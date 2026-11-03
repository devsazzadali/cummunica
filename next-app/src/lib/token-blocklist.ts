// Server-side JWT revocation (logout invalidation), in-memory.
// A token's jti is added here on logout until its expiry, and
// verifyToken() rejects blocklisted jtis. LIMITATION (honest):
// single-process only — multi-instance deployments must move this
// to shared state (e.g. Redis). It does NOT replace the httpOnly-
// cookie hardening follow-up documented in SECURITY.md.
const blocked = new Map<string, number>(); // jti -> expiry epoch ms
export function blockToken(jti: string, expiresAtMs: number): void {
  blocked.set(jti, expiresAtMs);
  if (blocked.size > 10000) {
    const now = Date.now();
    blocked.forEach((exp, k) => { if (exp <= now) blocked.delete(k); });
  }
}
export function isTokenBlocked(jti: string): boolean {
  const exp = blocked.get(jti);
  if (exp === undefined) return false;
  if (exp <= Date.now()) { blocked.delete(jti); return false; }
  return true;
}
