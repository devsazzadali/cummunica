# Communica Next.js — Full Bug Re-check (2026-11-03)

- **User question answered:** "Check the whole website again — is there any kind of bug?"
- **Method:** QA → Developer → PM loop. Four parallel QA workers tested one area
  each, the developer fixed every confirmed failure, QA re-tested, PM approved.
- **Test setup:** local build + local server on port 3101, **placeholder env only,
  NO live DB, NO real credentials**. Unauthenticated testing throughout, plus
  code-level review where a live DB would be needed. `npx tsc --noEmit` exit 0,
  `npm run build` exit 0 (22 pages, 87.3 kB shared JS). Test server stopped
  after re-testing.
- **Rules kept:** custom JWT+bcrypt auth only, no demo-only success, no fake
  data, no secrets in any file, no `.env` file, no deployment, no GitHub push,
  Lucide icons only, Direction A tokens only.
- **Verdict: 6 bugs found, all 6 fixed and re-tested to PASS. Zero open bugs
  from this re-check.**

## Bugs found and fixed

### B1 — Call signals relayed before accept (server-side) — Severity: MEDIUM
- **Where:** `src/app/api/calls/route.ts`, `action:"signal"` branch.
- **Evidence (QA worker, feature logic):** the branch checked only that the
  sender was a party to the call and that the signal shape validated; it did
  NOT check `call.startedAt !== null`. A modified client could queue an offer
  before the callee accepted. The shipped client was already safe (no peer
  connection exists pre-accept, so the signal is dropped client-side), but the
  server did not enforce the rule.
- **Fix:** reject signals while `startedAt === null`:
  `throw forbidden("call not accepted yet — signals are only relayed after accept")`.
- **Re-test:** code re-read after fix; live-call proof still requires a
  two-browser mic/cam test after deploy (see Pending, not a new bug).

### B2 — Forged token leaked server config — Severity: MEDIUM
- **Where:** `src/lib/auth.ts`, `verifyToken()`.
- **Evidence (QA worker, API/security, live curl):** with no `JWT_SECRET`
  configured, a garbage/tampered Bearer token returned
  `500 {"error":"auth_not_configured","message":"JWT_SECRET is not configured
  in this environment"}` instead of a generic 401 — revealing server config
  state to a token probe. No user data leaked in any case (not a bypass).
- **Fix:** `verifyToken` now maps `auth_not_configured` to generic
  `401 unauthenticated`. `signToken` keeps its 500 (server-side login/register
  path, never a token probe).
- **Re-test (live, after rebuild + server restart):**
  `curl /api/profile -H 'Authorization: Bearer garbage-token-12345'` →
  `{"error":"unauthenticated","message":"unauthenticated"} [401]` ✅

### B3 — Register/login validation ran after DB setup — Severity: LOW
- **Where:** `src/app/api/auth/register/route.ts`,
  `src/app/api/auth/login/route.ts`, `src/lib/auth.ts`.
- **Evidence (QA worker, API/security, live curl):** with no `DATABASE_URL`,
  register with a weak password (`"123"`) or missing fields returned
  `503 db_not_configured` instead of `400`, because `getPrisma()` was
  evaluated as an argument before the validation inside `registerUser()` ran.
  Login with `{}` likewise returned 503 instead of 400.
- **Fix:** registration validation is now a pure function
  `validateRegistrationInput()` called in the register route BEFORE any DB
  access (and still inside `registerUser()` as defence in depth); login
  rejects an empty identifier/password with `400` before DB access.
- **Re-test (live, after rebuild + server restart):**
  - register `{"password":"123"}` → `400 "password must be at least 8 characters"` ✅
  - register `{}` → `400 "username must be 3-20 characters"` ✅
  - login `{}` → `400 "username and password are required"` ✅

### B4 — Search `@<8-digit-ID>` returned no hit — Severity: LOW (quirk)
- **Where:** `src/lib/db.ts`, `searchUsers()`.
- **Evidence (QA worker, feature logic):** bare `12345678` resolved, but
  `@12345678` returned `[]` — the exact-ID check did not strip `@`, while
  the partial-ID guard did, so the `@`-prefixed exact ID was caught by the
  guard. Partial IDs still correctly return `[]`; no partial-ID leak.
- **Fix:** `searchUsers` now strips a leading `@` before the exact-ID check.
- **Re-test:** code re-read; authenticated live search proof needs a live DB
  (see Pending).

### B5 — Three deep-link pages showed bare "unauthenticated" with no Login link — Severity: MINOR
- **Where:** `/contacts/[id]`, `/groups/[id]/info`, `/updates/[id]`.
- **Evidence (QA worker, pages):** unauthenticated renders showed only the
  single word "unauthenticated" — no Login link, no explanation — while
  `/chats`, `/archived`, `/calls`, `/updates`, `/sazmu` all offer a Login
  button. Routes themselves were fine (HTTP 200, all links/buttons real).
- **Fix:** each of the three pages now renders a green Login button
  (`href="/login"`) whenever the error is exactly `"unauthenticated"`,
  matching the pattern on the other pages.
- **Re-test (live, headless screenshots after rebuild):** all three pages
  now show "unauthenticated" + a green Login button, visually verified
  (screenshots in `/tmp/qa-recheck-fixed/`: contacts-test123.png,
  groups-info.png, updates-test123.png). ✅

### B6 — SAZMU page highlighted the wrong bottom tab — Severity: COSMETIC
- **Where:** `src/app/sazmu/page.tsx`.
- **Evidence (QA coordinator review of shell usage):** the SAZMU page used
  `AppShell active="Chats"`, so the Chats tab appeared active while the user
  was on the AI chat. SAZMU has no tab of its own.
- **Fix:** `AppShell active=""` — no tab highlighted on the SAZMU page.
- **Re-test:** build passes; tab comparison is exact-match only, so `""`
  matches no tab. ✅

## What passed clean (no bug found)

### Pages & navigation — 22/22 routes, HTTP 200, none blank
Landing, register, login, chats, chats/[id], groups/[id], groups/[id]/info,
new-chat, new-group, contacts/[id], calls, call screen, keypad, updates,
updates/[id], my-status, communities, sazmu, sazmu/setup, settings, archived,
favorites. No dead links (no `href="#"` or empty href; every href maps to a
real route), no dead buttons (every `<button>` has `onClick` or is a submit
button), no lorem/fake data, no visible error boundary or 404 on any route.
Unauthenticated states render honestly (e.g. "Could not load chats:
unauthenticated" + Login; "/new-chat: no demo people are shown").

### API routes & security gates
- All 15 route files / 26 method calls unauthenticated → uniform
  `401 {"error":"unauthenticated"}` with zero data leak. Wrong-method probes
  → empty-body 405, no leak.
- Verify-email → live honest `501` ("Resend API key pending from user"), no
  email-sent claim.
- Per-IP rate limits observed live: `429` at exactly the 21st login attempt
  (20/10 min) and the 11th register attempt (10/hour). (Note: the API
  worker's bursts tripped the in-memory buckets during testing; the server
  restart for re-testing cleared them — buckets are in-memory only.)
- Media: unauthenticated upload → 401, nothing written to `public/uploads/`;
  code rules pass — allowlist types only (JPEG/PNG/WebP/GIF, WebM/MP3/Ogg/
  WAV/M4A, MP4/WebM), sizes 5/10/20 MB, magic-byte content sniffing (declared
  MIME never trusted alone), traversal-safe filenames
  (`split(/[\\/]/).pop()`, unsafe chars → `_`, leading dots stripped,
  60-char cap, extension forced from validated MIME, plus a
  `dest.startsWith(dir + path.sep)` guard).
- Greps clean: `passwordHash` only stripped at boundaries (never returned);
  `dangerouslySetInnerHTML` 0 hits; no `.env` file; no hardcoded secrets or
  Neon URLs in `src/` or `prisma/`; no "TODO demo" / fake-success code.
  (The only "demo" hits are the word "demoted" and a comment stating failures
  are "never a fake success"; `src/lib/demo-data.ts` supplies only SAZMU
  setup preset names, not API data.)

### Feature logic (code-level, live-DB proof pending)
- Group admin: server-side ADMIN check (not UI-only) for add/promote/demote/
  remove; last admin cannot leave while members remain, cannot be demoted,
  cannot be removed into an orphaned group; sole-member group may leave
  (documented exception, not a bug); non-member access → 403 via membership
  gates on chats, messages, members, reactions.
- Status: 24h expiry enforced in the list/own/single/view queries
  (`expiresAt > now`), not just UI; owner-only delete (403 otherwise); view
  recording via one-row-per-viewer upsert; visibility = self + accepted
  contacts minus blocked-either-direction.
- Messages: sender-only TEXT edit (400 for non-TEXT, deleted, or empty text),
  sender-only delete-for-all with server-side redaction (text/mediaUrl/
  mediaMime nulled) plus `redactDeleted()` on read as defence in depth.
- SAZMU: template-only labelling everywhere — API returns
  `llmUsed:false, llmConfigured:false`, pages state "Template replies only
  until an LLM provider/key is provided — no generative reply is faked" and
  "SAZMU AI · AI — not a human"; setup persistence POSTs to the real
  `/api/sazmu` route and only reports success on `res.ok`.
- Logout: clears both `communica_token` and `communica_user` even if the
  server logout call fails; server blocklists the token `jti` until expiry.
- Search: empty → `[]`, exact 8-digit ID → ID lookup only, partial IDs → `[]`
  before any username matching, `@username` prefix search capped at 20.
- Calls: no simulated timer / fake "connected" (timer only on a real
  `connectionState === "connected"` event); media acquired only after accept;
  accepted-contact gate server-side on start; party checks on accept/decline/
  cancel/end; 30s ringing timeout swept to MISSED.

### Responsive & Direction A
- 21 screenshots (7 routes × 360/768/1280): no horizontal overflow, no text
  or buttons cut off at the viewport edge, no page-level sideways scrolling.
- The earlier responsive fix holds: mobile 360 = single-pane + bottom tabs,
  detail pane hidden unless the list is hidden (`/chats/1` full-screen
  detail); desktop 1280 = genuine two-pane (list 420px + detail).
- Direction A tokens only: header `#075E54`, accent `#128C7E`, own bubble
  `#D9FDD3`, chat bg `#ECE5DD`; no B/C/D tokens in source (no `--wa-purple`,
  no violet-pink gradient, no `#0B0F14` surfaces, no `#007AFF`); Lucide
  icons throughout; the single ❤️ in code is a message-reaction *value* on
  an aria-labelled button, not a UI icon; touch targets ≥44px (bottom tabs
  ~72×56px); Bengali "বাংলা" renders correctly (no boxes).
- Non-defects confirmed: filter pills clipped at the pane edge are the
  intended `overflow-x:auto` scroll affordance; tablet 768 uses the desktop
  top nav by the intended `max-width:767px` breakpoint; SAZMU purple avatar
  is the documented Direction-A `--wa-ai` token.

### Known cosmetic items — NOT bugs, left as-is
- App header + page topbar both read "Communica" on `/chats`, `/chats/[id]`,
  `/groups/[id]` (redundant vertical space only, no clipping or overlap).
- SAZMU setup page has no bottom tabs by design (bare `<main>` setup flow
  with its own Back topbar).
- `my-status` and `settings` show a bare "unauthenticated" line when logged
  out, but the full form and back links remain — not the content-only gap
  fixed in B5.

## Explicitly NOT claimed (still pending, unchanged by this re-check)
- Live-DB end-to-end: register → login → search → chat → message → call →
  status → group against the real Neon DB (needs deploy-time env).
- Authenticated live proofs: register `400` with a real DB, login
  identical-`401`, 5-failure/15-min lockout, authenticated media upload,
  cross-user `403` gates, own-bubble `#D9FDD3` rendering, real message
  bubble/tick rendering.
- Live two-browser mic/cam call test (including TURN/strict-NAT behaviour
  and call clarity under throttling).
- Live visual rendering at 360/768/1280 in a real user browser (this re-check
  used headless Chrome renders, unauthenticated).
- httpOnly-cookie migration, multi-instance shared state, TURN provisioning,
  push notifications, E2E encryption, S3 media storage, password reset
  (needs Resend key), generative SAZMU (needs LLM provider + key).
- Platform super admin: no super-admin role, dashboard, or platform user
  management exists yet — this is a missing feature, not a bug found here,
  and it is handled separately (admin dashboard plan, awaiting approval).
  It is NOT included in this bug count and no super-admin design was
  invented in this re-check.

## PM approval
I approve the code work of this re-check: QA tested repeatedly, one item at
a time, across all 22 pages, all API routes, responsive layouts, and security
gates; the developer fixed all 6 confirmed bugs; QA re-tested each fix
(live curl + headless screenshots where applicable); `tsc --noEmit` and
`npm run build` pass; no secrets, no `.env`, no deployment, no GitHub push
were made in this re-check. The app is as bug-free as can be proven without
a live DB and real browsers — the pending items above are the remaining
proof, not hidden failures.
