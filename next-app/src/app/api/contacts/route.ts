export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isBlockedEitherDirection, publicProfile, resolveUserId } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";

/** Supporting route for the §7 call gate (not a Step 3 headline
 *  route): without a way to create/accept contacts, no call could
 *  ever pass the accepted-contact gate.
 *  GET /api/contacts — my contact rows with public profiles.
 *  POST — request: { identifier } (accepted=false). The call gate
 *  needs the CALLEE's row to be accepted, so a request alone never
 *  enables calls.
 *  PATCH — accept: { identifier, accepted:true }. */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const rows = await prisma.contact.findMany({
      where: { ownerId: auth.userId },
      include: { contactUser: true },
    });
    return json({
      contacts: rows.map((r) => ({
        ...publicProfile(r.contactUser),
        nickname: r.nickname, isFavorite: r.isFavorite, isBlocked: r.isBlocked, accepted: r.accepted,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const contactUserId = asString(body.contactUserId) ? asString(body.contactUserId) : await resolveUserId(prisma, asString(body.identifier));
    if (contactUserId === auth.userId) throw badRequest("cannot add yourself as a contact");
    const target = await prisma.user.findUnique({ where: { id: contactUserId } });
    if (target === null) throw notFound("user not found");
    // F8: blocked in either direction => no new contact-request row.
    // BLOCK RULE (decided and documented in SECURITY.md + the
    // messages route): blocking is enforced for 1:1 traffic —
    // contact creation, DIRECT chat creation, DIRECT messages and
    // calls all refuse a blocked user. It is NOT enforced on GROUP
    // messages: a blocked user already in a shared group can still
    // send there, because group membership is an admin decision
    // (admin-add and group creation refuse blocked users, and an
    // admin can remove a member). This scope is deliberate.
    if (await isBlockedEitherDirection(prisma, auth.userId, contactUserId)) {
      throw forbidden("cannot add a blocked user as a contact");
    }
    const existing = await prisma.contact.findUnique({
      where: { ownerId_contactUserId: { ownerId: auth.userId, contactUserId } },
    });
    if (existing !== null) throw conflict("contact already exists");
    const row = await prisma.contact.create({ data: { ownerId: auth.userId, contactUserId, accepted: false } });
    // ACCEPT-FIX (2026-11-03): a request must be visible to the target,
    // otherwise nobody can ever accept it from the UI. Mirror a pending
    // row for the target (accepted=false). Accepting that row is what
    // the call gate checks: owner=callee, contactUser=caller, accepted=true.
    try {
      const targetRow = await prisma.contact.findUnique({ where: { ownerId_contactUserId: { ownerId: contactUserId, contactUserId: auth.userId } } });
      if (targetRow === null) await prisma.contact.create({ data: { ownerId: contactUserId, contactUserId: auth.userId, accepted: false } });
    } catch {}
    return json({ contact: { accepted: row.accepted, isFavorite: row.isFavorite, isBlocked: row.isBlocked } }, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const contactUserId = asString(body.contactUserId) ? asString(body.contactUserId) : await resolveUserId(prisma, asString(body.identifier));
    const existing = await prisma.contact.findUnique({
      where: { ownerId_contactUserId: { ownerId: auth.userId, contactUserId } },
    });
    if (existing === null) throw notFound("contact request not found");
    const updated = await prisma.contact.update({
      where: { ownerId_contactUserId: { ownerId: auth.userId, contactUserId } },
      data: {
        ...(typeof body.accepted === "boolean" ? { accepted: body.accepted } : {}),
        ...(typeof body.isFavorite === "boolean" ? { isFavorite: body.isFavorite } : {}),
        ...(typeof body.isBlocked === "boolean" ? { isBlocked: body.isBlocked } : {}),
        ...(typeof body.nickname === "string" ? { nickname: body.nickname } : {}),
      },
    });
    return json({ contact: { accepted: updated.accepted, isFavorite: updated.isFavorite, isBlocked: updated.isBlocked, nickname: updated.nickname } });
  } catch (err) {
    return handleError(err);
  }
}
