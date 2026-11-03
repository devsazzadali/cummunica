export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { searchUsers } from "@/lib/db";
import { handleError, json } from "@/lib/http";
import { rateLimitOrThrow } from "@/lib/rate-limit";

/** GET /api/users/search?q= — authenticated. By @username prefix or
 *  exact 8-digit Communica ID only (partial ID rejected, per
 *  ALGORITHMS §2). Never returns passwordHash (or id). Empty q => []. */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    rateLimitOrThrow(`search-user:${auth.userId}`, 120, 60 * 1000, "too many searches — try again in a minute");
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const results = await searchUsers(getPrisma(), auth.userId, q);
    return json({ results });
  } catch (err) {
    return handleError(err);
  }
}
