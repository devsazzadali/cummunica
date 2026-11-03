export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isBlockedEitherDirection, resolveUserId } from "@/lib/db";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { handleError, json, readJson, asString, asStringArray } from "@/lib/http";
import { validateLengths } from "@/lib/validation";

/** GET /api/chats?filter=all|unread|favorites|groups&archived=true|false
 *  Ranking (ALGORITHMS §3): DIRECT favorites first (via
 *  Contact.isFavorite), then recency (newest non-deleted message, else
 *  Chat.createdAt). Archived chats are a separate list. Muted never
 *  changes ranking. */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const params = new URL(request.url).searchParams;
    const filter = params.get("filter") ?? "all";
    const archived = params.get("archived") === "true";
    const memberships = await prisma.chatMember.findMany({
      where: { userId: auth.userId, archived },
      include: {
        chat: {
          include: {
            members: { include: { user: { select: { id: true, username: true, displayName: true, communicaId: true } } } },
          },
        },
      },
    });
    const items = [];
    for (const m of memberships) {
      const lastMessage = await prisma.message.findFirst({
        where: { chatId: m.chatId, deletedForAll: false },
        orderBy: { createdAt: "desc" },
      });
      const lastActivity = lastMessage !== null ? lastMessage.createdAt : m.chat.createdAt;
      const unread = await prisma.message.count({
        where: {
          chatId: m.chatId,
          senderId: { not: auth.userId },
          deletedForAll: false,
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      let isFavorite = false;
      if (m.chat.type === "DIRECT") {
        const other = m.chat.members.find((mem) => mem.userId !== auth.userId);
        if (other) {
          const contact = await prisma.contact.findUnique({
            where: { ownerId_contactUserId: { ownerId: auth.userId, contactUserId: other.userId } },
          });
          isFavorite = contact?.isFavorite ?? false;
        }
      }
      items.push({
        chat: { id: m.chat.id, type: m.chat.type, title: m.chat.title, createdAt: m.chat.createdAt },
        members: m.chat.members.map((mem) => ({
          userId: mem.userId, role: mem.role,
          username: mem.user.username, displayName: mem.user.displayName, communicaId: mem.user.communicaId,
        })),
        lastMessage: lastMessage
          ? { id: lastMessage.id, type: lastMessage.type, text: lastMessage.text, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt }
          : null,
        lastActivity, unread, isFavorite,
      });
    }
    let filtered = items;
    if (filter === "unread") filtered = filtered.filter((i) => i.unread > 0);
    if (filter === "favorites") filtered = filtered.filter((i) => i.isFavorite);
    if (filter === "groups") filtered = filtered.filter((i) => i.chat.type === "GROUP");
    filtered.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });
    return json({ chats: filtered });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/chats — create (or return the existing) DIRECT chat, or
 *  create a GROUP (creator is first ADMIN, per ALGORITHMS §8).
 *  Body DIRECT: { type:"DIRECT", otherUserId } or { otherIdentifier }.
 *  Body GROUP: { type:"GROUP", title, memberUserIds?, memberIdentifiers? }. */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const type = asString(body.type) || "DIRECT";

    if (type === "DIRECT") {
      const otherUserId = asString(body.otherUserId)
        ? asString(body.otherUserId)
        : await resolveUserId(prisma, asString(body.otherIdentifier));
      if (otherUserId === auth.userId) throw badRequest("cannot create a chat with yourself");
      const other = await prisma.user.findUnique({ where: { id: otherUserId } });
      if (other === null) throw notFound("user not found");
      if (await isBlockedEitherDirection(prisma, auth.userId, otherUserId)) {
        throw forbidden("cannot create a chat with a blocked user");
      }
      const myChats = await prisma.chatMember.findMany({
        where: { userId: auth.userId },
        include: { chat: { include: { members: true } } },
      });
      const existing = myChats.find(
        (mc) => mc.chat.type === "DIRECT" && mc.chat.members.some((mem) => mem.userId === otherUserId),
      );
      if (existing) return json({ chat: { id: existing.chat.id, type: existing.chat.type }, existing: true });
      const chat = await prisma.chat.create({ data: { type: "DIRECT", createdById: auth.userId } });
      await prisma.chatMember.createMany({
        data: [
          { chatId: chat.id, userId: auth.userId, role: "MEMBER" },
          { chatId: chat.id, userId: otherUserId, role: "MEMBER" },
        ],
      });
      return json({ chat: { id: chat.id, type: chat.type }, existing: false }, 201);
    }

    if (type === "GROUP") {
      const title = asString(body.title).trim();
      validateLengths({ title });
      if (title === "") throw badRequest("group name is required");
      // F7: resolve members FIRST and refuse the whole creation if
      // any resolved member is blocked in either direction — the
      // same check admin-add (members route) and DIRECT creation
      // already apply. Checked before the chat row is created, so a
      // refused creation leaves no orphan group behind.
      const seen = new Set<string>([auth.userId]);
      const memberIds: string[] = [];
      for (const id of asStringArray(body.memberUserIds)) memberIds.push(id);
      for (const ident of asStringArray(body.memberIdentifiers)) {
        try { memberIds.push(await resolveUserId(prisma, ident)); } catch { /* skipped, per §8 */ }
      }
      for (const userId of memberIds) {
        if (seen.has(userId)) continue;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user !== null && await isBlockedEitherDirection(prisma, auth.userId, userId)) {
          throw forbidden("cannot add a blocked user to a group");
        }
      }
      const chat = await prisma.chat.create({ data: { type: "GROUP", title, createdById: auth.userId } });
      await prisma.chatMember.create({ data: { chatId: chat.id, userId: auth.userId, role: "ADMIN" } });
      for (const userId of memberIds) {
        if (seen.has(userId)) continue;
        seen.add(userId);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user === null) continue; // Non-existent ids are skipped, per §8.
        await prisma.chatMember.create({ data: { chatId: chat.id, userId, role: "MEMBER" } });
      }
      return json({ chat: { id: chat.id, type: chat.type, title: chat.title } }, 201);
    }
    throw badRequest("chat type is invalid");
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/chats — membership-only. { chatId, archived } toggles
 *  archive for the CALLER's membership row only (never another
 *  member's). { chatId, action:"leave" } removes the caller. */
export async function PATCH(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const chatId = asString(body.chatId);
    const membership = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: auth.userId } } });
    if (membership === null) throw forbidden("not a member of this chat");
    if (body.action === "leave") {
      // F17: same last-admin protection as DELETE /api/chats/members.
      // A last admin cannot orphan a group via this route; for a
      // DIRECT chat (no admin role) or a sole-member group, leaving
      // is still allowed.
      const chatRow = await prisma.chat.findUnique({ where: { id: chatId }, include: { members: true } });
      if (chatRow !== null && chatRow.type === "GROUP" && membership.role === "ADMIN"
        && chatRow.members.filter((m) => m.role === "ADMIN").length <= 1 && chatRow.members.length > 1) {
        throw badRequest("the last admin cannot leave while other members remain — make another member admin first");
      }
      await prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId: auth.userId } } });
      return json({ left: true });
    }
    if (typeof body.archived !== "boolean") throw badRequest("archived must be a boolean");
    await prisma.chatMember.update({ where: { chatId_userId: { chatId, userId: auth.userId } }, data: { archived: body.archived } });
    return json({ archived: body.archived });
  } catch (err) {
    return handleError(err);
  }
}
