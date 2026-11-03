# Communica — Algorithms (Step 3)

**Scope:** Pseudocode only — not production code. This file describes *how*
each feature works, step by step. It implements Step 1
(`COMMUNICA_PLAN.md`, `LANGUAGE.md`) against the Step 2 schema
(`prisma/schema.prisma`, QA-passed and PM-approved — **not edited here**).

**Hard limits carried over from Step 1 (do not break):**

- Backend: Prisma + Neon DB (PostgreSQL) ONLY. **NOT Supabase** — no
  Supabase Auth, Realtime, or Storage anywhere in these algorithms.
- Auth: JWT + bcrypt, server-side only.
- Realtime: WebSocket (Socket.io) with polling fallback. NOT Supabase
  Realtime.
- Uploads: server storage / S3-compatible storage later. NOT Supabase
  Storage.
- Calls: in-app WebRTC ONLY. **Never PSTN, never a real phone number.**
  `User.communicaId` is a random 8-digit in-app identifier only.
- **SAZMU AI is an AI chatbot contact inside Communica, ALWAYS labelled
  "AI — not a human".** It is not a row in `User` (see the schema
  comment on `CompanionSetting`); it is never presented as a real person.
- Registration comes FIRST, before any use of the app.
- SAZMU AI replies use only the user's own data: `User` profile fields
  plus `UserMemory` rows the user consented to. Never scraped private
  chats, never another person's data.
- Local work only: no publishing, no accounts, no real credentials,
  no `prisma db push` in this step.

**Field discipline:** Every algorithm below references only models and
fields that exist in `prisma/schema.prisma`: `User`, `Contact`, `Chat`,
`ChatMember`, `Message`, `MessageRead`, `Reaction`, `StatusUpdate`,
`StatusView`, `CallLog`, `CompanionSetting`, `UserMemory`, and their
fields as written there. Where a rule needs a value the schema does not
store (e.g. a "pinned" flag), the algorithm says so and states the
chosen workaround instead of inventing a field.

**Conventions used in the pseudocode:**

- `NOW` = current server time (UTC; the server, not the client, is the
  source of truth for timestamps).
- `FAIL(code, message)` = stop and return an error to the caller; do
  not continue to later steps.
- `AUTH(request)` = verify the JWT from the request / socket handshake
  and return the authenticated `User.id`. If the token is missing,
  expired, or invalid → `FAIL(401, "unauthenticated")`.
- All database writes that must succeed together are done in one
  transaction where noted.

---

## 1. Registration + Communica ID generation + password hashing + JWT

**Inputs:** `username` (raw), `displayName`, `password` (plaintext,
received over HTTPS only, never logged or stored).

**Outputs:** the new `User` row (without `passwordHash`) + a JWT +
the generated `communicaId` shown to the user.

```
FUNCTION register(username_raw, displayName, password):
  # --- 1a. Username normalization (schema: User.username) ---
  username = TRIM(LOWERCASE(username_raw))
  IF username LENGTH < 3 OR username LENGTH > 20:
    FAIL(400, "username must be 3-20 characters")
  IF username does NOT match ^[a-z0-9_]+$:
    FAIL(400, "username may contain only letters, numbers, underscore")
  displayName = TRIM(displayName)
  IF displayName is empty:
    FAIL(400, "display name is required")
  IF password LENGTH < 8:                      # chosen default, see §1 note
    FAIL(400, "password must be at least 8 characters")

  # --- 1b. Username uniqueness ---
  existing = FIND User WHERE username = username
  IF existing exists:
    FAIL(409, "username already taken")

  # --- 1c. Random 8-digit Communica ID with collision retry ---
  # The ID is an in-app identifier only. It is NOT a phone number and
  # can never place or receive phone calls.
  attempts = 0
  LOOP:
    attempts = attempts + 1
    # First digit 1-9, so the ID is always exactly 8 digits
    # (no leading zero that could be dropped or misread).
    communicaId = RANDOM_INTEGER(10000000, 99999999) as string
    collision = FIND User WHERE communicaId = communicaId
    IF collision does NOT exist:
      BREAK
    IF attempts >= 10:                          # chosen default, see §1 note
      FAIL(500, "could not allocate a Communica ID, try again")

  # --- 1d. Password hashing ---
  passwordHash = BCRYPT_HASH(password, cost=12)  # chosen default, see §1 note
  # Plaintext password is discarded here; only passwordHash is stored.

  # --- 1e. Create the user (one transaction) ---
  user = CREATE User {
    username: username,
    displayName: displayName,
    communicaId: communicaId,
    passwordHash: passwordHash,
    lastSeenAt: NOW
  }
  # Note: User.avatarUrl and User.bio start empty (NULL); the user may
  # set them later. No row is created in any other table at registration.

  # --- 1f. JWT issuance (server-side secret only, never in frontend) ---
  token = JWT_SIGN(
    payload = { userId: user.id, username: user.username },
    secret  = SERVER_JWT_SECRET,                 # from secure vault, never committed
    expiresIn = "7 days"                         # chosen default, see §1 note
  )
  RETURN { user WITHOUT passwordHash, communicaId, token }
END
```

**Login (same primitives, for completeness):**

```
FUNCTION login(username_raw, password):
  username = TRIM(LOWERCASE(username_raw))
  user = FIND User WHERE username = username
  IF user does NOT exist OR NOT BCRYPT_VERIFY(password, user.passwordHash):
    FAIL(401, "invalid username or password")   # same message either way
  UPDATE User SET lastSeenAt = NOW WHERE id = user.id
  token = JWT_SIGN({ userId: user.id, username: user.username }, ...)
  RETURN { user WITHOUT passwordHash, token }
END
```

**Chosen defaults in §1 (not user decisions):** minimum password length
8; bcrypt cost 12; at most 10 Communica ID collision retries before
failing; JWT lifetime 7 days; first Communica ID digit 1–9 so the ID is
always 8 digits. These may be tuned later without changing the schema.

---

## 2. Search by Communica ID / username

**Rule:** Communica ID search is EXACT-ONLY (full 8 digits). Partial
ID search is NOT supported, for anti-enumeration security. An exact
8-digit Communica ID match is tried FIRST; username search comes
second and is exact or prefix only. Only public profile fields are
ever returned, and blocked users are excluded in both directions.

**Public fields returned (only these):** `User.username`,
`User.displayName`, `User.communicaId`, `User.avatarUrl`, `User.bio`.
Never returned: `User.passwordHash`, `User.id` (PUBLIC_PROFILE returns
no id at all), `User.lastSeenAt`, `User.createdAt`,
`User.updatedAt`, or any other user's private data.

```
FUNCTION searchUsers(request, query_raw):
  me = AUTH(request)
  query = TRIM(query_raw)
  IF query is empty:
    RETURN []                                    # no empty-query dump

  # --- 2a. Blocked-user exclusion set (both directions) ---
  # A Contact row is owned by one user: Contact.ownerId blocks
  # Contact.contactUserId when Contact.isBlocked = true.
  blockedByMe   = SELECT contactUserId FROM Contact
                  WHERE ownerId = me AND isBlocked = true
  blockedMe     = SELECT ownerId FROM Contact
                  WHERE contactUserId = me AND isBlocked = true
  excludedIds   = blockedByMe UNION blockedMe UNION { me }

  # --- 2b. Exact 8-digit Communica ID match FIRST ---
  IF query matches ^[0-9]{8}$:
    hit = FIND User WHERE communicaId = query
    IF hit exists AND hit.id NOT IN excludedIds:
      RETURN [ PUBLIC_PROFILE(hit) ]            # single exact result
    ELSE:
      RETURN []                                 # an 8-digit query is an
                                                # ID lookup, not a prefix
                                                # search — do not fall
                                                # through to username
                                                # matching on digits

  # --- 2c. Username search: exact match first, then prefix ---
  normalized = LOWERCASE(query)
  exact = FIND User WHERE username = normalized
          AND id NOT IN excludedIds
  IF exact exists:
    RETURN [ PUBLIC_PROFILE(exact) ]
  prefixMatches = SELECT User WHERE username STARTS WITH normalized
                  AND id NOT IN excludedIds
                  ORDER BY username ASC
                  LIMIT 20                        # chosen default
  RETURN MAP(prefixMatches, PUBLIC_PROFILE)
END

FUNCTION PUBLIC_PROFILE(user):
  RETURN {
    username:    user.username,
    displayName: user.displayName,
    communicaId: user.communicaId,
    avatarUrl:   user.avatarUrl,
    bio:         user.bio
  }
END
```

**Notes:**

- SAZMU AI also appears in search as a labelled AI contact (per the
  plan), but it is NOT a `User` row, so it is appended by the client
  from a constant, never returned from this database query.
- Partial Communica ID search is NOT supported: an 8-digit query is an
  exact lookup only, so one user cannot enumerate IDs by prefix.
- The searcher themself is always excluded from results.

---

## 3. Chat-list ranking + unread counts

**Chosen ranking rule (stated as a chosen default, not a user
decision):** The schema has NO pinned flag on `ChatMember`, so there is
no true "pinned" tier. The rule used here is:

1. **Favorites first** — for DIRECT chats only, a chat is a favorite
   when a `Contact` row exists with `ownerId = me`,
   `contactUserId = the other member`, and `isFavorite = true`.
   GROUP chats have no `Contact` row and therefore never rank as
   favorites; they sort by recency only.
2. **Then recency** — by the chat's last message time
   (`Message.createdAt` of the newest non-deleted message), newest
   first. Chats with no messages sort by `Chat.createdAt`, newest
   first, below chats that have messages.
3. **Archived chats are NOT in the main list at all** — chats where the
   requester's `ChatMember.archived = true` are returned only under a
   separate `archived` list (same favorite-then-recency order inside
   that list).

`ChatMember.muted` does NOT change ranking; it only silences
notifications (a later-phase concern).

```
FUNCTION getChatList(request, filter):
  # filter: "all" | "unread" | "favorites" | "groups" (per the plan's
  # Chats filters); archived chats are fetched with a separate call.
  me = AUTH(request)

  memberships = SELECT ChatMember WHERE userId = me
                AND archived = false            # archived listed separately
  chats = []
  FOR EACH membership IN memberships:
    chat = membership.chat                      # Chat row

    # --- 3a. Last message (recency key) ---
    lastMessage = SELECT Message WHERE chatId = chat.id
                  AND deletedForAll = false
                  ORDER BY createdAt DESC LIMIT 1
    lastActivity = lastMessage.createdAt IF lastMessage exists
                   ELSE chat.createdAt

    # --- 3b. Unread count ---
    # Unread = messages after MY lastReadAt, excluding my own messages
    # and messages deleted for everyone.
    IF membership.lastReadAt is NULL:
      unread = COUNT Message WHERE chatId = chat.id
               AND senderId != me AND deletedForAll = false
    ELSE:
      unread = COUNT Message WHERE chatId = chat.id
               AND senderId != me AND deletedForAll = false
               AND createdAt > membership.lastReadAt

    # --- 3c. Favorite flag (DIRECT chats only) ---
    isFavorite = false
    IF chat.type = DIRECT:
      otherMember = SELECT ChatMember WHERE chatId = chat.id
                    AND userId != me LIMIT 1
      IF otherMember exists:
        contact = FIND Contact WHERE ownerId = me
                  AND contactUserId = otherMember.userId
        isFavorite = contact.isFavorite IF contact exists ELSE false

    chats.APPEND({ chat, lastMessage, lastActivity, unread, isFavorite })

  # --- 3d. Apply the requested filter ---
  IF filter = "unread":    chats = chats WHERE unread > 0
  IF filter = "favorites": chats = chats WHERE isFavorite = true
  IF filter = "groups":    chats = chats WHERE chat.type = GROUP
  # filter = "all": no further filtering

  # --- 3e. Sort: favorites first, then recency ---
  SORT chats BY (isFavorite DESC, lastActivity DESC)

  RETURN chats
END

FUNCTION getArchivedChatList(request):
  # Same as getChatList with archived = true, same favorite-then-recency
  # sort, returned as its own list. Restoring a chat sets
  # ChatMember.archived = false for the requester only.
  me = AUTH(request)
  ... (same steps as getChatList, but WHERE archived = true) ...
END
```

---

## 4. Message send / deliver / read flow

**Participants:** sender (authenticated), chat room (Socket.io room
`chat:{chatId}`), recipients (other `ChatMember`s), polling fallback
for clients whose socket is down.

```
FUNCTION sendMessage(request, chatId, type, text, mediaUrl, replyToId):
  sender = AUTH(request)

  # --- 4a. Membership check (authorization, not just authentication) ---
  membership = FIND ChatMember WHERE chatId = chatId AND userId = sender.id
  IF membership does NOT exist:
    FAIL(403, "not a member of this chat")

  # --- 4b. Validate payload by Message.type ---
  IF type = TEXT AND (text is empty after TRIM):
    FAIL(400, "text message must not be empty")
  IF type IN (PHOTO, VOICE, VIDEO, FILE) AND mediaUrl is empty:
    FAIL(400, "media message requires an uploaded file (see §6)")
  IF replyToId is given:
    parent = FIND Message WHERE id = replyToId AND chatId = chatId
    IF parent does NOT exist OR parent.deletedForAll = true:
      FAIL(400, "replied-to message not found in this chat")

  # --- 4c. Save (single source of truth = the database) ---
  message = CREATE Message {
    chatId: chatId, senderId: sender.id, type: type,
    text: text, mediaUrl: mediaUrl, mediaMime: (from §6 upload),
    durationSec: (from §6 upload, VOICE/VIDEO only),
    replyToId: replyToId, deletedForAll: false, createdAt: NOW
  }
  UPDATE Chat SET updatedAt = NOW WHERE id = chatId
  # The sender's own read position advances past their own message.
  UPDATE ChatMember SET lastReadAt = NOW
    WHERE chatId = chatId AND userId = sender.id

  # --- 4d. Live delivery via WebSocket ---
  EMIT to room "chat:{chatId}" event "message:new" WITH message
  # Every connected member's client receives it; the sender's own other
  # devices receive it too (multi-device sync).

  # --- 4e. Delivery acknowledgement ---
  # "Delivered" here means: saved in the database AND emitted to the
  # room. It does NOT mean "read" — read is §4f, and it does NOT mean
  # the recipient's device confirmed receipt (that ack is a later
  # enhancement; the server does not wait for it).
  RETURN message   # HTTP 201; clients treat a 201 as "sent/delivered
                   # to server". Socket emission is best-effort on top.

FUNCTION markRead(request, chatId, messageId):
  me = AUTH(request)
  membership = FIND ChatMember WHERE chatId = chatId AND userId = me.id
  IF membership does NOT exist:
    FAIL(403, "not a member of this chat")
  message = FIND Message WHERE id = messageId AND chatId = chatId
  IF message does NOT exist OR message.senderId = me.id:
    FAIL(400, "cannot mark own or missing message as read")
    # (Own messages never create MessageRead rows for the sender.)

  # Idempotent: MessageRead has @@unique([messageId, userId]).
  UPSERT MessageRead { messageId, userId: me.id, readAt: NOW }
  # Advance the reader's watermark, but never backwards.
  IF membership.lastReadAt is NULL
     OR message.createdAt > membership.lastReadAt:
    UPDATE ChatMember SET lastReadAt = message.createdAt
      WHERE chatId = chatId AND userId = me.id

  EMIT to room "chat:{chatId}" event "message:read"
    WITH { messageId, readerId: me.id, readAt: NOW }
END

FUNCTION pollMessages(request, chatId, sinceTimestamp):
  # --- Polling fallback when the socket is down ---
  # The client calls this on reconnect and then on an interval
  # (chosen default: every 15 seconds while the socket is down, and
  # stops polling once the socket reconnects).
  me = AUTH(request)
  membership = FIND ChatMember WHERE chatId = chatId AND userId = me.id
  IF membership does NOT exist:
    FAIL(403, "not a member of this chat")
  RETURN SELECT Message WHERE chatId = chatId
         AND createdAt > sinceTimestamp
         AND deletedForAll = false
         ORDER BY createdAt ASC
END
```

**Offline handling:**

- If the recipient's socket is down, the message is still saved (§4c)
  and therefore still delivered when they next load the chat or poll
  (§4e fallback). Nothing is lost because the socket was down.
- If the SENDER is offline, the client queues the message locally and
  retries `sendMessage` on reconnect; the server never invents a
  message the client did not send.
- Read receipts (`MessageRead`) are per message per reader; the chat
  list unread count in §3 is derived from `ChatMember.lastReadAt`, so
  the two stay consistent as long as `markRead` advances the watermark.

---

## 5. SAZMU AI reply pipeline

**Identity rule (applies to every step below):** SAZMU AI is ALWAYS
labelled "AI — not a human" in the UI, in its contact entry, and in
every introduction it gives. It is a system contact, not a `User` row.
Its per-user settings live in `CompanionSetting` (`role`,
`callName`, `petName`, `tone`, `language`); its per-user consented
facts live in `UserMemory` (`key`, `value`). No other user's data is
ever read for a reply.

**Pipeline order is fixed: SAFETY FIRST, then language, then intent,
then memory, then generation, then fallback. Safety checks can never be
skipped or reordered.**

```
FUNCTION sazmuReply(request, userText):
  me = AUTH(request)
  settings = FIND CompanionSetting WHERE userId = me.id
  IF settings does NOT exist:
    FAIL(400, "companion not set up yet")
    # Setup (role Boyfriend/Girlfriend, callName, optional petName)
    # must happen before chatting. Boyfriend default callName: Sazzad.
    # Girlfriend callName: one of Sadia, Maria, Tithi, Borsha, Anika,
    # Tajmira, Mim, Mimi, Mumu, Ayra, Jannati, Mushfika, or a custom
    # name the user chose. No girlfriend default is invented.

  # --- 5a. SAFETY FIRST (before any language/intent work) ---
  IF userText signals distress, self-harm, or a crisis:
    RETURN caringNonMedicalReply(settings)
    # Caring, supportive, non-medical: acknowledge feelings, encourage
    # talking to a trusted real person or a local professional helpline,
    # never diagnose, never give medical advice, never claim to be human.
  IF userText is sexual or asks for sexual/romantic-physical content:
    RETURN nonSexualRedirect(settings)
    # Warmly decline the sexual direction and redirect to non-sexual
    # conversation (feelings, daily life, encouragement, poetry).
    # No erotic content is ever produced.
  IF userText sets a boundary ("stop", "don't say that", "leave me alone"):
    RETURN boundaryRespectReply(settings)
    # Acknowledge the boundary, stop that topic immediately, do not
    # argue, do not repeat the unwanted content, offer a neutral topic.

  # --- 5b. Language detection: Bengali / Banglish / English ---
  # Bengali = Bengali script characters present.
  # Banglish = Latin script + Bengali words/grammar (romanized Bengali).
  # English = Latin script, English words.
  # The reply language follows settings.language (Bengali | Banglish |
  # English) when set, but detection of the INCOMING message decides
  # which intent vocabulary to match against first.
  language = DETECT(userText)  # "Bengali" | "Banglish" | "English"
  replyLanguage = settings.language   # user preference wins for output

  # --- 5c. Intent matching (template layer — what exists NOW) ---
  intent = MATCH_INTENT(userText, language)
  # Intents: greeting, how-are-you, evening plans, what-to-eat,
  # dreams, missing-you, comfort, celebration, planning, teasing,
  # romantic poetry, general question, unknown.
  # Matching is keyword/phrase-based over the three languages; it does
  # NOT call any external service.

  # --- 5d. UserMemory lookup (consented data ONLY) ---
  # Only this user's own UserMemory rows, keyed by intent
  # (e.g. favourite_food for what-to-eat, job for work questions).
  memories = SELECT UserMemory WHERE userId = me.id
             AND key IN RELEVANT_KEYS(intent)
  profile = { displayName: me.displayName }  # from User, public-to-self
  # NEVER: other users' memories, private chats, or scraped data.

  # --- 5e. Generation: LLM LATER, template fallback NOW ---
  IF LLM_BACKEND_IS_CONFIGURED:   # NOT configured yet: no provider or
                                  # key has been chosen or given.
    reply = LLM_GENERATE_VIA_BACKEND_PROXY(
      settings, intent, memories, profile, userText, replyLanguage)
    # Backend proxy ONLY: the API key lives server-side (secure vault),
    # is never embedded in frontend code, and the frontend never calls
    # the provider directly. The proxy also re-applies the §5a safety
    # rules to the generated text before returning it.
  ELSE:
    reply = TEMPLATE_REPLY(intent, settings, memories, replyLanguage)
    # Template replies are the current Phase 1 behaviour (from the demo
    # reply tables). They MUST be labelled as templates, not as
    # generative AI output, until the LLM backend exists.

  # --- 5f. Honest-unknown (never invent facts) ---
  IF intent = "general question" AND reply has no grounded answer:
    RETURN honestUnknownReply(settings, replyLanguage)
    # E.g. "I don't know that — I'm SAZMU AI, and I'd rather say so
    # than guess." No fabricated date, price, fact, or event.

  # --- 5g. AI label in every introduction ---
  IF this is the first message of the conversation OR the user asks
     "who are you / are you real":
    reply = AI_INTRODUCTION(settings) + reply
    # AI_INTRODUCTION always includes: "I am SAZMU AI, an AI chatbot —
    # not a human", plus the companion role and callName
    # (CompanionSetting.role, CompanionSetting.callName) and, when set,
    # addresses the user by CompanionSetting.petName.

  RETURN reply
END
```

**Memory write rule (how `UserMemory` grows, with consent):**

```
FUNCTION maybeRemember(me, userText, intent):
  # Only store a fact the user plainly stated about themself
  # (e.g. "my favourite food is biryani" -> key=favourite_food).
  # Never infer sensitive facts, never store another person's data,
  # never copy text from a private chat with another user.
  IF userText plainly states a storable preference/fact:
    UPSERT UserMemory { userId: me.id, key, value, updatedAt: NOW }
  # The user can delete their memories at any time; deletion removes
  # the UserMemory rows and they are never used again.
END
```

---

## 6. Media upload validation

**Chosen limits (stated as chosen defaults, not user decisions):**

| `MessageType` / `StatusUpdate` | Allowed MIME types | Max size | Extra rule |
|---|---|---|---|
| PHOTO | image/jpeg, image/png, image/webp, image/gif | 10 MB | — |
| VOICE | audio/mpeg, audio/ogg, audio/webm, audio/mp4 | 16 MB | Max duration 300 seconds (5 min) |
| VIDEO | video/mp4, video/webm | 100 MB | Max duration 600 seconds (10 min) |
| FILE | application/pdf, text/plain, application/zip | 25 MB | — |

**Validation order: type → size → server-side MIME check → duration.
A file that fails any step is rejected and never stored.**

```
FUNCTION uploadMedia(request, chatId, file, declaredType):
  sender = AUTH(request)
  membership = FIND ChatMember WHERE chatId = chatId AND userId = sender.id
  IF membership does NOT exist:
    FAIL(403, "not a member of this chat")

  # --- 6a. Declared type must match the allowed table above ---
  rule = LIMIT_TABLE[declaredType]
  IF rule does NOT exist:
    FAIL(400, "unsupported media type")

  # --- 6b. Size limit (checked before reading the whole file) ---
  IF file.size > rule.maxSize:
    FAIL(413, "file too large for this media type")

  # --- 6c. Server-side MIME check (never trust the extension or the
  # client-declared Content-Type alone) ---
  actualMime = SNIFF_MIME_FROM_BYTES(file.bytes)   # magic bytes
  IF actualMime NOT IN rule.allowedMimes:
    FAIL(400, "file content does not match an allowed type")

  # --- 6d. Duration check for VOICE / VIDEO ---
  durationSec = NULL
  IF declaredType IN (VOICE, VIDEO):
    durationSec = READ_MEDIA_DURATION(file.bytes)
    IF durationSec > rule.maxDurationSec:
      FAIL(400, "media is longer than the allowed duration")

  # --- 6e. Storage path naming (no user-supplied filenames) ---
  # User-supplied filenames are discarded: they can contain path
  # traversal or collisions. The server generates the name.
  extension = EXTENSION_FOR_MIME(actualMime)
  messageId = NEW_CUID()          # storage filename key ONLY — it is
                                  # NOT the §4 Message row id. §4's
                                  # Message id is generated separately
                                  # by its own cuid() default; the
                                  # client passes this upload's
                                  # mediaUrl (not this key) to sendMessage.
  storagePath = "uploads/{sender.id}/chats/{chatId}/{messageId}.{extension}"
  # Stored on server storage now, S3-compatible storage later (Phase 2).
  # NOT Supabase Storage.
  mediaUrl = STORE_FILE(storagePath, file.bytes)

  # --- 6f. Thumbnail note ---
  # For PHOTO and VIDEO, the server generates a small thumbnail
  # alongside the original (same directory, "{messageId}.thumb.jpg")
  # and the client shows the thumbnail in the chat list / grid, loading
  # the full file only on tap. If thumbnail generation fails, the
  # original is still served (no failure of the upload itself).
  IF declaredType IN (PHOTO, VIDEO):
    GENERATE_THUMBNAIL_BEST_EFFORT(storagePath)

  RETURN { mediaUrl, mediaMime: actualMime, durationSec, messageId }
END
```

**Status media** (`StatusUpdate.mediaUrl`) uses the same validation
table and path scheme, with `statuses/` in place of `chats/{chatId}/`
and the `StatusUpdate` id in place of `messageId`.

---

## 7. WebRTC call signalling with accepted-contact gate

**Gate rule (from the schema comment on `Contact`):** a call is allowed
only when the callee has ACCEPTED the caller as a contact — i.e. a
`Contact` row exists with `ownerId = calleeId`,
`contactUserId = callerId`, `accepted = true`, and `isBlocked = false`.
The plan leaves open whether calls from non-contacts are ever allowed;
until the user decides otherwise, the default is: **not allowed**.
Calls are in-app WebRTC only — no PSTN, no real number is ever dialled.

**Signalling transport:** Socket.io rooms `user:{userId}` for call
events; media itself is peer-to-peer WebRTC once signalling completes.
`CallLog` is written for EVERY attempt, including missed/declined, so
the Recent Calls list is complete.

```
FUNCTION startCall(request, calleeId, chatId, type):
  # type: CallType AUDIO | VIDEO
  caller = AUTH(request)

  # --- 7a. Accepted-contact gate (BEFORE any signalling) ---
  gate = FIND Contact WHERE ownerId = calleeId
         AND contactUserId = caller.id
  IF gate does NOT exist OR gate.accepted = false OR gate.isBlocked = true:
    FAIL(403, "calls are only allowed to accepted contacts")

  # --- 7b. Callee busy check ---
  IF callee ALREADY HAS an active call (tracked in the signalling
     server's in-memory active-call set, NOT in the database):
    log = CREATE CallLog { callerId: caller.id, calleeId, chatId,
            type, status: CANCELLED, startedAt: NOW }
    # (Busy is recorded as CANCELLED from the caller's side — this
    # busy → CANCELLED mapping is a chosen default; the callee
    # is not interrupted. See the status note below.)
    RETURN { status: "busy", callLogId: log.id }

  callId = NEW_CUID()
  # Timestamp method (consistent across §7): the active-call record
  # carries BOTH timestamps. ringingSince is set here at REGISTER;
  # startedAt starts NULL and is set only in onCallAccepted. Hence
  # onCallTimeout reads call.ringingSince and onCallEnded reads
  # call.startedAt (both defined by the time those paths run).
  REGISTER active call { callId, callerId: caller.id, calleeId, chatId,
    type, ringingSince: NOW, startedAt: NULL, callLogId: NULL }
  EMIT to room "user:{calleeId}" event "call:incoming"
    WITH { callId, callerId: caller.id, chatId, type }
  # The caller now waits for accept / decline / timeout (below).
  RETURN { callId, status: "ringing" }
END

FUNCTION onCallSignal(request, callId, signal):
  # signal: { kind: "offer" | "answer" | "ice", payload }
  user = AUTH(request)
  call = ACTIVE_CALL(callId)
  IF call does NOT exist OR user.id NOT IN (call.callerId, call.calleeId):
    FAIL(403, "not a party to this call")
  otherId = call.calleeId IF user.id = call.callerId ELSE call.callerId
  # The server RELAYS signalling only; it never sees media.
  EMIT to room "user:{otherId}" event "call:signal"
    WITH { callId, kind: signal.kind, payload: signal.payload }
END

FUNCTION onCallAccepted(request, callId):
  callee = AUTH(request)
  call = ACTIVE_CALL(callId)
  IF call does NOT exist OR callee.id != call.calleeId:
    FAIL(403, "only the callee can accept")
  log = CREATE CallLog { callerId: call.callerId, calleeId: callee.id,
          chatId: call.chatId, type: call.type,
          status: ACCEPTED, startedAt: NOW }
  call.callLogId = log.id
  call.startedAt = NOW
  EMIT to room "user:{call.callerId}" event "call:accepted" WITH { callId }
  # WebRTC offer/answer/ICE exchange (§7, onCallSignal) now proceeds.
END

FUNCTION onCallDeclined(request, callId):
  callee = AUTH(request)
  call = ACTIVE_CALL(callId)
  IF call does NOT exist OR callee.id != call.calleeId:
    FAIL(403, "only the callee can decline")
  CREATE CallLog { callerId: call.callerId, calleeId: callee.id,
    chatId: call.chatId, type: call.type,
    status: DECLINED, startedAt: NOW }
  REMOVE active call callId
  EMIT to room "user:{call.callerId}" event "call:declined" WITH { callId }
END

FUNCTION onCallCancelled(request, callId):
  # Explicit caller-cancel path (chosen method for FAIL 4b): the
  # CALLER hangs up before the callee answers. This is NOT handled by
  # onCallEnded, which requires an accepted call (see its guard below).
  caller = AUTH(request)
  call = ACTIVE_CALL(callId)
  IF call does NOT exist OR caller.id != call.callerId:
    FAIL(403, "only the caller can cancel an unanswered call")
  IF call.callLogId is NOT NULL:
    FAIL(400, "call already accepted — use onCallEnded, not cancel")
  CREATE CallLog { callerId: call.callerId, calleeId: call.calleeId,
    chatId: call.chatId, type: call.type,
    status: CANCELLED, startedAt: call.ringingSince }
  REMOVE active call callId
  EMIT to room "user:{call.calleeId}" event "call:cancelled" WITH { callId }
  EMIT to room "user:{call.callerId}" event "call:cancelled" WITH { callId }
END

FUNCTION onCallTimeout(callId):
  # No answer within the ringing window (chosen default: 30 seconds).
  call = ACTIVE_CALL(callId)
  IF call exists:
    CREATE CallLog { callerId: call.callerId, calleeId: call.calleeId,
      chatId: call.chatId, type: call.type,
      status: MISSED, startedAt: call.ringingSince }
    REMOVE active call callId
    EMIT to room "user:{call.callerId}" event "call:missed" WITH { callId }
    EMIT to room "user:{call.calleeId}" event "call:missed" WITH { callId }
END

FUNCTION onCallEnded(request, callId):
  user = AUTH(request)
  call = ACTIVE_CALL(callId)
  IF call does NOT exist OR user.id NOT IN (call.callerId, call.calleeId):
    FAIL(403, "not a party to this call")
  # Guard: onCallEnded runs ONLY for accepted calls. An unaccepted
  # call has callLogId = NULL and startedAt = NULL, so using them here
  # would be undefined — the caller must use onCallCancelled instead
  # (and the callee uses onCallDeclined).
  IF call.callLogId is NULL OR call.startedAt is NULL:
    FAIL(400, "call not accepted yet — caller uses onCallCancelled")
  endedAt = NOW
  durationSec = SECONDS_BETWEEN(call.startedAt, endedAt)
  UPDATE CallLog SET status = ENDED, endedAt = endedAt,
    durationSec = durationSec WHERE id = call.callLogId
  REMOVE active call callId
  EMIT to BOTH parties event "call:ended" WITH { callId, durationSec }
END
```

**Status mapping note:** `CallStatus` has MISSED, ACCEPTED, DECLINED,
ENDED, CANCELLED. A call that was ACCEPTED and then ends is updated to
ENDED (its final state); ACCEPTED is the transient "was answered"
state. A caller hanging up before an answer is CANCELLED via the
explicit onCallCancelled path (never via onCallEnded, which requires
an accepted call); a callee declining is DECLINED; no answer in
30 seconds is MISSED; a callee-busy attempt is CANCELLED (chosen
default, see §7b).

**TURN fallback note:** If direct peer-to-peer WebRTC fails (strict
NAT/firewall), the clients fall back to relaying media through a TURN
server. TURN is a media relay only — it does not change the gate, the
signalling flow, or the `CallLog` rules above, and it is never a PSTN
gateway: no real phone number is involved at any point.

---

## 8. Group admin controls

**Models:** `Chat` with `type = GROUP`, `title` = group name;
`ChatMember` with `role` = ADMIN | MEMBER. A DIRECT chat has no admin
controls — these rules apply to GROUP chats only.

```
FUNCTION createGroup(request, title, memberUserIds):
  creator = AUTH(request)
  title = TRIM(title)
  IF title is empty:
    FAIL(400, "group name is required")
  # The creator is always the first ADMIN; there is never a group with
  # zero admins at creation.
  chat = CREATE Chat { type: GROUP, title: title, createdById: creator.id }
  CREATE ChatMember { chatId: chat.id, userId: creator.id, role: ADMIN,
                      joinedAt: NOW }
  FOR EACH userId IN memberUserIds (deduplicated, creator excluded):
    IF user EXISTS:
      CREATE ChatMember { chatId: chat.id, userId, role: MEMBER,
                          joinedAt: NOW }
      EMIT to room "user:{userId}" event "group:added" WITH { chatId: chat.id }
  RETURN chat
END

FUNCTION addMember(request, chatId, newUserId):
  actor = AUTH(request)
  REQUIRE_GROUP_ADMIN(actor, chatId)     # helper below
  IF newUserId is already a ChatMember of chatId:
    FAIL(409, "already a member")
  CREATE ChatMember { chatId, userId: newUserId, role: MEMBER,
                      joinedAt: NOW }
  EMIT to room "chat:{chatId}" event "group:member-added"
    WITH { chatId, userId: newUserId }
END

FUNCTION removeMember(request, chatId, targetUserId):
  actor = AUTH(request)
  REQUIRE_GROUP_ADMIN(actor, chatId)
  target = FIND ChatMember WHERE chatId = chatId AND userId = targetUserId
  IF target does NOT exist:
    FAIL(404, "not a member")
  IF target.role = ADMIN AND COUNT_ADMINS(chatId) = 1:
    FAIL(400, "cannot remove the last admin")
  DELETE ChatMember WHERE chatId = chatId AND userId = targetUserId
  EMIT to room "chat:{chatId}" event "group:member-removed"
    WITH { chatId, userId: targetUserId }
END

FUNCTION promoteAdmin(request, chatId, targetUserId):
  actor = AUTH(request)
  REQUIRE_GROUP_ADMIN(actor, chatId)
  target = FIND ChatMember WHERE chatId = chatId AND userId = targetUserId
  IF target does NOT exist:
    FAIL(404, "not a member")
  UPDATE ChatMember SET role = ADMIN
    WHERE chatId = chatId AND userId = targetUserId
END

FUNCTION demoteAdmin(request, chatId, targetUserId):
  actor = AUTH(request)
  REQUIRE_GROUP_ADMIN(actor, chatId)
  target = FIND ChatMember WHERE chatId = chatId AND userId = targetUserId
  IF target does NOT exist OR target.role != ADMIN:
    FAIL(404, "not an admin")
  IF COUNT_ADMINS(chatId) = 1:
    FAIL(400, "cannot demote the last admin")
  UPDATE ChatMember SET role = MEMBER
    WHERE chatId = chatId AND userId = targetUserId
END

FUNCTION leaveGroup(request, chatId):
  me = AUTH(request)
  membership = FIND ChatMember WHERE chatId = chatId AND userId = me.id
  IF membership does NOT exist:
    FAIL(404, "not a member")
  IF membership.role = ADMIN AND COUNT_ADMINS(chatId) = 1:
    # Last-admin rule (chosen default): the last admin cannot simply
    # leave and orphan the group. They must first promote another
    # member to ADMIN, or delete the group (§8, deleteGroup).
    FAIL(400, "last admin must promote another admin or delete the group first")
  DELETE ChatMember WHERE chatId = chatId AND userId = me.id
  EMIT to room "chat:{chatId}" event "group:member-left"
    WITH { chatId, userId: me.id }
END

FUNCTION deleteGroup(request, chatId):
  actor = AUTH(request)
  REQUIRE_GROUP_ADMIN(actor, chatId)
  # Delete rules (chosen defaults):
  # - Any ADMIN may delete the group (not only Chat.createdById), so a
  #   group survives its creator leaving after promoting a successor.
  # - Deleting removes the Chat row; ChatMember and Message rows are
  #   removed by the schema's onDelete: Cascade.
  # - CallLog.chat has NO onDelete: SetNull in the schema (and the
  #   schema is NOT edited here), so deleting the Chat would NOT
  #   auto-null CallLog.chatId. The algorithm therefore nulls it
  #   explicitly, in the SAME TRANSACTION and BEFORE deleting the
  #   Chat (step below). Call history is thus preserved with a NULL
  #   chatId, not silently rewritten — the app must handle a NULL
  #   chatId on old CallLog rows.
  # - Deletion is permanent and is NOT offered for DIRECT chats.
  chat = FIND Chat WHERE id = chatId
  IF chat.type != GROUP:
    FAIL(400, "only groups can be deleted this way")
  IN ONE TRANSACTION:
    UPDATE CallLog SET chatId = NULL WHERE chatId = chatId
    DELETE Chat WHERE id = chatId
  EMIT to all former members event "group:deleted" WITH { chatId }
END

FUNCTION REQUIRE_GROUP_ADMIN(actor, chatId):
  membership = FIND ChatMember WHERE chatId = chatId AND userId = actor.id
  IF membership does NOT exist OR membership.role != ADMIN:
    FAIL(403, "group admin only")
END

FUNCTION COUNT_ADMINS(chatId):
  RETURN COUNT ChatMember WHERE chatId = chatId AND role = ADMIN
END
```

---

## 9. Status 24h expiry

**Rule (from the schema comment on `StatusUpdate`):**
`expiresAt = createdAt + 24 hours`. Expired statuses are filtered out
on every read. Expiry is enforced lazily — no background job is
required for correctness.

```
FUNCTION postStatus(request, text, mediaUrl):
  me = AUTH(request)
  IF text is empty AND mediaUrl is empty:
    FAIL(400, "status needs text or media")
  IF mediaUrl is given:
    VALIDATE per §6 (same type/size/MIME rules; StatusUpdate.mediaUrl
    uses the statuses/ path scheme from §6).
  createdAt = NOW
  status = CREATE StatusUpdate {
    userId: me.id, mediaUrl: mediaUrl, text: text,
    expiresAt: createdAt + 24 hours, createdAt: createdAt
  }
  RETURN status
END

FUNCTION CONTACT_USER_IDS(me):
  # Explicit definition of the helper used by getVisibleStatuses.
  # Returns the caller's own ID PLUS every user linked to the caller
  # by an accepted, not-blocked Contact row in either direction.
  # The caller's own ID IS included, so the caller's own statuses are
  # visible to the caller. A user who blocked the caller (their Contact
  # row has isBlocked = true) and a user the caller blocked are both
  # excluded, because only rows with isBlocked = false are collected.
  acceptedAsOwner   = SELECT contactUserId FROM Contact
                      WHERE ownerId = me AND accepted = true
                      AND isBlocked = false
  acceptedAsContact = SELECT ownerId FROM Contact
                      WHERE contactUserId = me AND accepted = true
                      AND isBlocked = false
  RETURN { me } UNION acceptedAsOwner UNION acceptedAsContact
END

FUNCTION getVisibleStatuses(request):
  me = AUTH(request)
  # Visible = my contacts' (and my own) statuses that have NOT expired.
  # "Contacts" here means users with an accepted Contact row in either
  # direction; blocked users' statuses are never shown.
  visibleUserIds = CONTACT_USER_IDS(me)   # own ID included; accepted,
                                          # not blocked, either way
  statuses = SELECT StatusUpdate WHERE userId IN visibleUserIds
             AND expiresAt > NOW          # <-- the expiry filter
             ORDER BY createdAt DESC
  RETURN statuses
END

FUNCTION viewStatus(request, statusId):
  me = AUTH(request)
  status = FIND StatusUpdate WHERE id = statusId
  IF status does NOT exist OR status.expiresAt <= NOW:
    FAIL(404, "status not found or expired")
    # An expired status is indistinguishable from a missing one: the
    # client never learns whether an expired id ever existed.
  IF status.userId != me.id:
    # Viewing is recorded; StatusView has @@unique([statusId, viewerId])
    # so re-viewing does not duplicate the row.
    UPSERT StatusView { statusId, viewerId: me.id, viewedAt: NOW }
  RETURN status
END
```

**Lazy expiry note:** Correctness comes from the `expiresAt > NOW`
filter on every read, not from deleting rows on time. An optional
periodic cleanup job may delete rows with `expiresAt <= NOW` (and
their `StatusView` rows, which cascade via `onDelete: Cascade`) to
save space, but it is an optimization, not a correctness requirement —
a status whose row still exists past 24h is still invisible because
every read filters it out. Cleanup must never delete a status early
and must never touch a status that has not expired.

---

## Cross-checks against the schema (verification notes)

- §1 uses `User.username`, `User.displayName`, `User.communicaId`,
  `User.passwordHash`, `User.lastSeenAt` — all exist. No other `User`
  field is written at registration.
- §2 returns only `User.username`, `User.displayName`,
  `User.communicaId`, `User.avatarUrl`, `User.bio`; it filters with
  `Contact.ownerId`, `Contact.contactUserId`, `Contact.isBlocked`.
- §3 uses `ChatMember.archived`, `ChatMember.lastReadAt`,
  `ChatMember.muted` (noted, not ranked on), `Chat.type`,
  `Chat.createdAt`, `Message.createdAt`, `Message.deletedForAll`,
  `Message.senderId`, `Contact.isFavorite` — all exist. No pinned
  field is invented; the favorite rule and its DIRECT-only limit are
  stated explicitly.
- §4 uses `ChatMember`, `Message` (including `replyToId`,
  `mediaMime`, `durationSec`, `deletedForAll`), `MessageRead`
  (`messageId`, `userId`, `readAt`), `Chat.updatedAt` — all exist.
- §5 uses `CompanionSetting` (`role`, `callName`, `petName`, `tone`,
  `language`) and `UserMemory` (`userId`, `key`, `value`, `updatedAt`)
  — all exist. SAZMU AI is never a `User` row.
- §6 writes `Message.mediaUrl`, `Message.mediaMime`,
  `Message.durationSec` and `StatusUpdate.mediaUrl` — all exist.
- §7 writes `CallLog` (`chatId`, `callerId`, `calleeId`, `type`,
  `status`, `startedAt`, `endedAt`, `durationSec`) with `CallType`
  AUDIO/VIDEO and `CallStatus` MISSED/ACCEPTED/DECLINED/ENDED/
  CANCELLED — all exist. The gate uses `Contact.accepted` and
  `Contact.isBlocked`.
- §8 uses `Chat.type`, `Chat.title`, `Chat.createdById`,
  `ChatMember.role` (ADMIN/MEMBER), `ChatMember.joinedAt` — all exist.
- §9 uses `StatusUpdate.expiresAt`, `StatusUpdate.createdAt`,
  `StatusUpdate.mediaUrl`, `StatusUpdate.text`, `StatusView`
  (`statusId`, `viewerId`, `viewedAt`) — all exist.
- Forbidden terms check: no Supabase, no PSTN, no real phone numbers
  anywhere in this file; SAZMU AI is labelled AI throughout.
