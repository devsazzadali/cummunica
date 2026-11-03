# Communica — Language & Stack Choice (Step 1)

## Chosen stack (one stack)

**TypeScript + Next.js / React web app (PWA) + Node API routes + Prisma +
Neon Postgres + Socket.io (WebSocket) + WebRTC for calls.**
Later, **React Native / Expo** reusing the same TypeScript code for mobile.

In short:

| Layer | Choice |
|---|---|
| Language | TypeScript (frontend and backend) |
| Web app | Next.js + React, as a PWA (installable, works on phone browsers) |
| API | Node.js API routes inside Next.js |
| Database access | Prisma (already written: `prisma/schema.prisma`, PostgreSQL) |
| Database hosting | Neon Postgres |
| Auth | JWT + bcrypt (server-side) |
| Realtime chat/calls signalling | Socket.io (WebSocket, with polling fallback) |
| Audio/video calls | WebRTC (in-app only, never PSTN) |
| Media uploads | Server storage / S3-compatible storage (later phase) |
| Mobile (later) | React Native / Expo, reusing TypeScript logic |
| AI replies (later) | LLM behind a backend proxy (provider + key still unchosen) |

## Why this stack fits Communica

1. **Prisma is a JavaScript/TypeScript tool.** The schema is already written
   in Prisma and validated. Prisma Client is generated for JS/TS; using
   TypeScript means the database layer, the API routes, and the UI all share
   one language and one type system, with no bridge layer in between.
2. **Existing work is already TypeScript-adjacent JavaScript.** The Phase 1
   demo (`app.js`, `replies.js`) is plain JavaScript, and the mealkhata
   migration the user already runs uses the same Prisma + Neon + JWT +
   bcrypt approach in TypeScript. Staying in this ecosystem reuses that
   knowledge instead of starting a second stack from scratch.
3. **Next.js covers web + API in one project.** Pages, API routes, and
   (later) PWA installability come from one codebase, which keeps a
   small-team project manageable. Socket.io runs alongside it for live
   messaging and call signalling.
4. **WebRTC is a web standard.** Audio/video calls in the browser use the
   browser's built-in WebRTC; no native plugin is needed for the web app,
   and the same call model carries over to React Native later.
5. **Mobile reuse is real, not a rewrite.** React Native / Expo uses
   TypeScript and React, so chat logic, SAZMU AI settings handling, and
   API client code can be shared with the web app. A separate mobile
   language would mean maintaining two implementations of the same app.

## Why NOT Python / Django for this project

- Django's ORM would replace Prisma, but the schema is already written and
  validated in Prisma, and the backend is specified as Prisma + Neon.
  Switching ORMs would throw away finished schema work for no user-facing
  gain.
- The project would then span two languages (Python backend, JS frontend),
  doubling the surface for a small team, while the current JS/TS path keeps
  one language end to end.
- Nothing in Communica's requirements (chat, WebRTC signalling, JWT auth)
  needs Python specifically; the LLM, when added, is called over HTTPS from
  the Node backend regardless of provider.

## Why NOT Flutter / Dart for this project

- Flutter would mean a second language (Dart) and a second codebase for
  mobile, while the web app — which comes first — still needs JS/TS anyway.
  The user asked for a WhatsApp-like web experience first, not a
  mobile-only app.
- React Native / Expo gives the same mobile outcome (a real phone app)
  while reusing the TypeScript code already being written for the web app.
- Flutter's strengths (pixel-perfect custom UI, a single mobile codebase)
  do not outweigh the cost of maintaining Dart alongside the TypeScript
  web app for this project.

## What this choice does NOT claim

- No performance benchmarks are claimed here — none were measured, and
  none are needed for this decision, which rests on ecosystem fit and
  code reuse.
- This choice does not change any fixed decision: backend stays Prisma +
  Neon (NOT Supabase), auth stays JWT + bcrypt, realtime stays
  WebSocket/polling, uploads stay server/S3 later, SAZMU AI stays labelled
  AI, and the Communica ID stays an in-app number, never a phone number.

## Open items for later phases (not decided here)

- LLM provider choice (Gemini vs OpenAI vs another) — user to decide.
- Hosting provider — user to decide.
- Exact Socket.io deployment topology (same host as Next.js vs separate
  service) — decided when hosting is chosen.
