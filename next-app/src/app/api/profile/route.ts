export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";
import { validateLengths } from "@/lib/validation";

/** GET /api/profile — the caller's own profile (never passwordHash).
 *  PATCH — displayName / bio / avatarUrl only. Username and
 *  communicaId are immutable (they are other users' lookup keys). */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (user === null) throw badRequest("user not found");
    const { passwordHash: _h, ...pub } = user;
    void _h;
    return json({ profile: pub });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
    const bio = typeof body.bio === "string" ? body.bio : undefined;
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : undefined;
    if (avatarUrl !== undefined && avatarUrl !== "" && !avatarUrl.startsWith("/uploads/")) {
      throw badRequest("avatar must be uploaded through /api/media");
    }
    validateLengths({ displayName, bio });
    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(bio !== undefined ? { bio: bio === "" ? null : bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl === "" ? null : avatarUrl } : {}),
      },
    });
    const { passwordHash: _h, ...pub } = updated;
    void _h;
    return json({ profile: pub });
  } catch (err) {
    return handleError(err);
  }
}
