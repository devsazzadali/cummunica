# Communica — Backend README (Step 7: BACKEND_README)

**Status: reference-implementation SKELETONS, not wired to a live database.**
These TypeScript modules implement the Step 3 algorithms
(`../ALGORITHMS.md`) against the Step 2 Prisma schema
(`../prisma/schema.prisma`, QA-passed and PM-approved) for the Step 5/6
UI prototype (`../website/index.html`). Nothing here is published, no
account has been created, and no `prisma db push` to a live database
has been run in this step — no `DATABASE_URL` has been provided.

**Fixed decisions (do not change without the user):**

- Backend: **Prisma + Neon DB (PostgreSQL) ONLY. NOT Supabase.**
- Auth: **JWT + bcrypt**, server-side only.
- Realtime: **WebSocket (Socket.io) with polling fallback.**
- Uploads: **server storage / S3-compatible storage later.** NOT Supabase Storage.
- Calls: **in-app WebRTC ONLY.** Never a real phone number, never a
  PSTN call. `User.communicaId` is a random 8-digit IN-APP identifier.
- **SAZMU AI is one AI chatbot contact inside Communica, ALWAYS
  labelled "AI — not a human".** It is NOT a row in `User`. Boyfriend
  default call name: **Sazzad**. Girlfriend presets: Sadia, Maria,
  Tithi, Borsha, Anika, Tajmira, Mim, Mimi, Mumu, Ayra, Jannati,
  Mushfika, plus a custom name. No girlfriend default is invented.
  ("Mumu" here is only a girlfriend call-name option, not the brand.)
- **Registration FIRST, then use.** No use of the app before registering.

## What is in this folder

| File | Implements (algorithm section) |
|---|---|
| `src/errors.ts` | Shared `ApiError` + status-code helpers (401/403/400/404/409/413). |
| `src/types.ts` | Schema-shaped record types, public-profile shape, adapter interfaces (password hasher, JWT signer, emit, clock). No runtime dependency. |
| `src/auth.ts` | §1 register (username normalize, random ID + collision retry, bcrypt, JWT) + login (incl. the UI's "@username OR Communica ID" login variant). |
| `src/users.ts` | §2 search (exact ID / username exact+prefix, public fields only, blocked excluded) + contacts (request / accept / favorite / block). |
| `src/chats.ts` | §3 chat-list ranking + unread counts, archive/favorite/mute, §8 group admin (create/add/remove/promote/demote/leave/delete). |
| `src/messages.ts` | §4 send / list / poll / mark-read / reactions, PLUS the **real message-edit endpoint** (`editedAt`) the Step 5/6 UI does not have yet (UI limitation L1) + delete-for-all. |
| `src/media.ts` | §6 upload validation (type → size → server-side MIME sniff → duration), safe path naming, status-media variant. |
| `src/calls.ts` | §7 WebRTC signalling (accepted-contact gate, offer/answer/ICE relay, accept/decline/busy/missed/caller-cancel/end, `CallLog` writes, `ringingSince`/`startedAt`). |
| `src/sazmu.ts` | §5 SAZMU AI backend proxy design (safety-first pipeline, language detection, `UserMemory` lookup, LLM ONLY via server-side proxy when configured, template fallback, honest-unknown, AI label). |
| `src/socket.ts` | Socket.io rooms `chat:{chatId}` / `user:{userId}`, event catalogue, handshake JWT auth, polling-fallback note. |
| `src/index.ts` | Re-exports the modules for the route layer. |
| `package.json` | Dependency + script declarations for the wiring phase (NOT installed here). |
| `tsconfig.json` | Strict config used for the Step 7 check (`tsc --noEmit`). |
| `.env.example` | Environment variable NAMES only. No values. Never commit a real `.env`. |

**Import safety (why this type-checks with no `node_modules`):**
no module here imports `@prisma/client`, `bcryptjs`, `jsonwebtoken`,
or `socket.io`. Each module defines a narrow Db/adapter interface that
production implements on top of those libraries, and takes it as a
parameter (dependency injection). The route layer (Next.js API routes,
to be written in the wiring phase) is the only place that imports the
real libraries. That is deliberate: these are reference skeletons, and
their logic can be checked without a live database or installed packages.

## How to wire this to Neon (when DATABASE_URL is provided)

Do these steps in order, and ONLY after the user provides the Neon
`DATABASE_URL` (and `DIRECT_URL` if Neon requires it) **via the secure
vault — never in chat, never in a file, never in a commit**.

1. **Environment handling.**
   - Copy `.env.example` to `.env` locally and fill it from the secure
     vault. `.env` must stay out of version control (add it to
     `.gitignore` before the first commit that contains this folder).
   - Required names: `DATABASE_URL`, `JWT_SECRET`. Optional: `DIRECT_URL`,
     `LLM_PROVIDER`, `LLM_API_KEY`, `SOCKET_PORT`.
   - If a secret is ever committed by mistake, rotate it in the vault
     and in Neon — do not just delete the commit.
2. **Install + generate.**
   - `npm install` (installs `package.json`: Prisma, bcryptjs,
     jsonwebtoken, socket.io, TypeScript).
   - `npx prisma generate` — generates Prisma Client from
     `../prisma/schema.prisma`. The schema file lives one level up
     (`../prisma/`), NOT inside `backend/`; do not copy or edit it.
3. **Push the schema — only now, only with a real DATABASE_URL.**
   - `npx prisma db push` (or `prisma migrate dev` if the project
     adopts migrations later — that is a later decision, not this step).
   - This step was NOT run here: no `DATABASE_URL` exists yet, and no
     dummy URL was written to any file. The Step 7 syntax check did not
     need one (see Verification below).
4. **Wire the adapters (route layer, to be written).**
   - Implement each module's `*Db` interface on top of Prisma Client
     (e.g. `AuthDb.findUserByUsername` → `prisma.user.findUnique`).
     The interfaces are small on purpose; map them one by one and keep
     the error codes in `errors.ts` (a Prisma "not found" must become
     the module's 404/403, never a raw Prisma error to the client).
   - Passwords: `bcryptjs` with cost **12** (`BCRYPT_COST` in
     `auth.ts`). JWT: `jsonwebtoken` with `JWT_SECRET` from the vault,
     7-day lifetime (`JWT_LIFETIME_DAYS`). Never log a plaintext
     password or a token.
   - Socket.io: implement `IoLike` in `socket.ts` over a real
     Socket.io server; verify the handshake JWT with the same signer
     as the HTTP API (`authenticateSocket`). See "Socket.io deployment
     note" below.
   - Media storage: implement `StoreFn` in `media.ts` (server disk now,
     S3-compatible storage later) and wire a real server-side duration
     prober before trusting VOICE/VIDEO durations (see Honest limits).
   - LLM: implement `LlmClient` in `sazmu.ts` ONLY after the user
     chooses a provider and supplies its key via the secure vault. The
     key lives server-side only; the frontend must NEVER call the LLM
     provider directly and must never receive the key.
5. **Smoke-test before any UI wiring.**
   - Register → login → search → create chat → send/list/edit message →
     start/accept/end call (in-memory) → SAZMU setup + template reply.
   - Confirm every error code in the route table below still matches
     after the Prisma mapping (especially 403 membership, 409 username
     taken, 400 edit rules, 403 call gate).

## JWT secret via the secure vault

- `JWT_SECRET` is read from the environment at server start. It is
  never hard-coded, never committed, and never sent to the client.
- The JWT payload is `{ userId, username }`, valid **7 days**
  (ALGORITHMS §1 chosen default). There are no refresh tokens in this
  step; adding rotation is a production-hardening task (see below).

## LLM key: server-side only

- `LLM_PROVIDER` / `LLM_API_KEY` are server-side environment names.
  Until both are configured, `sazmuReply` uses template replies and
  marks them `isTemplate: true` — the client must label them as
  templates, NOT as generative AI output.
- When configured, the backend proxy calls the provider, re-applies
  the §5a safety rules to the generated text, and only then returns it.
- SAZMU AI replies use only the requesting user's own `User` profile
  + consented `UserMemory` rows. Never another user's data, never
  scraped private chats. `DELETE /sazmu/memories` removes them.

## Socket.io deployment note

- `LANGUAGE.md` leaves the topology open (same host as Next.js vs a
  separate service) — that decision belongs to the hosting choice,
  which the user has not made yet. Either works with `socket.ts` as
  long as the SAME `JWT_SECRET` verifies handshake tokens.
- **Single-process limit:** `CallService` keeps active calls in an
  in-memory `Map`. That is correct for one server process. On multiple
  instances, move active-call state to shared state (e.g. Redis) or pin
  a user's signalling to one instance, otherwise busy checks and the
  30-second missed-call timeout diverge between instances.
- **Polling fallback:** if a client's socket is down, it polls
  `GET /chats/:chatId/messages/poll?since=<ISO time>` on reconnect and
  then every 15 seconds until the socket reconnects (ALGORITHMS §4).
  Messages are never lost while offline because they are saved to the
  database before being emitted.

## Route table

Conventions: `Authorization: Bearer <JWT>` on every `Auth: Yes` route.
`AUTH` = verify JWT; missing/expired/invalid → **401 unauthenticated**.
Error body shape: `{ "error": { "code": "<code>", "message": "<message>" } }`.
IDs in paths are the internal `cuid()` ids (chat/message/user ids), NOT
Communica IDs — except search, where the query IS the Communica ID or
@username. Search responses NEVER include `id` or `passwordHash`
(ALGORITHMS §2); other responses never include `passwordHash`.

### Auth (`src/auth.ts`)

| Method + path | Auth | Request | Response / errors |
|---|---|---|---|
| `POST /auth/register` | No | `{ username, displayName, password }` — username is trimmed + lower-cased; client strips a leading `@` first | `201 { user (no passwordHash), communicaId, token }`. `400` username 3–20 / charset / display name / password ≥ 8; `409` username taken; `500` ID allocation failed after 10 retries |
| `POST /auth/login` | No | `{ identifier, password }` — identifier is `@username` OR an exact 8-digit Communica ID (matches the Step 5/6 login screen) | `200 { user (no passwordHash), token }`. `401` invalid username or password (same message for missing user vs wrong password) |

### Users + contacts (`src/users.ts`)

| Method + path | Auth | Request | Response / errors |
|---|---|---|---|
| `GET /users/search?q=<query>` | Yes | Query param `q`: exact 8-digit Communica ID OR @username (exact, else prefix). Empty `q` → `[]` | `200 [ { username, displayName, communicaId, avatarUrl, bio } ]` — public fields ONLY, no id. Blocked users (either direction) + self excluded. An 8-digit query never falls through to username matching; partial-ID search does not exist |
| `POST /contacts/request` | Yes | `{ contactUserId }` (internal id, resolved via search + a non-public lookup — see note) | `201 Contact` (`accepted: false`). `400` self-request; `404` user not found; `409` contact already exists |
| `POST /contacts/:contactUserId/accept` | Yes | — | `200 Contact` (`accepted: true`). `404` request not found |
| `PATCH /contacts/:contactUserId/favorite` | Yes | `{ isFavorite: boolean }` | `200 Contact`. DIRECT-chat favorites only (see chats list ranking) |
| `PATCH /contacts/:contactUserId/block` | Yes | `{ isBlocked: boolean }` | `200 Contact`. `404` contact not found. Blocked users are excluded from search and cannot call |

Note: `resolveUserIdForChat` in `users.ts` is INTERNAL-ONLY (turning a
searched public profile into a chat/contact target). It is NOT an
endpoint — exposing it would leak internal ids through search.

### Chats + groups (`src/chats.ts`)

| Method + path | Auth | Request | Response / errors |
|---|---|---|---|
| `GET /chats?filter=all\|unread\|favorites\|groups&archived=false` | Yes | Query params as shown; `archived=true` returns the archived list instead of the main list | `200 [ { chat, lastMessage, lastActivity, unread, isFavorite } ]`, sorted favorites-first (DIRECT only) then recency. Archived chats never appear in the main list |
| `GET /chats/archived` | Yes | — | `200` same shape as above, archived only, same ordering |
| `POST /chats/direct` | Yes | `{ otherUserId }` | `200 Chat` (existing DIRECT chat returned if one already exists). `400` self-chat; `404` user not found; `403` blocked either direction (skeleton chosen default, not in ALGORITHMS) |
| `POST /chats/groups` | Yes | `{ title, memberUserIds[] }` | `201 Chat` (creator = first ADMIN; non-existent member ids skipped; duplicates/creator ignored). `400` empty group name |
| `GET /chats/:chatId/members` | Yes | — | `200 [ ChatMember ]`. `403` not a member |
| `POST /chats/:chatId/members` | Yes | `{ userId }` | `201 ChatMember` (MEMBER). Admin only → `403`; `409` already a member. Emits `group:member-added` |
| `DELETE /chats/:chatId/members/:userId` | Yes | — | `204`. Admin only → `403`; `404` not a member; `400` cannot remove the last admin. Emits `group:member-removed` |
| `POST /chats/:chatId/members/:userId/promote` | Yes | — | `200 ChatMember` (ADMIN). Admin only → `403`; `404` not a member |
| `POST /chats/:chatId/members/:userId/demote` | Yes | — | `200 ChatMember` (MEMBER). Admin only → `403`; `404` not an admin; `400` cannot demote the last admin |
| `POST /chats/:chatId/leave` | Yes | — | `204`. `404` not a member; `400` last admin must promote another admin or delete first. Emits `group:member-left` |
| `DELETE /chats/:chatId` | Yes | — | `204`. GROUP only (`400` otherwise); any ADMIN may delete (not only the creator). `CallLog.chatId` is nulled in the SAME transaction before the Chat is deleted, so call history survives. Emits `group:deleted` |
| `PATCH /chats/:chatId/archive` | Yes | `{ archived: boolean }` | `200 ChatMember`. Requester only. `403` not a member |
| `PATCH /chats/:chatId/mute` | Yes | `{ muted: boolean }` | `200 ChatMember`. Requester only; muted never changes ranking |

### Messages (`src/messages.ts`)

| Method + path | Auth | Request | Response / errors |
|---|---|---|---|
| `POST /chats/:chatId/messages` | Yes | `{ type, text?, mediaUrl?, mediaMime?, durationSec?, replyToId? }` — TEXT needs non-empty text; PHOTO/VOICE/VIDEO/FILE need an uploaded `mediaUrl` (from `POST /chats/:chatId/media`); `replyToId` must exist in this chat and not be deleted-for-all | `201 Message` (saved, then emitted as `message:new`). `403` not a member; `400` payload / reply-target errors |
| `GET /chats/:chatId/messages?limit=&beforeId=` | Yes | Pagination: `limit` clamped to 1–100; `beforeId` pages backwards | `200 [ Message ]` (newest-first page; deleted-for-all messages carry the flag — clients render a placeholder) |
| `GET /chats/:chatId/messages/poll?since=<ISO time>` | Yes | Polling fallback while the socket is down | `200 [ Message ]` (`createdAt > since`, `deletedForAll = false`, ascending). Client polls on reconnect, then every 15 s while down, stops on reconnect |
| `POST /chats/:chatId/messages/:messageId/read` | Yes | — | `204` + `message:read` emit. Idempotent. `403` not a member; `400` own or missing message (watermark never moves backwards) |
| `PATCH /chats/:chatId/messages/:messageId` | Yes | `{ text }` — **the endpoint the Step 5/6 UI lacks (L1)** | `200 Message` with `editedAt` set + `message:edited` emit. Sender only (`403`); TEXT only, non-empty, not deleted-for-all (`400`); `404` message not found. Clients show an "edited" marker when `editedAt` is non-null. No edit history is stored (schema has only `editedAt`) |
| `DELETE /chats/:chatId/messages/:messageId` | Yes | — (delete for everyone) | `200 Message` with `deletedForAll: true` + `message:deleted` emit. Sender only (`403`). Fields are kept, not wiped; clients render a placeholder |
| `POST /chats/:chatId/messages/:messageId/reactions` | Yes | `{ emoji }` | `201 Reaction` + `message:reaction` emit. `400` missing/deleted message or empty emoji |
| `DELETE /chats/:chatId/messages/:messageId/reactions` | Yes | `{ emoji }` | `204` (remove own reaction) |
| `GET /chats/:chatId/messages/:messageId/reactions` | Yes | — | `200 [ Reaction ]` |

### Media (`src/media.ts`)

| Method + path | Auth | Request | Response / errors |
|---|---|---|---|
| `POST /chats/:chatId/media` | Yes | `multipart/form-data`: `file`, `declaredType` (PHOTO/VOICE/VIDEO/FILE), `durationSec` (VOICE/VIDEO, server-probed in production) | `201 { mediaUrl, mediaMime, durationSec, uploadKey, storagePath }` — pass `mediaUrl` (+`mediaMime`/`durationSec`) to `POST /chats/:chatId/messages`. Validation order: type → size → server-side MIME sniff → duration. `403` not a member; `400` unsupported type / MIME mismatch / duration missing or over limit; `413` file too large. Limits: PHOTO 10 MB (jpeg/png/webp/gif); VOICE 16 MB, 300 s (mpeg/ogg/webm/mp4); VIDEO 100 MB, 600 s (mp4/webm); FILE 25 MB (pdf/txt/zip). User filenames are discarded; path is `uploads/{senderId}/chats/{chatId}/{key}.{ext}`; thumbnails best-effort for PHOTO/VIDEO |

### Calls (`src/calls.ts` — in-app WebRTC signalling only)

| Method + path | Auth | Request | Response / errors |
|---|---|---|---|
| `POST /calls` | Yes | `{ calleeId, chatId?, type: AUDIO\|VIDEO }` | `200 { status: "ringing", callId }` + `call:incoming` to `user:{calleeId}`; OR `200 { status: "busy", callLogId }` when the callee is already in a call (busy logged as CANCELLED, callee not interrupted). `403` gate failed (callee has not accepted the caller, or caller is blocked) |
| `POST /calls/:callId/signal` | Yes | `{ kind: offer\|answer\|ice, payload }` | `204` + relay as `call:signal` to the other party only. Server never sees media. `403` not a party to the call |
| `POST /calls/:callId/accept` | Yes | — (callee only) | `200 CallLog` (`ACCEPTED`, `startedAt` = now) + `call:accepted` to caller. `403` only the callee can accept |
| `POST /calls/:callId/decline` | Yes | — (callee only) | `200 CallLog` (`DECLINED`) + `call:declined` to caller. `403` only the callee can decline |
| `POST /calls/:callId/cancel` | Yes | — (caller only, before answer) | `200 CallLog` (`CANCELLED`, `startedAt` = ringing time) + `call:cancelled` to both. `403` only the caller can cancel; `400` already accepted — use end instead |
| `POST /calls/:callId/end` | Yes | — (either party, after accept) | `200 CallLog` (`ENDED`, `endedAt`, `durationSec`) + `call:ended` to both. `400` not accepted yet (caller uses cancel, callee uses decline) |
| `GET /calls/recent?limit=` | Yes | — | `200 [ CallLog ]` (caller OR callee, newest first, limit clamped 1–100). A log exists for EVERY attempt, including missed/declined/busy |
| (server timer, no endpoint) | — | No answer within 30 s | `CallLog` (`MISSED`, `startedAt` = ringing time) + `call:missed` to both |

### SAZMU AI (`src/sazmu.ts` — backend proxy ONLY)

| Method + path | Auth | Request | Response / errors |
|---|---|---|---|
| `GET /sazmu/settings` | Yes | — | `200 CompanionSetting` (`role`, `callName`, `petName`, `tone`, `language`). `404` not set up yet |
| `PUT /sazmu/settings` | Yes | `{ role: Boyfriend\|Girlfriend, callName?, petName?, tone?, language? }` | `200 CompanionSetting`. Boyfriend with no `callName` → `Sazzad`; Girlfriend with no `callName` → `400` (no girlfriend default invented). Girlfriend presets: Sadia, Maria, Tithi, Borsha, Anika, Tajmira, Mim, Mimi, Mumu, Ayra, Jannati, Mushfika, or custom |
| `POST /sazmu/chat` | Yes | `{ text, isFirstMessage: boolean }` | `200 { text, aiLabel: true, source, language, intent, isTemplate }`. Pipeline: safety (distress → caring non-medical reply; sexual → warm non-sexual redirect; boundary → stop at once) → language detect → intent → own `UserMemory` only → LLM via server-side proxy IF configured (safety re-applied to generated text) else template → honest-unknown for ungrounded general questions → AI introduction on first message / identity question. `400` companion not set up yet. The frontend must NEVER call the LLM provider directly |
| `DELETE /sazmu/memories` | Yes | — | `204`. Deletes all of the requesting user's `UserMemory` rows; they are never used again |

### Socket.io events (`src/socket.ts`)

Handshake: client sends its JWT (`auth.token`); the server verifies it
with the same signer as HTTP (`authenticateSocket`) and disconnects
unauthenticated sockets before they join any room. Every user joins
`user:{userId}`; a socket joins `chat:{chatId}` only after the
membership check (`chat:join` / `chat:leave` client events).

Server → client events: `message:new`, `message:read`,
`message:edited`, `message:deleted`, `message:reaction`,
`call:incoming`, `call:accepted`, `call:declined`, `call:cancelled`,
`call:missed`, `call:ended`, `call:signal`, `group:added`,
`group:member-added`, `group:member-removed`, `group:member-left`,
`group:deleted`. Clients never broadcast these directly — the service
modules emit them after their checks pass, so a client cannot forge a
read receipt, a call acceptance, or a group event.

## Skeleton vs production-ready (honest split)

**Ready as specified (logic matches ALGORITHMS exactly):** username
normalization/validation, Communica ID generation + collision retry,
JWT payload/lifetime shape, search exact/prefix rules + public-fields
discipline + blocked exclusion, chat ranking + unread derivation,
group admin rules incl. last-admin guards and transactional group
delete, message send/read/poll rules, media limit table + validation
order + safe path naming, call gate + state machine + `CallLog` rules
+ timestamp discipline, SAZMU pipeline order + AI label + memory
consent rules, socket rooms/events + handshake auth.

**SKELETON — must be hardened before production (marked in code):**

- No rate limiting, login lockout, or per-socket caps (auth, socket).
- No refresh-token rotation (single 7-day JWT).
- No password-reset flow; no email/phone verification (none is wanted:
  no real phone numbers by design).
- Chat list has no pagination cursor (full filtered list returned).
- Media duration is validated but not probed here: production MUST
  measure duration server-side (e.g. ffprobe) and must probe audio vs
  video tracks — magic-byte sniffing alone cannot tell audio-only MP4
  from video MP4, or WebM audio from WebM video.
- SAZMU safety + intent matching are keyword lists, not a trained
  classifier. The ORDER and the guarantees (never diagnose, never
  erotic, never invent facts, boundary respected at once) are the
  contract; the matcher itself should be upgraded before launch.
- Template replies in `sazmu.ts` are short skeletons, not the full
  Phase 1 demo reply tables. They are labelled templates until the LLM
  backend exists.
- Active calls are in-memory (single-process). See the Socket.io note.
- Message edit has no history; delete-for-all is sender-only.
- No tests are shipped in this step — verification below is a
  type/syntax check only, not a test suite. A route-level test suite
  (Prisma test DB) belongs to the wiring phase.

## NOT implemented in this step (stated, not claimed)

- **Status / Updates endpoints (ALGORITHMS §9: post status, visible
  statuses with the 24-hour `expiresAt > NOW` filter, view + `StatusView`
  upsert).** The Step 7 file list has no status module, so no status
  route is offered here. `media.ts` already provides the status-media
  validation + `statuses/` path helper (`uploadStatusMedia`) for that
  follow-up step; the `StatusUpdate`/`StatusView` models already exist
  in the schema.
- **Communities moderation tools.** The plan marks moderation TBD and
  the schema has no Community model (communities map to groups); no
  endpoint is invented for it.
- **Push notifications, end-to-end encryption, native mobile app.**
  Out of scope per the plan (transport encryption + JWT only, for now).
- **The Next.js API route layer itself** (the HTTP glue mapping the
  routes above to these functions). That is the wiring phase, after
  `DATABASE_URL` is provided — it is not smuggled into this step as
  untested route code.
- **Any live-database operation.** No `prisma db push`, no Neon
  connection, no account, no publishing, no credential value anywhere.

## Verification performed in this step

- **Type/syntax check:** `tsc --noEmit` (TypeScript 5.6.3, strict,
  `tsconfig.json` in this folder) over all of `src/` — **exit code 0,
  zero errors**. Method note: the check used a throwaway TypeScript
  copy extracted to `/tmp` (the VM has no global `tsc`); no package
  was installed into this folder and no `node_modules` was created.
  No `node --check` claim is made for the `.ts` files (Node's checker
  does not strip types), and no test suite was run — the check proves
  the skeletons are syntactically valid, well-typed TypeScript, not
  that they pass behavioural tests against a database.
- **No live DB touched:** no `DATABASE_URL` was used at all in this
  step — not even a dummy one in a shell command — because the check
  above does not require one. Nothing was written to any file outside
  `backend/`, and no file in `~/workspace/communica/` was edited or
  deleted (schema, plan, language, algorithms, flowchart, website UI
  untouched).
- **Secret scan:** `grep` over `backend/` for secret-value patterns
  (see the report for the exact commands) — only env var NAMES
  (`.env.example`, empty values) and the words "password"/"token" as
  code identifiers were found; no key, token, or credential VALUE is
  in any file.
- **Forbidden-dependency scan:** no file imports Supabase, and no file
  contains PSTN dialling code. The words "Supabase"/"PSTN" appear only
  in exclusion statements ("NOT Supabase", "never PSTN") in docs and
  comments, which is the design constraint itself, not a dependency.
- **SAZMU AI label:** every SAZMU reply shape carries `aiLabel: true`,
  introductions state "AI chatbot, not a human", and the chatbot is
  never modelled as a `User` row.
