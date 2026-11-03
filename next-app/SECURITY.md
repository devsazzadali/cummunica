# Communica — Security (standing rule, 2026-11-03)

Goal: no one can hack anyone else's account. Auth stays custom
JWT + bcrypt ONLY (never Neon Auth, never a third-party auth).

## What is enforced in code (this step)

- **Passwords:** bcrypt cost 12 (`BCRYPT_COST` in `src/lib/auth.ts`),
  minimum 8 characters, hashed only — plaintext is never stored.
  `toPublicUser()` strips `passwordHash`; search/profile routes
  return public shapes only. Verified by `tests/security-unit.ts`.
- **No user enumeration:** login returns the identical 401
  `invalid_credentials` for a missing user and a wrong password.
  Register returning 409 for a taken username is a registration
  conflict, not a login oracle — usernames are public handles by
  design (they are the search key).
- **Tokens:** JWT, 7-day expiry, secret ONLY from deploy-time
  `JWT_SECRET` (never in the repo, never in client code). Every
  protected route calls `requireAuth()` first. Tokens now carry a
  `jti`; `POST /api/auth/logout` revokes that token server-side
  (in-memory blocklist until expiry) and the client clears storage.
  Tokens issued before the `jti` change are rejected — users re-login.
- **Authorisation gates (all server-side, never client-only):**
  chat/message access = chat membership (403 otherwise); message
  edit/delete = sender only, TEXT-only edits; calls = accepted
  contact gate (callee accepted caller, not blocked); search
  excludes self + blocked in both directions; group member/role
  actions = group ADMIN only (last admin cannot be demoted or
  leave while others remain); status view = visible users only
  (self + accepted contacts, minus blocked); profile PATCH = own
  row only; avatar/status media must be `/uploads/` URLs from
  `/api/media`.
- **Rate limiting + lockout** (`src/lib/rate-limit.ts`): login
  20 attempts / 10 min per IP + lockout after 5 failures per
  identifier (and per IP + identifier) for 15 minutes; register
  10 / hour per IP; search 120 / min per user. Only genuine 401s
  count toward lockout — a DB outage (503) never locks a user
  out. F12: `x-forwarded-for` is UNTRUSTED by default (no trusted
  proxy is configured) and is used for the per-IP bucket only;
  the identifier-keyed lockout is the binding protection, so
  rotating the header cannot dilute a per-account lockout.
- **Block rule — DECIDED (F8):** blocking is enforced for 1:1
  traffic only (contact creation, DIRECT chat creation, DIRECT
  messages, calls — all 403 when blocked either way). It is NOT
  enforced on GROUP messages: a blocked user already in a shared
  group can still send there, because group membership is an
  admin decision (group creation and admin-add refuse blocked
  users; an admin can remove a member). See README.md.
- **Delete-for-all redaction (F19):** DELETE nulls text/media in
  the row and GET strips those fields for any flagged message, so
  deleted content cannot be read back through the API.
- **Upload content sniffing (F11):** `/api/media` sniffs content
  bytes server-side against the declared MIME (JPEG/PNG/WebP/GIF/
  MP3/Ogg/WAV/WebM/MP4 signatures) and rejects mismatches; the
  stored extension is forced from the validated MIME. MP4/M4A and
  audio/video WebM share a container family, so sniffing proves
  the container, not the codec inside.
- **Message media (F10):** media messages must use a `/uploads/`
  URL and a mediaMime matching the message type, exactly as
  status/profile already required for URLs.
- **Input safety:** server-side validation on every write route
  (username pattern/length, 8-digit IDs, message types, text
  length caps, reaction caps, group-title caps). Prisma queries
  are parameterised — there is NO raw SQL with user input
  anywhere in `src/`. Rendering is React-escaped JSX only; there
  is NO `dangerouslySetInnerHTML` with user content in `src/`.
  File uploads: allowlisted mime types, size caps
  (`src/lib/media.ts`: photo 5 MB, voice 10 MB, video 20 MB),
  safe filenames that strip directories — no path traversal.
- **Headers** (`next.config.mjs`): `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, restrictive
  `Permissions-Policy` (camera/mic deliberately NOT blocked —
  WebRTC calls need them, behind browser permission), plus a
  Content-Security-Policy (F13: `default-src 'self'`, no objects/
  frames, connect/media/img/font restricted to self/ws/blob/data;
  script/style keep `'unsafe-inline'` because Next.js emits inline
  bootstrap scripts and the app uses inline style attributes — a
  nonce-based CSP is the follow-up). HSTS is a HOST-level setting
  and is NOT set by the app: the deployment host / reverse proxy
  must send `Strict-Transport-Security` (e.g.
  `max-age=31536000; includeSubDomains`) on every response.
- **Error hygiene:** `handleError()` maps unknown errors to a
  generic 500 `internal_error` — no stack traces, no DB internals,
  no "username exists" leak from login. Grep-verified: no secret,
  key, token value, or `.env` file in the repo (see self-test
  section below); deploy-time env names only in `.env.example`.

## Honest limitations — NOT silently weak (pending, recorded)

1. **Token store is localStorage, not httpOnly cookies.**
   XSS is mitigated by React escaping + no raw HTML, but a token
   copied from a device before logout remains usable until expiry
   or logout. HARDENING FOLLOW-UP (before production login at
   scale): move the JWT to an httpOnly + Secure + SameSite cookie
   set by the auth routes, with CSRF protection, and remove
   localStorage token use. F20 ASSESSMENT (2026-11-03 fix round):
   this migration was NOT attempted here, deliberately. It touches
   login/register/logout, every client caller (api-client,
   call-api, login/register pages, Socket.io handshake auth) and
   needs CSRF tokens on every state-changing route; it cannot be
   proven without a live-DB login flow, which this fix round
   cannot run (F1 pending, no live credential). Doing it
   unverified risked breaking the auth flow, so it stays pending
   with this reason recorded, not claimed fixed.
2. **Revocation + rate-limit + call state are in-memory /
   single-process.** Multi-instance deployments must move them
   to shared state (e.g. Redis) or pin users to one instance,
   otherwise a revoked/locked-out token may still work on another
   instance. Same limitation already documented for `/api/calls`.
3. **Upload storage is server-local** (`public/uploads`), not
   S3/object storage. Production follow-up: signed uploads to
   object storage with the same mime/size validation server-side.
4. **No E2E encryption, no push notifications, no TURN server.**
   Messages are protected by auth + membership gates in transit
   over HTTPS (host-provided), but the server can read them.
   TURN is needed for strict-NAT call pairs. None of these are
   faked as present.
5. **Password reset: NOT BUILT in this step (by design, secure).**
   Secure design when it is built (never a weak reset):
   user requests a reset for their own identifier → server
   creates a random token, stores ONLY its SHA-256 hash with a
   short expiry (e.g. 1 hour) and single-use flag, and sends the
   plaintext token ONLY by email via Resend once the user
   provides a Resend key via the secure vault → reset endpoint
   verifies the hash + expiry, then sets a new bcrypt-12 hash.
   Responses must not reveal whether an identifier exists.
   Until then, there is NO reset endpoint at all — nobody can
   trigger a reset for someone else's account, because the
   mechanism does not exist.

## Self-test results (this run, no live DB available in this VM)

Unit tests (`tests/security-unit.ts`, compiled with `tsc` to
`/tmp`, run with a placeholder `JWT_SECRET` — no real secret):
forged token → 401, expired token → 401, revoked (logged-out)
token → 401, identical 401 for missing vs wrong password,
bcrypt cost 12 + hash never in public shapes, rate limit trips
after the limit, login lockout trips after 5 failures and clears
on success, disallowed/oversize upload rejected, traversal
filename sanitised, XSS payload stored as inert text (React
escapes on render; no `dangerouslySetInnerHTML` in `src/`).

Auth-layer HTTP checks (built app started with placeholder env,
no live DB — routes return 401 before touching the DB, which is
exactly the gate under test): `GET /api/chats`, `/api/status`,
`/api/messages`, `/api/calls` without a token → 401; with a
forged token → 401. Live-DB membership attacks (user X reading
user Y's chat, blocked-user message, call to non-contact) are
code-gated in the routes listed above and MUST be re-run by QA
end-to-end against a live DB before PM approval — they are NOT
claimed as live-tested here, because no DB credential is stored
in this VM and none was invented for the test.
