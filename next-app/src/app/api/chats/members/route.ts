export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isBlockedEitherDirection, resolveUserId } from "@/lib/db";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";

async function requireGroupAdmin(prisma: ReturnType<typeof getPrisma>, chatId: string, userId: string) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, include: { members: true } });
  if (chat === null) throw notFound("chat not found");
  if (chat.type !== "GROUP") throw badRequest("only group chats have members to manage");
  const me = chat.members.find((m) => m.userId === userId);
  if (me === undefined) throw forbidden("not a member of this group");
  if (me.role !== "ADMIN") throw forbidden("only group admins can manage members");
  return chat;
}

/** POST /api/chats/members — admin adds a member by identifier.
 *  Blocked users are refused. DELETE — admin removes a member, or
 *  any member leaves (self). PATCH — admin sets ADMIN/MEMBER role;
 *  the last admin cannot be demoted. */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const chatId = asString(body.chatId);
    await requireGroupAdmin(prisma, chatId, auth.userId);
    const userId = await resolveUserId(prisma, asString(body.identifier));
    if (userId === auth.userId) throw badRequest("you are already a member");
    if (await isBlockedEitherDirection(prisma, auth.userId, userId)) throw forbidden("cannot add a blocked user");
    const existing = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } });
    if (existing !== null) throw badRequest("user is already a member");
    await prisma.chatMember.create({ data: { chatId, userId, role: "MEMBER" } });
    return json({ added: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const params = new URL(request.url).searchParams;
    const chatId = params.get("chatId") ?? "";
    const targetId = params.get("userId") ?? auth.userId;
    const chat = await prisma.chat.findUnique({ where: { id: chatId }, include: { members: true } });
    if (chat === null) throw notFound("chat not found");
    if (chat.type !== "GROUP") throw badRequest("only group chats have members to manage");
    const me = chat.members.find((m) => m.userId === auth.userId);
    if (me === undefined) throw forbidden("not a member of this group");
    if (targetId !== auth.userId && me.role !== "ADMIN") throw forbidden("only group admins can remove members");
    if (targetId === auth.userId && me.role === "ADMIN" && chat.members.filter((m) => m.role === "ADMIN").length <= 1 && chat.members.length > 1) {
      throw badRequest("the last admin cannot leave while other members remain — make another member admin first");
    }
    await prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId: targetId } } });
    return json({ removed: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const chatId = asString(body.chatId);
    const targetId = asString(body.userId);
    const role = asString(body.role);
    if (role !== "ADMIN" && role !== "MEMBER") throw badRequest("role is invalid");
    const chat = await requireGroupAdmin(prisma, chatId, auth.userId);
    const target = chat.members.find((m) => m.userId === targetId);
    if (target === undefined) throw notFound("member not found");
    if (role === "MEMBER" && target.role === "ADMIN" && chat.members.filter((m) => m.role === "ADMIN").length <= 1) {
      throw badRequest("cannot demote the last admin");
    }
    await prisma.chatMember.update({ where: { chatId_userId: { chatId, userId: targetId } }, data: { role: role as "ADMIN" | "MEMBER" } });
    return json({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}
