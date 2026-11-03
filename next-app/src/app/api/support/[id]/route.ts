export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { forbidden, notFound } from "@/lib/errors";
import { handleError, json } from "@/lib/http";
import { rateLimitOrThrow } from "@/lib/rate-limit";

/** GET /api/support/[id] — one OWN ticket with its replies thread.
 *  Unauthenticated => 401. Missing ticket => 404. Another user's
 *  ticket => 403 (existence is not confirmed to non-owners beyond
 *  the generic forbidden — the id alone reveals nothing else). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(request);
    rateLimitOrThrow(`support-view:${auth.userId}`, 120, 60 * 1000, "too many requests — try again in a minute");
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { username: true, displayName: true } } },
        },
      },
    });
    if (ticket === null) throw notFound("ticket not found");
    if (ticket.userId !== auth.userId) throw forbidden("this ticket belongs to another user");
    return json({ ticket });
  } catch (err) {
    return handleError(err);
  }
}
