// Communica backend — shared types (Step 7 skeleton).
//
// These interfaces mirror ~/workspace/communica/prisma/schema.prisma
// EXACTLY (model and field names as written there). The schema itself
// is NOT edited by this step. Production code implements the small
// per-module Db interfaces (defined in each src/*.ts file) on top of
// Prisma Client; these skeletons never import @prisma/client directly,
// which is why they type-check with no node_modules installed.
//
// SKELETON NOTE: nothing here is production-hardened. In particular
// there is no rate limiting, no refresh-token rotation, and no
// end-to-end encryption in this step (transport encryption HTTPS/WSS
// + JWT only, per COMMUNICA_PLAN.md).

export type CompanionRole = "Boyfriend" | "Girlfriend";
export type ChatType = "DIRECT" | "GROUP";
export type MessageType = "TEXT" | "PHOTO" | "VOICE" | "VIDEO" | "FILE" | "SYSTEM";
export type MemberRole = "ADMIN" | "MEMBER";
export type CallType = "AUDIO" | "VIDEO";
export type CallStatus = "MISSED" | "ACCEPTED" | "DECLINED" | "ENDED" | "CANCELLED";

/** User row shape (subset used by these skeletons). */
export interface UserRecord {
  id: string;
  username: string; // lower-cased @handle, 3-20 chars, letters/numbers/_
  displayName: string;
  /** Random 8-digit IN-APP identifier. NOT a phone number: it cannot
   *  place or receive phone calls. */
  communicaId: string;
  passwordHash: string;
  avatarUrl: string | null;
  bio: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactRecord {
  id: string;
  ownerId: string;
  contactUserId: string;
  nickname: string | null;
  isFavorite: boolean;
  isBlocked: boolean;
  accepted: boolean;
  createdAt: Date;
}

export interface ChatRecord {
  id: string;
  type: ChatType;
  title: string | null; // group name; DIRECT chats use the other member's displayName
  avatarUrl: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMemberRecord {
  id: string;
  chatId: string;
  userId: string;
  role: MemberRole;
  muted: boolean;
  archived: boolean;
  lastReadAt: Date | null;
  joinedAt: Date;
}

export interface MessageRecord {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  durationSec: number | null;
  replyToId: string | null;
  editedAt: Date | null;
  deletedForAll: boolean;
  createdAt: Date;
}

export interface MessageReadRecord {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

export interface ReactionRecord {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface StatusUpdateRecord {
  id: string;
  userId: string;
  mediaUrl: string | null;
  text: string | null;
  expiresAt: Date; // createdAt + 24 hours
  createdAt: Date;
}

export interface CallLogRecord {
  id: string;
  chatId: string | null;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: CallStatus;
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
}

/** SAZMU AI companion settings, per user. The chatbot itself is a
 *  system contact labelled AI — never a row in User. */
export interface CompanionSettingRecord {
  id: string;
  userId: string;
  role: CompanionRole;
  /** Boyfriend default: Sazzad. Girlfriend: a preset or a custom name
   *  the user chose. No girlfriend default is invented. */
  callName: string;
  petName: string | null; // what the companion calls the user
  tone: string; // schema default "soft"
  language: string; // Bengali | Banglish | English (schema default "Bengali")
  updatedAt: Date;
}

export interface UserMemoryRecord {
  id: string;
  userId: string;
  key: string; // e.g. favourite_food, job, mood_note
  value: string;
  updatedAt: Date;
}

/**
 * Public profile — the ONLY fields search may ever return
 * (ALGORITHMS §2). Deliberately has NO id, NO passwordHash,
 * NO lastSeenAt, NO createdAt, NO updatedAt.
 */
export interface PublicProfile {
  username: string;
  displayName: string;
  communicaId: string;
  avatarUrl: string | null;
  bio: string | null;
}

/** User object returned by auth endpoints: never includes passwordHash. */
export type PublicUser = Omit<UserRecord, "passwordHash">;

/** Emit a realtime event to a Socket.io room. Production wires this
 *  to the Socket.io server (see socket.ts); skeletons take it as an
 *  injected function so they never import socket.io directly. */
export type EmitFn = (room: string, event: string, payload: unknown) => void;

/** Clock injection (default: () => new Date()). The server, not the
 *  client, is the source of truth for timestamps (ALGORITHMS). */
export type NowFn = () => Date;

/**
 * Password hashing adapter. Production wires bcrypt with cost 12
 * (ALGORITHMS §1 chosen default). The cost lives in the wiring code,
 * not in these skeletons, and no password value is ever logged.
 */
export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hash: string): Promise<boolean>;
}

/** JWT payload (ALGORITHMS §1: userId + username, 7-day lifetime). */
export interface JwtPayload {
  userId: string;
  username: string;
}

/**
 * JWT adapter. Production wires jsonwebtoken with the secret read
 * from the secure vault (env var name JWT_SECRET — never a value in
 * any file). `expiresInDays` is 7 per ALGORITHMS §1.
 */
export interface TokenSigner {
  sign(payload: JwtPayload, expiresInDays: number): string;
  verify(token: string): JwtPayload;
}
