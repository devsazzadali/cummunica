export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { handleError, json, readJson } from "@/lib/http";
import { rateLimitOrThrow } from "@/lib/rate-limit";
import { validateTicketInput } from "@/lib/support";

/** GET /api/support — the caller's OWN tickets, newest first.
 *  Unauthenticated => 401 (requireAuth). No other user's ticket
 *  is ever returned here (where userId = caller). */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    rateLimitOrThrow(`support-list:${auth.userId}`, 120, 60 * 1000, "too many requests — try again in a minute");
    const prisma = getPrisma();
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { replies: true } } },
    });
    return json({ tickets });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/support — create a ticket for the caller.
 *  Body: { category, subject, message }. Validation runs BEFORE
 *  getPrisma(), so an invalid category is a 400 even when no DB is
 *  configured (otherwise a 503 would mask the 400). Authenticated
 *  only (401 without a token); rate-limited per user. */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    rateLimitOrThrow(`support-create:${auth.userId}`, 20, 60 * 60 * 1000, "too many tickets — try again later");
    const body = await readJson(request);
    const input = validateTicketInput(body);
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.create({
      data: { userId: auth.userId, category: input.category, subject: input.subject, message: input.message },
    });
    return json({ ticket }, 201);
  } catch (err) {
    return handleError(err);
  }
}
