# Communica Next.js — Step 5 QA REPORT (Functional QA + Structural checks)

- App: Communica (Social Communication), Next.js 14.2 App Router + TypeScript, `~/workspace/communica/next-app/`
- QA date: 2026-11-03 (Asia/Dhaka). QA role: this step's QA tester AND fixer — each item tested one by one, each failure fixed and re-tested in this same step.
- Scope per DESIGN_HOLD.md: this is FUNCTIONAL QA + STRUCTURAL design checks only. Final visual styling (palette, icon-set details, typography) is ON HOLD until the user picks a premium design direction. Final palette/font realism QA is DEFERRED — it is recorded as deferred here, NOT as passed.
- NOT done in this step: no deployment, no live-DB command (no `prisma db push` / `db pull`), no live mic/cam call, no live-browser visual render (see Open Items). Build/typecheck used placeholder env passed on the command line only — never written to any file.
- Method: code inspection + grep + CSS inspection + build output + the two existing unit suites (run with a test-only `JWT_SECRET` via command env). No browser was available to this QA worker, so anything needing a real browser is recorded as OPEN, never claimed.

## Totals

- QA checks run: 64
- PASS: 62
- FAIL remaining: 0
- OPEN (not verified by this QA, not failures of code inspected): 2 — live two-browser mic/cam call test; live-browser visual responsive render. Both are listed verbatim in Open Items.
- Failures found and FIXED in this step (all re-tested to PASS): 5 — see "Fixes applied" below.
- Unit suites: `tests/unit.ts` 52 passed / 0 failed (49 before QA additions + 3 new QA checks); `tests/webrtc-unit.ts` 37 passed / 0 failed. Combined: 89 passed / 0 failed.
- Typecheck: `npx tsc --noEmit` — PASS, exit 0, no errors.
- Build: `npm run build` — PASS ("Compiled successfully", "Generating static pages (20/20)"). All 22 pages + all 9 API routes listed in §H.

## Fixes applied (before → after, each re-tested)

1. **F1 — Settings logout did not clear the real session (FAIL → PASS).** Before: Settings "Logout (demo)" was a plain link to `/` and its note said "no session exists in Step 2" — stale since Step 3, because register/login now store `communica_token` in localStorage, so tapping it left the user signed in. Fix: `src/app/settings/page.tsx` now uses a Logout button that removes `communica_token` and `communica_user` from localStorage and routes to `/`; the note now says logout clears the saved token. Re-test: code inspection + full typecheck/build pass; live tap still needs the live-browser check (Open Items).
2. **F2 — Duplicate demo Communica ID (FAIL → PASS).** Before: demo user Rahim and demo user ME (Sazzad) both carried Communica ID `48291357`, violating the ID-uniqueness rule the app itself enforces. Fix: Rahim's ID changed to `48291358` in both demo-data rows (USERS and CHATS); ME/Sazzad keeps `48291357` (also the Settings read-only default). Re-test: grep confirms each ID now appears only for its own user; build passes. Demo data only — no live-DB data was touched.
3. **F3 — 360px breakpoint missing (FAIL → PASS).** Before: `globals.css` had only `max-width:767px`, `768–1023px`, and `min-width:1280px` — no small-phone 360px rule, although the task requires 360/768/1280. Fix: added `@media(max-width:360px)` tightening (header padding, landing heading 32px, chat-row padding, wrap padding). Re-test: grep confirms all three breakpoints present; build passes. A live resized render is still open (Open Items).
4. **F4 — Desktop tab touch target under 44px (FAIL → PASS).** Before: `.dtab` had only `padding:10px 12px` with 14px text — roughly 38–40px tall, under the 44px touch-target rule. All other targets already met it (buttons/inputs/chips/filter tabs 44px, icon buttons 44px, bottom-nav items 56px, keypad keys 56px, call buttons 64px). Fix: `.dtab` now has `min-height:44px`. Re-test: CSS inspection confirms; build passes.
5. **F5 — Unit-test gap: auth gate + passwordHash leak shape untested (GAP → COVERED).** Before: `tests/unit.ts` tested invalid tokens but never `requireAuth` itself, and never asserted the public-user shape strips `passwordHash`. Fix: added 3 checks to `tests/unit.ts` — missing header → 401 `unauthenticated`; bogus Bearer token → 401 `unauthenticated`; `toPublicUser` output contains no `passwordHash` key. Re-test: suite went 49 → 52 passed, 0 failed.

No other code was changed. No styling was finalised (design hold respected); the CSS changes above are structural (breakpoint + touch target), not palette/typography finalisation.

## A. NAVIGATION — 6/6 PASS

- A1 — All 22 pages reachable / present in build: PASS. Build output lists: `/`, `/archived`, `/call`, `/calls`, `/chats`, `/chats/[id]`, `/communities`, `/contacts/[id]`, `/favorites`, `/groups/[id]`, `/groups/[id]/info`, `/keypad`, `/login`, `/my-status`, `/new-chat`, `/new-group`, `/register`, `/sazmu`, `/sazmu/setup`, `/settings`, `/updates`, `/updates/[id]` (22 pages + `/_not-found`).
- A2 — No dead link: PASS. Every static `href="/…"` in pages/components resolves to a real route (`/`, `/archived`, `/calls`, `/chats`, `/favorites`, `/keypad`, `/login`, `/my-status`, `/new-chat`, `/new-group`, `/register`, `/sazmu`, `/sazmu/setup`, `/updates`, `/call?kind=…&variant=incoming`); every templated href targets a real dynamic route (`/chats/[id]`, `/contacts/[id]`, `/groups/[id]`, `/updates/[id]`, `/call` with query params). No href points to a non-existent route.
- A3 — Bottom nav on the 5 main tabs: PASS. `src/components/ui.tsx` `BottomNav` renders exactly Chats, Updates, Communities, Calls, Settings (Lucide icons), and all five tab pages (`/chats`, `/updates`, `/communities`, `/calls`, `/settings`) render via `AppShell`, which includes `BottomNav`.
- A4 — Desktop top tabs: PASS. `DesktopTabs` renders the same 5 tabs in the app header; CSS hides `.desktop-tabs` below 768px and shows them at/above it.
- A5 — Every button navigates or shows a clearly-labelled demo note: PASS. Real actions navigate (register/login submit → API + continue links; chat/call/profile links; keypad call link). Demo-only actions are labelled: Communities "Join (demo)" shows a demo note, contact-page favourite/archive/block/report buttons show demo notes, my-status/new-group buttons show "demo" notes, and every demo page carries a `DemoNote` (29 demo-note usages across pages). The one stale "demo" label found (Settings logout) was fixed — see F1.
- A6 — Sub-flow back links: PASS. Flow pages without bottom nav (landing, register, login, new-chat, my-status, new-group, sazmu/setup) all carry a back link to a real route; this is expected — bottom nav belongs on the 5 main tabs, not on every flow screen. Edge cases handled, not dead: unknown chat id → "Chat not found (demo)" placeholder with Back to Chats; a contact with no chat (demo Sadia) → same placeholder via `/chats/[id]`.

## B. FORMS — 7/7 PASS (1 fixed: logout, F1)

- B1 — Register validation: PASS. Client (`/register`) trims and strips a leading `@` before submit and marks all fields required; server (`registerUser` in `src/lib/auth.ts`) enforces username 3–20 chars, `^[a-z0-9_]+$` only, display name non-empty, password ≥ 8 chars, optional email format check, duplicate username → 409 `conflict`, and generates an 8-digit Communica ID (first digit 1–9) with collision retry (max 10 attempts). Unit-covered: short/long/hyphen/`@` usernames → 400, short password → 400, duplicate → 409.
- B2 — Login validation + identical 401 shape: PASS. Login accepts username, `@username`, or exact 8-digit Communica ID + password; missing user and wrong password both return the identical 401 (`unauthenticated` shape via `handleError`, no user-enumeration leak). Unit-covered: "login wrong password 401 identical" and "login missing user 401 identical" both pass.
- B3 — Search (exact 8-digit ID only, partial rejected, `@username` prefix): PASS. Server (`searchUsers`): empty query → `[]`; exact 8-digit query → ID lookup only, never prefix; digit-only non-8-digit query is NOT treated as a partial-ID lookup (falls to username search, which cannot match it, so returns `[]`); `@username` strips `@`, lowercases, exact match then prefix (max 20), blocked users and self excluded. Client (`/new-chat`) shows "Communica IDs are exactly 8 digits" for digit-only non-8-digit input and states partial-ID search is not supported. Unit-covered: `searchKind` empty/id/partial/username.
- B4 — Chat send (membership/validation shapes): PASS. `POST /api/messages` requires auth, requires `chatId`, enforces membership (non-member → 403 "not a member of this chat"), `TEXT` must be non-empty, media types require `mediaUrl`, reply-to must exist in the same chat and not be deleted-for-all; success is 201 with the message. Client composer sends via the API when signed in and, on failure, shows the error honestly and does NOT add a fake sent message; when not signed in it adds a local-only message plus a demo note. Unit-covered: empty TEXT → 400, media without URL → 400.
- B5 — SAZMU setup (role, presets incl. Sazzad default, custom name, pet name, tone, language): PASS. Setup page offers role Boyfriend/Girlfriend chips; Boyfriend preset defaults to Sazzad; Girlfriend presets come from `GIRLFRIEND_PRESET_CALL_NAMES` (includes Mim and Mumu; no girlfriend default is invented — server rejects Girlfriend with an empty call name with 400); custom-name input overrides presets; pet-name input (e.g. baby/sweetheart); tone chips (Emotional and romantic / Friendly / Playful-teasing / Calm and comforting); language chips (Bengali / Banglish / English). Server (`POST /api/sazmu` action `setup`) validates role, defaults Boyfriend's empty name to Sazzad, stores petName/tone/language. SAZMU is labelled AI everywhere (`AI_LABEL = "SAZMU AI — AI, not a human"`, chat header "SAZMU AI · AI — not a human").
- B6 — Keypad exact-8 rule: PASS. Keypad caps input at 8 digits; the call button appears ONLY at exactly 8 digits (link to `/call?to=<id>&callee=<id>&kind=audio&variant=outgoing`); fewer digits show the note "Enter exactly 8 digits to enable the call button. Partial ID search is not supported." A partial ID can never start a call from the keypad.
- B7 — Logout (was FAIL, fixed F1): PASS after fix. Logout now clears `communica_token` + `communica_user` and routes to `/`.

## C. API ROUTE SHAPES — 12/12 PASS (3 checks added, F5)

All 9 routes exist as handlers, all protected routes gate with `requireAuth` (missing/expired/bogus token → 401 `unauthenticated` via shared `handleError` → `{error, message}` JSON, never a stack trace or DB internals; Prisma P2002 → 409 `conflict`; anything else → 500 `internal_error`). No route returns `passwordHash` (verified by grep + code inspection: register/login return `toPublicUser` output; search returns `PublicProfile` only — no id, no passwordHash; chats list selects only id/username/displayName/communicaId for members).

- C1 — `POST /api/auth/register` (public by design): PASS. 201 `{user (public), communicaId, token}`; validation/409 shapes per B1.
- C2 — `POST /api/auth/login` (public by design): PASS. Identical 401 shape per B2; updates lastSeenAt on success.
- C3 — `POST /api/auth/verify-email` (public, stub by design): PASS. Always 501 `email_verification_not_configured` ("Resend API key pending from user"); never sends mail, never uses a key. This is the documented pending state, not a failure.
- C4 — `GET /api/users/search` (protected): PASS. `requireAuth` first; shapes per B3; never returns passwordHash or id.
- C5 — `GET/POST /api/chats` (protected): PASS. Both handlers call `requireAuth`; GET lists only the caller's own memberships (archived filter supported); POST validates members and creates chats; member selects exclude passwordHash.
- C6 — `GET/POST/PATCH/DELETE /api/messages` (protected): PASS. All four handlers call `requireAuth`; GET/POST membership-gated per B4; PATCH/DELETE likewise auth-gated (delete/edit paths use the same membership/ownership checks in the route file).
- C7 — `GET/POST /api/calls` (protected): PASS. Both handlers call `requireAuth`; GET single-call form enforces party-only access (strangers get 403 "not a party to this call"); POST start enforces the accepted-contact gate (403) and busy (see §D); signal shapes validated and malformed signals rejected with 400.
- C8 — `GET/POST/PATCH /api/contacts` (protected): PASS. All three handlers call `requireAuth`; contact creation/accept/block flows are auth-gated.
- C9 — `GET/POST /api/sazmu` (protected): PASS. Both handlers call `requireAuth`; GET returns the caller's setting or 404 "companion not set up yet"; POST setup/chat shapes per B5; chat replies always carry `aiLabel: true` + `isTemplate: true`, `llmUsed: false`, and general questions get the honest-unknown fallback, never an invented fact.
- C10 — No `passwordHash` in any route response: PASS (grep + inspection as above; `passwordHash` appears in code only as a DB write field and inside `toPublicUser`'s strip).
- C11 — `tests/unit.ts`: PASS — 52 passed, 0 failed (49 pre-existing + 3 QA additions from F5). Run: compiled with `tsc` to a temp dir inside the project (so `bcryptjs` resolves) under a test-only `JWT_SECRET`, then executed with node; temp dir deleted afterwards.
- C12 — `tests/webrtc-unit.ts`: PASS — 37 passed, 0 failed (Opus order, constraints, tiers, quality derivation, signal validation, gate predicate, room naming).

## D. CALL LOGIC (code-level only — NO live mic/cam call was run) — 14/14 PASS, 1 OPEN

Evidence is from `src/lib/webrtc.ts`, `src/lib/call-api.ts`, `src/components/call-ui.tsx`, `src/app/api/calls/route.ts`, and `server.mjs` (Socket.io signalling). A live two-browser call was NOT performed and is NOT claimed (see D15).

- D1 — Opus preferred: PASS. `preferOpusCodecs` moves `audio/opus` first without mutating input (unit-covered); `applyOpusPreference` applies it via `setCodecPreferences` on audio transceivers, non-fatally.
- D2 — Echo cancellation / noise suppression / auto gain always true: PASS. `AUDIO_CONSTRAINTS` sets all three to `true`; `getAudioConstraints` and `getMediaConstraints` (audio and video) always carry them; no code path sets any of them false (unit-covered).
- D3 — HD ideal 1280×720@30fps with fallback tiers: PASS. `VIDEO_TIERS` = hd 1280×720@30 (2.5 Mbps cap) → sd 640×480@24 (900 kbps) → low 426×240@15 (300 kbps); constraints use `ideal`, never `exact`; `acquireLocalMedia` tries HD first then steps down on constraint/device errors, and permission denial is NOT retried across tiers (reported immediately).
- D4 — Adaptive quality stepping (getStats, weak thresholds, video-down-first, audio-protected): PASS. While connected, the UI polls `getStats()` every 3s, derives quality via `deriveQualityFromStats` (weak when RTT > 300 ms or packet loss > 5% or connection failed/disconnected); on weak it steps the video tier down (bitrate cap + `applyConstraints` to the lower tier); on good it steps back up only after 2 consecutive good samples (no flapping). Audio senders are never bitrate-capped. Unit-covered thresholds: weak at RTT 500 ms, weak at 20% loss, good at RTT 80 ms / 1% loss.
- D5 — Quality indicator good/weak: PASS. When connected the UI shows "Call quality: Good — Good connection." or "Weak — Weak connection — likely your network (round-trip … ms, packet loss …%). Video is reduced to protect audio." The legacy demo `CallShell` in `interactive.tsx` still shows a "Good (placeholder)" label, but it is NOT used by the real `/call` page (which uses `CallScreen`); it is dead demo UI, noted here, not presented as a call result.
- D6 — Mute / speaker / video controls: PASS. Buttons exist, are disabled until `connected` (so they cannot fake control of a non-call), and toggle the real track (`track.enabled`) / remote-video mute. End/Cancel/Decline/Accept buttons map to the matching server actions.
- D7 — Accepted-contact gate: PASS. Server `POST /api/calls` start calls `requireCallGate(findContactGate(...))` — allowed only when the callee accepted the caller and neither side blocked; missing gate row denies. Client maps a 403 to "This contact has not accepted you yet, or has blocked calls."
- D8 — Permission-denied path: PASS. `NotAllowedError`/`SecurityError` → `MediaPermissionError` ("Microphone/camera permission was denied. Allow access in the browser and try again."); the UI shows it as an error screen with "No call was placed. No microphone or camera was used for a fake call." — no fake connected call, no timer.
- D9 — Not-accepted path: PASS (see D7; client text verified in `call-ui.tsx`).
- D10 — Busy path: PASS. Server checks in-memory active calls for the callee and returns `{status:"busy"}` with a CANCELLED log row; client shows "They are already on another call." No interruption of the existing call.
- D11 — No media before accept: PASS. Caller acquires media only inside `beginMediaAndOffer`, which runs only when polling sees status `accepted`; callee acquires media only inside `acceptIncoming`, after the server accept succeeds. Ringing/listening/incoming screens start no stream. One nuance recorded honestly: on the incoming screen, an OPT-IN "Enable camera preview" button (video calls only) starts a local-only preview that is labelled "local only and is never sent to the other person" — it is never automatic, and the main incoming screen starts nothing before Accept.
- D12 — Timer only after connected: PASS. `connectedAtRef` is set only on `connectionstate === "connected"`; the timer interval runs only in phase `connected`; before that the UI says "Timer starts only when the call actually connects."
- D13 — Missed after 30 seconds: PASS (code-level). `RINGING_TIMEOUT_MS = 30_000`; `sweepExpired` (run at the start of every calls GET/POST) writes MISSED logs and records outcome `MISSED`; client maps it to "No answer — the call was missed after 30 seconds."
- D14 — Decline / cancel / end paths: PASS. Only the callee can decline, only the caller can cancel an unanswered call, end requires an accepted call; wrong-party attempts get 403; outcomes are recorded (DECLINED/CANCELLED/ENDED) and surfaced to the peer on poll.
- D15 — Live two-browser mic/cam call: OPEN, NOT verified by this QA. `MANUAL_CALL_TEST.md` remains the script for it (Tests 1–4: audio accept/talk/mute/speaker/end, video HD + throttling, gates/edge cases, socket mode). Do NOT treat §D as a live-call pass.

## E. RESPONSIVE STRUCTURE — 6/6 PASS, 1 OPEN

- E1 — Desktop two-pane present: PASS. `TwoPane` component (`pane-list` 400px + `pane-detail` flex) used by `/chats` and `/chats/[id]`; CSS: `.two-pane{display:flex}`, list 400px (340px at 768–1023px, 420px at ≥1280px).
- E2 — Mobile single-pane present: PASS. Below 768px, `.pane-list{width:100%}` and `.pane-list-hide-mobile` hides the list on detail screens, so mobile shows one pane; bottom nav is fixed at the bottom.
- E3 — Touch targets ≥ 44px in CSS: PASS after fix F4. Buttons/inputs/selects/textarea `min-height:44px`; icon buttons 44×44; bottom-nav items 56px; filter tabs/chips 44px; keypad keys 56px; call buttons 64px; desktop tabs now `min-height:44px` (F4).
- E4 — No horizontal scroll rules: PASS. `body{overflow-x:hidden}`, `box-sizing:border-box` globally, chat previews use ellipsis with `min-width:0` on flex children, bubbles capped at 75% desktop / 88% mobile.
- E5 — Safe-area handling: PASS. Layout `viewportFit:"cover"` in `layout.tsx`; bottom nav uses `padding-bottom:env(safe-area-inset-bottom,0)`.
- E6 — Breakpoints 360/768/1280 present in code: PASS after fix F3. `max-width:360px` (new), `max-width:767px` / `min-width:768px` (mobile↔desktop switch), `min-width:768px and max-width:1023px` (tablet list width), `min-width:1280px` (wide list width).
- E7 — Live-browser VISUAL resized render: OPEN, NOT verified by this QA. No live browser was available to this worker, so no resized screenshot or visual pass is claimed; this remains open for the parent's live-browser check.

## F. PWA STRUCTURE — 8/8 PASS

- F1 — Manifest valid JSON: PASS. `public/manifest.webmanifest` parses as JSON.
- F2 — Name Communica: PASS. `"name":"Communica — Social Communication"`, `"short_name":"Communica"`.
- F3 — Theme/background colours: PASS. `"theme_color":"#075E54"`, `"background_color":"#ECE5DD"`; layout sets the same `themeColor` in viewport metadata.
- F4 — Standalone display: PASS. `"display":"standalone"`, `"start_url":"/"`, `"scope":"/"`.
- F5 — Icons 192 + 512 present: PASS. `public/icon-192.png` is a real 192×192 PNG; `public/icon-512.png` is a real 512×512 PNG; both listed in the manifest.
- F6 — Icons Communica-branded, not WhatsApp logo: PASS. `public/icon.svg` is a Communica "C" mark on a dark-green rounded square (own design, no WhatsApp trademarked logo/brand asset); the PNGs are the same Communica branding. No WhatsApp logo, name, or brand asset is used anywhere in the app (the word WhatsApp appears only in explanatory comments/docs as "WhatsApp-like layout" reference, never as branding).
- F7 — Service worker present and registered: PASS. `public/sw.js` exists (app-shell cache `communica-shell-v1`, install/activate/fetch handlers, same-origin GET only) and `src/components/sw.tsx` (`RegisterSW`, rendered in the root layout) registers `/sw.js` when supported.
- F8 — theme-color meta present: PASS. Root layout viewport sets `themeColor:"#075E54"` (in addition to the manifest value).

## G. SECURITY / HYGIENE — 6/6 PASS

- G1 — No `.env` file: PASS. `ls .env` → "No such file or directory" at QA time and after build.
- G2 — No real credential / DATABASE_URL / JWT secret / API key in any file: PASS. Grep over `src/` finds only env-name references (`process.env.JWT_SECRET` guard, `DATABASE_URL missing` error text) — no values. Build/test placeholder values were passed via command-line env only and never written to a file.
- G3 — `.env.example` names only: PASS. It lists `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `LLM_PROVIDER`, `LLM_API_KEY` as empty/placeholder names with a "NAMES ONLY. Do NOT put any real value" header.
- G4 — No third-party calling dependency: PASS. `package.json` has no Twilio/Agora/Daily/Stream/Vonage/Zoom dependency; `webrtc.ts` header states no third-party calling service; signalling is own REST queue + own Socket.io server (`server.mjs`).
- G5 — No Neon Auth code: PASS. Grep finds only comments stating "NOT Neon Auth" / "custom JWT + bcrypt only"; no Neon Auth package or import.
- G6 — No live-DB command run in this step: PASS. No `prisma db push`, `db pull`, or any DB-mutating command was run; the only DB-adjacent runs were pure unit tests with mocks and a build with placeholder env (build does not connect to a DB).

## H. BUILD — 3/3 PASS

- H1 — `npx tsc --noEmit`: PASS, exit 0, no errors (run after all fixes).
- H2 — `npm run build`: PASS — "Compiled successfully", "Generating static pages (20/20)", no live DB (placeholder `DATABASE_URL`/`DIRECT_URL`/`JWT_SECRET` via command env only).
- H3 — Final build route list (verbatim from build output): pages — `/`, `/archived`, `/call`, `/calls`, `/chats`, `/chats/[id]`, `/communities`, `/contacts/[id]`, `/favorites`, `/groups/[id]`, `/groups/[id]/info`, `/keypad`, `/login`, `/my-status`, `/new-chat`, `/new-group`, `/register`, `/sazmu`, `/sazmu/setup`, `/settings`, `/updates`, `/updates/[id]` (22); API routes — `/api/auth/login`, `/api/auth/register`, `/api/auth/verify-email`, `/api/calls`, `/api/chats`, `/api/contacts`, `/api/messages`, `/api/sazmu`, `/api/users/search` (9, all dynamic ƒ); plus `/_not-found`. First Load JS shared 87.3 kB.

## PM-approval-style summary (Steps 1–4 carried limitations — summarised, NOT re-approved by this QA)

This QA does not re-approve Steps 1–4 as its own PM decision; it records what those steps delivered and what limitations they carried into Step 5, all still standing:

- Step 1 (plan/schema/algorithms): carried the algorithm contracts this QA tested against (username/ID rules, search rule, call gate, message rules). Limitation carried: contracts are code-level; live-DB runtime behaviour was never part of Step 1.
- Step 2 (22 pages, demo data): carried the page structure and demo data. Limitations carried: demo screens are not wired to live data (every demo action is labelled as such); two demo-era stale items found by this QA (logout label, duplicate demo ID) are now fixed (F1, F2); the demo `CallShell` placeholder in `interactive.tsx` is unused by the real `/call` page and must not be mistaken for call functionality.
- Step 3 (API routes, custom JWT+bcrypt auth, Prisma): carried the 9 routes and auth. Limitations carried: email verification is a 501 stub (Resend key pending); SAZMU replies are template-only, no LLM provider chosen or called (`llmUsed: false`); no rate limiting; tokens are localStorage-based, not httpOnly cookies (see Open Items).
- Step 4 (own WebRTC calling, signalling, manual test script): carried the call logic verified code-level in §D. Limitations carried: no TURN server provisioned (strict-NAT calls may fail to connect — documented gap, not a pass); the live two-browser test in `MANUAL_CALL_TEST.md` was never run and remains open; the Socket.io server is optional (REST polling fallback exists).
- Step 5 (this QA): functional + structural QA only. Final design QA is deferred by DESIGN_HOLD.md until the user picks a premium design direction; nothing in this report approves final palette, icon-set details, or typography.

## OPEN ITEMS (verbatim list — none of these is claimed as passed)

1. Live mic/cam call test — run `MANUAL_CALL_TEST.md` in two real browsers (Tests 1–4: audio accept/talk/mute/speaker/end, video HD + network-throttling quality behaviour, gates/edge cases incl. not-accepted, busy, 30-second missed, decline, signed-out, keypad, and socket-server mode). A connected-but-blurry/echoey call is a FAIL per CALL_QUALITY_REQUIREMENTS.md.
2. Live-browser visual responsive test — resized visual render at 360 / 768 / 1280 widths (desktop two-pane vs mobile single-pane, touch targets, no horizontal scroll) in a real browser; this QA verified structure in code + CSS only.
3. Live-DB runtime test at deploy time — run the app against the real Neon DB with a real JWT_SECRET and exercise register/login/search/chat/message/call/SAZMU flows end to end; build/typecheck here used placeholder env only and never connected to a live DB.
4. Final design QA after user picks a direction — palette, icon-set details, and typography realism per DESIGN_REQUIREMENTS.md as updated by the chosen direction, screen by screen; deferred by DESIGN_HOLD.md and NOT passed in this report.
5. TURN decision — no TURN server is provisioned; decide whether to provision one (e.g. for strict-NAT users) or accept the documented gap that such calls may not connect.
6. httpOnly-cookie hardening — auth tokens are currently stored in localStorage by the client; hardening to httpOnly cookies (with the client/server changes that requires) is still open.
7. Rate limiting — no rate limiting is implemented on any API route; adding it (notably auth and search/message/call start) is still open.

## Files changed in this step

- `src/app/settings/page.tsx` — real logout (F1).
- `src/lib/demo-data.ts` — Rahim demo ID 48291357 → 48291358 (F2).
- `src/app/globals.css` — `.dtab` min-height 44px (F4); `@media(max-width:360px)` block (F3).
- `tests/unit.ts` — 3 new QA checks: requireAuth 401s + passwordHash strip (F5).
- This report: `QA_REPORT.md` (this file).
