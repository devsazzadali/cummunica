# Communica — Flowcharts (Step 4)

**Scope:** Mermaid flowcharts only — no UI, no backend code, no schema change,
no change to the plan, language, or algorithms files.

**Source of truth:** `ALGORITHMS.md` (Step 3, QA-passed, PM-approved).
Every decision, field, error code, and timestamp below comes from that file.
Nothing here invents a new gate, field, or rule.

**Fixed decisions carried over:**

- App: Communica, tagline Social Communication.
- Backend: Prisma plus Neon DB ONLY. NOT Supabase. Auth: JWT plus bcrypt.
  Realtime: WebSocket with Socket.io, plus polling fallback.
- Registration FIRST, then use. No real phone number: random 8-digit
  in-app Communica ID plus unique username.
- Calls: in-app WebRTC ONLY. Never a real phone number, never a PSTN call.
- SAZMU AI: one AI chatbot contact inside Communica, ALWAYS labelled
  AI, not a human. It is NOT a row in User. Boyfriend default call name:
  Sazzad. Girlfriend preset names: Sadia, Maria, Tithi, Borsha, Anika,
  Tajmira, Mim, Mimi, Mumu, Ayra, Jannati, Mushfika, plus a custom name.
  No girlfriend default is invented.
- Local work only: no publishing, no credentials, no live database push.

**Mermaid conventions used below:**

- `flowchart TD` in every diagram.
- Diamond nodes are decisions. Rectangular nodes are actions or results.
- FAIL nodes stop the flow and return the error shown, exactly as in
  `ALGORITHMS.md`. Later steps are not run after a FAIL.
- NOW means current server time in UTC, server as source of truth.
- AUTH means verify the JWT; missing, expired, or invalid token gives
  FAIL 401 unauthenticated.

---

## 1. Overall app flow

Register or Login first, then Chat List, then Chat, Calls, Status,
Communities, and Settings. Chat list ranking, group admin controls,
Status 24h expiry, and media validation appear here as branches; their
full step-by-step logic lives in the matching sections below and in
`ALGORITHMS.md` sections 3, 6, 8, and 9.

```mermaid
flowchart TD
    Start["Open Communica"] --> RegisteredQ{"Already registered"}
    RegisteredQ -->|No| Register["Go to Registration flow in section 2"]
    RegisteredQ -->|Yes| Login["Login with username and password"]
    Login --> LoginOkQ{"Username found and bcrypt password matches"}
    LoginOkQ -->|No| LoginFail["FAIL 401 invalid username or password"]
    LoginOkQ -->|Yes| UpdateSeen["Update User lastSeenAt to NOW and issue JWT for 7 days"]
    Register --> ChatList["Open Chat List"]
    UpdateSeen --> ChatList
    ChatList --> RankNote["Rank chats: DIRECT favorites first, then recency by last message or Chat createdAt"]
    RankNote --> ArchivedNote["Archived chats are NOT in main list, they are a separate archived list"]
    ArchivedNote --> FilterQ{"Choose Chats filter"}
    FilterQ -->|All| ShowAll["Show all non-archived chats"]
    FilterQ -->|Unread| ShowUnread["Show only chats with unread greater than 0"]
    FilterQ -->|Favorites| ShowFav["Show only DIRECT favorite chats"]
    FilterQ -->|Groups| ShowGroups["Show only GROUP chats"]
    ShowAll --> TabQ{"Choose tab or action"}
    ShowUnread --> TabQ
    ShowFav --> TabQ
    ShowGroups --> TabQ
    TabQ -->|Chat| ChatOpen["Open a chat and use Send Message flow in section 3"]
    TabQ -->|Calls| CallsTab["Open Calls tab and Recent Calls from CallLog"]
    TabQ -->|Status| StatusTab["Open Updates tab: post or view Status, 24h expiry filter applies"]
    TabQ -->|Communities| CommTab["Open Communities tab: browse or join a community and its groups"]
    TabQ -->|Search| SearchFlow["Use Search User flow in section 5"]
    TabQ -->|Settings| SettingsTab["Open Settings: profile, companion setup, memories"]
    CallsTab --> CallFlow["Use Audio Video Call flow in section 6"]
    StatusTab --> StatusExpiry["Visible statuses only where expiresAt is greater than NOW, createdAt plus 24 hours"]
    CommTab --> GroupAdmin["Group admin controls: add, remove, promote, demote, leave, delete group"]
    GroupAdmin --> DeleteGroupNote["Delete group: null CallLog chatId first in same transaction, then delete Chat"]
    SettingsTab --> SazmuEntry["SAZMU AI contact entry, always labelled AI, not a human"]
    SazmuEntry --> SazmuFlow["Use SAZMU AI Reply flow in section 4"]
    ChatOpen --> MediaNote["Media messages validated first: type, size, server MIME sniff, duration, then stored"]
```

Algorithm trace: plan tabs Chats, Updates, Communities, Calls; chat list
filters All, Unread, Favorites, Groups plus Archived; ranking favorites
first for DIRECT only then recency; Status expiry `createdAt + 24 hours`
with `expiresAt > NOW` filter on every read; group delete nulls
`CallLog.chatId` before deleting `Chat`, in one transaction.

---

## 2. Registration

Covers `ALGORITHMS.md` section 1, registration only. Login primitives are
shown in the overall flow above; login itself reuses the same
normalization, bcrypt verify, `lastSeenAt` update, and JWT issuance.

```mermaid
flowchart TD
    RStart["Start registration with username, displayName, password"] --> RNorm["Normalize username: trim and lowercase"]
    RNorm --> RLenQ{"Username length 3 to 20"}
    RLenQ -->|No| RLenFail["FAIL 400 username must be 3 to 20 characters"]
    RLenQ -->|Yes| RCharQ{"Username matches letters numbers underscore only"}
    RCharQ -->|No| RCharFail["FAIL 400 username may contain only letters numbers underscore"]
    RCharQ -->|Yes| RDisp["Trim displayName"]
    RDisp --> RDispQ{"DisplayName empty"}
    RDispQ -->|Yes| RDispFail["FAIL 400 display name is required"]
    RDispQ -->|No| RPwQ{"Password length at least 8"}
    RPwQ -->|No| RPwFail["FAIL 400 password must be at least 8 characters"]
    RPwQ -->|Yes| RUniq["Find User where username equals normalized username"]
    RUniq --> RUniqQ{"Existing user found"}
    RUniqQ -->|Yes| RUniqFail["FAIL 409 username already taken"]
    RUniqQ -->|No| RAttempts["Set attempts to 0"]
    RAttempts --> RLoop["Increment attempts and generate random integer 10000000 to 99999999 as string"]
    RLoop --> RFirstNote["First digit is 1 to 9, so ID is always exactly 8 digits, no leading zero"]
    RFirstNote --> RColl["Find User where communicaId equals generated ID"]
    RColl --> RCollQ{"Collision found"}
    RCollQ -->|No| RHash["Hash password with bcrypt cost 12, discard plaintext"]
    RCollQ -->|Yes| RAttQ{"Attempts at least 10"}
    RAttQ -->|Yes| RAttFail["FAIL 500 could not allocate a Communica ID, try again"]
    RAttQ -->|No| RLoop
    RHash --> RCreate["Create User in one transaction: username, displayName, communicaId, passwordHash, lastSeenAt NOW"]
    RCreate --> RNullNote["AvatarUrl and bio start empty NULL, no other table row is created at registration"]
    RNullNote --> RJwt["Sign JWT server-side only: userId and username, expires in 7 days, secret from secure vault"]
    RJwt --> RReturn["Return user WITHOUT passwordHash, plus communicaId and token, and show communicaId to user"]
```

Algorithm trace: normalization, length, character set, display name,
password minimum 8, username uniqueness 409, collision retry loop with
10-attempt cap and 500, first digit 1 to 9, bcrypt cost 12, one-transaction
create, `lastSeenAt NOW`, JWT 7 days, no `passwordHash` in the return.

---

## 3. Send Message

Covers `ALGORITHMS.md` section 4 in full: send, read receipt, and
polling fallback. Media validation from section 6 is the step that
supplies `mediaUrl`, `mediaMime`, and `durationSec` to a media message.

```mermaid
flowchart TD
    SStart["Start send, read, or poll"] --> SChoice{"Choose operation"}
    SChoice -->|Send message| SAuth["AUTH request and get sender User id"]
    SChoice -->|Mark read| MAuth["AUTH request and get reader User id"]
    SChoice -->|Poll messages| PAuth["AUTH request and get reader User id"]
    SAuth --> SMem["Find ChatMember where chatId and sender id match"]
    SMem --> SMemQ{"Membership exists"}
    SMemQ -->|No| SMemFail["FAIL 403 not a member of this chat"]
    SMemQ -->|Yes| STypeQ{"Message type and payload valid"}
    STypeQ -->|Text empty after trim| STextFail["FAIL 400 text message must not be empty"]
    STypeQ -->|Media without mediaUrl| SMediaFail["FAIL 400 media message requires an uploaded file"]
    STypeQ -->|Reply target missing or deleted for all| SReplyFail["FAIL 400 replied-to message not found in this chat"]
    STypeQ -->|Valid| SSave["Create Message: chatId, senderId, type, text, mediaUrl, mediaMime, durationSec, replyToId, deletedForAll false, createdAt NOW"]
    SSave --> SChatUpd["Update Chat updatedAt to NOW"]
    SChatUpd --> SReadUpd["Update sender ChatMember lastReadAt to NOW"]
    SReadUpd --> SEmit["Emit to room chat chatId event message new with message"]
    SEmit --> SReturn["Return message HTTP 201, client treats 201 as sent and delivered to server"]
    SReturn --> SOfflineNote["If recipient socket is down, message is still saved and delivered on next load or poll, nothing is lost"]
    MAuth --> MMem["Find ChatMember where chatId and reader id match"]
    MMem --> MMemQ{"Membership exists"}
    MMemQ -->|No| MMemFail["FAIL 403 not a member of this chat"]
    MMemQ -->|Yes| MMsg["Find Message where id and chatId match"]
    MMsg --> MMsgQ{"Message exists and sender is not the reader"}
    MMsgQ -->|No| MMsgFail["FAIL 400 cannot mark own or missing message as read"]
    MMsgQ -->|Yes| MUpsert["Upsert MessageRead with messageId, userId, readAt NOW, idempotent on messageId plus userId"]
    MUpsert --> MWater["Advance ChatMember lastReadAt to message createdAt only if NULL or message createdAt is later, never backwards"]
    MWater --> MEmit["Emit to room chat chatId event message read with messageId, readerId, readAt NOW"]
    PAuth --> PMem["Find ChatMember where chatId and reader id match"]
    PMem --> PMemQ{"Membership exists"}
    PMemQ -->|No| PMemFail["FAIL 403 not a member of this chat"]
    PMemQ -->|Yes| PReturn["Return Messages where chatId matches, createdAt greater than sinceTimestamp, deletedForAll false, ordered by createdAt ascending"]
    PReturn --> PPollNote["Client polls on reconnect then every 15 seconds while socket is down, stops once socket reconnects"]
```

Algorithm trace: AUTH, membership 403, TEXT empty 400, media without
upload 400, reply target check 400, Message create fields, `Chat.updatedAt`,
sender `lastReadAt`, room emit `message:new`, HTTP 201 delivered-to-server
meaning, offline save-then-poll, `markRead` own-or-missing 400, MessageRead
upsert, watermark never backwards, emit `message:read`, poll membership
403, `createdAt > sinceTimestamp`, `deletedForAll false`, ascending order,
15-second polling interval.

---

## 4. SAZMU AI Reply

Covers `ALGORITHMS.md` section 5 in full. Safety order is fixed and
cannot be skipped or reordered: distress first, then sexual content,
then boundary. SAZMU AI is labelled AI in every step, never a real human.

```mermaid
flowchart TD
    AStart["Start SAZMU AI reply with user text"] --> AAuth["AUTH request and get user id"]
    AAuth --> ASet["Find CompanionSetting where userId matches"]
    ASet --> ASetQ{"CompanionSetting exists"}
    ASetQ -->|No| ASetFail["FAIL 400 companion not set up yet"]
    ASetQ -->|Yes| ASetupNote["Setup first: role Boyfriend or Girlfriend, callName, optional petName"]
    ASetupNote --> ABoyNote["Boyfriend default callName is Sazzad"]
    ABoyNote --> AGirlNote["Girlfriend callName is a preset or custom name, no girlfriend default is invented"]
    AGirlNote --> ADistressQ{"User text signals distress, self-harm, or crisis"}
    ADistressQ -->|Yes| ADistress["Return caring non-medical reply: acknowledge feelings, encourage a trusted real person or local professional helpline, never diagnose, never give medical advice, never claim to be human"]
    ADistressQ -->|No| ASexualQ{"User text is sexual or asks for sexual or romantic-physical content"}
    ASexualQ -->|Yes| ASexual["Return warm non-sexual redirect to feelings, daily life, encouragement, poetry, no erotic content ever"]
    ASexualQ -->|No| ABoundQ{"User text sets a boundary, for example stop, do not say that, leave me alone"}
    ABoundQ -->|Yes| ABound["Return boundary respect reply: acknowledge boundary, stop that topic at once, do not argue, do not repeat unwanted content, offer a neutral topic"]
    ABoundQ -->|No| ALang["Detect incoming language: Bengali script, Banglish Latin script plus Bengali words, or English"]
    ALang --> ALangOut["Reply language follows CompanionSetting language when set, detection decides which intent vocabulary to match first"]
    ALangOut --> AIntent["Match intent by keywords in detected language: greeting, how-are-you, evening plans, what-to-eat, dreams, missing-you, comfort, celebration, planning, teasing, romantic poetry, general question, unknown"]
    AIntent --> AMem["Select this user only UserMemory rows for keys relevant to intent, plus displayName from User"]
    AMem --> AMemNote["NEVER other users memories, private chats, or scraped data"]
    AMemNote --> ALLMQ{"LLM backend is configured"}
    ALLMQ -->|Yes| ALLM["Generate via backend proxy only: key server-side in secure vault, never in frontend, frontend never calls provider directly"]
    ALLM --> ALLMSafe["Proxy re-applies safety rules from distress, sexual, boundary steps to generated text"]
    ALLMQ -->|No| ATemplate["Use template reply for intent, settings, memories, reply language"]
    ATemplate --> ATemplateNote["Template replies MUST be labelled as templates, not as generative AI output, until LLM backend exists"]
    ALLMSafe --> AUnknownQ{"Intent is general question and reply has no grounded answer"}
    ATemplateNote --> AUnknownQ
    AUnknownQ -->|Yes| AUnknown["Return honest unknown reply in reply language, for example I do not know that, I am SAZMU AI, and I would rather say so than guess, never invent a fact"]
    AUnknownQ -->|No| AIntroQ{"First message of conversation OR user asks who are you or are you real"}
    AUnknown --> AIntroQ
    AIntroQ -->|Yes| AIntro["Prefix AI introduction: I am SAZMU AI, an AI chatbot, not a human, plus role and callName, and petName when set"]
    AIntroQ -->|No| AReturn["Return reply, always with SAZMU AI labelled AI, not a human"]
    AIntro --> AReturn
    AReturn --> AMaybe["Optional memory write: only if user plainly stated a storable fact about themself"]
    AMaybe --> AMaybeNote["Upsert UserMemory with userId, key, value, updatedAt NOW, never infer sensitive facts, never store another persons data, user can delete memories at any time"]
```

Algorithm trace: setup FAIL 400, Boyfriend default Sazzad, girlfriend
presets plus custom with no invented default, safety order
distress, sexual, boundary, language detection Bengali, Banglish, English,
settings language wins for output, intent list, own `UserMemory` only,
LLM-later backend-proxy branch with server-side key and re-applied safety,
template fallback labelled as templates, honest-unknown for ungrounded
general questions, AI introduction on first message or identity question,
`maybeRemember` upsert rule.

---

## 5. Search User

Covers `ALGORITHMS.md` section 2 in full. Communica ID search is
EXACT-ONLY. No partial ID search exists in any branch.

```mermaid
flowchart TD
    SearchStart["Start search with raw query"] --> SearchAuth["AUTH request and get searcher id"]
    SearchAuth --> SearchTrim["Trim query"]
    SearchTrim --> SearchEmptyQ{"Query empty"}
    SearchEmptyQ -->|Yes| SearchEmpty["Return empty list, no empty-query dump"]
    SearchEmptyQ -->|No| SearchBlocked["Build excluded set: users blocked by me, users who blocked me, plus me"]
    SearchBlocked --> SearchIdQ{"Query matches exactly 8 digits"}
    SearchIdQ -->|Yes| SearchIdHit["Find User where communicaId equals query"]
    SearchIdHit --> SearchIdOkQ{"Hit exists and hit id NOT in excluded set"}
    SearchIdOkQ -->|Yes| SearchIdReturn["Return single public profile for exact ID hit"]
    SearchIdOkQ -->|No| SearchIdEmpty["Return empty list, do NOT fall through to username matching on digits"]
    SearchIdQ -->|No| SearchNorm["Normalize query to lowercase"]
    SearchNorm --> SearchExact["Find User where username equals normalized query and id NOT in excluded set"]
    SearchExact --> SearchExactQ{"Exact username hit exists"}
    SearchExactQ -->|Yes| SearchExactReturn["Return single public profile for exact username hit"]
    SearchExactQ -->|No| SearchPrefix["Select Users where username starts with normalized query and id NOT in excluded set, ordered by username ascending, limit 20"]
    SearchPrefix --> SearchPrefixReturn["Return public profiles for prefix matches"]
    SearchIdReturn --> PublicFields["Public fields only: username, displayName, communicaId, avatarUrl, bio"]
    SearchExactReturn --> PublicFields
    SearchPrefixReturn --> PublicFields
    PublicFields --> NeverFields["NEVER return passwordHash, User id, lastSeenAt, createdAt, updatedAt, or any other users private data"]
    NeverFields --> SazmuNote["SAZMU AI appears in search as a labelled AI contact, appended by client from a constant, never returned from this database query"]
```

Algorithm trace: AUTH, empty query returns empty, blocked exclusion in
both directions plus self, exact 8-digit match tried FIRST, 8-digit
no-fallthrough rule, username exact before prefix, prefix limit 20
ascending, public fields only, excluded private fields, SAZMU AI as
client constant not a `User` row.

---

## 6. Audio and Video Call

Covers `ALGORITHMS.md` section 7 in full, including timestamps,
caller-cancel, and the TURN fallback note. Media is peer-to-peer WebRTC
once signalling completes; the server relays signalling only and never
sees media.

```mermaid
flowchart TD
    CallStart["Start call with calleeId, chatId, type AUDIO or VIDEO"] --> CallAuth["AUTH request and get caller id"]
    CallAuth --> CallGate["Find Contact where ownerId equals calleeId and contactUserId equals caller id"]
    CallGate --> CallGateQ{"Gate row exists and accepted is true and isBlocked is false"}
    CallGateQ -->|No| CallGateFail["FAIL 403 calls are only allowed to accepted contacts"]
    CallGateQ -->|Yes| CallBusyQ{"Callee already has an active call in signalling server in-memory active-call set, NOT in database"}
    CallBusyQ -->|Yes| CallBusyLog["Create CallLog: callerId, calleeId, chatId, type, status CANCELLED, startedAt NOW"]
    CallBusyLog --> CallBusyReturn["Return status busy and callLogId, callee is not interrupted"]
    CallBusyQ -->|No| CallRegister["Register active call: callId, callerId, calleeId, chatId, type, ringingSince NOW, startedAt NULL, callLogId NULL"]
    CallRegister --> CallIncoming["Emit to room user calleeId event call incoming with callId, callerId, chatId, type"]
    CallIncoming --> CallWait["Caller waits for accept, decline, cancel, or timeout, return status ringing"]
    CallWait --> CallOutcome{"What happens next"}
    CallOutcome -->|Callee accepts| CallAcceptAuth["AUTH callee, check active call exists and callee id matches, else FAIL 403 only the callee can accept"]
    CallOutcome -->|Callee declines| CallDeclineAuth["AUTH callee, check active call exists and callee id matches, else FAIL 403 only the callee can decline"]
    CallOutcome -->|Caller cancels before answer| CallCancelAuth["AUTH caller, check active call exists and caller id matches, else FAIL 403 only the caller can cancel an unanswered call"]
    CallOutcome -->|No answer in 30 seconds| CallTimeout["Timeout path: if active call still exists, create CallLog status MISSED with startedAt equal to ringingSince"]
    CallOutcome -->|Signalling| CallSignalAuth["AUTH user, check active call exists and user is caller or callee, else FAIL 403 not a party to this call"]
    CallAcceptAuth --> CallAcceptLog["Create CallLog: status ACCEPTED, startedAt NOW, set active call callLogId and startedAt to NOW"]
    CallAcceptLog --> CallAcceptEmit["Emit to room user callerId event call accepted with callId"]
    CallAcceptEmit --> CallSignalFlow["WebRTC offer, answer, ICE exchange proceeds through relay below"]
    CallDeclineAuth --> CallDeclineLog["Create CallLog: status DECLINED, startedAt NOW, remove active call"]
    CallDeclineLog --> CallDeclineEmit["Emit to room user callerId event call declined with callId"]
    CallCancelAuth --> CallCancelQ{"Active call callLogId is NOT NULL, meaning already accepted"}
    CallCancelQ -->|Yes| CallCancelFail["FAIL 400 call already accepted, use call ended, not cancel"]
    CallCancelQ -->|No| CallCancelLog["Create CallLog: status CANCELLED, startedAt equal to ringingSince, remove active call"]
    CallCancelLog --> CallCancelEmit["Emit to both rooms user calleeId and user callerId event call cancelled with callId"]
    CallTimeout --> CallTimeoutEmit["Remove active call, emit to both caller and callee event call missed with callId"]
    CallSignalAuth --> CallSignalRelay["Relay signal only to other party room user otherId event call signal with callId, kind offer or answer or ice, and payload, server never sees media"]
    CallSignalRelay --> CallSignalFlow
    CallSignalFlow --> CallEndQ{"Call ends after acceptance"}
    CallEndQ -->|Yes| CallEndAuth["AUTH user, check active call exists and user is caller or callee, else FAIL 403 not a party to this call"]
    CallEndAuth --> CallEndGuardQ{"Active call callLogId NULL or startedAt NULL, meaning not accepted yet"}
    CallEndGuardQ -->|Yes| CallEndFail["FAIL 400 call not accepted yet, caller uses cancel, callee uses decline"]
    CallEndGuardQ -->|No| CallEndCalc["Set endedAt NOW, durationSec equals seconds between startedAt and endedAt"]
    CallEndCalc --> CallEndUpdate["Update CallLog to status ENDED, endedAt, durationSec, remove active call"]
    CallEndUpdate --> CallEndEmit["Emit to both parties event call ended with callId and durationSec"]
    CallEndEmit --> TurnNote["TURN fallback: if direct peer-to-peer WebRTC fails on strict NAT or firewall, relay media through TURN server"]
    TurnNote --> TurnNote2["TURN is a media relay only, it does not change gate, signalling, or CallLog rules, and it is never a PSTN gateway"]
    CallTimeoutEmit --> CallLogNote["CallLog is written for EVERY attempt, including missed and declined, so Recent Calls list is complete"]
    CallDeclineEmit --> CallLogNote
    CallCancelEmit --> CallLogNote
    CallBusyReturn --> CallLogNote
```

Algorithm trace: accepted-contact gate before any signalling, busy as
CANCELLED with `startedAt NOW`, register with `ringingSince NOW` and
`startedAt NULL`, incoming emit, signal relay for offer, answer, ICE
with party check, accept creates ACCEPTED log and sets `startedAt NOW`,
decline creates DECLINED log, caller-cancel creates CANCELLED log with
`startedAt = ringingSince` and is rejected once accepted, 30-second
timeout creates MISSED log with `startedAt = ringingSince`, end guard
rejects unaccepted calls, end computes duration from `startedAt` to
`endedAt` and updates to ENDED, TURN fallback as media relay only.

---

## 7. Supporting flows: Media upload, Group admin, Status 24h

These three algorithms feed the flows above. They are diagrammed here so
no step from `ALGORITHMS.md` sections 6, 8, or 9 is left as a branch-only
note. They add no new rule beyond those sections.

```mermaid
flowchart TD
    SupStart["Start media upload, group action, or status action"] --> SupChoice{"Choose operation"}
    SupChoice -->|Upload media| MAuth2["AUTH request, find ChatMember, else FAIL 403 not a member of this chat"]
    SupChoice -->|Group action| GAuth["AUTH request, group actions below require group admin except create and leave"]
    SupChoice -->|Status action| StAuth["AUTH request and get user id"]
    MAuth2 --> MTypeQ{"Declared type exists in limit table"}
    MTypeQ -->|No| MTypeFail["FAIL 400 unsupported media type"]
    MTypeQ -->|Yes| MSizeQ{"File size over limit for type"}
    MSizeQ -->|Yes| MSizeFail["FAIL 413 file too large for this media type"]
    MSizeQ -->|No| MMime["Sniff MIME from bytes, never trust extension or client Content-Type alone"]
    MMime --> MMimeQ{"Sniffed MIME in allowed list for type"}
    MMimeQ -->|No| MMimeFail["FAIL 400 file content does not match an allowed type"]
    MMimeQ -->|Yes| MDurQ{"Type is VOICE or VIDEO and duration over limit"}
    MDurQ -->|Yes| MDurFail["FAIL 400 media is longer than the allowed duration"]
    MDurQ -->|No| MStore["Server generates storage path, discards user filename, stores file on server storage, S3 later"]
    MStore --> MThumb["For PHOTO and VIDEO, generate thumbnail best effort, failure does not fail upload"]
    MThumb --> MReturn["Return mediaUrl, mediaMime, durationSec, and upload key for sendMessage"]
    GAuth --> GChoice{"Choose group operation"}
    GChoice -->|Create group| GCreateQ{"Title trimmed and not empty"}
    GCreateQ -->|No| GCreateFail["FAIL 400 group name is required"]
    GCreateQ -->|Yes| GCreate["Create GROUP Chat, creator as first ADMIN, other existing members as MEMBER, emit group added to each"]
    GChoice -->|Add member| GAddAdmin["Require group admin, else FAIL 403 group admin only"]
    GAddAdmin --> GAddQ{"Already a member"}
    GAddQ -->|Yes| GAddFail["FAIL 409 already a member"]
    GAddQ -->|No| GAdd["Create ChatMember MEMBER, emit group member-added"]
    GChoice -->|Remove member| GRemAdmin["Require group admin, else FAIL 403 group admin only"]
    GRemAdmin --> GRemQ{"Target not a member"}
    GRemQ -->|Yes| GRemFail["FAIL 404 not a member"]
    GRemQ -->|No| GRemLastQ{"Target is ADMIN and admin count is 1"}
    GRemLastQ -->|Yes| GRemLastFail["FAIL 400 cannot remove the last admin"]
    GRemLastQ -->|No| GRem["Delete ChatMember, emit group member-removed"]
    GChoice -->|Promote or demote| GProAdmin["Require group admin, else FAIL 403 group admin only"]
    GProAdmin --> GProQ{"Target not a member, or for demote not an admin"}
    GProQ -->|Yes| GProFail["FAIL 404 not a member or not an admin"]
    GProQ -->|No| GProLastQ{"Demote and admin count is 1"}
    GProLastQ -->|Yes| GProLastFail["FAIL 400 cannot demote the last admin"]
    GProLastQ -->|No| GPro["Update ChatMember role to ADMIN or MEMBER"]
    GChoice -->|Leave group| GLeaveQ{"Member not found"}
    GLeaveQ -->|Yes| GLeaveFail["FAIL 404 not a member"]
    GLeaveQ -->|No| GLeaveLastQ{"Member is ADMIN and admin count is 1"}
    GLeaveLastQ -->|Yes| GLeaveLastFail["FAIL 400 last admin must promote another admin or delete the group first"]
    GLeaveLastQ -->|No| GLeave["Delete ChatMember, emit group member-left"]
    GChoice -->|Delete group| GDelAdmin["Require group admin, else FAIL 403 group admin only"]
    GDelAdmin --> GDelQ{"Chat type is not GROUP"}
    GDelQ -->|Yes| GDelFail["FAIL 400 only groups can be deleted this way"]
    GDelQ -->|No| GDel["In ONE transaction: update CallLog chatId to NULL where chatId matches, then delete Chat, emit group deleted to former members"]
    StAuth --> StChoice{"Choose status operation"}
    StChoice -->|Post status| StPostQ{"Text empty and mediaUrl empty"}
    StPostQ -->|Yes| StPostFail["FAIL 400 status needs text or media"]
    StPostQ -->|No| StPostVal["Validate media per media flow above when mediaUrl given, using statuses path scheme"]
    StPostVal --> StPost["Create StatusUpdate with userId, text, mediaUrl, createdAt NOW, expiresAt createdAt plus 24 hours"]
    StChoice -->|View visible statuses| StVis["Collect own id plus accepted not-blocked contacts in either direction"]
    StVis --> StVisReturn["Return StatusUpdate where userId in collected set and expiresAt greater than NOW, ordered by createdAt descending"]
    StChoice -->|View one status| StView["Find StatusUpdate by id"]
    StView --> StViewQ{"Status missing or expiresAt less than or equal to NOW"}
    StViewQ -->|Yes| StViewFail["FAIL 404 status not found or expired, expired is indistinguishable from missing"]
    StViewQ -->|No| StViewOwnQ{"Status owner is the viewer"}
    StViewOwnQ -->|Yes| StViewReturn["Return status, no StatusView row for own status"]
    StViewOwnQ -->|No| StViewUpsert["Upsert StatusView with statusId, viewerId, viewedAt NOW, idempotent, then return status"]
```

Algorithm trace: media limits PHOTO 10 MB, VOICE 16 MB and 300 seconds,
VIDEO 100 MB and 600 seconds, FILE 25 MB, with MIME lists from section 6;
validation order type, size, server MIME sniff, duration; server-generated
path, thumbnail best effort. Group: creator first ADMIN, add 409,
remove and demote last-admin 400, leave last-admin 400, delete any ADMIN,
delete only GROUP, null `CallLog.chatId` in same transaction before
deleting `Chat`. Status: post requires text or media, `expiresAt`
`createdAt + 24 hours`, visible set own plus accepted not-blocked either
direction, `expiresAt > NOW` filter on every read, expired view 404,
`StatusView` upsert only for other users statuses.

---

## 8. Overall verification checklist

- [x] Overall app flow: Register and Login first, then Chat List, Chat,
  Calls, Status, Communities, Settings.
- [x] Registration: username validation, random ID plus collision retry,
  bcrypt, JWT.
- [x] Send Message: auth, membership check, save, WebSocket emit,
  delivery ack, read receipt, polling fallback.
- [x] SAZMU AI Reply: safety-first order distress, sexual, boundary,
  then language, intent, memory, LLM-later branch, template fallback,
  honest-unknown, AI label.
- [x] Search User: exact 8-digit ID first, then username exact and
  prefix, public fields only, blocked excluded, no partial ID search.
- [x] Audio and Video Call: accepted-contact gate, offer, answer, ICE,
  accept, decline, busy, missed, caller-cancel, CallLog write, TURN
  fallback note.
- [x] Supporting flows: media validation order, group admin controls
  and group delete nulling `CallLog.chatId` before deleting `Chat`,
  Status 24h expiry.
- [x] No Supabase implementation anywhere. No PSTN. SAZMU AI labelled AI
  in every SAZMU AI step.

**Steps not silently dropped:** none. Every algorithm step from sections
1 to 9 has a matching node above. The 7 diagrams are: overall, registration,
send message, SAZMU AI reply, search user, audio and video call, plus
supporting media, group, and Status flows.
