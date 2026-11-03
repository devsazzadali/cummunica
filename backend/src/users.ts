// Communica backend — user search + contacts (Step 7 skeleton).
// Implements ALGORITHMS §2 exactly:
// - Communica ID search is EXACT-ONLY (full 8 digits). Partial ID
//   search is NOT supported, for anti-enumeration security.
// - An exact 8-digit query is an ID lookup FIRST and never falls
//   through to username matching on digits.
// - Username search: exact match first, then prefix, limit 20, ascending.
// - Only public profile fields are ever returned; blocked users are
//   excluded in BOTH directions; the searcher is always excluded.
// - SAZMU AI is NOT a User row, so it is never returned here: the
//   client appends it from a constant as a labelled AI contact.
//
// SKELETON NOTE: contact-request accept/decline is included because
// the schema has Contact.accepted and the call gate (calls.ts) depends
// on it; the Step 5/6 UI does not yet render a request flow (known
// limitation L5 in UI_TEST_REPORT.md).

import type { ContactRecord, PublicProfile, UserRecord } from "./types";
import { badRequest, conflict, notFound } from "./errors";

export const USERNAME_PREFIX_LIMIT = 20; // ALGORITHMS §2 chosen default

/** Narrow Db surface this module needs (production: Prisma Client). */
export interface UsersDb {
  findUserByUsername(username: string): Promise<UserRecord | null>;
  findUserByCommunicaId(communicaId: string): Promise<UserRecord | null>;
  /** Users whose username starts with `prefix`, ordered ascending. */
  findUsersByUsernamePrefix(prefix: string, limit: number): Promise<UserRecord[]>;
  findBlockedIdsBothDirections(userId: string): Promise<string[]>;
  findContact(ownerId: string, contactUserId: string): Promise<ContactRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  createContact(input: {
    ownerId: string;
    contactUserId: string;
    accepted: boolean;
  }): Promise<ContactRecord>;
  updateContact(
    ownerId: string,
    contactUserId: string,
    patch: Partial<Pick<ContactRecord, "isFavorite" | "isBlocked" | "accepted" | "nickname">>,
  ): Promise<ContactRecord>;
}

/** ALGORITHMS §2 PUBLIC_PROFILE — the only fields search returns. */
export function publicProfile(user: UserRecord): PublicProfile {
  return {
    username: user.username,
    displayName: user.displayName,
    communicaId: user.communicaId,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
  };
}

/**
 * ALGORITHMS §2 searchUsers. `meId` comes from AUTH (verified JWT).
 * Empty query returns [] — never an empty-query dump of users.
 */
export async function searchUsers(
  db: UsersDb,
  meId: string,
  queryRaw: string,
): Promise<PublicProfile[]> {
  const query = queryRaw.trim();
  if (query === "") return [];

  // Blocked-user exclusion set, both directions, plus the searcher.
  const excluded = new Set<string>(await db.findBlockedIdsBothDirections(meId));
  excluded.add(meId);

  // Exact 8-digit Communica ID match FIRST. No fall-through to
  // username matching on digits, and no partial-ID search.
  if (/^[0-9]{8}$/.test(query)) {
    const hit = await db.findUserByCommunicaId(query);
    if (hit !== null && !excluded.has(hit.id)) {
      return [publicProfile(hit)];
    }
    return [];
  }

  const normalized = query.toLowerCase();
  const exact = await db.findUserByUsername(normalized);
  if (exact !== null && !excluded.has(exact.id)) {
    return [publicProfile(exact)];
  }
  const prefixMatches = await db.findUsersByUsernamePrefix(
    normalized,
    USERNAME_PREFIX_LIMIT,
  );
  return prefixMatches
    .filter((user) => !excluded.has(user.id))
    .map(publicProfile);
}

/**
 * INTERNAL-ONLY helper (NOT an endpoint): resolve a public identifier
 * to a User id so a chat or contact can be created. Never expose this
 * through the search endpoint — search returns PublicProfile only,
 * which carries no id (ALGORITHMS §2).
 */
export async function resolveUserIdForChat(
  db: UsersDb,
  identifierRaw: string,
): Promise<string> {
  const identifier = identifierRaw.trim().replace(/^@/, "");
  const user = /^[0-9]{8}$/.test(identifier)
    ? await db.findUserByCommunicaId(identifier)
    : await db.findUserByUsername(identifier.toLowerCase());
  if (user === null) throw notFound("user not found");
  return user.id;
}

/**
 * Send a contact request. Creates a Contact row owned by the requester
 * with accepted=false. The call gate (calls.ts) requires the CALLEE's
 * row (ownerId=callee, contactUserId=caller) to be accepted, so a
 * request alone never enables calls. Requesting yourself or an
 * existing contact is rejected.
 */
export async function requestContact(
  db: UsersDb,
  ownerId: string,
  contactUserId: string,
): Promise<ContactRecord> {
  if (ownerId === contactUserId) {
    throw badRequest("cannot add yourself as a contact");
  }
  const target = await db.findUserById(contactUserId);
  if (target === null) throw notFound("user not found");
  const existing = await db.findContact(ownerId, contactUserId);
  if (existing !== null) throw conflict("contact already exists");
  return db.createContact({ ownerId, contactUserId, accepted: false });
}

/** Accept a contact request: sets accepted=true on MY row for them. */
export async function acceptContact(
  db: UsersDb,
  ownerId: string,
  contactUserId: string,
): Promise<ContactRecord> {
  const existing = await db.findContact(ownerId, contactUserId);
  if (existing === null) throw notFound("contact request not found");
  return db.updateContact(ownerId, contactUserId, { accepted: true });
}

/**
 * Favorite toggle for DIRECT chats (ALGORITHMS §3: favorites exist
 * only via Contact.isFavorite; GROUP chats never rank as favorites).
 * The Step 5/6 UI's ⭐ toggle maps to this endpoint.
 */
export async function setFavorite(
  db: UsersDb,
  ownerId: string,
  contactUserId: string,
  isFavorite: boolean,
): Promise<ContactRecord> {
  const existing = await db.findContact(ownerId, contactUserId);
  if (existing === null) {
    // No contact row yet: create an accepted=false row, then set the
    // favorite flag on it, so unfavouriting later still has a row.
    await db.createContact({ ownerId, contactUserId, accepted: false });
  }
  return db.updateContact(ownerId, contactUserId, { isFavorite });
}

/** Block a contact: blocked users are excluded from search (§2) and
 *  cannot call (calls.ts gate requires isBlocked=false). */
export async function setBlocked(
  db: UsersDb,
  ownerId: string,
  contactUserId: string,
  isBlocked: boolean,
): Promise<ContactRecord> {
  const existing = await db.findContact(ownerId, contactUserId);
  if (existing === null) throw notFound("contact not found");
  return db.updateContact(ownerId, contactUserId, { isBlocked });
}
