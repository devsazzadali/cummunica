"use client";
import { useEffect } from "react";
import { applyTheme, DEFAULT_THEME, hasSessionToken, isThemeId, readThemeMirror } from "@/lib/theme";
import { apiJson } from "@/lib/api-client";

/** ThemeProvider — resolves the active theme once on mount and sets
 *  the single data-theme attribute (atomic switch: colours, text,
 *  bubbles, shapes and spacing change together).
 *  Resolution (fixed order): (a) logged-in user's DB theme,
 *  (b) platform default theme, (c) Theme V fallback (user-confirmed default).
 *  - Logged-in (a token exists): apply the localStorage mirror
 *    instantly, then fetch /api/profile; the DB value, when set,
 *    OVERWRITES the mirror. When the DB value is null, fall back to
 *    the platform default. Never blocks rendering: every fetch
 *    failure leaves the already-applied theme in place.
 *  - Logged-out: the mirror is IGNORED (it belongs to a previous
 *    user) and the platform default from the public endpoint is
 *    applied, falling back to Theme P. So a default-theme change
 *    applies to logged-out pages immediately.
 *  The pre-paint inline script in layout.tsx does the same instant
 *  mirror step (token-gated) before React hydrates, so there is no
 *  flash of the wrong theme for logged-in users. */
export default function ThemeProvider() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (hasSessionToken()) {
        const mirror = readThemeMirror();
        if (mirror) applyTheme(mirror);
        try {
          const d = (await apiJson("/api/profile")) as { profile: { theme?: string | null } };
          if (cancelled) return;
          if (isThemeId(d.profile.theme)) {
            applyTheme(d.profile.theme);
            return;
          }
        } catch {
          /* DB/profile unavailable: keep the mirror, then try default */
        }
        if (cancelled) return;
        try {
          const d = (await apiJson("/api/theme/default")) as { theme?: string };
          if (!cancelled && isThemeId(d.theme)) applyTheme(d.theme);
        } catch {
          /* keep mirror/fallback */
        }
        return;
      }
      try {
        const d = (await apiJson("/api/theme/default")) as { theme?: string };
        if (!cancelled && isThemeId(d.theme)) {
          document.documentElement.setAttribute("data-theme", d.theme);
        }
      } catch {
        if (!cancelled) document.documentElement.setAttribute("data-theme", DEFAULT_THEME);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
