# Communica — Social Communication (Phase 1 Prototype)

**Status: LOCAL DEMO ONLY. Nothing here is published, no external account was created,
no real credential was used, and no external service was contacted.**

Open `index.html` in a browser (double-click, or serve the folder locally). No build step.

## What is built (Phase 1)

- **Registration FIRST:** username + display name + password (demo only, see warning below).
  On registration you receive a random 8-digit **Communica ID** — an in-app number,
  **NOT a real phone number**. Users are found by that ID or by `@username`.
- **WhatsApp-like UI (web only):** bottom tabs Chats / Updates / Communities / Calls;
  top search bar (search SAZMU AI or users); chat list with All / Unread / Favorites filters;
  Archived section; 1:1 chat view with text messages.
- **SAZMU AI chatbot contact:** one AI contact inside the app, clearly labelled
  “AI — not a human”. Its replies come from `replies.js`, a Bengali + Banglish
  rule/template prototype (morning, night, missing you, comfort, celebration, poetry,
  motivation, small verified general knowledge, honest “I don’t know” fallback).
  **This is NOT a generative LLM and is NOT claimed to be one.**
- **Demo media (browser-local only):** photo button attaches an image via file input and
  shows it locally; voice button records via the browser mic (MediaRecorder) and plays
  back locally. Nothing is uploaded anywhere in Phase 1.
- **SAZMU settings:** role Boyfriend/Girlfriend, call name, pet name — saved per browser.
- **Demo data:** SAZMU AI + 3 generic demo users (Ayesha, Tanvir, Nusrat) with demo chats.
  These are NOT real people. A “continue with demo user Ayesha” shortcut is provided
  for testing without registration.
- **Prisma schema prepared:** `prisma/schema.prisma` (PostgreSQL / Neon DB) for
  User, Chat, ChatMember, Message, CompanionSetting — see the schema header for the
  auth/realtime/upload design. It is **not yet wired to a live database**.

## Demo-only warnings (read before using)

- All Phase 1 data lives **only in this browser** (localStorage). Clearing browser data
  deletes it. There is no server account and no cross-device sync.
- The registration password is SHA-256-hashed in the browser for the demo only.
  This is **NOT production authentication** (no salt handling, no server verification,
  no password recovery). **Do not use a real password you use anywhere else.**
- Photo/voice messages never leave the browser in Phase 1. Voice recording needs mic
  permission; if denied, type your message instead.
- No real calls are placed. Calls/Updates/Communities tabs are placeholders in Phase 1.

## Defaults assumed (changeable — user has NOT yet confirmed these)

- App name: **Communica**, tagline “Social Communication”. Chatbot inside: **SAZMU AI**.
- Backend stack: **Prisma + Neon DB only (NOT Supabase)** — corrected per user 2026-11-03.
  Auth: JWT + bcrypt (planned). Realtime: WebSocket/polling (planned, not Supabase Realtime).
  Uploads: server storage / S3-compatible storage later (not Supabase Storage).
- Registration method: username + display name + password, plus generated random ID.
  (User has not yet confirmed whether phone-number registration is wanted.)
- Companion defaults: Boyfriend default call name **Sazzad**; Girlfriend presets
  Sadia, Maria, Tithi, Borsha, Anika, Tajmira, Mim, Mimi, Mumu, Ayra, Jannati, Mushfika,
  plus a custom name. “Mumu” in that list is a girlfriend **call-name option only**,
  not the app brand. Default companion in a fresh demo is Girlfriend / call name SAZMU
  (placeholder) until the user changes it.
- Generative AI provider: **not chosen yet** (Gemini vs OpenAI open). No LLM is wired in.

## What Phase 2 / 3 will add

- **Phase 2:** real Prisma + Neon wiring (needs a Neon `DATABASE_URL` from the user via
  secure entry — never in chat), server JWT auth, media upload, WebRTC audio + video
  calls (in-app only, never PSTN phone calls), group chats.
- **Phase 3:** Updates/Status, Communities, message delivery/read receipts, push notifications.
- **Later, only if chosen:** generative LLM replies from user data (profile + chat history)
  behind a backend proxy (API keys must never be embedded in a static page), and a native
  mobile app / Play Store listing (needs the user’s own developer account).

## Files

- `index.html` — screens: registration, main (tabs), chat view
- `style.css` — WhatsApp-like styling
- `app.js` — demo state, registration, search, chat list, chat view, media demo
- `replies.js` — SAZMU AI prototype reply logic (Bengali + Banglish), testable in Node
- `prisma/schema.prisma` — database schema (prepared, not live)

## Tests run (Phase 1, by the builder)

- `node --check` on `replies.js` and `app.js`: PASS.
- HTML structure validation (balanced tags): PASS.
- JS-to-HTML ID cross-check (every id used by `app.js` exists in `index.html`): PASS
  after fixing one real bug found this way (a missing `tab-chats` wrapper).
- SAZMU reply logic, 20 messages (10 Bengali script + 10 Banglish, incl. kemon acho,
  suprovat, mon kharap, tomake miss korchi, bangladesh er rajdhan ki?, ekta kobita dao,
  dhonnobad, shuvo ratri, ami klanto): **20/20 PASS**, no casual message hit the
  “I don’t know” fallback; an unknown question (quantum computing) honestly fell back.
- App logic in a Node vm harness: search by `@username`, full Communica ID and partial ID
  all returned the right demo user; no-match search returned 0; 200 generated IDs were
  all unique 8-digit numbers; seed state has 4 chats and a SAZMU greeting message.

### Known limitations / honest gaps

- The full click-through flow (register → list → chat → SAZMU reply) was verified at
  **logic level** (seed/search/reply functions + ID cross-check + syntax), **not in a
  live browser render** — a generic subagent cannot drive a live browser. The UI should
  be opened in a real browser for a visual check before anyone calls it “working”.
- Banglish poem replies use a small Roman poem bank; Bengali poem replies use the
  Bengali poem bank. Both are original template poems, not copied work.
- Voice messages use blob URLs, so they do not survive a page reload in Phase 1
  (photos use data URLs and do persist in localStorage, within browser storage limits).
