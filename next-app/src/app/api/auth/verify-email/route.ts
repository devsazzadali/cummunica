export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { ApiError } from "@/lib/errors";
import { handleError, json } from "@/lib/http";

/** POST /api/auth/verify-email — PREPARED ONLY, NOT LIVE.
 *  Always returns 501 email_verification_not_configured, exactly as
 *  backend/src/email_verification.ts. Never sends mail; no key is
 *  requested or used here (Resend key pending from the user). */
export async function POST() {
  try {
    throw new ApiError(
      501,
      "email_verification_not_configured",
      "email verification is not configured yet: Resend API key pending from user",
    );
  } catch (err) {
    return handleError(err);
  }
}
