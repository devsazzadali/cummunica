// Communica backend — messages (Step 7 skeleton).
// Implements ALGORITHMS §4 (send / deliver / read / polling) PLUS the
// message-edit endpoint the Step 5/6 UI does NOT have yet
// (UI_TEST_REPORT.md limitation L1): edit sets Message.editedAt, so
// the UI can add an edit control in a later phase. Edit is real here,
// not a demo placeholder.
//
// Delivery meaning (ALGORITHMS §4e): "delivered" = saved in the
// database AND emitted to room chat:{chatId}. It does NOT mean "read"
// (that is markRead) and does NOT mean the recipient's device acked.
// If the recipient's socket is down, the message is still saved and
// is delivered on next load or poll — nothing is lost.
//
// SKELETON NOTES:
// - Edit history is NOT stored: the schema has only Message.editedAt,
//   no history table, so an edit overwrites text and stamps editedAt.
// - Delete-for-all sets deletedForAll=true only; clients must render
//   a placeholder for such messages (fields are kept, not wiped).
// - Delete is sender-only in this skeleton (group-admin delete is a
//   later-phase decision, not in ALGORITHMS).

import type {
  ChatMemberRecord,
  EmitFn,
  MessageRecord,
  MessageType,
  NowFn,
  ReactionRecord,
} from "./types";
import { badRequest, forbidden, notFound } from "./errors";

/** Narrow Db surface this module needs (production: Prisma Client). */
export interface MessagesDb {
  findMembership(chatId: string, userId: string): Promise<ChatMemberRecord | null>;
  findMessageById(messageId: string): Promise<MessageRecord | null>;
  createMessage(input: {
    chatId: string;
    senderId: string;
    type: MessageType;
    text: string | null;
    mediaUrl: string | null;
    mediaMime: string | null;
    durationSec: number | null;
    replyToId: string | null;
  }): Promise<MessageRecord>;
  updateChatUpdatedAt(chatId: string, at: Date): Promise<void>;
  updateMemberLastRead(chatId: string, userId: string, at: Date): Promise<void>;
  listMessages(chatId: string, limit: number, beforeId: string | null): Promise<MessageRecord[]>;
  listMessagesSince(chatId: string, since: Date): Promise<MessageRecord[]>;
  upsertMessageRead(messageId: string, userId: string, readAt: Date): Promise<void>;
  updateMessage(
    messageId: string,
    patch: Partial<Pick<MessageRecord, "text" | "editedAt" | "deletedForAll">>,
  ): Promise<MessageRecord>;
  addReaction(messageId: string, userId: string, emoji: string): Promise<ReactionRecord>;
  removeReaction(messageId: string, userId: string, emoji: string): Promise<void>;
  listReactions(messageId: string): Promise<ReactionRecord[]>;
}

async function requireMembership(
  db: MessagesDb,
  chatId: string,
  userId: string,
): Promise<ChatMemberRecord> {
  const membership = await db.findMembership(chatId, userId);
  if (membership === null) throw forbidden("not a member of this chat");
  return membership;
}

export interface SendMessageInput {
  chatId: string;
  type: MessageType;
  text?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  durationSec?: number | null;
  replyToId?: string | null;
}

/** ALGORITHMS §4 sendMessage. Returns the created message (HTTP 201). */
export async function sendMessage(
  db: MessagesDb,
  senderId: string,
  input: SendMessageInput,
  emit: EmitFn,
  now: NowFn = () => new Date(),
): Promise<MessageRecord> {
  const membership = await requireMembership(db, input.chatId, senderId);

  if (input.type === "TEXT" && (input.text === undefined || input.text === null || input.text.trim() === "")) {
    throw badRequest("text message must not be empty");
  }
  if (
    (input.type === "PHOTO" || input.type === "VOICE" || input.type === "VIDEO" || input.type === "FILE") &&
    (input.mediaUrl === undefined || input.mediaUrl === null || input.mediaUrl === "")
  ) {
    throw badRequest("media message requires an uploaded file (see media.ts)");
  }
  if (input.replyToId !== undefined && input.replyToId !== null) {
    const parent = await db.findMessageById(input.replyToId);
    if (parent === null || parent.chatId !== input.chatId || parent.deletedForAll) {
      throw badRequest("replied-to message not found in this chat");
    }
  }

  const message = await db.createMessage({
    chatId: input.chatId,
    senderId,
    type: input.type,
    text: input.text ?? null,
    mediaUrl: input.mediaUrl ?? null,
    mediaMime: input.mediaMime ?? null,
    durationSec: input.durationSec ?? null,
    replyToId: input.replyToId ?? null,
  });
  await db.updateChatUpdatedAt(input.chatId, now());
  // The sender's own read position advances past their own message.
  void membership;
  await db.updateMemberLastRead(input.chatId, senderId, now());
  emit(`chat:${input.chatId}`, "message:new", message);
  return message;
}

/** List messages in a chat (newest-first page; pass beforeId to page
 *  backwards). Deleted-for-all messages are returned with their flag
 *  set — clients render a placeholder for them. */
export async function listMessages(
  db: MessagesDb,
  meId: string,
  chatId: string,
  limit: number,
  beforeId: string | null = null,
): Promise<MessageRecord[]> {
  await requireMembership(db, chatId, meId);
  const safeLimit = Math.min(Math.max(limit, 1), 100); // SKELETON chosen default
  return db.listMessages(chatId, safeLimit, beforeId);
}

/** ALGORITHMS §4 pollMessages: polling fallback while the socket is
 *  down. The client calls this on reconnect, then every 15 seconds
 *  while the socket is down, and stops once it reconnects. */
export async function pollMessages(
  db: MessagesDb,
  meId: string,
  chatId: string,
  since: Date,
): Promise<MessageRecord[]> {
  await requireMembership(db, chatId, meId);
  return db.listMessagesSince(chatId, since);
}

/** ALGORITHMS §4 markRead. Idempotent via MessageRead's
 *  @@unique([messageId, userId]). The watermark never moves backwards. */
export async function markRead(
  db: MessagesDb,
  meId: string,
  chatId: string,
  messageId: string,
  emit: EmitFn,
  now: NowFn = () => new Date(),
): Promise<void> {
  const membership = await requireMembership(db, chatId, meId);
  const message = await db.findMessageById(messageId);
  if (message === null || message.chatId !== chatId || message.senderId === meId) {
    throw badRequest("cannot mark own or missing message as read");
  }
  const readAt = now();
  await db.upsertMessageRead(messageId, meId, readAt);
  if (membership.lastReadAt === null || message.createdAt > membership.lastReadAt) {
    await db.updateMemberLastRead(chatId, meId, message.createdAt);
  }
  emit(`chat:${chatId}`, "message:read", { messageId, readerId: meId, readAt });
}

/**
 * NEW in Step 7 (fills UI limitation L1): edit a message.
 * Rules (skeleton, stated honestly — ALGORITHMS does not specify edit
 * rules, the schema only provides Message.editedAt):
 * - Only the sender may edit, and only TEXT messages.
 * - A message deleted for all cannot be edited.
 * - Empty text is rejected; a successful edit sets text + editedAt.
 * Clients show an "edited" marker whenever editedAt is non-null.
 */
export async function editMessage(
  db: MessagesDb,
  meId: string,
  chatId: string,
  messageId: string,
  newText: string,
  emit: EmitFn,
  now: NowFn = () => new Date(),
): Promise<MessageRecord> {
  await requireMembership(db, chatId, meId);
  const message = await db.findMessageById(messageId);
  if (message === null || message.chatId !== chatId) throw notFound("message not found");
  if (message.senderId !== meId) throw forbidden("only the sender can edit a message");
  if (message.deletedForAll) throw badRequest("cannot edit a deleted message");
  if (message.type !== "TEXT") throw badRequest("only text messages can be edited");
  if (newText.trim() === "") throw badRequest("text message must not be empty");
  const updated = await db.updateMessage(messageId, { text: newText, editedAt: now() });
  emit(`chat:${chatId}`, "message:edited", updated);
  return updated;
}

/** Delete for everyone: sender-only, sets deletedForAll=true, emits
 *  message:deleted. Readers render a placeholder for flagged messages. */
export async function deleteForAll(
  db: MessagesDb,
  meId: string,
  chatId: string,
  messageId: string,
  emit: EmitFn,
): Promise<MessageRecord> {
  await requireMembership(db, chatId, meId);
  const message = await db.findMessageById(messageId);
  if (message === null || message.chatId !== chatId) throw notFound("message not found");
  if (message.senderId !== meId) throw forbidden("only the sender can delete a message");
  const updated = await db.updateMessage(messageId, { deletedForAll: true });
  emit(`chat:${chatId}`, "message:deleted", { messageId, chatId });
  return updated;
}

/** Add a reaction (Reaction has @@unique([messageId, userId, emoji]);
 *  re-adding the same emoji is a no-op in production upsert terms). */
export async function addReaction(
  db: MessagesDb,
  meId: string,
  chatId: string,
  messageId: string,
  emoji: string,
  emit: EmitFn,
): Promise<ReactionRecord> {
  await requireMembership(db, chatId, meId);
  const message = await db.findMessageById(messageId);
  if (message === null || message.chatId !== chatId || message.deletedForAll) {
    throw badRequest("cannot react to a missing or deleted message");
  }
  if (emoji.trim() === "") throw badRequest("reaction emoji is required");
  const reaction = await db.addReaction(messageId, meId, emoji);
  emit(`chat:${chatId}`, "message:reaction", reaction);
  return reaction;
}

export async function removeReaction(
  db: MessagesDb,
  meId: string,
  chatId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  await requireMembership(db, chatId, meId);
  await db.removeReaction(messageId, meId, emoji);
}

export async function listReactions(
  db: MessagesDb,
  meId: string,
  chatId: string,
  messageId: string,
): Promise<ReactionRecord[]> {
  await requireMembership(db, chatId, meId);
  const message = await db.findMessageById(messageId);
  if (message === null || message.chatId !== chatId) throw notFound("message not found");
  return db.listReactions(messageId);
}
