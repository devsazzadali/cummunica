export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { loginUser } from "@/lib/auth";
import { authDb } from "@/lib/db";
import { ApiError, badRequest } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";
import { clientIp, isLoginLocked, loginLockError, loginLockKeys, rateLimitOrThrow, recordLoginFailure, resetLoginFailures } from "@/lib/rate-limit";

/** POST /api/auth/login — username OR @username OR exact 8-digit
 *  Communica ID + password. Identical 401 message for missing user
 *  vs wrong password (no enumeration). Rate-limited per IP and
 *  locked for 15 minutes after 5 failures for one identifier (and
 *  for one IP + identifier) — the identifier key cannot be diluted
 *  by rotating x-forwarded-for (F12, see rate-limit.ts).
 *  DB outages (503) are NOT counted as login failures. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const identifier = asString(body.identifier ?? body.username);
  const ip = clientIp(request);
  // F12: lockout is keyed to the identifier as well as the IP (both
  // keys are checked/recorded), so forging x-forwarded-for to rotate
  // IPs cannot dilute the per-account lockout. The per-IP bucket
  // above remains best-effort only — see rate-limit.ts.
  const lockKeys = loginLockKeys(ip, identifier);
  try {
    rateLimitOrThrow(`login-ip:${ip}`, 20, 10 * 60 * 1000, "too many login attempts — try again later");
    if (lockKeys.some((k) => isLoginLocked(k))) throw loginLockError();
    // Validate BEFORE touching the DB, so empty identifier/password is
    // a 400 even when DATABASE_URL is not configured (no 503 masking).
    if (identifier.trim() === "" || asString(body.password) === "") throw badRequest("username and password are required");
    const result = await loginUser(authDb(getPrisma()), identifier, asString(body.password));
    lockKeys.forEach((k) => resetLoginFailures(k));
    return json(result);
  } catch (err) {
    // Only a genuine 401 counts toward lockout — never a 503/429.
    if (err instanceof ApiError && err.status === 401) lockKeys.forEach((k) => recordLoginFailure(k));
    return handleError(err);
  }
}
