# Communica — Production Pack (Step 6, FINAL)

> **Read this first — three honest limits.**
>
> 1. **This pack does not deploy the app.** Nothing has been pushed to
>    GitHub from this build, no hosting account has been created, and
>    no live database has been touched in this step. You deploy it
>    yourself, following the steps below.
> 2. **Final design is NOT final.** Final visual styling (palette,
>    icon-set details, typography) is ON HOLD until you pick a premium
>    design direction (see `~/workspace/communica/DESIGN_HOLD.md`).
>    The app is deployable for structure and function, but the current
>    WhatsApp-like look is a working placeholder, NOT the final design.
>    Final design QA is deferred until after your pick.
> 3. **Nothing in this pack over-claims QA.** Anything listed as open
>    in `QA_REPORT.md` is still open here — in particular the live
>    two-browser mic/cam call test, the live-browser visual responsive
>    test, and the live-database runtime test at deploy time. Those
>    are jobs for you to run after deploy, not results already achieved.

## a. What this app is

Communica (Social Communication) is a WhatsApp-like chat app built with
Next.js 14.2 (App Router) + TypeScript on the front end and Next.js API
routes + Prisma + Neon Postgres on the back end. People register with a
username and password, get a generated in-app 8-digit Communica ID, and
can be found by `@username` or by that exact 8-digit ID. They can chat,
join groups and communities, post status updates, and make in-app audio
and video calls. Calls use the app's own WebRTC system — browser
peer-to-peer media plus the app's own Socket.io signalling server (or
REST polling when that server is not running). No third-party calling
service is used, and no phone number is dialled: Communica IDs are
in-app only. Inside Communica there is one AI chatbot, SAZMU AI. It is
always labelled AI and is never a real human; for now its replies are
template-only (see the environment-variable table below).

## b. Exact deploy steps — follow in order

Do these yourself. The hosting account is your own; none was created
here. Do not paste any real secret into code, into chat, or into any
file in this folder — secrets go only into your host's dashboard, at
deploy time.

### Step 1 — Choose a host

- **Recommended for Next.js: Vercel.** It is built for Next.js apps:
  it runs `npm run build` and `npm run start` for you.
- **Or any Node host** that can run a Node.js app (Node >= 18.18,
  per `package.json`). Any host you choose must let you set
  environment variables in its dashboard (Step 3).
- **About the Socket.io signalling server:** it is OPTIONAL. Calls
  work without it, using REST polling (invites arrive a couple of
  seconds slower). Only run it if your host lets you run a second
  long-lived Node process (see Step 4). On a host that only serves
  the Next.js app, skip it — do not treat that as a failed deploy.

### Step 2 — Connect the GitHub repo, or upload this folder

This folder has **NOT been pushed to GitHub in this build**. Pushing
is your decision. Whichever route you take, the rule is the same:

**Push / upload these:**

- `src/` — all app pages, components, libraries, and API routes
- `prisma/schema.prisma` — the database schema
- `public/` — PWA manifest, icons, service worker
- `server.mjs` — the optional Socket.io signalling server
- `package.json` and `package-lock.json` — dependencies and scripts
- `next.config.mjs`, `tsconfig.json`, `next-env.d.ts` — project config
- `.env.example` — variable names only (no values)
- `.gitignore` — tells Git what never to commit
- Docs: `README.md`, `PRODUCTION_PACK.md` (this file),
  `QA_REPORT.md`, `MANUAL_CALL_TEST.md`, `tests/`

**NEVER push / upload these:**

- `.env`, `.env.local`, or any `.env.*.local` file — real secrets
  live only in your host dashboard, never in a file
- `node_modules/` — dependencies; your host reinstalls them
- `.next/` — build output; your host rebuilds it

If you use Git, check before pushing that `.gitignore` covers the
three items above (it does in this folder). If you upload a folder
manually instead, delete `.next/` and `node_modules/` from the copy
first — they are large and must not be uploaded.

### Step 3 — Set environment variables AT DEPLOY TIME ONLY

Set these in your host's dashboard (for example, Vercel's
"Environment Variables" settings), never in code and never in chat.
The full table, including what breaks without each one, is in
section (c) below. The three required ones are:

- `DATABASE_URL` — your Neon pooled connection string, copied from
  your Neon dashboard.
- `DIRECT_URL` — your Neon direct connection string, also from your
  Neon dashboard.
- `JWT_SECRET` — a long random secret **you generate yourself**.
  Generate one on your own machine, for example with:

  ```bash
  openssl rand -base64 48
  ```

  Copy only the output into your host dashboard. Do not share it,
  do not save it in a file, and do not reuse a value from any other
  project. Changing `JWT_SECRET` later invalidates every existing
  login token, so users will have to log in again (see
  Troubleshooting).

The optional/future variables (`RESEND_API_KEY`, `LLM_PROVIDER`,
`LLM_API_KEY`) are **not needed for this deploy**. Leave them unset
unless you are deliberately switching on that future feature.

### Step 4 — Build, start, and (optionally) the signalling server

On your host, the commands are:

```bash
npm install
npm run build     # build command
npm run start     # start command — serves the Next.js app
```

**Separate, optional Socket.io signalling server** (only on a host
that supports a second long-lived process, and only if you want
faster call invites than REST polling):

```bash
node server.mjs   # or: npm run socket
```

- Port: `server.mjs` uses the `PORT` environment variable, default
  **3000**. Open the app on that same port when this server is
  running.
- It needs the **same `JWT_SECRET`** as the Next.js app, because it
  verifies each socket handshake with that secret. A different secret
  means sockets are rejected as unauthenticated.
- Do **not** run `npm run start` and `npm run socket` at the same
  time on the same port — pick one serving mode per port.
- If you do not run it, calls still work via the `/api/calls` REST
  queue + polling. That fallback is by design, not a workaround.

**Do NOT run any live-database-changing command as part of this
deploy.** In particular, do NOT run `prisma db push` or `prisma db
pull`. The live Communica Neon database is already in sync with
`prisma/schema.prisma`. A db push is only ever a separate, explicitly
approved step if the schema changes in the future.

### Step 5 — First-run checks after deploy

Run these in order, on the deployed site (not on this local folder):

1. **Register** a new account. You should get a username and an
   8-digit Communica ID.
2. **Log in** with that account, then log out and log in again.
3. **Search** for another user by `@username` and by their exact
   8-digit ID. Note: a partial ID (fewer than 8 digits) must NOT
   match anyone — that is the rule, not a bug.
4. **Send a message** in a chat, and confirm the other side can see
   it.
5. **Run `MANUAL_CALL_TEST.md` in two real browsers** (or two browser
   profiles): Test 1 audio accept/talk/mute/speaker/end, Test 2 video
   HD + network-throttling quality behaviour, Test 3 gates and edge
   cases (not-accepted, busy, 30-second missed, decline, signed-out,
   keypad), and Test 4 socket-server mode if you run `server.mjs`.
   A connected-but-blurry or echoey call is a FAIL under
   `CALL_QUALITY_REQUIREMENTS.md` — do not call calls "verified"
   until this script passes in real browsers.
6. **Check the responsive layout** at 360, 768, and 1280 pixels wide
   in a real browser: mobile shows one pane with a bottom tab bar,
   desktop shows the two-pane chat list + chat view, no horizontal
   scrolling. (Code-level structure passed QA; the live visual
   render is still open — see section (d).)

If any of steps 1–4 fail, see Troubleshooting (section (g)) before
retrying — the most likely cause is a missing or mistyped environment
variable.

## c. Environment variable table

No real value for any of these is in this repo. `.env.example`
contains names only, with empty values.

| Variable | Required / optional | Where it comes from | What breaks without it |
|---|---|---|---|
| `DATABASE_URL` | Required | Your Neon dashboard — the pooled Postgres connection string for the Communica database | The app cannot reach the database at all: register, login, search, chat, and calls all fail. Check this first on any deploy failure. |
| `DIRECT_URL` | Required | Your Neon dashboard — the direct Postgres connection string for the same database | Prisma operations that need a direct (non-pooled) connection fail. Set it alongside `DATABASE_URL` even if your first test seems to work without it. |
| `JWT_SECRET` | Required | Generated by you at deploy time (see Step 3, e.g. `openssl rand -base64 48`) | Login tokens cannot be created or verified: register/login fail, and the Socket.io server rejects every socket as unauthenticated. Changing it later invalidates all existing login tokens (users must log in again). |
| `RESEND_API_KEY` | Optional — future only | A Resend API key, only when you decide to switch email verification on | Nothing breaks today. Email verification is currently a 501 stub (`POST /api/auth/verify-email` always returns `email_verification_not_configured`) until this key is provided in a future step. Do not set it expecting verification to work now. |
| `LLM_PROVIDER` | Optional — future only | The name of a generative-AI provider, only when one is chosen | Nothing breaks today. SAZMU AI currently replies from templates only (`llmUsed: false`, honest-unknown fallback for general questions). No provider is chosen and no provider is called. |
| `LLM_API_KEY` | Optional — future only | That provider's API key, only when a provider is chosen | Nothing breaks today. Same as above: without a provider + key, SAZMU stays template-only. |

## d. What is PRODUCTION-READY vs STILL PENDING

### PRODUCTION-READY

- 22 pages, 9 API routes (see the file list in section (f) and the
  route list in `QA_REPORT.md` section H).
- Custom JWT + bcrypt auth (NOT Neon Auth — Neon is the database
  only).
- Prisma schema in sync with the live Communica Neon database
  (`prisma/schema.prisma` is byte-identical to
  `~/workspace/communica/prisma/schema.prisma`).
- Own WebRTC signalling + call UI + call-quality logic (code):
  Opus audio with echo cancellation + noise suppression + auto gain,
  HD 1280×720@30fps ideal with graceful fallback tiers, adaptive
  quality stepping that protects audio over video, quality indicator,
  accepted-contact gate, busy handling, 30-second missed handling.
- PWA manifest, Communica-branded icons (192 + 512), and service
  worker.
- QA functional pass: 62/64 checks PASS, 0 FAIL remaining (see
  `QA_REPORT.md`; unit suites 89 passed / 0 failed).

### STILL PENDING — do not present these as done

- Live two-browser mic/cam call test (`MANUAL_CALL_TEST.md`, Tests
  1–4) — run it after deploy, in real browsers.
- Live-browser visual responsive test at 360 / 768 / 1280 widths.
- Live-database runtime end-to-end test at deploy time (register /
  login / search / chat / message / call / SAZMU against the real
  Neon database with a real `JWT_SECRET`). Build/typecheck in this
  workspace used placeholder env only and never connected to a live
  database.
- Final design direction pick + final design QA (palette, icon-set
  details, typography) — deferred by `DESIGN_HOLD.md`.
- TURN decision for strict NATs — no TURN server is provisioned, so
  calls between users behind strict NATs may fail to connect.
- httpOnly-cookie hardening — auth tokens are currently stored in
  localStorage by the client, not in httpOnly cookies.
- Rate limiting / login lockout — no rate limiting is implemented on
  any API route.
- Push notifications — not implemented.
- E2E encryption — transport + JWT only for now; messages are not
  end-to-end encrypted.
- Generative LLM for SAZMU — provider + key unchosen; replies are
  template-only for now.
- Also still open, from `QA_REPORT.md`: multi-instance deployments
  need shared signalling state (e.g. Redis) or signalling pinned to
  one instance, because the REST active-call map and the socket
  registry are in-memory.

## e. Brand distinction note

Communica is its own app with its own name and logo (a "C" mark made
for this project). It does NOT copy WhatsApp's trademarked logo,
brand name, or brand assets. Only the generic chat-app layout,
colours, and typography are WhatsApp-like — that is a layout
reference, not a brand copy. This holds for every design direction
chosen later: the chosen direction must still use Communica's own
name and logo, never WhatsApp's.

## f. File list — every top-level item in `next-app/`

| File / folder | Purpose (one line) |
|---|---|
| `PRODUCTION_PACK.md` | This file — the deploy-yourself production pack (Step 6). |
| `README.md` | Project readme; its deploy section points to this pack. |
| `QA_REPORT.md` | Step 5 functional QA report (64 checks: 62 PASS, 0 FAIL, 2 OPEN). |
| `MANUAL_CALL_TEST.md` | Human two-browser call test script — run before calls are called verified. |
| `.env.example` | Environment variable names only, empty values — never put a real value here. |
| `.gitignore` | Excludes `node_modules/`, `.next/`, and `.env*` files from Git. |
| `package.json` | App name, dependencies, and scripts (`build`, `start`, `socket`, `dev`, `typecheck`). |
| `package-lock.json` | Locked dependency versions for reproducible installs. |
| `next.config.mjs` | Next.js configuration (React strict mode). |
| `next-env.d.ts` | Next.js-generated TypeScript declarations — do not edit by hand. |
| `tsconfig.json` | TypeScript configuration. |
| `tsconfig.tsbuildinfo` | TypeScript incremental-build cache — generated, not source. |
| `server.mjs` | Optional Socket.io signalling custom server (default port 3000, same `JWT_SECRET`). |
| `prisma/` | Contains `schema.prisma`, the database schema (byte-identical to the source schema). |
| `public/` | PWA manifest, Communica icons (192/512/SVG), and service worker (`sw.js`). |
| `src/` | All app code: 22 pages under `src/app/`, API routes under `src/app/api/`, components under `src/components/`, libraries under `src/lib/`. |
| `tests/` | Unit suites: `unit.ts` (52 checks) and `webrtc-unit.ts` (37 checks). |
| `node_modules/` | Installed dependencies — never push or upload; the host reinstalls them. |
| `.next/` | Build output — never push or upload; the host rebuilds it. |

Pointers outside this folder (all still in force):

- `~/workspace/communica/next-app/QA_REPORT.md` — full QA evidence
  and the verbatim open-items list.
- `~/workspace/communica/next-app/MANUAL_CALL_TEST.md` — the human
  call test to run before launch.
- `~/workspace/communica/CALL_QUALITY_REQUIREMENTS.md` — call-quality
  rules (a blurry/echoey connected call is a FAIL).
- `~/workspace/communica/DESIGN_HOLD.md` — final styling is on hold
  until you pick a design direction.
- `~/workspace/communica/DESIGN_REQUIREMENTS.md` and
  `~/workspace/communica/RESPONSIVE_PWA_REQUIREMENTS.md` — design and
  responsive/PWA requirements.

## g. Troubleshooting — the 3 most likely deploy failures

### 1. Database connection failure / environment variable missing

**Symptoms:** register, login, or chat fail; the app may show a
database or "missing" error.

**Check, in order:**

1. In your host dashboard, confirm `DATABASE_URL` and `DIRECT_URL`
   are both set, with no extra spaces or line breaks, and that they
   point at the Communica Neon database (not another project's).
2. Confirm you did NOT put the values in a file — host-dashboard
   variables are the only place they belong.
3. Redeploy after changing any variable (most hosts do not pick up
   a changed variable until the next deployment).
4. Never "fix" this by running `prisma db push` against the live
   database as part of deploy — the live database is already in
   sync with the schema, and a push is a separate, explicitly
   approved step only.

### 2. `JWT_SECRET` missing, or changed, invalidating tokens

**Symptoms:** login fails, or users who were logged in are suddenly
signed out / every API call returns unauthenticated; the Socket.io
server rejects sockets as unauthenticated.

**Check, in order:**

1. Confirm `JWT_SECRET` is set in the host dashboard, identical in
   every place the app runs (Next.js app and, if you run it, the
   `server.mjs` process — it must be the SAME secret).
2. If you changed `JWT_SECRET`, expect every existing login token to
   stop working. That is by design: users simply log in again and
   get a fresh token. Do not try to "restore" old tokens.
3. If it was never set, set it and redeploy — a missing secret is
   not fixed by changing code.

### 3. Socket.io server not running, so live signalling falls back to REST polling

**Symptoms:** calls still work, but incoming-call invites arrive a
couple of seconds slower than expected; or you expected the socket
server and it is not responding.

**Check, in order:**

1. First, confirm this is actually a problem: REST polling fallback
   is the designed behaviour when `server.mjs` is not running.
   Calls working slightly slower is NOT a failed deploy.
2. If you do want socket mode: confirm `node server.mjs` (or
   `npm run socket`) is actually running as a long-lived process on
   your host, on the same port the app is served from (default
   3000, or your `PORT` value), with the same `JWT_SECRET`.
3. Confirm you are not running `npm run start` and `npm run socket`
   at the same time on the same port — that port conflict stops one
   of them.
4. If your host cannot run a second long-lived process, stay on
   REST polling and run `MANUAL_CALL_TEST.md` Test 4's fallback
   check (calls still work after stopping the socket server).

## Verification record (this step)

- No `.env` file exists in `next-app/` (checked before and after
  writing this pack; `.env.local` also absent).
- `.env.example` contains names only, with empty values.
- Grep of this pack and the updated `README.md` deploy section
  found no real credential, database URL, JWT secret, or API key —
  only variable names and the secret-generation command
  (`openssl rand -base64 48`), which produces a value on your own
  machine and is not itself a secret.
- No app code was changed in this step (documentation only), no
  deployment was made, and no live-database command was run.
- Final build/typecheck (placeholder env via command env only,
  never written to a file) — results recorded below after the run:
  see "Final build + typecheck results" at the end of this file.

## Final build + typecheck results

Run at the end of Step 6 (2026-11-03, Asia/Dhaka), after the
documentation-only changes, with placeholder env passed via command
env only (never written to a file). No live database was connected,
no deployment was made, no app code was changed.

- `npx tsc --noEmit` — PASS, exit 0, no errors.
- `npm run build` (with placeholder `DATABASE_URL` / `DIRECT_URL` /
  `JWT_SECRET` via command env only) — PASS, exit 0. Build output
  lists all 22 pages and all 9 API routes (same route list as
  `QA_REPORT.md` section H), First Load JS shared 87.3 kB.
- No `.env` / `.env.local` file exists; `.env.example` is names-only
  with empty values. The only secret-like string found by grep in
  the docs is the pre-existing placeholder build command in
  `README.md` (`postgresql://placeholder:placeholder@localhost…` /
  `placeholder-only-for-local-build`) — a placeholder, not a real
  credential — and no real credential, database URL, JWT secret, or
  API key appears in `PRODUCTION_PACK.md` or in the new `README.md`
  deploy section.
