# Communica — Product Plan (Step 1)

**App:** Communica — tagline: "Social Communication".
**Status at Step 1: LOCAL WORK ONLY.** Nothing is published, no external account
has been created, no real credential has been used, and no live database exists yet.
The Phase 1 demo prototype (`index.html`, `app.js`, `replies.js`, `style.css`)
stores data only in the browser (localStorage). The Prisma schema
(`prisma/schema.prisma`) is written and validated with `prisma validate`
(v6.18.0) but has NOT been pushed to any live database.

## Fixed decisions (do not change without the user)

- **Backend: Prisma + Neon DB (PostgreSQL) ONLY. NOT Supabase.** The user
  corrected this on 2026-11-03. That means: no Supabase Auth, no Supabase
  Realtime, no Supabase Storage anywhere in the design.
- **Auth: JWT + bcrypt** (server-side, in a later phase — not the demo's
  browser-only hash).
- **Realtime: WebSocket (Socket.io) / polling.** NOT Supabase Realtime.
- **Uploads: server storage / S3-compatible storage later.** NOT Supabase Storage.
- **Registration FIRST, then use.** No use of the app before registering.
- **No real phone number.** Each user gets a generated random 8-digit in-app
  **Communica ID** (e.g. 48291357) plus a unique `@username`. Users are found
  by Communica ID OR by @username. The Communica ID is an in-app identifier
  only — it cannot place or receive phone calls and is never a phone number.
- **SAZMU AI is one AI chatbot contact inside Communica.** It is ALWAYS
  labelled "AI — not a human" in the UI. It is never presented as a real
  person, and it is not a row in the `User` table (see the schema comment).
  Boyfriend default call name: **Sazzad**. Girlfriend preset call names:
  Sadia, Maria, Tithi, Borsha, Anika, Tajmira, Mim, Mimi, Mumu, Ayra, Jannati,
  Mushfika — plus a custom-name option. "Mumu" here is only a girlfriend
  call-name option, not the app brand. No girlfriend default name has been
  chosen by the user, so none is invented here.
- **Calls are in-app WebRTC only — never PSTN phone calls.** No phone-call
  feature, no dialling of real numbers, ever.

## Honest current state (what is NOT real yet)

- **No live Neon DB yet.** No `DATABASE_URL` has been given. No `prisma db push`
  to a live database has been run.
- **No real calls yet.** The Calls tab in the demo is a placeholder; no WebRTC
  session has been built.
- **No real LLM yet.** SAZMU AI's demo replies come from `replies.js`
  (rule/template replies in Bengali and Banglish). They are NOT generative AI
  output and must not be described as such.
- **No end-to-end encryption yet.** Until a later phase, security is transport
  encryption (HTTPS/WSS) + JWT authentication only. Messages are not
  end-to-end encrypted, and this must not be claimed otherwise.

## Features KEPT (and why)

1. **Registration first (username + display name + password).**
   Why: the user specified this order. It also gives every account a unique
   @username and a random Communica ID before any chatting happens.
2. **Communica ID + @username search.**
   Why: this is the user's chosen replacement for phone-number discovery.
   It lets people find each other without sharing a real phone number.
3. **WhatsApp-like interface: Chats / Updates / Communities / Calls tabs.**
   Why: the user asked for a WhatsApp-like interface, and the screenshots they
   sent as reference show exactly these tabs.
4. **Search + filters: All / Unread / Favorites / Groups, plus Archived.**
   Why: the reference UI has them, and they are the basic tools for managing
   a growing chat list. Favorites and Archived are per-user settings.
5. **1:1 chatting (text).**
   Why: the core of the app. Everything else builds on it.
6. **Group chatting.**
   Why: the user asked for it, and Communities/Groups are part of the
   WhatsApp-like reference. Group creation, member list, and admin/member
   roles are in the schema (`Chat`, `ChatMember`).
7. **Photo transfer.**
   Why: the user asked for it. Demo: browser-local attach-and-show only;
   real uploads come with server/S3 storage in a later phase.
8. **Voice transfer (voice messages).**
   Why: the user asked for it. Demo: browser mic recording played back
   locally only; real storage and delivery come later.
9. **Audio call + video call (in-app WebRTC only).**
   Why: the user asked for both. Kept as in-app calls only, gated by the
   accepted-contact rule in the schema (calls only to accepted contacts,
   unless the user later enables calls from anyone).
10. **Status / Updates (24-hour stories, WhatsApp-style).**
    Why: the Updates tab is part of the reference UI. Schema has
    `StatusUpdate` (expires after 24 hours) and `StatusView`.
11. **Communities.**
    Why: the Communities tab is part of the reference UI. Kept as a tab
    with group discovery/announcement-style groups; detailed moderation
    rules are a later-phase question (see Open questions).
12. **Recent Calls list.**
    Why: part of the Calls tab in the reference UI. Schema has `CallLog`
    (audio/video, missed/accepted/declined/ended/cancelled, duration).
13. **SAZMU AI chatbot contact (labelled AI).**
    Why: the user asked for one AI chatbot inside the app. Its generative
    replies, when built, must come from user data only: the user's profile
    plus consented chat history. Never scraped private chats, never another
    person's data, and the user can delete their stored memories at any time
    (`UserMemory` in the schema).
14. **Message basics: replies, reactions, read receipts, edit/delete.**
    Why: these are already in the schema (`replyTo`, `Reaction`,
    `MessageRead`, `editedAt`, `deletedForAll`) and are expected in any
    WhatsApp-like chat. They are small additions once real messaging exists.

## Features NOT kept yet (and why)

- **Real generative LLM replies.** Not kept yet because no LLM provider or
  API key has been chosen or given. The demo's template replies stay until
  then, and must be labelled as templates, not AI generation.
- **Real audio/video calls.** Not kept yet because no signalling server or
  WebRTC wiring exists; the Calls tab is a placeholder. Building it needs
  the backend (Phase 2) first.
- **Real media upload / cross-device sync.** Not kept yet because there is
  no server or storage yet; demo media never leaves the browser.
- **Push notifications.** Not kept yet because there is no server or mobile
  app to push to. PWA notifications come after the backend.
- **End-to-end encryption.** Not kept yet because it is a large, separate
  piece of work (key management, device trust, recovery). Transport
  encryption + JWT is the honest interim position.
- **Native mobile app / Play Store listing.** Not kept yet because the web
  app comes first (see `LANGUAGE.md`); a store listing also needs the
  user's own developer account, which has not been provided.
- **Phone-number registration, SMS verification, PSTN calling.** NOT kept,
  by design — the user chose Communica ID + @username instead, and calls
  are in-app only. These are not "later phases"; they are excluded unless
  the user explicitly reverses this decision.
- **Payments, ads, or monetisation.** Not requested; not in the plan.

## How each kept feature works (user flow, plain language)

- **Register:** Open Communica → enter a unique @username, a display name,
  and a password → submit → the app gives you a random 8-digit Communica ID
  and shows it to you → you are signed in. (Demo warning: the Phase 1 demo
  password handling is browser-only and not production auth; do not reuse a
  real password there.)
- **Find someone:** Tap search → type an @username (exact or prefix
  match) or a full 8-digit Communica ID (exact match only — partial
  Communica ID search is NOT supported, for anti-enumeration security)
  → matching users appear → tap one to open a chat or send a
  contact request. SAZMU AI also appears in search as a labelled AI contact.
- **Chat 1:1:** Chats tab → tap a chat → type and send text. Later: attach
  a photo, record a voice message, reply to a message, react with an emoji,
  and see read receipts.
- **Group chat:** Create a group → name it → add members → chat like a 1:1
  chat, with the group name shown instead of a person's name. Group admins
  manage members.
- **Photo / voice:** In a chat, tap the photo button to attach an image, or
  the voice button to record and send a voice message. (Phase 1: both stay
  in the browser only.)
- **Audio / video call:** Open a chat or the Calls tab → tap the audio or
  video call button → the other person gets an in-app call screen → they
  accept or decline → the call runs inside the app. Missed/answered calls
  appear under Recent Calls. Calls only work in-app; no real phone number
  is ever dialled.
- **Status / Updates:** Updates tab → post a photo or text status → it is
  visible to your contacts for 24 hours, then it expires. Viewers are
  recorded (who saw it).
- **Communities:** Communities tab → browse or join a community → read
  announcements and join its groups. (Detailed moderation rules TBD.)
- **Filters and archive:** In Chats, switch between All / Unread /
  Favorites / Groups. Swipe or use the menu to archive a chat; archived
  chats live under Archived and can be restored.
- **SAZMU AI chat:** Tap the SAZMU AI contact (labelled "AI — not a human")
  → choose Boyfriend or Girlfriend role, a call name (Boyfriend default
  Sazzad; Girlfriend from the preset list or a custom name), and optionally
  a pet name the companion calls you → chat. In the future generative
  version, replies use your profile and consented chat history only, and
  the companion still says it is an AI when asked.

## Phases, in order

- **Phase 1 — DONE (demo prototype, local only).** Registration-first screen,
  WhatsApp-like tabs, chat list with filters and Archived, 1:1 text chat,
  SAZMU AI template replies, browser-local photo/voice demo, Prisma schema
  written and validated. No server, no live DB, no real calls, no real LLM.
- **Phase 2 — Backend wiring (next).** Neon DB connection + `prisma db push`
  (only after the user provides `DATABASE_URL` via the secure vault),
  server JWT + bcrypt auth replacing the demo hash, real message storage
  and WebSocket delivery, media upload (server/S3), group chats, WebRTC
  audio/video calls (in-app only), SAZMU AI settings saved per user.
- **Phase 3 — Polish and reach.** Status/Updates and Communities fully
  working, delivery/read receipts, push notifications (PWA), then the
  generative LLM version of SAZMU AI behind a backend proxy (only after
  the provider + API key are provided via the secure vault), then
  React Native/Expo mobile reuse of the TypeScript code (see `LANGUAGE.md`).
- **Later, only if the user chooses it:** end-to-end encryption, native
  app store listing (needs the user's developer account), advanced
  community moderation.

## What the user must provide later (never in chat — via the secure vault)

1. **Neon `DATABASE_URL`** (and `DIRECT_URL` if Neon requires it) — needed
   before any `prisma db push` or live testing. Nothing has been pushed
   because this has not been given.
2. **LLM provider choice + API key** — needed before any generative SAZMU AI
   replies. Provider is still unchosen (Gemini vs OpenAI is open). The key
   must live server-side only, never embedded in a web page.
3. **Hosting account** — needed before the app can be deployed anywhere
   (web hosting for the Next.js app + a place to run the Socket.io server).
   No hosting account has been created.

## Open questions (not invented — awaiting the user)

- LLM provider choice (Gemini vs OpenAI vs another).
- Hosting provider choice.
- Community moderation rules (who can create, who can post, admin tools).
- Whether calls from non-contacts are ever allowed (schema default: no,
  accepted contacts only).
- Girlfriend default call name (no default chosen yet; do not invent one).
