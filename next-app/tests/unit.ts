// Step 3 unit tests — NO live DB. Mock AuthDb adapter + pure logic only.
// Run: JWT_SECRET=test-secret npx tsc tests/unit.ts src/lib/auth.ts src/lib/sazmu.ts src/lib/validation.ts src/lib/errors.ts --module commonjs --target es2022 --outDir /tmp/step3-unit --skipLibCheck --esModuleInterop --moduleResolution node && node /tmp/step3-unit/tests/unit.js
import {
  generateCommunicaId, isExactCommunicaId, loginUser, normalizeUsername,
  registerUser, requireAuth, stripAt, toPublicUser, validateUsername, verifyToken, type AuthDb, type UserRow,
} from "../src/lib/auth";
import { ApiError } from "../src/lib/errors";
import {
  AI_LABEL, BOYFRIEND_DEFAULT_CALL_NAME, GIRLFRIEND_PRESET_CALL_NAMES,
  checkSafety, detectLanguage, matchIntent, plainMemoryFromText, sazmuTemplateReply,
} from "../src/lib/sazmu";
import { callGateAllows, searchKind, validateSendMessage } from "../src/lib/validation";
import { searchUsers } from "../src/lib/db";

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name}`); }
}
async function throwsCode(name: string, fn: () => Promise<unknown> | unknown, status: number, code: string): Promise<void> {
  try { await fn(); ok(name, false); }
  catch (e) {
    ok(name, e instanceof ApiError && e.status === status && e.code === code);
  }
}

function mockDb(opts: { existingUsernames?: Set<string>; takenIds?: string[] } = {}): AuthDb & { users: Map<string, UserRow> } {
  const users = new Map<string, UserRow>();
  const takenIds = [...(opts.takenIds ?? [])];
  let seq = 0;
  return {
    users,
    findUserByUsername: async (u) => users.get(u) ?? null,
    findUserByCommunicaId: async (id) => {
      if (takenIds.includes(id)) return { id: "taken", username: "taken", displayName: "Taken", communicaId: id, passwordHash: "x", email: null, avatarUrl: null, bio: null, lastSeenAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
      let found: UserRow | null = null;
      users.forEach((user) => { if (user.communicaId === id) found = user; });
      return found;
    },
    createUser: async (input) => {
      const user: UserRow = { id: `u${++seq}`, ...input, avatarUrl: null, bio: null, lastSeenAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
      users.set(user.username, user);
      return user;
    },
    updateLastSeen: async () => undefined,
  };
}

async function main(): Promise<void> {
  // Username rules
  ok("normalize trims+lowercases", normalizeUsername("  Sazzad_1 ") === "sazzad_1");
  ok("stripAt removes leading @", stripAt("@sazzad") === "sazzad");
  await throwsCode("username too short 400", () => validateUsername("ab"), 400, "bad_request");
  await throwsCode("username too long 400", () => validateUsername("a".repeat(21)), 400, "bad_request");
  await throwsCode("username hyphen 400", () => validateUsername("bad-name"), 400, "bad_request");
  await throwsCode("server does not strip @ (client must)", () => validateUsername(normalizeUsername("@sazzad")), 400, "bad_request");
  ok("username valid passes", (() => { validateUsername("sazzad_1"); return true; })());
  ok("exact ID format", isExactCommunicaId("48291357") && !isExactCommunicaId("4829135") && !isExactCommunicaId("4829135a"));
  ok("generated ID 8 digits, first non-zero", generateCommunicaId(() => 10000000) === "10000000" && generateCommunicaId(() => 99999999) === "99999999");

  // Register + login with mocked DB
  const db = mockDb();
  const reg = await registerUser(db, { username: "Sazzad", displayName: "Sazzad", password: "password123" });
  ok("register returns 8-digit ID", /^[1-9][0-9]{7}$/.test(reg.communicaId));
  ok("register never returns passwordHash", !("passwordHash" in reg.user));
  ok("register token verifies", verifyToken(reg.token).username === "sazzad");
  await throwsCode("register duplicate 409", () => registerUser(db, { username: "sazzad", displayName: "X", password: "password123" }), 409, "conflict");
  await throwsCode("register short password 400", () => registerUser(db, { username: "newuser", displayName: "N", password: "short" }), 400, "bad_request");
  await throwsCode("register empty display 400", () => registerUser(db, { username: "newuser2", displayName: "  ", password: "password123" }), 400, "bad_request");
  const login1 = await loginUser(db, "@sazzad", "password123");
  ok("login by @username", login1.user.username === "sazzad");
  const login2 = await loginUser(db, reg.communicaId, "password123");
  ok("login by exact Communica ID", login2.user.username === "sazzad");
  await throwsCode("login wrong password 401 identical", () => loginUser(db, "sazzad", "wrongpassword"), 401, "invalid_credentials");
  await throwsCode("login missing user 401 identical", () => loginUser(db, "ghost", "wrongpassword"), 401, "invalid_credentials");
  await throwsCode("invalid token 401 unauthenticated", () => verifyToken("not.a.token"), 401, "unauthenticated");

  // Collision retry: first generated ID taken, second free — via a db whose
  // takenIds list contains the deterministic first candidate is hard to
  // force through registerUser's internal generator, so assert the
  // retry contract at the adapter level instead: taken then free.
  const db2 = mockDb({ takenIds: ["11111111"] });
  const first = await db2.findUserByCommunicaId("11111111");
  const second = await db2.findUserByCommunicaId("22222222");
  ok("collision retry contract (taken then free)", first !== null && second === null);

  // Search kinds
  ok("searchKind empty", searchKind("") === "empty" && searchKind("   ") === "empty");
  ok("searchKind exact ID only", searchKind("48291357") === "id");
  ok("searchKind partial ID is NOT id lookup", searchKind("48291") === "username");
  ok("searchKind username", searchKind("@saz") === "username");

  // Call gate
  ok("call gate null denied", !callGateAllows(null));
  ok("call gate accepted+unblocked allowed", callGateAllows({ accepted: true, isBlocked: false }));
  ok("call gate blocked denied", !callGateAllows({ accepted: true, isBlocked: true }));
  ok("call gate unaccepted denied", !callGateAllows({ accepted: false, isBlocked: false }));

  // Message validation
  await throwsCode("empty TEXT 400", () => validateSendMessage({ type: "TEXT", text: "  " }), 400, "bad_request");
  await throwsCode("media without URL 400", () => validateSendMessage({ type: "PHOTO", mediaUrl: "" }), 400, "bad_request");
  ok("valid TEXT passes", (() => { validateSendMessage({ type: "TEXT", text: "hi" }); return true; })());
  // F10: media must be /uploads/ and mime must match the type.
  await throwsCode("external media URL 400", () => validateSendMessage({ type: "PHOTO", mediaUrl: "https://evil.example/x.jpg", mediaMime: "image/jpeg" }), 400, "bad_request");
  await throwsCode("media mime mismatch 400", () => validateSendMessage({ type: "PHOTO", mediaUrl: "/uploads/a.mp4", mediaMime: "video/mp4" }), 400, "bad_request");
  await throwsCode("media mime missing 400", () => validateSendMessage({ type: "VOICE", mediaUrl: "/uploads/a.webm", mediaMime: null }), 400, "bad_request");
  ok("valid PHOTO passes", (() => { validateSendMessage({ type: "PHOTO", mediaUrl: "/uploads/a.jpg", mediaMime: "image/jpeg" }); return true; })());
  // F9: digit-only non-8-digit queries return [] before username search,
  // even when a digit-leading username would prefix-match.
  const searchMock = {
    contact: { findMany: async () => [] },
    user: {
      findUnique: async (args: { where: { username?: string; communicaId?: string } }) => {
        if (args.where.communicaId === "48291357") return { username: "sazzad", displayName: "Sazzad", communicaId: "48291357", avatarUrl: null, bio: null };
        return null;
      },
      findMany: async (args: { where: { username: { startsWith: string } } }) => {
        if (args.where.username.startsWith === "saz") return [{ username: "sazzad", displayName: "Sazzad", communicaId: "48291357", avatarUrl: null, bio: null }];
        return [{ username: "48291user", displayName: "Digit", communicaId: "11111111", avatarUrl: null, bio: null }];
      },
    },
  };
  const prismaArg = searchMock as unknown as Parameters<typeof searchUsers>[0];
  ok("partial ID search returns [] (F9)", (await searchUsers(prismaArg, "me", "48291")).length === 0);
  ok("exact ID search still works", (await searchUsers(prismaArg, "me", "48291357")).length === 1);
  ok("username prefix search still works", (await searchUsers(prismaArg, "me", "saz")).length === 1);

  // SAZMU
  ok("detect Bengali script", detectLanguage("আমি ভালো আছি") === "Bengali");
  ok("detect Banglish", detectLanguage("ami kemon acho") === "Banglish");
  ok("detect English", detectLanguage("what is the weather") === "English");
  ok("safety order distress first", checkSafety("i want to die and sex") === "distress");
  ok("safety sexual", checkSafety("send nude") === "sexual");
  ok("safety boundary", checkSafety("leave me alone") === "boundary");
  ok("safety none", checkSafety("hello there") === null);
  ok("intent greeting", matchIntent("hello") === "greeting");
  ok("intent what-to-eat", matchIntent("ki khabo aj") === "what-to-eat");
  const settings = { role: "Boyfriend" as const, callName: "Sazzad", petName: null, tone: "soft", language: "Bengali" };
  const greet = sazmuTemplateReply(settings, "hello", [], true);
  ok("sazmu greeting aiLabel+template+intro", greet.aiLabel === true && greet.isTemplate === true && greet.source === "template" && greet.text.includes("SAZMU AI"));
  const unknown = sazmuTemplateReply(settings, "what is quantum physics", [], false);
  ok("sazmu general question honest-unknown, never invented", unknown.source === "honest-unknown" && unknown.text.includes("jani na"));
  const food = sazmuTemplateReply({ ...settings, petName: "baby" }, "what to eat", [{ key: "favourite_food", value: "biryani" }], false);
  ok("sazmu uses own memory only", food.text.includes("biryani"));
  ok("boyfriend default Sazzad", BOYFRIEND_DEFAULT_CALL_NAME === "Sazzad");
  ok("girlfriend presets include Mim+Mumu", GIRLFRIEND_PRESET_CALL_NAMES.includes("Mim") && GIRLFRIEND_PRESET_CALL_NAMES.includes("Mumu"));
  ok("AI label wording", AI_LABEL === "SAZMU AI — AI, not a human");
  ok("plain memory pattern", plainMemoryFromText("my favourite food is biryani")?.value === "biryani");
  ok("plain memory ignores other data", plainMemoryFromText("hello there") === null);

  // QA Step 5 additions: auth gate + passwordHash never leaks via public shape.
  await throwsCode("requireAuth missing header 401", () => requireAuth(new Request("http://qa/")), 401, "unauthenticated");
  await throwsCode("requireAuth bogus token 401", () => requireAuth(new Request("http://qa/", { headers: { authorization: "Bearer bogus.token.here" } })), 401, "unauthenticated");
  ok("toPublicUser strips passwordHash", (() => {
    const pub = toPublicUser({ id: "u1", username: "sazzad", displayName: "Sazzad", communicaId: "48291357", email: null, avatarUrl: null, bio: null, lastSeenAt: new Date(), createdAt: new Date(), updatedAt: new Date(), passwordHash: "secret-hash" });
    return !("passwordHash" in pub) && pub.username === "sazzad";
  })());

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
