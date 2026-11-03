export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { handleError, json, readJson } from "@/lib/http";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { requireInterimSupportAdmin, validateReplyInput } from "@/lib/support";

/** POST /api/support/[id]/reply — ADMIN-ONLY reply + status update.
 *  INTERIM GATE (see src/lib/support.ts requireInterimSupportAdmin):
 *  the caller's stored DB email must equal deploy-time env
 *  SUPER_ADMIN_EMAIL — no email is hardcoded anywhere. If that env
 *  var is absent, this endpoint fails closed (403), never open.
 *  This interim gate migrates to a User.role gate in the
 *  admin-dashboard Phase 4/5; NO role field is invented in this step.
 *  Body: { body, status? } — status, when given, must be one of
 *  Open / InProgress / Resolved. When no status is given, an Open
 *  ticket moves to InProgress (admin has engaged); other statuses
 *  are left unchanged. Admin replies never grant access to the
 *  user's private chats — only this ticket and its replies.
 *  Unauthenticated => 401; non-admin => 403; missing ticket => 404. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(request);
    rateLimitOrThrow(`support-reply:${auth.userId}`, 60, 60 * 60 * 1000, "too many replies — try again later");
    const body = await readJson(request);
    const input = validateReplyInput(body);
    const prisma = getPrisma();
    const caller = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
    requireInterimSupportAdmin(caller?.email ?? null);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    if (ticket === null) throw notFound("ticket not found");
    const reply = await prisma.supportReply.create({
      data: { ticketId: ticket.id, authorId: auth.userId, body: input.body, isAdminReply: true },
    });
    const nextStatus = input.status ?? (ticket.status === "Open" ? "InProgress" : ticket.status);
    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: nextStatus },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { username: true, displayName: true } } },
        },
      },
    });
    return json({ ticket: updated, reply }, 201);
  } catch (err) {
    return handleError(err);
  }
}
