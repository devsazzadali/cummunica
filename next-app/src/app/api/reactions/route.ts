export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";

/** POST /api/reactions — toggle one reaction on a message.
 *  Membership-gated; deleted-for-all messages cannot be reacted to.
 *  Emoji is capped at 8 characters and must not contain whitespace
 *  (a single emoji, not free text — keeps stored values inert). */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const chatId = asString(body.chatId);
    const messageId = asString(body.messageId);
    const emoji = asString(body.emoji);
    if (chatId === "" || messageId === "") throw badRequest("chatId and messageId are required");
    if (emoji === "" || emoji.length > 8 || /\s/.test(emoji)) throw badRequest("reaction is invalid");
    const membership = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: auth.userId } } });
    if (membership === null) throw forbidden("not a member of this chat");
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (message === null || message.chatId !== chatId) throw notFound("message not found");
    if (message.deletedForAll) throw badRequest("cannot react to a deleted message");
    const existing = await prisma.reaction.findUnique({ where: { messageId_userId_emoji: { messageId, userId: auth.userId, emoji } } });
    if (existing !== null) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      return json({ reacted: false });
    }
    await prisma.reaction.create({ data: { messageId, userId: auth.userId, emoji } });
    return json({ reacted: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
