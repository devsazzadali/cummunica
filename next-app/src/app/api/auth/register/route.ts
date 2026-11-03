export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { registerUser, validateRegistrationInput } from "@/lib/auth";
import { authDb } from "@/lib/db";
import { handleError, json, readJson, asString } from "@/lib/http";
import { clientIp, rateLimitOrThrow } from "@/lib/rate-limit";

/** POST /api/auth/register — username + displayName + password (>=8).
 *  Email optional. bcrypt cost 12, random 8-digit Communica ID with
 *  collision retry, JWT 7 days. Returns public user (never
 *  passwordHash) + communicaId + token. */
export async function POST(request: Request) {
  try {
    rateLimitOrThrow(`register-ip:${clientIp(request)}`, 10, 60 * 60 * 1000, "too many registrations from this address — try again later");
    const body = await readJson(request);
    // Validate BEFORE touching the DB, so a weak/missing field is a 400
    // even when DATABASE_URL is not configured (no 503 masking it).
    validateRegistrationInput({
      username: asString(body.username),
      displayName: asString(body.displayName),
      password: asString(body.password),
      email: typeof body.email === "string" ? body.email : null,
    });
    const result = await registerUser(authDb(getPrisma()), {
      username: asString(body.username),
      displayName: asString(body.displayName),
      password: asString(body.password),
      email: typeof body.email === "string" ? body.email : null,
    });
    return json(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
