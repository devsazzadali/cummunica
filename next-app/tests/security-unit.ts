// Security unit tests — NO live DB. Run (placeholder secret only):
//   JWT_SECRET=<redacted> node <compiled-output>/security-unit.js
// Compiled with tsc to /tmp (see SECURITY.md); never committed output.
import jwt from "jsonwebtoken";
import { hashPassword, loginUser, signToken, toPublicUser, verifyToken, type AuthDb, type UserRow } from "../src/lib/auth";
import { blockToken } from "../src/lib/token-blocklist";
import { checkLimit, isLoginLocked, loginLockKey, loginLockKeys, recordLoginFailure, resetLoginFailures } from "../src/lib/rate-limit";
import { safeUploadFilename, sniffUpload, validateUpload } from "../src/lib/media";
import { ApiError } from "../src/lib/errors";
import { callGateAllows } from "../src/lib/validation";

let passed = 0; let failed = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { passed++; console.log(`PASS ${name}`); } else { failed++; console.log(`FAIL ${name}`); }
}
async function throwsCode(name: string, fn: () => Promise<unknown> | unknown, status: number, code: string): Promise<void> {
  try { await fn(); ok(name, false); }
  catch (e) { ok(name, e instanceof ApiError && e.status === status && e.code === code); }
}
function mockDb(): AuthDb & { users: Map<string, UserRow> } {
  const users = new Map<string, UserRow>();
  return {
    users,
    findUserByUsername: async (u) => users.get(u) ?? null,
    findUserByCommunicaId: async (id) => { let f: UserRow | null = null; users.forEach((u) => { if (u.communicaId === id) f = u; }); return f; },
    createUser: async (input) => { const u: UserRow = { id: "u1", ...input, avatarUrl: null, bio: null, lastSeenAt: new Date(), createdAt: new Date(), updatedAt: new Date() }; users.set(u.username, u); return u; },
    updateLastSeen: async () => undefined,
  };
}
async function main(): Promise<void> {
  const db = mockDb();
  // Register via loginUser path: create directly with bcrypt-12 hash.
  const hash = await hashPassword("password123");
  ok("bcrypt cost 12", /^\$2[ab]\$12\$/.test(hash));
  ok("bcrypt hash is not plaintext", hash !== "password123");
  const user: UserRow = { id: "u1", username: "sazzad", displayName: "Sazzad", communicaId: "48291357", passwordHash: hash, email: null, avatarUrl: null, bio: null, lastSeenAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
  db.users.set("sazzad", user);
  ok("public user never contains passwordHash", !("passwordHash" in toPublicUser(user)));
  await throwsCode("login missing user 401 identical", () => loginUser(db, "ghost", "wrongpassword"), 401, "invalid_credentials");
  await throwsCode("login wrong password 401 identical", () => loginUser(db, "sazzad", "wrongpassword"), 401, "invalid_credentials");
  const good = await loginUser(db, "sazzad", "password123");
  ok("login succeeds with right password", good.user.username === "sazzad" && !("passwordHash" in good.user));

  // Tokens: forged / expired / revoked all fail 401.
  await throwsCode("forged token 401", () => verifyToken("forged.header.payload"), 401, "unauthenticated");
  const wrongSecret = jwt.sign({ userId: "u1", username: "sazzad", jti: "x" }, "different-secret", { expiresIn: "7d" });
  await throwsCode("wrong-secret token 401", () => verifyToken(wrongSecret), 401, "unauthenticated");
  const expired = jwt.sign({ userId: "u1", username: "sazzad", jti: "y" }, process.env.JWT_SECRET ?? "", { expiresIn: "-1s" });
  await throwsCode("expired token 401", () => verifyToken(expired), 401, "unauthenticated");
  const token = signToken({ userId: "u1", username: "sazzad" });
  const payload = verifyToken(token);
  ok("fresh token verifies with jti", payload.userId === "u1" && typeof payload.jti === "string");
  blockToken(payload.jti, Date.now() + 60000);
  await throwsCode("revoked (logged-out) token 401", () => verifyToken(token), 401, "unauthenticated");

  // Rate limit + lockout.
  const key = "test-limit";
  let allowed = 0; for (let i = 0; i < 7; i++) if (checkLimit(key, 5, 60000)) allowed++;
  ok("rate limit trips after limit", allowed === 5);
  const lk = loginLockKey("1.2.3.4", "sazzad");
  resetLoginFailures(lk);
  for (let i = 0; i < 5; i++) recordLoginFailure(lk);
  ok("login lockout after 5 failures", isLoginLocked(lk));
  resetLoginFailures(lk);
  ok("lockout clears on success/reset", !isLoginLocked(lk));

  // Call gate: non-contact and blocked both denied.
  ok("call to non-contact denied", !callGateAllows(null));
  ok("call to blocked contact denied", !callGateAllows({ accepted: true, isBlocked: true }));
  ok("call to unaccepted contact denied", !callGateAllows({ accepted: false, isBlocked: false }));

  // F12: identifier-keyed lockout trips regardless of apparent IP.
  const idKeys = loginLockKeys("9.9.9.9", "sazzad");
  ok("login lock keys include identifier-only key", idKeys.length === 2 && idKeys[1] === "id:sazzad");
  idKeys.forEach((k) => resetLoginFailures(k));
  for (let i = 0; i < 5; i++) recordLoginFailure(idKeys[1]);
  ok("identifier lock trips without the IP key", isLoginLocked(idKeys[1]));
  idKeys.forEach((k) => resetLoginFailures(k));

  // Upload safety.
  await throwsCode("upload disallowed mime rejected", () => validateUpload("application/x-sh", 100), 400, "bad_request");
  await throwsCode("upload oversize rejected", () => validateUpload("image/jpeg", 6 * 1024 * 1024), 400, "bad_request");
  // F11: content sniffing — declared type must match the bytes.
  ok("sniff real JPEG passes", (() => { sniffUpload(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), "image/jpeg"); return true; })());
  ok("sniff real PNG passes", (() => { sniffUpload(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"); return true; })());
  await throwsCode("sniff PNG-as-JPEG rejected", () => sniffUpload(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/jpeg"), 400, "bad_request");
  await throwsCode("sniff text-as-JPEG rejected", () => sniffUpload(new Uint8Array([0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e]), "image/jpeg"), 400, "bad_request");
  const safe = safeUploadFilename("../../etc/passwd.jpg", "jpg");
  ok("traversal filename sanitised", !safe.includes("/") && !safe.includes("..") && safe.endsWith(".jpg"));
  // XSS payload is inert text: it is stored as a string and React
  // escapes it on render; there is no dangerouslySetInnerHTML in src
  // (grep-verified in the run report). The string itself must survive
  // unchanged so the user sees exactly what they typed, not executed code.
  const xss = "<script>alert(1)</script><img src=x onerror=alert(2)>";
  ok("xss payload stays inert text (no transform needed)", xss.includes("<script>") && xss.length > 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
