export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";
import { validateLengths } from "@/lib/validation";
import { isThemeId } from "@/lib/theme";

/** GET /api/profile — the caller's own profile (never passwordHash).
 *  The profile includes theme (the user's saved theme id, or null).
 *  PATCH — displayName / bio / avatarUrl / theme. Username and
 *  communicaId are immutable (they are other users' lookup keys).
 *  theme, when present, must be one of p/v/c/d (else 400, validated
 *  BEFORE any DB access); theme: null clears the preference so the
 *  platform default applies. This is also the endpoint the Settings
 *  theme picker saves through. */
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
    const body = await readJson(request);
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
    const bio = typeof body.bio === "string" ? body.bio : undefined;
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : undefined;
    // Theme validation runs before getPrisma() so an invalid id is a
    // 400 even when no DB is configured (otherwise a 503 masks it).
    let theme: string | null | undefined;
    if (body.theme !== undefined) {
      if (body.theme === null) theme = null;
      else if (isThemeId(body.theme)) theme = body.theme;
      else throw badRequest("theme must be one of: p, v, c, d");
    }
    if (avatarUrl !== undefined && avatarUrl !== "" && !avatarUrl.startsWith("/uploads/")) {
      throw badRequest("avatar must be uploaded through /api/media");
    }
    validateLengths({ displayName, bio });
    // getPrisma() only AFTER all validation, so a 400 is never
    // masked by a 503 when no DB is configured (theme fix, WS3).
    const prisma = getPrisma();
    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(bio !== undefined ? { bio: bio === "" ? null : bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl === "" ? null : avatarUrl } : {}),
        ...(theme !== undefined ? { theme } : {}),
      },
    });
    const { passwordHash: _h, ...pub } = updated;
    void _h;
    return json({ profile: pub });
  } catch (err) {
    return handleError(err);
  }
}
