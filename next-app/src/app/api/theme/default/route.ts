export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { DEFAULT_THEME, DEFAULT_THEME_SETTING_KEY, isThemeId } from "@/lib/theme";
import { json } from "@/lib/http";

/** GET /api/theme/default — PUBLIC platform default theme.
 *  No authentication: unauthenticated pages (landing, login,
 *  register) and users with no saved theme resolve through this.
 *  Returns { theme, source }: source is "setting" when a valid
 *  PlatformSetting value exists, otherwise "fallback" (Theme P).
 *  This endpoint NEVER fails the page: a missing/invalid setting
 *  or an unconfigured database still returns 200 with the fallback,
 *  because the default theme is a soft preference, not a hard
 *  resource. The client treats any non-200 here as fallback too. */
export async function GET() {
  try {
    const prisma = getPrisma();
    const setting = await prisma.platformSetting.findUnique({ where: { key: DEFAULT_THEME_SETTING_KEY } });
    if (setting && isThemeId(setting.value)) {
      return json({ theme: setting.value, source: "setting" });
    }
    return json({ theme: DEFAULT_THEME, source: "fallback" });
  } catch {
    return json({ theme: DEFAULT_THEME, source: "fallback" });
  }
}
