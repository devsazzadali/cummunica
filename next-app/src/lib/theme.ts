// Theme system (Workstream 3, 2026-11-03) — single source of truth for
// theme ids, used by BOTH client code (picker, provider, login) and
// server routes (profile PATCH, admin default-theme). No colours live
// here: every colour and every design token (bubble radius, card
// radius/shadow, button radius/weight, header treatment, spacing,
// avatar shape, heading emphasis) lives ONLY in globals.css, one
// variable set per data-theme value. Switching theme = changing the
// single data-theme attribute on <html>; text, bubbles, backgrounds,
// borders, inputs, badges and shadows all change in the same render,
// so text can never lag behind a background change (the user's
// text-colour rule). No component or page may hardcode a hex colour.
//
// Resolution order (fixed by user decision):
//   (a) logged-in user's saved User.theme from the DB,
//   (b) platform default theme from PlatformSetting "default_theme",
//   (c) fallback Theme V ("v") — user-confirmed default theme 2026-11-03
//       (photo of the violet chat list sent by the user).
// Unauthenticated pages use (b), falling back to (c) — never the
// previous user's localStorage mirror. The DB value is the source of
// truth on login: after login / profile fetch the mirror is
// overwritten from the DB value, so a stale mirror never wins.
// The localStorage mirror exists only so a logged-in user's theme
// applies instantly, before the profile round-trip finishes.

export const THEME_IDS = ["p", "v", "c", "d"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "v";
export const THEME_STORAGE_KEY = "communica_theme";
export const DEFAULT_THEME_SETTING_KEY = "default_theme";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /** Swatch colours for the Settings picker preview. These are the
   *  theme's own header + bubble colours (same values as globals.css);
   *  they are preview data only — the app itself is styled by CSS
   *  variables, never by these values. */
  header: string;
  bubbleMe: string;
  bubbleOther: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "p", name: "Magenta Pop", tagline: "Energetic pink-led, pill bubbles", header: "#C2185B", bubbleMe: "#FCE4EC", bubbleOther: "#FFFFFF" },
  { id: "v", name: "Royal Violet", tagline: "Premium violet, squarer bubbles", header: "#5B21B6", bubbleMe: "#EDE9FE", bubbleOther: "#FFFFFF" },
  { id: "c", name: "Sunset Coral", tagline: "Warm coral, roomy rounded cards", header: "#C2410C", bubbleMe: "#FFEDD5", bubbleOther: "#FFFFFF" },
  { id: "d", name: "Midnight Dark", tagline: "Deep ink dark mode, gold bubbles", header: "#0F172A", bubbleMe: "#F59E0B", bubbleOther: "#26334D" },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Validate a theme id from a request body. null/undefined means
 *  "no preference" (follow the platform default) — valid for the
 *  profile PATCH only. Any other value is a 400. */
export function parseThemePreference(value: unknown): ThemeId | null {
  if (value === undefined || value === null) return null;
  if (isThemeId(value)) return value;
  throw new Error("theme must be one of: p, v, c, d");
}

/** Apply a theme atomically: one attribute change restyles the whole
 *  app (colours + shapes + spacing + header treatment together).
 *  Also mirrors to localStorage for the instant-apply path. Safe to
 *  call during SSR (no-ops without a document). */
export function applyTheme(theme: ThemeId): void {
  try {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* non-browser / private mode: theme still applies via the
       attribute when a document exists; the mirror is best-effort */
    try {
      document.documentElement.setAttribute("data-theme", theme);
    } catch {
      /* ignore */
    }
  }
}

export function readThemeMirror(): ThemeId | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function hasSessionToken(): boolean {
  try {
    return localStorage.getItem("communica_token") !== null;
  } catch {
    return false;
  }
}
