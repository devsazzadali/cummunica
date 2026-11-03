// Communica backend — auth (Step 7 skeleton).
// Implements ALGORITHMS §1 exactly: username normalization, random
// 8-digit Communica ID with collision retry, bcrypt (via adapter),
// JWT (via adapter). Registration FIRST, before any use of the app.
//
// SKELETON NOTES (not production-hardened):
// - No rate limiting / lockout on login attempts yet — add before launch.
// - No refresh tokens: a single JWT valid 7 days, per ALGORITHMS §1.
// - No password-reset flow in this step.
// - Adapters are injected so this file never imports bcrypt or
//   jsonwebtoken directly and type-checks with no node_modules.
// - Backend: Prisma + Neon DB ONLY. NOT Supabase. No real phone
//   number is stored or used anywhere here.

import { ApiError, badRequest, conflict } from "./errors";
import type {
  JwtPayload,
  NowFn,
  PasswordHasher,
  PublicUser,
  TokenSigner,
  UserRecord,
} from "./types";

export const MIN_PASSWORD_LENGTH = 8; // ALGORITHMS §1 chosen default
export const MAX_COMMUNICA_ID_ATTEMPTS = 10; // ALGORITHMS §1 chosen default
export const JWT_LIFETIME_DAYS = 7; // ALGORITHMS §1 chosen default
export const BCRYPT_COST = 12; // ALGORITHMS §1 chosen default (wiring sets this)

/** Narrow Db surface this module needs (production: Prisma Client). */
export interface AuthDb {
  findUserByUsername(username: string): Promise<UserRecord | null>;
  findUserByCommunicaId(communicaId: string): Promise<UserRecord | null>;
  createUser(input: {
    username: string;
    displayName: string;
    communicaId: string;
    passwordHash: string;
    lastSeenAt: Date;
  }): Promise<UserRecord>;
  updateLastSeen(userId: string, at: Date): Promise<void>;
}

/** ALGORITHMS §1a: TRIM + LOWERCASE. The client strips a leading "@"
 *  before calling (the UI shows "@username" placeholders); the server
 *  does NOT silently rewrite other characters — anything outside
 *  ^[a-z0-9_]+$ is rejected, exactly as specified. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(username: string): void {
  if (username.length < 3 || username.length > 20) {
    throw badRequest("username must be 3-20 characters");
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    throw badRequest("username may contain only letters, numbers, underscore");
  }
}

/**
 * Secure random integer in [min, max] using WebCrypto when available.
 * SKELETON honesty: this is the production-grade source; if WebCrypto
 * is unavailable the function fails closed rather than falling back
 * to a weak generator. Node 18+ and browsers both provide it.
 */
export function secureRandomInt(min: number, max: number): number {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new ApiError(500, "random_unavailable", "secure random source unavailable");
  }
  const range = max - min + 1;
  const bytes = new Uint32Array(1);
  // Rejection sampling so the result is unbiased within the range.
  const limit = Math.floor(0x100000000 / range) * range;
  for (;;) {
    cryptoObj.getRandomValues(bytes);
    const value = bytes[0] as number;
    if (value < limit) return min + (value % range);
  }
}

/** ALGORITHMS §1c: first digit 1-9, so the ID is always exactly 8 digits. */
export function generateCommunicaId(
  randomInt: (min: number, max: number) => number = secureRandomInt,
): string {
  return String(randomInt(10000000, 99999999));
}

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  void _passwordHash;
  return rest;
}

export interface RegisterInput {
  username: string;
  displayName: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  communicaId: string;
  token: string;
}

/** ALGORITHMS §1, steps 1a-1f. Returns the user WITHOUT passwordHash,
 *  plus the generated communicaId (shown to the user) and a JWT.
 *  The plaintext password is discarded after hashing; only the hash
 *  is stored. No row is created in any other table at registration. */
export async function register(
  db: AuthDb,
  hasher: PasswordHasher,
  signer: TokenSigner,
  input: RegisterInput,
  now: NowFn = () => new Date(),
  randomInt: (min: number, max: number) => number = secureRandomInt,
): Promise<AuthResult> {
  const username = normalizeUsername(input.username);
  validateUsername(username);

  const displayName = input.displayName.trim();
  if (displayName === "") {
    throw badRequest("display name is required");
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest("password must be at least 8 characters");
  }

  const existing = await db.findUserByUsername(username);
  if (existing !== null) {
    throw conflict("username already taken");
  }

  let communicaId = "";
  for (let attempts = 0; attempts < MAX_COMMUNICA_ID_ATTEMPTS; attempts++) {
    const candidate = generateCommunicaId(randomInt);
    const collision = await db.findUserByCommunicaId(candidate);
    if (collision === null) {
      communicaId = candidate;
      break;
    }
  }
  if (communicaId === "") {
    throw new ApiError(500, "id_allocation_failed", "could not allocate a Communica ID, try again");
  }

  // BCRYPT_COST (12) is applied by the production hasher wiring.
  const passwordHash = await hasher.hash(input.password);
  const user = await db.createUser({
    username,
    displayName,
    communicaId,
    passwordHash,
    lastSeenAt: now(),
  });
  // User.avatarUrl and User.bio start empty (NULL); the user may set them later.

  const token = signer.sign(
    { userId: user.id, username: user.username },
    JWT_LIFETIME_DAYS,
  );
  return { user: toPublicUser(user), communicaId, token };
}

/** ALGORITHMS §1 login: same 401 message whether the username is
 *  missing or the password is wrong, so one cannot be distinguished
 *  from the other. Updates User.lastSeenAt on success. */
export async function login(
  db: AuthDb,
  hasher: PasswordHasher,
  signer: TokenSigner,
  usernameRaw: string,
  password: string,
  now: NowFn = () => new Date(),
): Promise<{ user: PublicUser; token: string }> {
  const username = normalizeUsername(usernameRaw);
  const user = await db.findUserByUsername(username);
  const invalid = new ApiError(401, "invalid_credentials", "invalid username or password");
  if (user === null) throw invalid;
  const ok = await hasher.verify(password, user.passwordHash);
  if (!ok) throw invalid;
  await db.updateLastSeen(user.id, now());
  const token = signer.sign(
    { userId: user.id, username: user.username },
    JWT_LIFETIME_DAYS,
  );
  return { user: toPublicUser(user), token };
}

/**
 * UI-matching extension (NOT in ALGORITHMS §1): the Step 5/6 login
 * screen accepts "@username OR Communica ID". An exact 8-digit query
 * is looked up by communicaId; anything else by username. The 401
 * message is identical in every failure case. The core username-only
 * login() above is preserved unchanged.
 */
export async function loginByIdentifier(
  db: AuthDb,
  hasher: PasswordHasher,
  signer: TokenSigner,
  identifierRaw: string,
  password: string,
  now: NowFn = () => new Date(),
): Promise<{ user: PublicUser; token: string }> {
  const identifier = identifierRaw.trim().replace(/^@/, "");
  const invalid = new ApiError(401, "invalid_credentials", "invalid username or password");
  const user = /^[0-9]{8}$/.test(identifier)
    ? await db.findUserByCommunicaId(identifier)
    : await db.findUserByUsername(normalizeUsername(identifier));
  if (user === null) throw invalid;
  const ok = await hasher.verify(password, user.passwordHash);
  if (!ok) throw invalid;
  await db.updateLastSeen(user.id, now());
  const token = signer.sign(
    { userId: user.id, username: user.username },
    JWT_LIFETIME_DAYS,
  );
  return { user: toPublicUser(user), token };
}

/** Verify a JWT from an Authorization header / socket handshake and
 *  return its payload. Throws 401 via the signer on any failure;
 *  callers map that to "unauthenticated" (ALGORITHMS: AUTH). */
export function verifyAuthToken(signer: TokenSigner, token: string): JwtPayload {
  return signer.verify(token);
}
