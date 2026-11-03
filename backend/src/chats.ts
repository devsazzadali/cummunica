// Communica backend — chats + group admin (Step 7 skeleton).
// Implements ALGORITHMS §3 (chat-list ranking + unread counts) and
// §8 (group admin controls) against prisma/schema.prisma.
//
// Ranking rule (ALGORITHMS §3, chosen default — the schema has NO
// pinned flag on ChatMember, so no true "pinned" tier exists):
//   1. Favorites first — DIRECT chats only, via Contact.isFavorite
//      (ownerId=me, contactUserId=other member). GROUP chats never
//      rank as favorites; they sort by recency only.
//   2. Then recency — newest non-deleted message's createdAt, else
//      Chat.createdAt for chats with no messages.
// Archived chats are NOT in the main list; they have their own list.
// ChatMember.muted does NOT change ranking (notifications only).
//
// SKELETON NOTE: group creation / membership emits use the injected
// EmitFn (socket.ts). No pagination cursor is in ALGORITHMS §3, so
// listChats returns the full filtered list; production should page it.

import type {
  ChatMemberRecord,
  ChatRecord,
  ContactRecord,
  EmitFn,
  MessageRecord,
  NowFn,
  UserRecord,
} from "./types";
import { badRequest, conflict, forbidden, notFound } from "./errors";

export type ChatListFilter = "all" | "unread" | "favorites" | "groups";

export interface ChatListItem {
  chat: ChatRecord;
  lastMessage: MessageRecord | null;
  lastActivity: Date;
  unread: number;
  isFavorite: boolean;
}

/** Narrow Db surface this module needs (production: Prisma Client). */
export interface ChatsDb {
  findMembershipsByUser(userId: string, archived: boolean): Promise<ChatMemberRecord[]>;
  findChatById(chatId: string): Promise<ChatRecord | null>;
  findLastMessage(chatId: string): Promise<MessageRecord | null>;
  countUnread(chatId: string, userId: string, lastReadAt: Date | null): Promise<number>;
  findOtherMember(chatId: string, userId: string): Promise<ChatMemberRecord | null>;
  findContact(ownerId: string, contactUserId: string): Promise<ContactRecord | null>;
  findMembership(chatId: string, userId: string): Promise<ChatMemberRecord | null>;
  findMembers(chatId: string): Promise<ChatMemberRecord[]>;
  findUserById(userId: string): Promise<UserRecord | null>;
  findExistingDirectChat(userIdA: string, userIdB: string): Promise<ChatRecord | null>;
  isBlockedEitherDirection(userIdA: string, userIdB: string): Promise<boolean>;
  createChat(input: {
    type: "DIRECT" | "GROUP";
    title: string | null;
    createdById: string | null;
  }): Promise<ChatRecord>;
  createMember(input: {
    chatId: string;
    userId: string;
    role: "ADMIN" | "MEMBER";
  }): Promise<ChatMemberRecord>;
  updateMember(
    chatId: string,
    userId: string,
    patch: Partial<Pick<ChatMemberRecord, "role" | "muted" | "archived">>,
  ): Promise<ChatMemberRecord>;
  deleteMember(chatId: string, userId: string): Promise<void>;
  countAdmins(chatId: string): Promise<number>;
  /** ONE transaction: null CallLog.chatId rows, then delete the Chat
   *  (ALGORITHMS §8 — CallLog has no onDelete SetNull in the schema,
   *  so this explicit nulling preserves call history). */
  deleteGroupInTransaction(chatId: string): Promise<void>;
}

async function requireMembership(
  db: ChatsDb,
  chatId: string,
  userId: string,
): Promise<ChatMemberRecord> {
  const membership = await db.findMembership(chatId, userId);
  if (membership === null) throw forbidden("not a member of this chat");
  return membership;
}

async function requireGroupAdmin(
  db: ChatsDb,
  chatId: string,
  userId: string,
): Promise<void> {
  const membership = await requireMembership(db, chatId, userId);
  const chat = await db.findChatById(chatId);
  if (chat === null || chat.type !== "GROUP" || membership.role !== "ADMIN") {
    throw forbidden("group admin only");
  }
}

/** ALGORITHMS §3 getChatList (archived=false) / getArchivedChatList (archived=true). */
export async function listChats(
  db: ChatsDb,
  meId: string,
  filter: ChatListFilter,
  archived: boolean,
): Promise<ChatListItem[]> {
  const memberships = await db.findMembershipsByUser(meId, archived);
  const items: ChatListItem[] = [];
  for (const membership of memberships) {
    const chat = await db.findChatById(membership.chatId);
    if (chat === null) continue; // Defensive: membership without chat.
    const lastMessage = await db.findLastMessage(chat.id);
    const lastActivity = lastMessage !== null ? lastMessage.createdAt : chat.createdAt;
    const unread = await db.countUnread(chat.id, meId, membership.lastReadAt);

    let isFavorite = false;
    if (chat.type === "DIRECT") {
      const other = await db.findOtherMember(chat.id, meId);
      if (other !== null) {
        const contact = await db.findContact(meId, other.userId);
        isFavorite = contact !== null ? contact.isFavorite : false;
      }
    }
    items.push({ chat, lastMessage, lastActivity, unread, isFavorite });
  }

  let filtered = items;
  if (filter === "unread") filtered = filtered.filter((item) => item.unread > 0);
  if (filter === "favorites") filtered = filtered.filter((item) => item.isFavorite);
  if (filter === "groups") filtered = filtered.filter((item) => item.chat.type === "GROUP");

  filtered.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.lastActivity.getTime() - a.lastActivity.getTime();
  });
  return filtered;
}

/** Convenience wrapper: the Archived screen's own list (same ordering). */
export async function listArchivedChats(
  db: ChatsDb,
  meId: string,
): Promise<ChatListItem[]> {
  return listChats(db, meId, "all", true);
}

/** Create (or return the existing) 1:1 DIRECT chat with another user. */
export async function createDirectChat(
  db: ChatsDb,
  meId: string,
  otherUserId: string,
  now: NowFn = () => new Date(),
): Promise<ChatRecord> {
  void now;
  if (meId === otherUserId) throw badRequest("cannot create a chat with yourself");
  const other = await db.findUserById(otherUserId);
  if (other === null) throw notFound("user not found");
  // SKELETON chosen default (not in ALGORITHMS): no new chat with a
  // user blocked in either direction — search already excludes them.
  if (await db.isBlockedEitherDirection(meId, otherUserId)) {
    throw forbidden("cannot create a chat with a blocked user");
  }
  const existing = await db.findExistingDirectChat(meId, otherUserId);
  if (existing !== null) return existing;
  const chat = await db.createChat({ type: "DIRECT", title: null, createdById: meId });
  await db.createMember({ chatId: chat.id, userId: meId, role: "MEMBER" });
  await db.createMember({ chatId: chat.id, userId: otherUserId, role: "MEMBER" });
  return chat;
}

/** ALGORITHMS §8 createGroup: creator is always the first ADMIN;
 *  there is never a group with zero admins at creation. */
export async function createGroup(
  db: ChatsDb,
  creatorId: string,
  titleRaw: string,
  memberUserIds: string[],
  emit: EmitFn,
): Promise<ChatRecord> {
  const title = titleRaw.trim();
  if (title === "") throw badRequest("group name is required");
  const chat = await db.createChat({ type: "GROUP", title, createdById: creatorId });
  await db.createMember({ chatId: chat.id, userId: creatorId, role: "ADMIN" });
  const seen = new Set<string>([creatorId]);
  for (const userId of memberUserIds) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    const user = await db.findUserById(userId);
    if (user === null) continue; // Non-existent ids are skipped, per §8.
    await db.createMember({ chatId: chat.id, userId, role: "MEMBER" });
    emit(`user:${userId}`, "group:added", { chatId: chat.id });
  }
  return chat;
}

/** ALGORITHMS §8 addMember (admin only, 409 if already a member). */
export async function addMember(
  db: ChatsDb,
  actorId: string,
  chatId: string,
  newUserId: string,
  emit: EmitFn,
): Promise<ChatMemberRecord> {
  await requireGroupAdmin(db, chatId, actorId);
  const existing = await db.findMembership(chatId, newUserId);
  if (existing !== null) throw conflict("already a member");
  const member = await db.createMember({ chatId, userId: newUserId, role: "MEMBER" });
  emit(`chat:${chatId}`, "group:member-added", { chatId, userId: newUserId });
  return member;
}

/** ALGORITHMS §8 removeMember (admin only; never the last admin). */
export async function removeMember(
  db: ChatsDb,
  actorId: string,
  chatId: string,
  targetUserId: string,
  emit: EmitFn,
): Promise<void> {
  await requireGroupAdmin(db, chatId, actorId);
  const target = await db.findMembership(chatId, targetUserId);
  if (target === null) throw notFound("not a member");
  if (target.role === "ADMIN" && (await db.countAdmins(chatId)) === 1) {
    throw badRequest("cannot remove the last admin");
  }
  await db.deleteMember(chatId, targetUserId);
  emit(`chat:${chatId}`, "group:member-removed", { chatId, userId: targetUserId });
}

export async function promoteAdmin(
  db: ChatsDb,
  actorId: string,
  chatId: string,
  targetUserId: string,
): Promise<ChatMemberRecord> {
  await requireGroupAdmin(db, chatId, actorId);
  const target = await db.findMembership(chatId, targetUserId);
  if (target === null) throw notFound("not a member");
  return db.updateMember(chatId, targetUserId, { role: "ADMIN" });
}

export async function demoteAdmin(
  db: ChatsDb,
  actorId: string,
  chatId: string,
  targetUserId: string,
): Promise<ChatMemberRecord> {
  await requireGroupAdmin(db, chatId, actorId);
  const target = await db.findMembership(chatId, targetUserId);
  if (target === null || target.role !== "ADMIN") throw notFound("not an admin");
  if ((await db.countAdmins(chatId)) === 1) {
    throw badRequest("cannot demote the last admin");
  }
  return db.updateMember(chatId, targetUserId, { role: "MEMBER" });
}

/** ALGORITHMS §8 leaveGroup (last admin must promote or delete first). */
export async function leaveGroup(
  db: ChatsDb,
  meId: string,
  chatId: string,
  emit: EmitFn,
): Promise<void> {
  const membership = await requireMembership(db, chatId, meId);
  if (membership.role === "ADMIN" && (await db.countAdmins(chatId)) === 1) {
    throw badRequest("last admin must promote another admin or delete the group first");
  }
  await db.deleteMember(chatId, meId);
  emit(`chat:${chatId}`, "group:member-left", { chatId, userId: meId });
}

/** ALGORITHMS §8 deleteGroup: any ADMIN (not only the creator) may
 *  delete; DIRECT chats cannot be deleted this way; CallLog.chatId is
 *  nulled in the SAME transaction BEFORE deleting the Chat. */
export async function deleteGroup(
  db: ChatsDb,
  actorId: string,
  chatId: string,
  emit: EmitFn,
): Promise<void> {
  await requireGroupAdmin(db, chatId, actorId);
  const chat = await db.findChatById(chatId);
  if (chat === null) throw notFound("chat not found");
  if (chat.type !== "GROUP") {
    throw badRequest("only groups can be deleted this way");
  }
  const formerMembers = await db.findMembers(chatId);
  await db.deleteGroupInTransaction(chatId);
  for (const member of formerMembers) {
    emit(`user:${member.userId}`, "group:deleted", { chatId });
  }
}

/** Archive / unarchive a chat for the requester only (Step 5/6 UI's
 *  📥 Archive button maps here; restoring sets archived=false). */
export async function setArchived(
  db: ChatsDb,
  meId: string,
  chatId: string,
  archived: boolean,
): Promise<ChatMemberRecord> {
  await requireMembership(db, chatId, meId);
  return db.updateMember(chatId, meId, { archived });
}

/** Mute / unmute a chat for the requester only. Muted never changes
 *  ranking (ALGORITHMS §3); it only silences notifications later. */
export async function setMuted(
  db: ChatsDb,
  meId: string,
  chatId: string,
  muted: boolean,
): Promise<ChatMemberRecord> {
  await requireMembership(db, chatId, meId);
  return db.updateMember(chatId, meId, { muted });
}

/** Member list for the Group Info screen (Step 5/6 UI). */
export async function listMembers(
  db: ChatsDb,
  meId: string,
  chatId: string,
): Promise<ChatMemberRecord[]> {
  await requireMembership(db, chatId, meId);
  return db.findMembers(chatId);
}
