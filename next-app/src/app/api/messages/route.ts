export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";
import { validateSendMessage, validateLengths } from "@/lib/validation";
import { isBlockedEitherDirection } from "@/lib/db";

async function requireMembership(prisma: ReturnType<typeof getPrisma>, chatId: string, userId: string) {
  const membership = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (membership === null) throw forbidden("not a member of this chat");
  return membership;
}

/** F19 redaction: a deleted-for-all message must never leak its
 *  content through the API, even to members. GET strips the fields
 *  (defence in depth — DELETE also nulls them in the row, so old
 *  rows flagged before this fix are redacted too). */
function redactDeleted<T extends { deletedForAll: boolean }>(row: T): T {
  if (!row.deletedForAll) return row;
  return { ...row, text: null, mediaUrl: null, mediaMime: null } as T;
}

/** GET /api/messages?chatId=&limit=&beforeId=&since=ISO
 *  Membership-gated. Newest-first page (beforeId pages backwards);
 *  since= gives the polling fallback (ALGORITHMS §4). Deleted-for-all
 *  messages are returned redacted (text/media nulled) — clients
 *  render a placeholder and cannot read the content back (F19). */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const params = new URL(request.url).searchParams;
    const chatId = params.get("chatId") ?? "";
    if (chatId === "") throw badRequest("chatId is required");
    await requireMembership(prisma, chatId, auth.userId);
    const since = params.get("since");
    if (since) {
      const sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) throw badRequest("since is invalid");
      const rows = await prisma.message.findMany({
        where: { chatId, createdAt: { gt: sinceDate } },
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { username: true, displayName: true } }, reactions: { select: { emoji: true, userId: true } }, reads: { select: { userId: true } } },
      });
      return json({ messages: rows.map(redactDeleted) });
    }
    const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "50", 10) || 50, 1), 100);
    const beforeId = params.get("beforeId");
    let beforeCreatedAt: Date | null = null;
    if (beforeId) {
      const before = await prisma.message.findUnique({ where: { id: beforeId } });
      if (before === null || before.chatId !== chatId) throw badRequest("beforeId is invalid");
      beforeCreatedAt = before.createdAt;
    }
    const rows = await prisma.message.findMany({
      where: { chatId, ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { sender: { select: { username: true, displayName: true } }, reactions: { select: { emoji: true, userId: true } }, reads: { select: { userId: true } } },
    });
    return json({ messages: rows.map(redactDeleted) });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/messages — send a message (201), or mark-read when
 *  body.action === "read". Send rules (ALGORITHMS §4): membership
 *  gate, TEXT non-empty, media requires mediaUrl, replyTo must exist
 *  in the same chat and not be deleted-for-all. The sender's read
 *  watermark advances past their own message. */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const chatId = asString(body.chatId);
    if (chatId === "") throw badRequest("chatId is required");
    const membership = await requireMembership(prisma, chatId, auth.userId);

    if (body.action === "read") {
      const messageId = asString(body.messageId);
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (message === null || message.chatId !== chatId || message.senderId === auth.userId) {
        throw badRequest("cannot mark own or missing message as read");
      }
      await prisma.messageRead.upsert({
        where: { messageId_userId: { messageId, userId: auth.userId } },
        update: { readAt: new Date() },
        create: { messageId, userId: auth.userId },
      });
      if (membership.lastReadAt === null || message.createdAt > membership.lastReadAt) {
        await prisma.chatMember.update({
          where: { chatId_userId: { chatId, userId: auth.userId } },
          data: { lastReadAt: message.createdAt },
        });
      }
      return json({ read: true });
    }

    const type = asString(body.type) || "TEXT";
    validateSendMessage({ type, text: typeof body.text === "string" ? body.text : null, mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : null, mediaMime: typeof body.mediaMime === "string" ? body.mediaMime : null });
    validateLengths({ text: typeof body.text === "string" ? body.text : null });
    // BLOCK RULE (decided, F8 — see also contacts/chats routes and
    // SECURITY.md): blocking is enforced for 1:1 traffic only.
    // Blocked in either direction => no new messages in a DIRECT
    // chat. GROUP messages are NOT refused by a block: a blocked
    // user already in a shared group can still send there, because
    // group membership is an admin decision (admin-add and group
    // creation refuse blocked users; an admin can remove a member).
    // That scope is deliberate and documented, not an oversight.
    const chatRow = await prisma.chat.findUnique({ where: { id: chatId }, include: { members: true } });
    if (chatRow !== null && chatRow.type === "DIRECT") {
      const other = chatRow.members.find((m) => m.userId !== auth.userId);
      if (other && await isBlockedEitherDirection(prisma, auth.userId, other.userId)) throw forbidden("cannot message a blocked user");
    }
    const replyToId = typeof body.replyToId === "string" && body.replyToId !== "" ? body.replyToId : null;
    if (replyToId !== null) {
      const parent = await prisma.message.findUnique({ where: { id: replyToId } });
      if (parent === null || parent.chatId !== chatId || parent.deletedForAll) {
        throw badRequest("replied-to message not found in this chat");
      }
    }
    const now = new Date();
    const message = await prisma.message.create({
      data: {
        chatId, senderId: auth.userId, type: type as "TEXT" | "PHOTO" | "VOICE" | "VIDEO" | "FILE" | "SYSTEM",
        text: typeof body.text === "string" ? body.text : null,
        mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : null,
        mediaMime: typeof body.mediaMime === "string" ? body.mediaMime : null,
        durationSec: typeof body.durationSec === "number" ? body.durationSec : null,
        replyToId,
      },
    });
    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: now } });
    await prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId: auth.userId } },
      data: { lastReadAt: now },
    });
    return json({ message }, 201);
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/messages — edit own TEXT message only (not deleted,
 *  non-empty new text). Sets text + editedAt. Sender-only. */
export async function PATCH(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const chatId = asString(body.chatId);
    const messageId = asString(body.messageId);
    const newText = asString(body.text);
    await requireMembership(prisma, chatId, auth.userId);
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (message === null || message.chatId !== chatId) throw notFound("message not found");
    if (message.senderId !== auth.userId) throw forbidden("only the sender can edit a message");
    if (message.deletedForAll) throw badRequest("cannot edit a deleted message");
    if (message.type !== "TEXT") throw badRequest("only text messages can be edited");
    if (newText.trim() === "") throw badRequest("text message must not be empty");
    const updated = await prisma.message.update({
      where: { id: messageId }, data: { text: newText, editedAt: new Date() },
    });
    return json({ message: updated });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/messages?chatId=&messageId= — delete for everyone:
 *  sender-only, sets deletedForAll=true AND nulls text/mediaUrl/
 *  mediaMime in the row (F19), so the content cannot be read back
 *  through the API; clients render a placeholder. */
export async function DELETE(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const params = new URL(request.url).searchParams;
    const chatId = params.get("chatId") ?? "";
    const messageId = params.get("messageId") ?? "";
    await requireMembership(prisma, chatId, auth.userId);
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (message === null || message.chatId !== chatId) throw notFound("message not found");
    if (message.senderId !== auth.userId) throw forbidden("only the sender can delete a message");
    const updated = await prisma.message.update({ where: { id: messageId }, data: { deletedForAll: true, text: null, mediaUrl: null, mediaMime: null } });
    return json({ message: updated });
  } catch (err) {
    return handleError(err);
  }
}
