# Communica — UI Test Report (Step 6: UI Tests + Fixes)

**Test date:** 2026-11-03
**File tested and fixed:** `~/workspace/communica/website/index.html` (Step 5 prototype)
**File size:** 45,699 bytes before → 51,360 bytes after fixes
**Scope guardrails honoured:** Only `website/index.html` was edited. No schema, plan,
language, algorithms, or flowchart file was changed, and no file in
`~/workspace/communica/` was deleted. No publishing, no accounts, no credentials,
no `prisma db push`. Backend remains Prisma + Neon DB only (NOT wired in this UI
step, NOT Supabase), as labelled throughout the prototype.
**Method (stated honestly):** Static HTML/CSS/JS inspection (screen inventory,
`onclick`/`oninput` handler cross-check against function definitions, colour-value
and font-size audit) PLUS a Node.js harness that loads the page's actual inline
`<script>` with a minimal DOM stub and calls its real functions. This is NOT a
live-browser click test — a generic subagent cannot operate a live browser — so
no live-browser click is claimed anywhere in this report. One function,
`deleteBubble`, is verified by code inspection only (see Test 5 note).
**Standing context held:** Communica, chatbot SAZMU AI always labelled AI, never a
real human. Boyfriend default call name Sazzad. Girlfriend presets Sadia, Maria,
Tithi, Borsha, Anika, Tajmira, Mim, Mimi, Mumu, Ayra, Jannati, Mushfika, plus
custom. No real phone number: random 8-digit in-app Communica ID, EXACT-ONLY
search, no partial ID search.

## Test 1 — Structure / navigation (before)

**Verdict before: PARTIAL PASS (no dead end, 4 navigation defects).**

- All 22 claimed screens exist as `<section class="screen" id="screen-…">`:
  Landing, Register, Login, Chat List, 1:1 Chat, Group Chat, SAZMU Chat,
  SAZMU Setup, New Chat/Search, Contact Profile, Group Info, Calls List,
  Call Screen, Keypad, Status/Updates, Status Viewer, My Status, Communities,
  Settings/Profile, Archived, Favorites, New Group. Count verified by grep: 22.
- Every `onclick` handler name used in the HTML is defined as a function in the
  script (cross-checked: `showScreen`, `demoEnter`, `doRegister`, `openChat`,
  `startCall`, `endCall`, `sendChatMsg`, `sendGroupMsg`, `sendSazmuMsg`,
  `sendPhotoDemo`, `sendVoiceDemo`, `setFilter`, `setRole`, `pickName`,
  `saveSazmu`, `filterPeople`/`filterChats` on `oninput`, `blockContact`,
  `reportContact`, `addMember`, `removeMember`, `createGroup`, `saveSettings`,
  `keyDigit`, `keyClear`, `keyCall`, `toggleBtn`, `toast`, `viewStatus`,
  `prevStatus`, `nextStatus`, `postStatus`, `unarchive`, `clearReply`,
  `setReply`). No dead button found. Inline script passes `node --check`.
- Reachability: Landing → Register / Login / demo chats; Chats → every tab via
  the bottom nav (Chats / Updates / Communities / Calls / Settings) and to
  New Chat, New Group, Archived, Favorites, Keypad; chat rows → 1:1 / Group /
  SAZMU chat; every detail screen has a back button or an exit action.
  No screen was unreachable and no screen was a dead end.
- **Defects found (all fixed, see Fixes):**
  - **D1 — Wrong-contact calls/profile.** The 1:1 chat top bar and the Contact
    Profile call buttons hardcoded `'Rahim'`, and the profile avatar/username/ID
    never changed. Opening Mim's chat and tapping 📞 started a call to Rahim.
  - **D2 — Fixed back destinations.** SAZMU Setup back always went to the SAZMU
    chat even when opened from Settings or New Chat; Keypad back always went to
    Calls even when opened from Chats.
  - **D3 — Status reply went to the wrong chat.** Status Viewer "Reply to
    status" always opened the generic 1:1 chat (Rahim) instead of the status
    author's chat.
  - **D4 — Community "Open group" kept the wrong title.** It opened the group
    chat still titled "Family Group" regardless of which community was tapped.
- Note (not a defect): "Browse demo chats" on Landing skips registration-first.
  It is explicitly labelled "(demo only)"; production must enforce
  registration-first (see Known limitations L4).

## Test 2 — Colour + typography (before)

**Verdict before: PARTIAL PASS (palette and fonts present, 3 contrast/target defects).**

- Palette present: `#075E54`, `#128C7E`, `#25D366`, chat background `#ECE5DD`.
- Font stack includes Bengali-supporting fonts first:
  `"Noto Sans Bengali","Hind Siliguri","SolaimanLipi",system-ui,…`.
  Bengali script appears in the SAZMU language option (`Bengali (বাংলা)`).
- Font sizes: smallest values in the stylesheet are 12px (badges, small labels,
  footer note); body text defaults to 16px, inputs are 16px, buttons 15px.
  No tiny body text found.
- Contrast — computed with a WCAG relative-luminance script (not guessed):
  white on `#075E54` = **7.67:1** (pass); white on `#128C7E` = **4.14:1**
  (below AA 4.5:1 for normal text — used by `.btn-green`, tab-active, avatar,
  links); white on `#25D366` = **1.98:1** (fail — used by `.btn-bright` and the
  unread badge); `#111111` on `#ECE5DD` = **15.12:1**; `#667781` on white =
  **4.65:1**; disclaimer `#5A4300` on `#FFF3CD` = **8.47:1**.
- **Defects found (all fixed):**
  - **D5 — White text on `#25D366` (1.98:1) and on `#128C7E` (4.14:1).**
  - **D6 — Bengali-mode SAZMU reply was Romanised, not Bengali script.**
    With language = Bengali the demo reply was "Bujhte perechi…" in Latin
    letters. The Node harness confirmed: no Bengali-script characters
    (U+0980–U+09FF) in the reply.
  - **D7 — Small touch targets.** `.react` buttons were 30px tall and `.chip`
    presets 40px tall, below the ~44px target; all other buttons already had
    `min-height:44px`.

## Test 3 — Feature / component checklist vs COMMUNICA_PLAN.md (before)

**Verdict before: PARTIAL PASS (most Phase-1 UI present, 9 items missing/partial).**

Present before: registration-first form with random 8-digit Communica ID;
login screen; chat list with All / Unread / Favorites / Groups filters;
Archived screen + Unarchive; Favorites screen; 1:1 text chat with reply and
reaction; photo and voice demo in 1:1 chat; group creation, member list,
add/remove member, make-admin; Communities browse/join; Status post, viewer
with Previous/Next, 24-hour expiry note, static viewer list; Calls list,
audio/video call buttons, call timer (`fmt`, `setInterval`, cleared on end),
mute/speaker toggles, End, incoming-call simulation; Keypad with 8-digit
validation; SAZMU AI labelled "AI — not a human" in the chat list, SAZMU header
and New Chat rows; SAZMU Setup with Boyfriend/Girlfriend roles, Boyfriend
default Sazzad, all 12 Girlfriend presets (verified in `gfNames`), custom name,
pet name, tone, and Bengali/Banglish/English language; Block and Report on the
Contact Profile; search by exact 8-digit ID and by @username exact/prefix.

Missing or partial before (all fixed except Edit — see L1):
- **D8 — No way to archive a chat.** Karim was pre-archived in demo data, but
  the UI offered no archive action; only Unarchive existed.
- **D9 — No favourite toggle.** Favorites existed as a filter and a screen,
  but no control could add/remove a favourite.
- **D10 — No read receipts.** Own bubbles showed only "You • now".
- **D11 — No message delete.** (Edit also missing; see L1.)
- **D12 — Group chat had no photo/voice buttons** (1:1 chat had both).
- **D13 — SAZMU chat had no mic button** (1:1 chat had one).
- **D14 — Status had no photo option** (text only; plan says photo or text).
- **D15 — Incoming calls had no Accept/Decline.** The screen said "accept by
  waiting" while the timer ran.
- **D16 — Login had no validation.** Its button jumped straight to Chats even
  with empty fields (Register did validate). Settings save also accepted
  empty name/username.

## Test 4 — Mobile / responsive (before)

**Verdict before: PARTIAL PASS.**

- Pass: `<meta name="viewport" content="width=device-width, initial-scale=1">`;
  `.phone` is `max-width:480px` centred; bottom nav is `position:fixed`,
  `max-width:480px`, centred, and visible on the 5 main tabs (hidden on detail
  screens by design, where the back button is the exit); keypad is
  `max-width:300px`; inputs are `width:100%` with `box-sizing:border-box`;
  bubbles `max-width:82%`; toast `max-width:90%`; call avatar 130px; keypad
  keys 56px; call buttons 60/68px.
- **Defects found (all fixed):** D7 touch targets (`.react` 30px, `.chip` 40px);
  **D17 — no overflow protection for long unbroken text** (no
  `overflow-wrap` on bubbles/chat rows; a long username, ID string or pasted
  word could push a row wider than the 480px shell on a narrow screen).

## Test 5 — Interaction, Node harness with minimal DOM stub (before)

**Verdict before: PARTIAL PASS — core interactions worked; 3 defects confirmed.**

Before-fix harness (19 checks on the original file): 17 passed, including
1:1 send adds a bubble, empty send ignored, mic/voice demo adds a bubble
without crashing, group send adds a bubble, chat search "Mim" shows Mim and
hides Rahim, exact 8-digit ID finds Rahim, partial ID `48291` rejected with
the EXACT-ONLY hint and an empty list, short ID rejected, username prefix
`@mi` finds Mim, SAZMU setup Girlfriend/Mim and Boyfriend/Sazzad both update
the SAZMU header, timer formats `00:00`/`01:05`, keypad short ID rejected,
keypad exact ID accepted and starts a call, archived list renders Karim.
Failures/defects confirmed before fixing:
- **D6 (again):** Bengali-mode SAZMU reply contained no Bengali script — FAIL.
- **D18 — Keypad accepted `*`/`#` and more than 8 characters.** `keyDigit`
  capped input at 12 characters and allowed `*`/`#`; `keyCall` then rejected
  the result, so the keypad invited input it would refuse. (Rejection itself
  already worked; the defect was the keypad accepting non-ID input.)
- Method note: the harness loads the page's real inline script and calls its
  real functions; it is a DOM-stub test, not a live-browser click test.

## Fixes made (all in `~/workspace/communica/website/index.html`)

- **D1:** Added `currentChatId`/`currentChatName`, set in `openChat()`; chat
  and profile call buttons now use `currentChatName`; `openChat()` also updates
  the profile avatar letter, `profile-sub` (@username + Communica ID) and the
  favourite button label. Added `profile-avatar`/`profile-sub` ids.
- **D2:** Added `setupReturn`/`keypadReturn`, tracked in `showScreen()` (every
  screen except Setup itself updates `setupReturn`; every screen except Keypad
  updates `keypadReturn`); Setup back now goes to `setupReturn`, Keypad back
  to `keypadReturn`. Defaults remain SAZMU chat and Calls.
- **D3:** New `replyStatus()` sets the 1:1 chat title/avatar/profile to the
  status author before opening the chat.
- **D4:** New `openCommunityGroup(name)` sets the group title to the tapped
  community before opening the group chat.
- **D5 (contrast, recomputed after fix):** White-on-`#128C7E` text rules
  (`.btn-green`, tab-active, avatar, links, bottom-nav active, photo-demo
  gradient) darkened to `#0B6E60`, where white now computes **6.15:1**;
  `.btn-bright` text changed white → `#06332B` on `#25D366` = **6.98:1**;
  unread badge background changed to `#075E54` (white = **7.67:1**). The
  WhatsApp green family is preserved (`#075E54`, `#0B6E60` darkened teal,
  `#25D366`, `#ECE5DD` unchanged); `#128C7E` is no longer used behind white
  text — this is a deliberate, documented change, not a palette drift.
- **D6:** Bengali-mode SAZMU demo reply rewritten in Bengali script:
  "🤖 (ডেমো উত্তর) বুঝতে পেরেছি। তুমি যা বললে, সেটা নিয়ে ভাবছি — আরেকটু বলো তো?"
- **D7:** `.react` `min-height` 30px → 44px; `.chip` 40px → 44px. All buttons
  are now at least 44px tall.
- **D8:** New `archiveCurrent()` (1:1 chat screen button + Contact Profile
  button) and `archiveGroup()` (Group Info button); archived chats appear in
  Archived and can be restored with the existing Unarchive.
- **D9:** New `favToggle()` on the Contact Profile; label reflects state
  ("⭐ Add to Favorites" / "★ Remove from Favorites") and is refreshed by
  `openChat()`.
- **D10:** Own bubbles now show "You • now • ✓✓ Seen (demo)".
- **D11 (partial):** New `deleteBubble()` — own bubbles get a 🗑 Delete button
  that removes the bubble (demo only). Edit is NOT implemented; see L1.
- **D12:** Group composer gained 🖼️/🎤 buttons with new
  `sendGroupPhotoDemo()` / `sendGroupVoiceDemo()` appending to the group thread.
- **D13:** SAZMU composer gained a 🎤 button with new `sendSazmuVoiceDemo()`.
- **D14:** My Status gained "🖼️ Post photo status (demo)" via new
  `postPhotoStatus()`.
- **D15:** Call screen gained an Accept/Decline block (`call-decision`) shown
  only for incoming calls; new `acceptCall()` (hides the block, state "In
  call", timer reset) and `declineCall()` (ends the call). Outgoing calls show
  no decision block. `endCall()` now also hides the block.
- **D16:** New `doLogin()` validates non-empty @username/ID + password and
  shows `login-result` otherwise (Login button now calls it);
  `saveSettings()` now rejects an empty display name or @username.
- **D17:** Added `overflow-wrap:break-word` to `.bubble` and chat-row text, and
  `min-width:0` to the chat-row middle span.
- **D18:** `keyDigit()` now rejects non-digits with the hint "Digits only — a
  Communica ID is 8 digits, not a phone number." and caps input at 8 digits.
  `keyCall()`'s exact-`^\d{8}$` rejection of short/partial IDs is unchanged.
- Also added: a group-chat audio-call button (group title as callee); inline
  script still passes `node --check` after all edits.

## After re-test results (same cases, after fixes)

- **Test 1 — PASS.** 22 screens still present. No dead button (handler
  cross-check repeated). Fixed navigation verified by harness state checks:
  keypad return = Chats after Chats → Keypad and = Calls after Calls → Keypad;
  setup return = Settings after Settings → Setup; community open sets the
  group title; status reply path is wired to the author. Hardcoded
  `'Rahim'` call buttons: none remain in chat/profile (remaining "Rahim"
  strings are demo data rows, initial placeholders updated by `openChat()`,
  and the intentionally labelled "Simulate incoming call" buttons).
- **Test 2 — PASS.** Recomputed ratios: white on `#075E54` 7.67:1, white on
  `#0B6E60` 6.15:1, `#06332B` on `#25D366` 6.98:1, `#111111` on `#ECE5DD`
  15.12:1, `#667781` on white 4.65:1, disclaimer 8.47:1 — all at or above
  AA 4.5:1 for normal text. Font stack unchanged (Bengali-supporting fonts
  first); smallest size still 12px for labels/badges only, body/inputs 16px.
- **Test 3 — PASS except recorded limitation L1 (Edit).** Archive, favourite
  toggle, read receipts, delete button, group photo/voice, SAZMU mic, photo
  status, incoming Accept/Decline, login and settings validation all present
  after fixes. SAZMU presets re-verified: all 12 Girlfriend names plus
  Boyfriend default Sazzad; SAZMU still labelled AI in list, header and
  search rows.
- **Test 4 — PASS.** Viewport, 480px shell, bottom nav on the 5 main tabs,
  44px minimum touch targets (global button rule, `.react`, `.chip`, keypad
  56px, call buttons 60/68px), overflow-wrap rules added. Bottom nav remains
  hidden on detail screens by design (back button is the exit there).
- **Test 5 — PASS (32/32 harness checks).** After-fix harness re-ran every
  before case plus the new functions: send/group/SAZMU-mic/photo/voice bubbles,
  read receipt, chat search filter, exact vs partial vs short ID, username
  prefix, SAZMU header update, Bengali-script reply, timer format, keypad
  `*` rejection, 8-digit cap, short-ID rejection, exact-ID acceptance, login
  empty rejection, incoming Accept (decision hidden, state "In call") and
  Decline (clean end), `openChat(2)` setting current chat to Mim with profile
  ID 19384726, archive → chat list loses Mim → archived list gains Mim →
  unarchive restores Mim, keypad/setup return tracking, photo status post,
  community group title, settings empty rejection. All 32 passed.
  - Note: `deleteBubble` itself was NOT run in the harness because the stub
    has no real DOM nodes for `closest()`/`remove()`; it is verified by code
    inspection only (button is rendered only on own bubbles, handler removes
    the enclosing `.bubble` and toasts). A live-browser pass should click it
    once (see L2).

## Final list — remaining known limitations (none is marked fixed)

- **L1 — Message edit NOT implemented (Test 3 item, still open).** Reason:
  the static demo renders messages as `innerHTML` strings with no message
  IDs, persistence, or sync, so a correct edit (with edited-state) cannot be
  built honestly in this file alone; delete and read receipts were added
  instead. Edit belongs to the backend phase, where messages have IDs.
- **L2 — No live-browser click test was possible.** Reason: a generic subagent
  cannot operate a live browser. Interactions were verified with the Node
  DOM-stub harness plus inspection. If the parent wants a live pass, it
  should delegate one click-through (especially Delete, Accept/Decline, and
  the 320px-wide layout) to an agent with browser access.
- **L3 — Saving SAZMU setup resets demo threads.** `saveSazmu()` calls
  `initMessages()`, which rewrites the 1:1, group and SAZMU demo threads.
  Demo-only behaviour, left unchanged to avoid a risky refactor in this step.
- **L4 — "Browse demo chats" bypasses registration-first.** Labelled demo-only
  on the Landing screen; production must enforce registration-first.
- **L5 — Out of scope by plan, not UI defects:** no live Neon DB, no real
  WebRTC calls, no generative LLM (SAZMU replies are labelled demo replies),
  no end-to-end encryption, no contact-request flow, no community moderation
  tools (plan marks moderation TBD). Every such surface in the file is
  labelled "demo" / "UI only".
- **L6 — Other demo simplifications:** registration does not check Communica
  ID/username uniqueness; demo passwords are browser-only, not production
  auth; group chat shows one static demo thread regardless of which group is
  opened; `doRegister`/`createGroup`/`addMember` do not validate duplicates.
- **L7 — Bottom nav hidden on detail screens by design** (back button exits);
  smallest labels/badges remain 12px, which is readable but is the floor of
  the type scale.
