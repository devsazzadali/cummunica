# Communica — Theme System (Workstream 3) — Report, 2026-11-03

## Standing rules recorded here (for all future theme edits)

1. **Text changes WITH the theme, automatically, all at once.** Every
   colour in the app comes from theme CSS variables; switching theme =
   changing the single `data-theme` attribute on `<html>`. No rule
   outside the four theme blocks in `next-app/src/app/globals.css`
   contains a hardcoded colour. Text, bubbles, backgrounds, borders,
   inputs, badges and shadows change in the same render — text can
   never lag behind a background.
2. **A theme is NOT only a colour swap.** Each theme has its own
   bubble radius/padding/shadow/border, card radius/shadow/border,
   button radius/weight/shadow, header treatment, row spacing, avatar
   shape/ring and heading emphasis (table below). Colour-only
   difference between two themes is a FAIL.
3. **Contrast QA is computed, not eyeballed.** Every text/background
   pair must be ≥ 4.5:1 (WCAG AA, normal text). A theme with any
   unreadable text FAILS even if the build passes.
4. **UI/UX review gate (standing workflow):** after UI design, before
   development counts as done, a UI/UX review against the 10-item
   checklist (§8) must happen; build pass alone does not count.

## 1. The four themes

### Colour tokens

| | P Magenta Pop | V Royal Violet | C Sunset Coral | D Midnight Dark |
|---|---|---|---|---|
| header | #C2185B solid | gradient #5B21B6→#7C3AED | #FDF8F3 minimal + 3px #EA580C underline | gradient #0F172A→#1E293B + 2px #F59E0B underline |
| accent / accent-dark | #E91E63 / #AD1457 | #7C3AED / #5B21B6 | #EA580C / #9A3412 | #FBBF24 / #F59E0B |
| own bubble | #FCE4EC, text #22181E | #EDE9FE, text #1E1B2E | #FFEDD5, text #241A14 | #F59E0B, text #1A1005, border #92400E |
| other bubble | #FFFFFF, text #22181E | #FFFFFF, text #1E1B2E | #FFFFFF, text #241A14 | #26334D, text #F1F5F9, border #334155 |
| chat bg / screen / surface | #FDF2F5 / #FAF7F8 / #FFFFFF | #F3F0FA / #F8F7FC / #FFFFFF | #FFF7ED / #FDF8F3 / #FFFFFF | #111A2E / #0B1220 / #1B2436 |
| input bg | #FFFFFF | #FFFFFF | #FFFFFF | #1E293B |
| text / muted / muted-dark | #22181E / #6B5B63 / #54424C | #1E1B2E / #6B5F7D / #564D6B | #241A14 / #6B5548 / #57453A | #F1F5F9 / #AEBBD0 / #C3CEDD |
| own-bubble metadata | #54424C | #564D6B | #57453A | #3A2A08 (light metadata would vanish on gold) |
| placeholder | #6B5B63 | #6B5F7D | #6B5548 | #93A4BC |
| primary button | #C2185B / white | #5B21B6 / white | #C2410C / white | #F59E0B / #1A1005 |
| badge | #AD1457 / white | #5B21B6 / white | #9A3412 / white | #F59E0B / #1A1005 |
| danger (all themes) | #DC2626 / white | same | same | same |

P/V/C tokens are EXACTLY `brand/COLOUR_RESEARCH.md` §2. D is new:
deep ink backgrounds, light readable text, vivid amber/gold accent
(not WhatsApp green, not plain blue). Full D record appended to
`brand/COLOUR_RESEARCH.md` §5; mockups in `brand/theme-d/`.

### Design tokens (per theme — this is what makes them feel different)

| | P | V | C | D |
|---|---|---|---|---|
| bubble radius | 20px pill | 12px, tail-feel corners (4px bottom corner on the speaking side) | 24px pill, roomy | 10px, bordered, no shadow |
| bubble padding / shadow | 10px 16px / soft shadow | 9px 14px / none | 12px 18px / light shadow | 9px 14px / none |
| card radius / shadow / border | 20px / deep tinted shadow / none | 12px / hairline shadow / 1px | 24px / none (flat) / 1px | 14px / deep dark shadow / 1px |
| button radius / weight / shadow | pill 999px / 700 / tinted shadow | 12px rect / 600 / none | 14px / 700 / warm shadow | 10px / 600 / none |
| header treatment | solid | gradient | minimal (surface bg, dark text, accent underline) | dark gradient + gold underline |
| chat-row padding / gap | 12px 16px / 12px | 10px 16px / 10px | 14px 16px / 14px | 11px 16px / 12px |
| avatar | circle 50% | squircle 28% | circle 50% | circle + 2px gold ring |
| heading (h1) | 24px / 800 / −0.02em | 22px / 700 / 0 | 26px / 800 / −0.01em | 20px / 600 / +0.02em |

Touch targets stay ≥ 44px in ALL themes: row min-height 72px,
buttons/inputs 44px, bottom nav 56px (density changes never shrink
a target). Avatar *size* in-app stays prop-driven (component
instances keep explicit sizes for accessibility); avatar *shape and
ring* follow the theme, and the CSS avatar size token applies to
class-based avatars and the brand mockups.

## 2. Contrast QA (computed, WCAG relative-luminance formula)

33 pairs per theme × 4 themes = 132 pairs, **0 failures**.
Pairs covered: primary text on surface/screen/chat/own/other/input;
muted on surface/screen/chat/input; muted-dark on
surface/screen/chat/own/other; header text + header tab on header;
link on surface/chat/screen; badge, primary-button and bright-button
text on their backgrounds; placeholder on input; active-nav on
surface; group sender name on other bubble; error/success/warning
text on their backgrounds; white on both auth-gradient endpoints;
avatar text on avatar background.

Worst pairs (still passing): link on chat bg 4.88:1 (P/C),
header-tab on header 4.88:1 (C: #FFEDD5 active-tab text is not used
there — the tight C pair is tab #57453A on header #FDF8F3 at 4.91:1),
header text on header 4.91:1 (C: #C2410C on #FDF8F3), link on screen
4.91:1, button text 5.18:1 (C). Theme minima: P 4.88:1, V 5.24:1,
C 4.88:1, D 5.77:1 (D worst = placeholder #93A4BC on #1E293B).
D headline pairs: body text on background 17.09:1, own-bubble text
on own bubble 8.73:1, other-bubble text on other bubble 11.53:1,
button text on accent 8.73:1, muted on background 9.65:1.
Note: bright accent colours are NEVER used for white text in P/C
(white on #E91E63 is 4.35:1, on #EA580C 3.56:1 — both fail); buttons
and badges use the deep header/accent-dark colours instead.

## 3. How resolution works (file/function pointers)

Order (fixed): (a) logged-in user's DB `User.theme` → (b) platform
default `PlatformSetting "default_theme"` → (c) fallback Theme P.
Unauthenticated pages use (b), falling back to (c) — never a
previous user's localStorage mirror.

- `next-app/src/lib/theme.ts` — single source of truth: `THEME_IDS`
  (`p/v/c/d`), `THEMES` (name/tagline/preview swatches),
  `DEFAULT_THEME="p"`, `THEME_STORAGE_KEY="communica_theme"`,
  `isThemeId`, `applyTheme` (one `data-theme` attribute change +
  mirror), `readThemeMirror`, `hasSessionToken`.
- `next-app/src/app/globals.css` — `:root` IS Theme P (SSR/no-JS
  fallback); `[data-theme="v|c|d"]` override it. All app rules use
  `--t-*` variables only. Old class names kept for compatibility
  (`.btn-green` = primary theme button, `.btn-pink` = theme-gradient
  auth button) but their colours now come from variables.
- `next-app/src/app/layout.tsx` — `<html data-theme="p">` plus a
  pre-paint inline script: if a session token exists, apply the
  mirror before first paint (token-gated so logged-out pages never
  get a previous user's theme). `themeColor` is Theme P's header
  (#C2185B) as a static browser-chrome fallback only — documented
  in the file; per-theme browser chrome is impossible from static
  metadata.
- `next-app/src/components/theme-provider.tsx` — on mount: logged-in
  → mirror instantly, then `/api/profile`; a DB theme OVERWRITES
  the mirror; DB null → platform default. Logged-out → public
  default endpoint, else P. Never blocks rendering.
- `next-app/src/app/login/page.tsx` — after login success, fetches
  profile theme (DB wins) else platform default, applies it, never
  blocks the login success on failure. Register does the same with
  the platform default (new accounts have no saved theme).
- `next-app/src/app/settings/page.tsx` — on profile load, applies
  the DB theme (overwriting the mirror). Logout clears token, user
  AND `communica_theme`, then applies the platform default before
  navigating home (layout does not remount on navigation, so the
  provider alone would not re-run after logout).
- Auth pages: layout/structure, field names, API calls unchanged
  (Workstream 1). Only colours/gradient/shadow/radius follow the
  active theme via variables (`.auth-brand`, `.btn-pink`).

## 4. Endpoints (all validated, all gated)

| Endpoint | Auth | Behaviour |
|---|---|---|
| `GET /api/theme/default` | public | Returns `{theme, source}`. Missing/invalid setting or no DB → 200 `{theme:"p", source:"fallback"}` (soft preference, never fails the page). Client also treats non-200 as fallback. |
| `GET /api/profile` | JWT 401 | Includes `theme` (id or null) in the profile (passwordHash never returned). |
| `PATCH /api/profile` | JWT 401 | Accepts `theme` = one of p/v/c/d, or `null` to clear the preference (→ platform default). Invalid id → **400, validated before any DB access** (fixed during QA: the original order called `getPrisma()` first, so a bad id returned 503 without a DB — now 400). Also the Settings picker save path. Other PATCH fields unchanged. |
| `GET /api/admin/settings/default-theme` | JWT 401 + interim admin 403 | Returns current default (`{theme, source}`). |
| `POST /api/admin/settings/default-theme` | JWT 401 + interim admin 403 | Body `{theme}` must be p/v/c/d else 400 (before DB access). Upserts `PlatformSetting "default_theme"`. |

Interim admin gate: `next-app/src/lib/support.ts`
`requireInterimAdmin(callerEmail, denialMessage)` — the caller's
stored DB email must equal deploy-time env `SUPER_ADMIN_EMAIL`;
NO email is hardcoded anywhere; absent env → fail closed 403.
`requireInterimSupportAdmin` now delegates to it with its exact
original message (support behaviour unchanged). **In a code comment
(`src/app/api/admin/settings/default-theme/route.ts`) and here:**
this interim gate migrates to the `User.role` gate in
admin-dashboard Phase 4/5; the admin-dashboard UI control for this
setting comes later in Phase 3 — this step is backend setting + API
only, no admin UI page, and the gate grants NO access to private
chats.

## 5. Settings picker behaviour

Settings → "Theme" section (below Save profile): four options with
NAME + COLOUR PREVIEW SWATCHES (header chip, own-bubble chip,
other-bubble chip from `THEMES`) plus a fifth "Platform default"
option (clears the saved preference). Each option is a radio-style
button (≥ 44px, labelled radiogroup); tapping saves immediately via
`PATCH /api/profile`, applies instantly in the same render, and
shows "Theme saved to the server" (`role="status"`) or an honest
error. Because the DB value is re-applied after every login, the
choice survives logout/login even if the localStorage mirror is
stale or deleted.

## 6. Storage / schema

- `User.theme String?` (null = no preference) added to BOTH
  `next-app/prisma/schema.prisma` AND `prisma/schema.prisma`;
  the two files are byte-identical (verified by `diff`).
- `PlatformSetting { key String @id, value String, updatedAt }`
  added to both schemas, in sync.
- `prisma validate` + `prisma generate` pass (placeholder
  `DATABASE_URL` env value for the local check only — no real
  credential, no `.env` file created). **NO `prisma db push`.**
- Local mirror: `localStorage "communica_theme"`, best-effort
  only; the DB value is the source of truth on login.

## 7. Verification (what was actually run)

- `npx tsc --noEmit` → exit 0. `npm run build` → exit 0 (21 pages).
  `prisma validate` + `generate` → pass. Schemas byte-in-sync.
- No WhatsApp-green tokens in live code: grep for
  #075E54/#128C7E/#25D366/#D9FDD3/#ECE5DD in `src/` → none (historic
  notes in `.md` files only).
- No hardcoded hex outside theme definitions: grep over
  `src/**/*.ts(x)` → hex appears ONLY in `src/lib/theme.ts`
  (picker preview data — the theme definition source, values
  identical to `globals.css`) and `src/app/layout.tsx`
  (static PWA `themeColor` = fallback Theme P header, documented).
  All hex in `globals.css` sits inside the four theme blocks
  (lines ≤ 108); every rule below them uses variables only.
  `btn-green`/`btn-bright` class names are retained but are
  variable-driven, not green.
- Production server run locally (placeholder `JWT_SECRET` only, NO
  live DB, NO real credentials), then stopped:
  - `GET /api/theme/default` → 200 `{"theme":"p","source":"fallback"}`.
  - `GET /api/profile`, `GET /api/admin/...` without token → 401.
  - `PATCH /api/profile {"theme":"x"}` with a placeholder-secret
    test JWT, no DB → **400** (after the ordering fix; was 503).
  - `PATCH /api/profile {"theme":"v"}` with no DB → honest 503
    `db_not_configured` (persistence needs the DB, as designed).
  - `POST /api/admin/... {"theme":"banana"}` → 400; valid theme
    with no DB → 503 (admin gate needs the caller email from the
    DB, so the live 403 path is code-verified, not live-proven —
    see §9).
  - Landing/login/settings/support pages → 200.
- Screenshots (standalone Chrome, headless, `--no-sandbox`):
  app, 1280px, landing/login/chats/settings × 4 themes (16 files)
  in `responsive-check/` as `theme-<p|v|c|d>-<page>-1280.png`
  (plus `theme-p-login-360.png`), AND brand Theme D mockups
  desktop 1280 + mobile 360 in `brand/theme-d/`. All screenshots
  were visually checked for invisible/clashing text (see §8 for
  the two failures found and fixed). Note: an intermediate
  screenshot set was stale due to browser HTTP caching of the
  prerendered pages — caught by byte-identical hashes, re-shot
  with a cache-busting query, hashes confirmed changed.

## 8. UI/UX designer review (standing gate — own section)

Reviewer role: professional UI/UX designer, checking screenshots +
flows in all four themes, including login/register under each
theme. Items: (1) 5-second clarity, (2) recoverable navigation,
(3) action feedback, (4) preventable/recoverable errors,
(5) consistency, (6) accessibility, (7) one-line value + ONE
primary CTA, (8) honest trust signals, (9) discoverable
share/invite path, (10) mobile-first, no horizontal scroll.

| # | Finding | Verdict after fix |
|---|---|---|
| 1 | Every screen states its job at a glance: landing value line + "Register — get started"; login "Welcome back / Login to continue"; settings sections labelled; chats two-pane with "Select a chat…" placeholder. | PASS |
| 2 | App header + desktop tabs + bottom nav on every app screen; Back links on login/register and detail pages. No dead ends found except the one below. | PASS after fix |
| 3 | Login/register show busy state, success message and honest error (never silent); settings picker shows "Theme saved to the server" or an error; profile save shows saved/error. | PASS |
| 4 | Inline labels on every input; destructive actions: logout has no confirm dialog (pre-existing app-wide behaviour, not introduced by themes — flagged as follow-up for the parent to approve, not silently changed in a theme step). Errors never lose typed input on these screens (forms keep state on error). | PASS with noted follow-up |
| 5 | Same button styles, same terms ("Communica ID", "SAZMU AI"), same placement across screens; theme picker uses the same card/button language as the rest of Settings. | PASS |
| 6 | Touch ≥ 44px everywhere (checked: buttons/inputs 44, nav 56, rows 72); contrast 132/132 pairs ≥ 4.5:1 (computed, §2); focus outline = theme accent-dark (visible in all themes); every input labelled; Bengali line renders correctly in D chat mockup and in the app font stack (bundled Noto Sans Bengali). | PASS after fix |
| 7 | **FAIL found:** landing had THREE full-width competing buttons (Register, Login, Open chats) and Register/Login looked identical. **Fixed:** Register is now the single primary gradient button (`btn-pink`), Login is the secondary light button, "Open chats" removed (for logged-out visitors it only led to an unauthenticated error page). Verified in the re-shot P landing screenshot. Login/register themselves already had one primary button each. | PASS after fix |
| 8 | SAZMU AI labelled AI on landing, login brand panel and chat list; privacy note ("No real phone number is needed"); demo note is honest about template-only replies and unconfigured DB; NO invented counts/testimonials anywhere. | PASS |
| 9 | New Chat / Search people, New Group and Keypad affordances are on the chats screen (visible in the V chats screenshot); Settings links SAZMU setup, Archived, Favorites, Support. | PASS |
| 10 | Mobile 360: D brand chat-list mockup — no horizontal scroll (pills row scrolls intentionally inside its own container); app login 360 (P) — stacked brand panel + card, no horizontal scroll, all text readable. Theme row-padding changes are overridden at ≤ 360px (12px 10px) so density never breaks small screens. | PASS |
| — | **FAIL found (the warned bug class):** placeholder heading "Communica" on the chats two-pane was INVISIBLE in P and V (white `--t-header-text` on a light screen background), and the landing H1 was invisible in P/V for the same reason. **Fixed:** both now use `--t-text` (dark on light themes, light on dark: 15.7–17.1:1). Verified in re-shot P landing and V chats screenshots. Full audit of remaining `--t-header-text` uses: all sit on header/gradient backgrounds (correct); `--t-auth-text` sits only on auth gradients (endpoints all pass). | PASS after fix |
| — | Minor, not a fail: the Settings file-input "Choose File" button renders in the browser's native OS style in all themes (native control, not CSS-themeable without appearance hacks); its label text remains readable. Pills/filter rows show their own horizontal scrollbar on narrow widths by design (scrollable, not clipped content). | Noted |

UI/UX review verdict: **PASS after the two fixes above**
(invisible placeholder/landing headings; landing CTA hierarchy).
The logout-confirm follow-up is left for the parent's decision
because it changes app behaviour beyond the theme brief.

## 9. NOT live-proven (honest limits — no live DB in this step)

- Theme persistence end-to-end (save → logout → login → DB theme
  re-applied) and "DB wins over stale mirror" are implemented and
  code-reviewed, but NOT proven against a live database.
- Admin default-theme 403 for a non-admin caller, and default-theme
  changes applying to logged-out pages / no-preference users, are
  implemented per the gate code, but NOT proven live (both need the
  caller row from the DB; without a DB the endpoints honestly
  return 503 after validation).
- Live two-browser call/chat flows under each theme were not
  re-run; theme changes are CSS/attribute-only and touch no
  call/chat logic, but visual theme coverage of a live chat
  conversation (real bubbles) awaits the live-DB step — the brand
  mockups cover bubble rendering in all four themes.
- No deployment, no GitHub push, no `.env` file, no secrets in any
  file (verified: no `.env` in `next-app`; test JWTs used a
  placeholder secret only, never persisted).

## 10. Still pending (for the parent / later steps)

1. Live-DB push for `User.theme` + `PlatformSetting` (both schemas
   are ready and in sync; push is explicitly out of this step).
2. Live-DB theme persistence test (save → logout → login) and
   live admin 403 test + default-theme propagation test.
3. Admin-dashboard UI control for the default theme — Phase 3
   (backend + API done here; no admin UI page in this step).
4. Migration of the interim `SUPER_ADMIN_EMAIL` gate to the
   `User.role` gate — admin-dashboard Phase 4/5.
5. Logout-confirm dialog — UI/UX follow-up, needs parent approval
   (behaviour change beyond themes).
6. User's own deploy (per standing arrangement: the user deploys
   from the GitHub repo; this step does not deploy).

## Files changed / created

- `next-app/src/lib/theme.ts` (new), `src/components/theme-provider.tsx` (new)
- `next-app/src/app/globals.css` (rewritten as the theme system)
- `next-app/src/app/layout.tsx` (data-theme + pre-paint script + ThemeProvider)
- `next-app/src/app/page.tsx` (landing CTA hierarchy only)
- `next-app/src/app/settings/page.tsx` (theme picker + logout mirror handling)
- `next-app/src/app/login/page.tsx`, `src/app/register/page.tsx` (post-auth theme apply only)
- `next-app/src/app/api/profile/route.ts` (theme PATCH + validation-before-DB fix)
- `next-app/src/app/api/theme/default/route.ts` (new, public)
- `next-app/src/app/api/admin/settings/default-theme/route.ts` (new, admin-only)
- `next-app/src/lib/support.ts` (shared `requireInterimAdmin`; support messages unchanged)
- `next-app/prisma/schema.prisma` + `prisma/schema.prisma` (in sync)
- `brand/theme-d/chat-list.html`, `chat.html`, `login.html` + screenshots (desktop + mobile)
- `brand/COLOUR_RESEARCH.md` §5 (Theme D record appended; P/V/C untouched)
- `brand/screenshots/theme-d-*.png` (gallery copies)
- `responsive-check/theme-<p|v|c|d>-<landing|login|chats|settings>-1280.png`, `theme-p-login-360.png`
- Workstreams 1 (login/register) and 2 (support) logic untouched except
  theme-variable styling; `admin-designs/` and `admin-designs-v2/` untouched.
