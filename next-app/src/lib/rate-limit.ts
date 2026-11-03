// Rate limiting + login lockout (in-memory, single-process).
// LIMITATION (honest): state lives in this process only. A multi-instance
// deployment must move this to shared state (e.g. Redis) or pin a user
// to one instance, exactly like the /api/calls active-call map. Limits
// are deliberately moderate so legitimate QA (a handful of attempts)
// is never locked out, while infinite brute-force is stopped.
import { ApiError } from "./errors";

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();
function prune(now: number): void {
  if (buckets.size > 10000) {
    buckets.forEach((b, k) => { if (b.resetAt <= now) buckets.delete(k); });
  }
}
/** Returns true and consumes one attempt, or false when the limit is hit. */
export function checkLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now(); prune(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= limit) return false;
  b.count += 1; return true;
}
export function rateLimitOrThrow(key: string, limit: number, windowMs: number, message: string): void {
  if (!checkLimit(key, limit, windowMs)) {
    throw new ApiError(429, "rate_limited", message);
  }
}
/** F12 — x-forwarded-for is UNTRUSTED by default. There is no
 *  trusted-proxy configuration in this app, so the header is
 *  treated as best-effort only (per-IP buckets) and NEVER as the
 *  sole key for a security decision: a caller can set the header
 *  and rotate apparent IPs. The binding login protection is the
 *  identifier-keyed lockout in the login route (see loginLockKeys):
 *  rotating IPs cannot dilute a lock on one identifier, because
 *  the identifier key trips regardless of the apparent IP. Do NOT
 *  "fix" this by trusting x-forwarded-for unless a trusted proxy
 *  is actually configured in front of the app and documented. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first !== "" ? first : "unknown-ip";
}

// Login lockout: 5 consecutive failures for one (IP + identifier) lock
// that pair for 15 minutes. A successful login clears the counter.
interface Lock { fails: number; lockedUntil: number }
const loginLocks = new Map<string, Lock>();
export const LOGIN_MAX_FAILS = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
export function loginLockKey(ip: string, identifier: string): string {
  return `${ip}:${identifier.trim().toLowerCase()}`;
}
/** F12: every lock key a login attempt is checked/recorded under —
 *  the old (IP + identifier) key AND an identifier-only key. The
 *  identifier key is what makes IP rotation (via a forged
 *  x-forwarded-for) useless for brute-forcing one account: 5
 *  failures for that identifier lock it for 15 minutes no matter
 *  which apparent IP they came from. */
export function loginLockKeys(ip: string, identifier: string): string[] {
  return [loginLockKey(ip, identifier), `id:${identifier.trim().toLowerCase()}`];
}
export function isLoginLocked(key: string): boolean {
  const l = loginLocks.get(key);
  return l !== undefined && l.lockedUntil > Date.now();
}
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const l = loginLocks.get(key) ?? { fails: 0, lockedUntil: 0 };
  l.fails += 1;
  if (l.fails >= LOGIN_MAX_FAILS) l.lockedUntil = now + LOGIN_LOCK_MS;
  loginLocks.set(key, l);
}
export function resetLoginFailures(key: string): void {
  loginLocks.delete(key);
}
export function loginLockError(): ApiError {
  return new ApiError(429, "account_locked", "too many failed login attempts — try again in 15 minutes");
}
