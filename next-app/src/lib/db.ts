// Step 3 — Prisma adapters over the generated client.
// These are the ONLY places that touch Prisma models from routes, so
// no route handler ever returns a passwordHash: search returns the
// PublicProfile shape only (no id, no passwordHash, per ALGORITHMS §2).
import type { PrismaClient } from "@prisma/client";
import type { AuthDb, UserRow } from "./auth";
import { notFound } from "./errors";
import { isExactCommunicaId } from "./auth";

export interface PublicProfile {
  username: string;
  displayName: string;
  communicaId: string;
  avatarUrl: string | null;
  bio: string | null;
}

export function publicProfile(user: {
  username: string; displayName: string; communicaId: string;
  avatarUrl: string | null; bio: string | null;
}): PublicProfile {
  return {
    username: user.username,
    displayName: user.displayName,
    communicaId: user.communicaId,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
  };
}

type Db = PrismaClient;

export function authDb(prisma: Db): AuthDb {
  return {
    findUserByUsername: async (username) => {
      const u = await prisma.user.findUnique({ where: { username } });
      return u as UserRow | null;
    },
    findUserByCommunicaId: async (communicaId) => {
      const u = await prisma.user.findUnique({ where: { communicaId } });
      return u as UserRow | null;
    },
    createUser: async (input) => {
      const u = await prisma.user.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          communicaId: input.communicaId,
          passwordHash: input.passwordHash,
          email: input.email,
        },
      });
      return u as UserRow;
    },
    updateLastSeen: async (userId, at) => {
      await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: at } });
    },
  };
}

/** Blocked ids in BOTH directions (owner=me blocking them, or them blocking me). */
export async function blockedIdsBothDirections(prisma: Db, meId: string): Promise<string[]> {
  const rows = await prisma.contact.findMany({
    where: {
      isBlocked: true,
      OR: [{ ownerId: meId }, { contactUserId: meId }],
    },
    select: { ownerId: true, contactUserId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.ownerId === meId ? r.contactUserId : r.ownerId);
  }
  return Array.from(ids);
}

/** ALGORITHMS §2 search. Empty query => []. Exact 8-digit ID first,
 *  never falls through to username matching. F9: a digit-only query
 *  that is not exactly 8 digits returns [] BEFORE any username
 *  search — usernames may be digit-leading (^[a-z0-9_]+$), so a
 *  partial ID that is also a username prefix must never match. */
export async function searchUsers(prisma: Db, meId: string, queryRaw: string): Promise<PublicProfile[]> {
  const query = queryRaw.trim().replace(/^@/, "");
  if (query === "") return [];
  const excluded = new Set<string>(await blockedIdsBothDirections(prisma, meId));
  excluded.add(meId);
  if (isExactCommunicaId(query)) {
    const hit = await prisma.user.findUnique({ where: { communicaId: query } });
    if (hit !== null && !excluded.has(hit.id)) return [publicProfile(hit)];
    return [];
  }
  if (/^[0-9]+$/.test(query.replace(/^@/, ""))) return [];
  const normalized = query.replace(/^@/, "").toLowerCase();
  const exact = await prisma.user.findUnique({ where: { username: normalized } });
  if (exact !== null && !excluded.has(exact.id)) return [publicProfile(exact)];
  const prefix = await prisma.user.findMany({
    where: { username: { startsWith: normalized } },
    orderBy: { username: "asc" },
    take: 20,
  });
  return prefix.filter((u) => !excluded.has(u.id)).map(publicProfile);
}

/** INTERNAL-ONLY identifier resolution (for chat/contact creation).
 *  Never exposed through search — search returns PublicProfile only. */
export async function resolveUserId(prisma: Db, identifierRaw: string): Promise<string> {
  const identifier = identifierRaw.trim().replace(/^@/, "");
  const user = isExactCommunicaId(identifier)
    ? await prisma.user.findUnique({ where: { communicaId: identifier } })
    : await prisma.user.findUnique({ where: { username: identifier.toLowerCase() } });
  if (user === null) throw notFound("user not found");
  return user.id;
}

/** Call gate row: ownerId=callee, contactUserId=caller. */
export async function findContactGate(
  prisma: Db,
  calleeId: string,
  callerId: string,
): Promise<{ accepted: boolean; isBlocked: boolean } | null> {
  const row = await prisma.contact.findUnique({
    where: { ownerId_contactUserId: { ownerId: calleeId, contactUserId: callerId } },
    select: { accepted: true, isBlocked: true },
  });
  return row;
}

export async function isBlockedEitherDirection(
  prisma: Db,
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  const count = await prisma.contact.count({
    where: {
      isBlocked: true,
      OR: [
        { ownerId: userIdA, contactUserId: userIdB },
        { ownerId: userIdB, contactUserId: userIdA },
      ],
    },
  });
  return count > 0;
}
