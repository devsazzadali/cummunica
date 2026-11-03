// Media upload rules — the single source of caps used by /api/media
// and by message validation. Server storage for now (public/uploads);
// S3/object storage is the documented production follow-up, NOT
// claimed here. Files are NEVER stored under a user-supplied path.
import { ApiError, badRequest } from "./errors";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;   // 5 MB
export const MAX_VOICE_BYTES = 10 * 1024 * 1024;  // 10 MB
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;  // 20 MB
export const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 10 MB

const ALLOWED: Record<string, { kinds: string[]; max: number; exts: string[] }> = {
  "image/jpeg": { kinds: ["PHOTO"], max: MAX_PHOTO_BYTES, exts: ["jpg", "jpeg"] },
  "image/png": { kinds: ["PHOTO"], max: MAX_PHOTO_BYTES, exts: ["png"] },
  "image/webp": { kinds: ["PHOTO"], max: MAX_PHOTO_BYTES, exts: ["webp"] },
  "image/gif": { kinds: ["PHOTO"], max: MAX_PHOTO_BYTES, exts: ["gif"] },
  "audio/webm": { kinds: ["VOICE"], max: MAX_VOICE_BYTES, exts: ["webm"] },
  "audio/mpeg": { kinds: ["VOICE"], max: MAX_VOICE_BYTES, exts: ["mp3"] },
  "audio/ogg": { kinds: ["VOICE"], max: MAX_VOICE_BYTES, exts: ["ogg"] },
  "audio/wav": { kinds: ["VOICE"], max: MAX_VOICE_BYTES, exts: ["wav"] },
  "audio/mp4": { kinds: ["VOICE"], max: MAX_VOICE_BYTES, exts: ["m4a"] },
  "video/mp4": { kinds: ["VIDEO"], max: MAX_VIDEO_BYTES, exts: ["mp4"] },
  "video/webm": { kinds: ["VIDEO"], max: MAX_VIDEO_BYTES, exts: ["webm"] },
};

export function mediaKindForMime(mime: string): string | null {
  const rule = ALLOWED[mime];
  return rule ? rule.kinds[0] : null;
}

/** Allowlisted MIME types per message kind (mirror of ALLOWED above).
 *  Used by message validation so mediaMime must match the message type. */
export const MEDIA_MIMES_BY_KIND: Record<string, string[]> = {
  PHOTO: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  VOICE: ["audio/webm", "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4"],
  VIDEO: ["video/mp4", "video/webm"],
  // /api/media never produces a FILE kind today; a FILE message may
  // only carry an allowlisted upload MIME, never an arbitrary one.
  FILE: Object.keys(ALLOWED),
};

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((b, i) => bytes[i] === b);
}
function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  return text.split("").every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));
}

/** Content-sniff an upload's bytes against its declared MIME (F11).
 *  The client-supplied file.type is NEVER trusted on its own: a
 *  renamed script/text file declared as image/jpeg is rejected even
 *  though the forced extension would have been .jpg. Throws 400 on
 *  mismatch or on bytes too short to identify. Known limitation,
 *  stated honestly: MP4/M4A and audio/video WebM share a container
 *  family (ftyp box / EBML header), so sniffing proves the container,
 *  not the codec inside — codec-level parsing is out of scope here. */
export function sniffUpload(bytes: Uint8Array, declaredMime: string): void {
  if (!ALLOWED[declaredMime]) throw badRequest("file type is not allowed");
  const ok = (() => {
    switch (declaredMime) {
      case "image/jpeg": return bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff]);
      case "image/png": return bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      case "image/webp": return bytes.length >= 12 && asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP");
      case "image/gif": return bytes.length >= 6 && (asciiAt(bytes, 0, "GIF87a") || asciiAt(bytes, 0, "GIF89a"));
      case "audio/mpeg": return bytes.length >= 3 && (asciiAt(bytes, 0, "ID3") || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0));
      case "audio/ogg": return bytes.length >= 4 && asciiAt(bytes, 0, "OggS");
      case "audio/wav": return bytes.length >= 12 && asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WAVE");
      case "audio/webm": case "video/webm": return bytes.length >= 4 && startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
      case "audio/mp4": case "video/mp4": return bytes.length >= 8 && asciiAt(bytes, 4, "ftyp");
      default: return false;
    }
  })();
  if (!ok) throw badRequest("file content does not match its declared type");
}

/** Throws 400 on disallowed type or oversize. Never trusts the client. */
export function validateUpload(mime: string, size: number): { kind: string; ext: string } {
  const rule = ALLOWED[mime];
  if (!rule) throw badRequest("file type is not allowed");
  if (size > rule.max) throw badRequest(`file is too large (max ${Math.round(rule.max / 1024 / 1024)} MB)`);
  if (size <= 0) throw badRequest("file is empty");
  return { kind: rule.kinds[0], ext: rule.exts[0] };
}

/** Safe filename: strips directories and unsafe chars, then prefixes
 *  a timestamp + random token. A name like "../../etc/passwd" can
 *  never escape the uploads directory. */
export function safeUploadFilename(original: string, ext: string): string {
  const base = original.split(/[\\/]/).pop() ?? "upload";
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 60) || "upload";
  const stem = clean.replace(/\.[a-zA-Z0-9]+$/, "") || "upload";
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${rand}-${stem}.${ext}`;
}

export function validateTextField(value: string, field: string, max: number): void {
  if (value.length > max) throw new ApiError(400, "bad_request", `${field} is too long (max ${max} characters)`);
}
