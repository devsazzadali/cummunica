# Communica — Next.js app (Step 2 pages complete)

## Block rule — DECIDED (F8, not ambiguous)

Blocking is enforced for **1:1 traffic only**: contact creation
(`POST /api/contacts`), DIRECT chat creation, DIRECT messages and
calls all refuse a user blocked in either direction (403).
Blocking is **NOT enforced on GROUP messages**: a blocked user who
is already in a shared group can still send messages there, because
group membership is an admin decision — group creation and
admin-add both refuse blocked users, and a group admin can remove
a member. If you block someone and do not want them in a shared
group, remove them from that group (or ask an admin to); the block
alone does not remove them or silence them in groups. This scope
is deliberate and is also stated in the code comments of
`src/app/api/contacts/route.ts` and `src/app/api/messages/route.ts`.

## Production pack — deploy yourself (Step 6)

**To deploy this app, follow `PRODUCTION_PACK.md` in this folder.**
It is the Step 6 production pack: what the app is, the exact deploy
steps in order (choose a host, connect GitHub / upload, set env vars
at deploy time only, build/start plus the optional Socket.io server),
the env var table, the honest production-ready vs still-pending
lists, the file list, and troubleshooting. This app has NOT been
deployed and NOT been pushed to GitHub in this build — deploying is
the user's own step, using that pack. Final visual styling is ON HOLD
(see `~/workspace/communica/DESIGN_HOLD.md`): the current look is a
working placeholder, not the final design, and final design QA is
deferred until the user picks a design direction.

## Brand distinction (standing, non-negotiable)

Communica is its own app with its own name and logo (a green speech-bubble
with a "C", made for this project). It does NOT copy WhatsApp's trademarked
logo, brand name, or brand assets. Only the generic chat-app layout, colours
(greens #075E54/#008069 family, chat background #ECE5DD family, own bubble
#D9FDD3 family) and typography (Segoe UI / Helvetica Neue / Roboto system
stack + Noto Sans Bengali / Hind Siliguri) are WhatsApp-like.

## Step 2 — what is done (all 22 pages, demo data only)

Routes: `/`, `/register`, `/login`, `/chats`, `/chats/[id]`, `/groups/[id]`,
`/sazmu`, `/sazmu/setup`, `/new-chat`, `/contacts/[id]`, `/groups/[id]/info`,
`/calls`, `/call` (audio + video UI shell, `?kind=` + `?variant=` incoming /
outgoing, mute / speaker / video / quality-indicator placeholders — NO
WebRTC code yet), `/keypad`, `/updates`, `/updates/[id]`, `/my-status`,
`/communities`, `/settings`, `/archived`, `/favorites`, `/new-group`.
Demo data lives in `src/lib/demo-data.ts` (prototype users/chats: Rahim,
Mim, Family Group, Karim, Sadia, SAZMU AI). No page imports Prisma Client,
fetches an API, or writes a `.env` file. Forms and composers validate
locally and show a clearly-labelled demo note; they never claim a real
account was created or a real message was sent.

Icons: `lucide-react` everywhere for UI chrome. No emoji as UI icons.
Responsive: desktop (>=768px) is WhatsApp Web mode — two-pane chat list +
active chat pane, no phone frame; mobile (<768px) is single-pane with a
fixed bottom tab bar (Chats / Updates / Communities / Calls / Settings),
>=44px touch targets, safe-area padding, no horizontal scrolling.
Breakpoints: 360px / 768px / 1280px+ checked by CSS inspection (see
QA_REPORT note in the Step 2 delivery report; no live-browser render was
available to this worker).
PWA: `public/manifest.webmanifest` (name Communica, theme #075E54,
background #ECE5DD, standalone), Communica-branded `public/icon-192.png`,
`public/icon-512.png` and `public/icon.svg` (not WhatsApp's logo),
`public/sw.js` app-shell offline cache registered from the root layout,
theme-color meta in `layout.tsx`.

Call-quality shell (UI only, Step 4 implements it): Opus audio with echo
cancellation + noise suppression + auto gain, HD 1280x720@30fps ideal with
graceful fallback, audio protected over video on weak networks, quality
indicator in the UI. No third-party calling service; signalling will be
our own Socket.io server. Strict NATs may need a TURN server later
(self-hostable) — not provisioned now. Network, device, camera and mic
still set the ceiling; perfect quality on a bad network is not promised.

## What is NOT done yet (Steps 3–4)

- No API routes, no live DB wiring, no real auth (custom JWT + bcrypt
  only, when it comes — NOT Neon Auth, NOT any third-party auth).
- No real chat sending to a server, no generative-AI replies (provider
  unchosen; see `.env.example`).
- No WebRTC calling logic (Step 4). The `/call` page is a UI shell only:
  no camera or microphone is started.
- Step 1 caveat carried: `package.json` still uses Prisma 5 while the
  copied schema was validated with Prisma 6.18 — Step 3 aligns it. No
  page imports Prisma Client, so the build needs no live DB and no
  Prisma generate.

## Step 1 scaffold (kept, see below)


## What this folder is

`next-app/` is the new Next.js front end + API back end for **Communica
(Social Communication)**, a WhatsApp-like app. This step is a **scaffold
only**: a working landing placeholder, the validated Prisma schema, and
project configuration. It is **not** the finished app.

Inside Communica there is one AI chatbot, **SAZMU AI**. It is **always
labelled AI and is never a real human**.

## What is NOT done yet (later steps)

- No pages beyond the landing placeholder (no Chats, Calls, Status,
  Communities, registration, or settings pages yet).
- No API routes yet.
- No authentication yet (when it comes, it will be **custom JWT + bcrypt
  only** — NOT Neon Auth, NOT any third-party auth).
- No calling features yet (in-app audio/video calls only, when built).
- No generative-AI replies yet (provider unchosen; see `.env.example`).

## Stack

- Frontend: Next.js App Router + React + TypeScript (PWA-ready manifest
  included; no service worker yet).
- Backend (later steps): Next.js API routes + Prisma + Neon Postgres.
- Database: Neon Postgres only. Neon is the database only — it is not
  the auth provider.
- Theme: WhatsApp-inspired green (`#075E54`, `#0B6E60`, `#25D366`),
  phone-friendly, Bengali + Banglish + English support planned.

## Files

- `src/app/layout.tsx` — root layout + metadata (PWA manifest link).
- `src/app/page.tsx` — landing placeholder only. It links nowhere
  broken: it contains no outbound links and no routes that do not exist
  yet. It is a static page and imports no Prisma client, so the build
  does not need a live database.
- `src/app/globals.css` — theme variables and landing styles.
- `public/manifest.webmanifest` — PWA-readiness (name, colours, display
  mode). Icons are intentionally empty until real icons are made.
- `prisma/schema.prisma` — byte-identical copy of
  `~/workspace/communica/prisma/schema.prisma` (validated schema).
  Do not edit it here without also updating the source schema.
- `.env.example` — variable **names only, empty values**. No real
  credential, database URL, JWT secret, or API key belongs in any file
  in this repo.

## Local development (Step 1 only)

```bash
cd ~/workspace/communica/next-app
npm install
npm run dev
```

Build / typecheck (dummy env passed via the command only, never written
to a file):

```bash
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
  JWT_SECRET="placeholder-only-for-local-build" npm run build
npm run typecheck
```

The landing page is static, so the build must not require a live
database connection. Do **not** run `prisma db push`, `prisma db pull`,
or any live-database command against the Communica Neon DB from this
scaffold step.

## DRAFT deploy checklist — DRAFT ONLY, NOT DEPLOYED (superseded by PRODUCTION_PACK.md)

> **This app is NOT deployed yet.** Nothing below has been run, and no
> hosting account has been created. This draft is superseded by the
> Step 6 production pack: follow `PRODUCTION_PACK.md` in this folder
> to deploy. The draft below is kept for history only.

At deploy time only (not now), the deployment environment would need:

- `DATABASE_URL` — Neon Postgres pooled connection (provided securely
  at deploy time; never committed to a file).
- `DIRECT_URL` — Neon Postgres direct connection (if the host requires
  it for migrations).
- `JWT_SECRET` — long random secret, set in the host environment only.
- `RESEND_API_KEY` — only when email verification goes live (pending).
- `LLM_PROVIDER` / `LLM_API_KEY` — only when a generative-AI provider
  is chosen (pending).

Draft commands (to be confirmed at deploy time):

```bash
npm install
npm run build
npm run start
```

Plus, at deploy time only: run Prisma migrations/generate against the
live database as a separate, explicitly approved step. Do not run them
as part of this Step 1 scaffold.

## Step 4 — Own WebRTC calling (in-house, no third-party calling service)

What was built (all inside `next-app/`, existing pages/API shell kept):
- `src/lib/webrtc.ts` — browser WebRTC only: RTCPeerConnection with
  public STUN only; Opus preferred via setCodecPreferences where the
  browser allows; getUserMedia audio constraints ALWAYS include
  echoCancellation, noiseSuppression, autoGainControl (never
  disabled); video uses IDEAL 1280x720@30fps with graceful fallback
  tiers (640x480, then 426x240) — never fixed-HD-only, never
  fixed-low-only. Adaptive quality via getStats() +
  connectionstate: video bitrate/resolution steps down first on weak
  bandwidth (audio never capped), steps back up after two good
  samples; quality state is good / weak with a plain network
  explanation when weak. Signal-message validation (offer/answer
  need SDP, ICE needs a candidate field) — malformed signals are
  dropped, never fed to a peer connection.
- `src/lib/call-api.ts` — client calls to our own /api/calls only.
- `src/app/api/calls/route.ts` (extended, gate + CallLog behaviour
  unchanged) — REST signalling transport: POST signal queues
  offer/answer/ICE for the other party; GET ?callId= returns
  ringing/accepted status + that party's queued signals (consumed on
  delivery); GET ?incoming=1 lists ringing calls for the signed-in
  user. The accepted-contact gate (callee accepted caller, not
  blocked) is still enforced server-side on start, else 403; busy,
  30-second missed sweep, and CallLog for every attempt are kept.
- `server.mjs` + `npm run socket` — OPTIONAL Socket.io custom server
  (Next + Socket.io on one HTTP server, same port). Handshake JWT
  verified with JWT_SECRET; rooms `user:{userId}`; events
  call:register / call:notify / call:signal / call:unregister with
  party checks against the registry. It relays signalling only and
  never sees media, never writes CallLogs (the REST routes remain the
  single log authority). A socket call:incoming is re-verified by the
  callee against GET ?callId=... before any accept UI appears.
- `src/components/call-ui.tsx` + `src/app/call/page.tsx` — the /call
  page is now a real call screen: local + remote video, mute,
  speaker, video on/off, end, a timer that runs ONLY after the peer
  connection reports "connected", a good/weak quality indicator, and
  accept/decline for incoming calls. Chat/contact/calls/keypad call
  buttons now start a real attempt: outgoing calls resolve the
  dialled name/ID to a real user and invite via /api/calls; a
  not-signed-in, unresolvable, not-accepted (403), busy, declined,
  missed, or permission-denied attempt shows a plain error instead
  of a simulated call. No media is captured before accept (caller
  captures only after the callee accepts; callee only after tapping
  Accept). The incoming-screen camera preview is opt-in, local only,
  and never attached to a peer connection. Styling still uses only
  the existing central theme classes (DESIGN_HOLD: the current look
  is a working placeholder, NOT final design).
- `tests/webrtc-unit.ts` — 37 pure-logic checks (no DB, no browser).
- `MANUAL_CALL_TEST.md` — two-browser human test script for Step 5 QA.

Signalling flow (client -> server -> peer):
1. Caller: POST /api/calls start (gate checked) -> { ringing, callId }.
   Caller registers the callId on the socket (if the custom server is
   running) and asks it to push call:incoming; otherwise the callee
   learns of the call by polling GET ?incoming=1.
2. Callee taps Accept -> POST /api/calls accept (CallLog ACCEPTED).
   Caller polls GET ?callId=, sees "accepted", captures media,
   creates an offer, and sends it (socket relay, else REST queue).
3. Callee sets the remote offer, captures media (only now), answers;
   ICE candidates flow the same way (socket, else REST queue).
   Media then flows peer-to-peer; the server never sees it.
4. Either side ends -> POST /api/calls end/cancel/decline, CallLog
   updated to ENDED/DECLINED/CANCELLED, both sides tear down media.

How to run the socket server (optional; default build unaffected):
  npm run socket        # Next + Socket.io on PORT (default 3000)
  npm run build && npm start   # plain Next.js; calls use REST polling

Honest limitations (NOT claimed):
- No live mic/cam call was tested in this environment — a human must
  run MANUAL_CALL_TEST.md in two browsers (Step 5 QA) before calls
  are called verified. QA items 1–5 in CALL_QUALITY_REQUIREMENTS.md
  are therefore still open.
- No TURN server provisioned: strict NATs may fail to connect; a
  self-hostable TURN server is a later step.
- Single-process signalling: the REST active-call map and the socket
  registry are in-memory. Multi-instance deployment needs shared
  state (e.g. Redis) or signalling pinned to one instance.
- No deployment was done. No third-party calling dependency or API
  key was added (socket.io/socket.io-client are our own signalling
  transport, not a calling service).
