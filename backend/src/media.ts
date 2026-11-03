// Communica backend — media upload validation (Step 7 skeleton).
// Implements ALGORITHMS §6 exactly: validation order is
// type -> size -> server-side MIME check -> duration. A file that
// fails any step is rejected and never stored.
//
// Limits (ALGORITHMS §6, chosen defaults — not user decisions):
//   PHOTO: image/jpeg, image/png, image/webp, image/gif — 10 MB
//   VOICE: audio/mpeg, audio/ogg, audio/webm, audio/mp4 — 16 MB, max 300s
//   VIDEO: video/mp4, video/webm — 100 MB, max 600s
//   FILE:  application/pdf, text/plain, application/zip — 25 MB
//
// SKELETON HONESTY (read before wiring to production):
// - MIME sniffing here reads magic bytes only. It cannot distinguish
//   audio-only MP4 from video MP4 (same container), so an MP4 container
//   is accepted for both VOICE and VIDEO and mapped to the declared
//   type's MIME. Production MUST probe tracks server-side (e.g. ffprobe)
//   to verify audio/video content; do not rely on this alone.
// - Duration is validated against the limit, but this skeleton takes
//   durationSec from the caller, which in production MUST be the value
//   a server-side prober measured — never a client claim. Until a
//   prober is wired, VOICE/VIDEO uploads are only as trustworthy as
//   that measurement step.
// - Storage is an injected `store` function (server storage now,
//   S3-compatible storage later). NOT Supabase Storage.
// - Thumbnails are a best-effort injected hook: failure never fails
//   the upload itself (ALGORITHMS §6f).

import type { MessageType } from "./types";
import { ApiError, badRequest, forbidden } from "./errors";

export const MB = 1024 * 1024;

export interface MediaRule {
  allowedMimes: string[];
  maxSizeBytes: number;
  maxDurationSec: number | null; // null = no duration limit for this type
}

export const MEDIA_LIMITS: Record<string, MediaRule> = {
  PHOTO: {
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxSizeBytes: 10 * MB,
    maxDurationSec: null,
  },
  VOICE: {
    allowedMimes: ["audio/mpeg", "audio/ogg", "audio/webm", "audio/mp4"],
    maxSizeBytes: 16 * MB,
    maxDurationSec: 300,
  },
  VIDEO: {
    allowedMimes: ["video/mp4", "video/webm"],
    maxSizeBytes: 100 * MB,
    maxDurationSec: 600,
  },
  FILE: {
    allowedMimes: ["application/pdf", "text/plain", "application/zip"],
    maxSizeBytes: 25 * MB,
    maxDurationSec: null,
  },
};

const EXTENSION_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/zip": "zip",
};

/** Narrow Db/storage surface this module needs. */
export interface MediaDb {
  isChatMember(chatId: string, userId: string): Promise<boolean>;
}

/** Injected storage: production writes bytes to server disk / S3 and
 *  returns the URL the client later passes to sendMessage. */
export type StoreFn = (storagePath: string, bytes: Uint8Array) => Promise<string>;
export type ThumbnailFn = (storagePath: string) => Promise<void>;

/**
 * Server-side MIME sniffing from magic bytes. Never trusts the file
 * extension or the client-declared Content-Type alone (ALGORITHMS §6c).
 * Returns null when the bytes match no known signature.
 */
export function sniffMimeFromBytes(bytes: Uint8Array): string | null {
  const startsWith = (sig: number[]): boolean =>
    sig.every((byte, i) => bytes[i] === byte);
  const asciiAt = (offset: number, text: string): boolean =>
    text.split("").every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (asciiAt(0, "RIFF") && asciiAt(8, "WEBP")) return "image/webp";
  if (asciiAt(0, "ID3") || startsWith([0xff, 0xfb])) return "audio/mpeg";
  if (asciiAt(0, "OggS")) return "audio/ogg";
  if (startsWith([0x1a, 0x45, 0xdf, 0xa3])) return "audio/webm"; // EBML: see note below
  if (asciiAt(4, "ftyp")) return "video/mp4"; // MP4 container: see note below
  if (asciiAt(0, "%PDF")) return "application/pdf";
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  return null;
}

/**
 * Map a sniffed container MIME to the declared type's MIME where the
 * container is shared. EBML (WebM) audio vs video and MP4 audio vs
 * video cannot be told apart from magic bytes alone — production must
 * probe tracks (see header note). This mapping keeps the skeleton's
 * contract (mediaMime matches the declared type's table) explicit
 * instead of silently mislabelling.
 */
export function mapSniffedMime(
  sniffed: string,
  declaredType: "PHOTO" | "VOICE" | "VIDEO" | "FILE",
): string {
  if (sniffed === "audio/webm" && declaredType === "VIDEO") return "video/webm";
  if (sniffed === "video/mp4" && declaredType === "VOICE") return "audio/mp4";
  return sniffed;
}

/** Reject path traversal in server-generated path segments. */
export function assertSafePathSegment(value: string, label: string): void {
  if (
    value === "" ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("..")
  ) {
    throw badRequest(`invalid ${label}`);
  }
}

export interface UploadInput {
  chatId: string;
  declaredType: "PHOTO" | "VOICE" | "VIDEO" | "FILE";
  /** Raw file bytes. Size is checked before the whole file is trusted. */
  bytes: Uint8Array;
  /**
   * Duration in seconds, measured SERVER-SIDE in production (see header
   * note). Required for VOICE/VIDEO; ignored for PHOTO/FILE.
   */
  durationSec?: number | null;
}

export interface UploadResult {
  mediaUrl: string;
  mediaMime: string;
  durationSec: number | null;
  /** Storage filename key ONLY — NOT the §4 Message row id. The client
   *  passes mediaUrl (not this key) to sendMessage (ALGORITHMS §6e). */
  uploadKey: string;
  storagePath: string;
}

/**
 * ALGORITHMS §6 uploadMedia. Storage path naming discards
 * user-supplied filenames entirely (path traversal / collision risk):
 *   uploads/{senderId}/chats/{chatId}/{uploadKey}.{ext}
 * Status media uses the same validation with:
 *   uploads/{senderId}/statuses/{statusId}.{ext}
 * (see uploadStatusMedia below).
 */
export async function uploadMedia(
  db: MediaDb,
  senderId: string,
  input: UploadInput,
  store: StoreFn,
  generateKey: () => string,
  thumbnail: ThumbnailFn | null = null,
): Promise<UploadResult> {
  if (!(await db.isChatMember(input.chatId, senderId))) {
    throw forbidden("not a member of this chat");
  }
  const rule = MEDIA_LIMITS[input.declaredType];
  if (rule === undefined) throw badRequest("unsupported media type");

  if (input.bytes.length > rule.maxSizeBytes) {
    throw new ApiError(413, "file_too_large", "file too large for this media type");
  }

  const sniffed = sniffMimeFromBytes(input.bytes);
  if (sniffed === null) {
    throw badRequest("file content does not match an allowed type");
  }
  const actualMime = mapSniffedMime(sniffed, input.declaredType);
  if (!rule.allowedMimes.includes(actualMime)) {
    throw badRequest("file content does not match an allowed type");
  }

  let durationSec: number | null = null;
  if (input.declaredType === "VOICE" || input.declaredType === "VIDEO") {
    if (input.durationSec === undefined || input.durationSec === null) {
      throw badRequest("media duration is required for voice and video");
    }
    durationSec = input.durationSec;
    if (rule.maxDurationSec !== null && durationSec > rule.maxDurationSec) {
      throw badRequest("media is longer than the allowed duration");
    }
  }

  const extension = EXTENSION_FOR_MIME[actualMime];
  if (extension === undefined) throw badRequest("file content does not match an allowed type");
  const uploadKey = generateKey();
  assertSafePathSegment(senderId, "sender id");
  assertSafePathSegment(input.chatId, "chat id");
  assertSafePathSegment(uploadKey, "upload key");
  const storagePath = `uploads/${senderId}/chats/${input.chatId}/${uploadKey}.${extension}`;
  const mediaUrl = await store(storagePath, input.bytes);

  // Thumbnail best-effort for PHOTO/VIDEO; failure never fails upload.
  if ((input.declaredType === "PHOTO" || input.declaredType === "VIDEO") && thumbnail !== null) {
    try {
      await thumbnail(storagePath);
    } catch {
      // Deliberately swallowed per ALGORITHMS §6f.
    }
  }
  return { mediaUrl, mediaMime: actualMime, durationSec, uploadKey, storagePath };
}

/** Status media (ALGORITHMS §6 note): same table, statuses/ path. */
export async function uploadStatusMedia(
  senderId: string,
  statusId: string,
  declaredType: "PHOTO" | "VOICE" | "VIDEO" | "FILE",
  bytes: Uint8Array,
  durationSec: number | null,
  store: StoreFn,
  generateKey: () => string,
): Promise<UploadResult> {
  const rule = MEDIA_LIMITS[declaredType];
  if (rule === undefined) throw badRequest("unsupported media type");
  if (bytes.length > rule.maxSizeBytes) {
    throw new ApiError(413, "file_too_large", "file too large for this media type");
  }
  const sniffed = sniffMimeFromBytes(bytes);
  if (sniffed === null) throw badRequest("file content does not match an allowed type");
  const actualMime = mapSniffedMime(sniffed, declaredType);
  if (!rule.allowedMimes.includes(actualMime)) {
    throw badRequest("file content does not match an allowed type");
  }
  let checkedDuration: number | null = null;
  if ((declaredType === "VOICE" || declaredType === "VIDEO") && durationSec !== null) {
    if (rule.maxDurationSec !== null && durationSec > rule.maxDurationSec) {
      throw badRequest("media is longer than the allowed duration");
    }
    checkedDuration = durationSec;
  }
  const extension = EXTENSION_FOR_MIME[actualMime];
  if (extension === undefined) throw badRequest("file content does not match an allowed type");
  assertSafePathSegment(senderId, "sender id");
  assertSafePathSegment(statusId, "status id");
  const storagePath = `uploads/${senderId}/statuses/${statusId}.${extension}`;
  void generateKey; // Status path uses the StatusUpdate id, not a new key.
  const mediaUrl = await store(storagePath, bytes);
  return { mediaUrl, mediaMime: actualMime, durationSec: checkedDuration, uploadKey: statusId, storagePath };
}

/** MessageType values that accept an upload (SYSTEM and TEXT do not). */
export function isUploadableType(type: MessageType): boolean {
  return type === "PHOTO" || type === "VOICE" || type === "VIDEO" || type === "FILE";
}
