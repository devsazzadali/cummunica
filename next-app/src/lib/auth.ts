// Step 3 — custom JWT + bcrypt auth, mirroring backend/src/auth.ts.
// CUSTOM auth ONLY: NOT Neon Auth, NOT any third-party auth.
// Neon is the Postgres DB only. bcrypt cost 12, JWT lifetime 7 days.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { isTokenBlocked } from "./token-blocklist";
import { ApiError, badRequest, conflict, unauthenticated } from "./errors";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_COMMUNICA_ID_ATTEMPTS = 10;
export const JWT_LIFETIME_DAYS = 7;
export const BCRYPT_COST = 12;

export interface JwtPayload {
  userId: string;
  username: string;
  jti: string;
  exp?: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  communicaId: string;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRow = PublicUser & { passwordHash: string };

/** ALGORITHMS §1a: TRIM + LOWERCASE. Server does NOT silently rewrite
 *  other characters — anything outside ^[a-z0-9_]+$ is rejected. The
 *  client strips a leading "@" before calling. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function stripAt(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

export function validateUsername(username: string): void {
  if (username.length < 3 || username.length > 20) {
    throw badRequest("username must be 3-20 characters");
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    throw badRequest("username may contain only letters, numbers, underscore");
  }
}

export function isExactCommunicaId(value: string): boolean {
  return /^[0-9]{8}$/.test(value);
}

/** ALGORITHMS §1c: first digit 1-9, so the ID is always exactly 8 digits. */
export function generateCommunicaId(
  randomInt: (min: number, max: number) => number = secureRandomInt,
): string {
  return String(randomInt(10000000, 99999999));
}

export function secureRandomInt(min: number, max: number): number {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new ApiError(500, "random_unavailable", "secure random source unavailable");
  }
  const range = max - min + 1;
  const bytes = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / range) * range;
  for (;;) {
    cryptoObj.getRandomValues(bytes);
    const value = bytes[0] as number;
    if (value < limit) return min + (value % range);
  }
}

export function toPublicUser(user: UserRow): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  void _passwordHash;
  return rest;
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, "auth_not_configured", "JWT_SECRET is not configured in this environment");
  }
  return secret;
}

export function signToken(payload: { userId: string; username: string }): string {
  // jti enables server-side logout revocation (see token-blocklist.ts).
  return jwt.sign({ ...payload, jti: randomUUID() }, jwtSecret(), { expiresIn: `${JWT_LIFETIME_DAYS}d` });
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, jwtSecret()) as JwtPayload;
    if (typeof decoded.userId !== "string" || typeof decoded.username !== "string" || typeof decoded.jti !== "string") {
      throw unauthenticated();
    }
    // Revoked on logout => 401, exactly like a forged/expired token.
    if (isTokenBlocked(decoded.jti)) throw unauthenticated();
    return { userId: decoded.userId, username: decoded.username, jti: decoded.jti, exp: decoded.exp };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw unauthenticated();
  }
}

/** Extract + verify a JWT from `Authorization: Bearer <token>`.
 *  Missing / expired / invalid token => 401 unauthenticated. */
export function requireAuth(request: Request): JwtPayload {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match || !match[1]) throw unauthenticated();
  return verifyToken(match[1]);
}

/** Narrow DB surface the auth service needs (Prisma adapter in db.ts,
 *  in-memory mock in tests). */
export interface AuthDb {
  findUserByUsername(username: string): Promise<UserRow | null>;
  findUserByCommunicaId(communicaId: string): Promise<UserRow | null>;
  createUser(input: {
    username: string;
    displayName: string;
    communicaId: string;
    passwordHash: string;
    email: string | null;
  }): Promise<UserRow>;
  updateLastSeen(userId: string, at: Date): Promise<void>;
}

/** ALGORITHMS §1 register. Registration works with username + password
 *  only; email is optional. Returns public user (never passwordHash),
 *  the generated communicaId, and a JWT. */
export async function registerUser(
  db: AuthDb,
  input: { username: string; displayName: string; password: string; email?: string | null },
): Promise<{ user: PublicUser; communicaId: string; token: string }> {
  const username = normalizeUsername(input.username);
  validateUsername(username);
  const displayName = input.displayName.trim();
  if (displayName === "") throw badRequest("display name is required");
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest("password must be at least 8 characters");
  }
  const email = input.email?.trim() ? input.email.trim() : null;
  if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest("email address is invalid");
  }
  const existing = await db.findUserByUsername(username);
  if (existing !== null) throw conflict("username already taken");

  let communicaId = "";
  for (let attempts = 0; attempts < MAX_COMMUNICA_ID_ATTEMPTS; attempts++) {
    const candidate = generateCommunicaId();
    const collision = await db.findUserByCommunicaId(candidate);
    if (collision === null) {
      communicaId = candidate;
      break;
    }
  }
  if (communicaId === "") {
    throw new ApiError(500, "id_allocation_failed", "could not allocate a Communica ID, try again");
  }
  const passwordHash = await hashPassword(input.password);
  const user = await db.createUser({ username, displayName, communicaId, passwordHash, email });
  const token = signToken({ userId: user.id, username: user.username });
  return { user: toPublicUser(user), communicaId, token };
}

/** ALGORITHMS §1 login by @username OR exact 8-digit Communica ID.
 *  Identical 401 message for missing user vs wrong password, so one
 *  cannot be distinguished from the other. Updates lastSeenAt. */
export async function loginUser(
  db: AuthDb,
  identifierRaw: string,
  password: string,
): Promise<{ user: PublicUser; token: string }> {
  const identifier = stripAt(identifierRaw);
  const invalid = new ApiError(401, "invalid_credentials", "invalid username or password");
  const user = isExactCommunicaId(identifier)
    ? await db.findUserByCommunicaId(identifier)
    : await db.findUserByUsername(normalizeUsername(identifier));
  if (user === null) throw invalid;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw invalid;
  await db.updateLastSeen(user.id, new Date());
  const token = signToken({ userId: user.id, username: user.username });
  return { user: toPublicUser(user), token };
}
