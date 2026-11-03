// Communica backend — email verification (PREPARED, NOT LIVE).
//
// Decision 2026-11-03 (user): auth is CUSTOM JWT+bcrypt, NOT Neon Auth
// (Neon is the Postgres DB only). Email verification will use the
// Resend API, whose key the user will provide LATER via the secure
// vault. Until then:
// - No verification mail is sent by any code path.
// - sendVerificationEmail() below fails closed with 501
//   "email_verification_not_configured" — it never pretends to send.
// - Registration still works with username + password only; email is
//   optional (User.email, User.emailVerifiedAt in the Prisma schema).
//
// When the Resend key arrives, the ONLY change needed here is to
// implement sendVerificationEmail() with that key (server-side only,
// never in frontend code) and to store a hashed token + expiry.
// The token scheme below is already final and does not change.

import { ApiError } from "./errors";

/** Verification link lifetime: 24 hours. */
export const EMAIL_TOKEN_LIFETIME_HOURS = 24;

/** A verification token record: only the SHA-256 hash is stored. */
export interface EmailVerificationToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Hash a raw token for storage. Never store the raw token. */
export async function hashEmailTokenAsync(rawToken: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new ApiError(500, "crypto_unavailable", "secure hash source unavailable");
  }
  const data = new TextEncoder().encode(rawToken);
  const digest = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a URL-safe raw token (shown once, in the email link). */
export function generateEmailToken(): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new ApiError(500, "random_unavailable", "secure random source unavailable");
  }
  const bytes = new Uint8Array(32);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function emailTokenExpired(token: EmailVerificationToken, now: Date): boolean {
  return now.getTime() > token.expiresAt.getTime();
}

/**
 * PENDING — Resend API key not yet provided by the user.
 * Do NOT call any mail provider from here until the key is supplied
 * via the secure vault. This function exists so the wiring phase has
 * exactly one place to implement sending, and so no other module
 * invents its own mail path.
 */
export async function sendVerificationEmail(_email: string, _link: string): Promise<void> {
  throw new ApiError(
    501,
    "email_verification_not_configured",
    "email verification is not configured yet: Resend API key pending from user",
  );
}
