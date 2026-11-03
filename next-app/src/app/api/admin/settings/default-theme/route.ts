export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { handleError, json, readJson } from "@/lib/http";
import { requireInterimAdmin } from "@/lib/support";
import { DEFAULT_THEME, DEFAULT_THEME_SETTING_KEY, isThemeId } from "@/lib/theme";

/** GET / POST /api/admin/settings/default-theme — ADMIN ONLY.
 *  INTERIM GATE (see src/lib/support.ts requireInterimAdmin): the
 *  caller's stored DB email must equal deploy-time env
 *  SUPER_ADMIN_EMAIL — no email is hardcoded anywhere. Absent env
 *  var => fail closed 403. This interim gate migrates to the
 *  User.role gate in admin-dashboard Phase 4/5; the admin-dashboard
 *  UI control for this setting comes later in Phase 3. This step is
 *  backend setting + API only — there is NO admin UI page here, and
 *  this gate grants NO access to private chats.
 *  GET returns the current default ({ theme, source }). POST body
 *  { theme } must be one of p/v/c/d (else 400, validated BEFORE
 *  any DB access). Unauthenticated => 401; non-admin => 403. */
async function requireAdmin(request: Request) {
  const auth = requireAuth(request);
  const prisma = getPrisma();
  const caller = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
  requireInterimAdmin(caller?.email ?? null, "only the admin can change the default theme");
  return prisma;
}

export async function GET(request: Request) {
  try {
    const prisma = await requireAdmin(request);
    const setting = await prisma.platformSetting.findUnique({ where: { key: DEFAULT_THEME_SETTING_KEY } });
    if (setting && isThemeId(setting.value)) {
      return json({ theme: setting.value, source: "setting" });
    }
    return json({ theme: DEFAULT_THEME, source: "fallback" });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const body = await readJson(request);
    if (!isThemeId(body.theme)) throw badRequest("theme must be one of: p, v, c, d");
    const prisma = getPrisma();
    const caller = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
    requireInterimAdmin(caller?.email ?? null, "only the admin can change the default theme");
    const saved = await prisma.platformSetting.upsert({
      where: { key: DEFAULT_THEME_SETTING_KEY },
      update: { value: body.theme },
      create: { key: DEFAULT_THEME_SETTING_KEY, value: body.theme },
    });
    void auth;
    return json({ theme: saved.value, source: "setting" });
  } catch (err) {
    return handleError(err);
  }
}
