export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { blockedIdsBothDirections } from "@/lib/db";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";
import { validateLengths } from "@/lib/validation";

/** Users whose statuses the viewer may see: self + accepted contacts
 *  in either direction, minus anyone blocked in either direction. */
async function visibleUserIds(prisma: ReturnType<typeof getPrisma>, meId: string): Promise<Set<string>> {
  const contacts = await prisma.contact.findMany({
    where: { accepted: true, OR: [{ ownerId: meId }, { contactUserId: meId }] },
    select: { ownerId: true, contactUserId: true },
  });
  const ids = new Set<string>([meId]);
  for (const c of contacts) ids.add(c.ownerId === meId ? c.contactUserId : c.ownerId);
  for (const b of await blockedIdsBothDirections(prisma, meId)) ids.delete(b);
  ids.add(meId);
  return ids;
}

/** GET /api/status — visible, unexpired statuses (newest first).
 *  ?mine=1 => own statuses only, with viewer lists.
 *  ?id= => one status, if visible to the caller. */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const params = new URL(request.url).searchParams;
    const now = new Date();
    if (params.get("mine") === "1") {
      // StatusView has no User relation in the schema (viewerId only),
      // so viewers are joined manually — no schema change needed.
      const rows = await prisma.statusUpdate.findMany({
        where: { userId: auth.userId, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
      });
      const ids = rows.map((s) => s.id);
      const views = ids.length ? await prisma.statusView.findMany({ where: { statusId: { in: ids } } }) : [];
      const viewerIds = Array.from(new Set(views.map((v) => v.viewerId)));
      const viewers = viewerIds.length ? await prisma.user.findMany({ where: { id: { in: viewerIds } }, select: { id: true, username: true, displayName: true } }) : [];
      const byId = new Map(viewers.map((u) => [u.id, u]));
      return json({ statuses: rows.map((s) => ({ ...s, viewers: views.filter((v) => v.statusId === s.id).map((v) => byId.get(v.viewerId)).filter(Boolean) })) });
    }
    const id = params.get("id") ?? "";
    const visible = await visibleUserIds(prisma, auth.userId);
    if (id !== "") {
      const s = await prisma.statusUpdate.findUnique({
        where: { id },
        include: { user: { select: { username: true, displayName: true, communicaId: true } } },
      });
      if (s === null || s.expiresAt <= now || !visible.has(s.userId)) throw notFound("status not found");
      return json({ status: s });
    }
    const rows = await prisma.statusUpdate.findMany({
      where: { userId: { in: Array.from(visible) }, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true, displayName: true, communicaId: true } } },
    });
    return json({ statuses: rows });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/status
 *  - create: { text?, mediaUrl?, mediaMime? } — at least one required,
 *    text <= 500 chars, expires in exactly 24h. Media must be a
 *    /uploads/ URL produced by /api/media (never an arbitrary URL).
 *  - view: { action:"view", statusId } — only for visible statuses;
 *    records one StatusView per viewer (upsert, no duplicates). */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    if (body.action === "view") {
      const statusId = asString(body.statusId);
      const s = await prisma.statusUpdate.findUnique({ where: { id: statusId } });
      if (s === null || s.expiresAt <= new Date()) throw notFound("status not found");
      const visible = await visibleUserIds(prisma, auth.userId);
      if (!visible.has(s.userId)) throw forbidden("status is not visible to you");
      await prisma.statusView.upsert({
        where: { statusId_viewerId: { statusId, viewerId: auth.userId } },
        update: { viewedAt: new Date() },
        create: { statusId, viewerId: auth.userId },
      });
      return json({ viewed: true });
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl : "";
    // NOTE: StatusUpdate has no mediaMime column (mediaUrl extension
    // + the /api/media validation already pin the type); do not invent one.
    if (text === "" && mediaUrl === "") throw badRequest("status needs text or a photo");
    if (text.length > 500) throw badRequest("status text is too long (max 500 characters)");
    if (mediaUrl !== "" && !mediaUrl.startsWith("/uploads/")) throw badRequest("status media must be uploaded through /api/media");
    validateLengths({ text });
    const created = await prisma.statusUpdate.create({
      data: {
        userId: auth.userId, text: text === "" ? null : text,
        mediaUrl: mediaUrl === "" ? null : mediaUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return json({ status: created }, 201);
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/status?id= — owner only. */
export async function DELETE(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const s = await prisma.statusUpdate.findUnique({ where: { id } });
    if (s === null) throw notFound("status not found");
    if (s.userId !== auth.userId) throw forbidden("only the owner can delete a status");
    await prisma.statusUpdate.delete({ where: { id } });
    return json({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
