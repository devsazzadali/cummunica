# Step 4 — Manual browser call test (human-run, Step 5 QA)

A generic worker cannot do a live mic/cam call, so the live
audio/video path is NOT verified by automation. Run this script in
two real browsers (or two browser profiles) before Step 4 is called
done. Record pass/fail per item in QA_REPORT.md; a connected-but-
blurry or echoey call is a FAIL per CALL_QUALITY_REQUIREMENTS.md.

## Setup (no live DB changes by this script itself)
1. The app must be running against the real (Neon) DB with a real
   JWT_SECRET — placeholder env used for `next build` is NOT enough
   for live calls, because /api/calls needs Prisma + the gate rows.
2. Create two users (A and B) via /register. In Contacts, make sure
   B has ACCEPTED A (and vice versa if you test both directions):
   calls to a not-accepted contact must be refused with a plain
   403-style message on the call screen.
3. Option 1 (default, no extra server): `npm run build && npm start`.
   Signalling then runs over the /api/calls REST queue + polling.
   Option 2 (live relay): `npm run socket` instead of `npm start`
   (same port, default 3000). Do NOT run both at once on one port.

## Test 1 — Outgoing audio call, accept, talk, end
1. A (signed in): open /calls, tap B's row (audio). Expect: the
   screen says "Ringing…", NO timer yet, NO mic/cam prompt yet for A
   (A's media starts only after B accepts).
2. B (signed in): open /call?variant=incoming (or wait on /calls).
   Expect: an incoming screen appears with Accept / Decline and NO
   mic/cam prompt before tapping anything.
3. B taps Accept. Expect: B is asked for mic permission; after
   allowing, A's screen moves to "Connecting…" then "In call" and
   the timer STARTS only now. Talk both ways: each side hears the
   other clearly, no echo/feedback.
4. A taps Mute, speaks — B hears nothing. A unmutes — B hears again.
5. A taps Speaker off/on — remote audio mutes/unmutes.
6. Either side taps End. Expect: both screens show "Call ended",
   the call appears in Recent Calls, and both mics are released
   (browser mic indicator disappears).

## Test 2 — Outgoing video call, HD + fallback + quality indicator
1. Repeat Test 1 as a video call. Expect: remote + local video
   visible, sharp at HD on a good connection, quality "Good".
2. Video on/off: turning video off hides local video; on restores it.
3. Throttle the network (browser devtools: Slow 3G / custom
   throttling) mid-call. Expect: quality shows "Weak" with a
   network explanation, video steps down (visibly softer, NOT
   frozen), audio stays intelligible, the call does NOT drop.
   Remove throttling: after a short while quality returns to Good
   and video steps back up.
4. Deny mic/cam permission on a fresh attempt. Expect: a plain
   permission-denied message, NO fake connected call, NO timer.

## Test 3 — Gates and edge cases (each must show a plain message)
1. A calls a user who has NOT accepted A. Expect: "has not
   accepted you yet" error, no ringing, no media started.
2. A calls while B is already on another call. Expect: "already on
   another call", no interruption of B's existing call.
3. A calls B and B does not answer within 30 seconds. Expect: the
   call ends as missed on both sides and is logged as missed.
4. B taps Decline. Expect: A sees "declined", no media started.
5. Not signed in: open /call directly. Expect: a sign-in message,
   no call attempt, no media started.
6. Keypad: dial B's exact 8-digit Communica ID, tap call. Expect: a
   real call attempt to B (or the gated error if B has not
   accepted A). A partial ID must never start a call.

## Test 4 — Socket server mode (only if `npm run socket` is used)
1. Repeat Test 1 with the socket server running. Expect: the same
   call flow, with faster invite delivery (no 2–3s poll wait).
2. Stop the socket server and restart with plain `npm start`.
   Expect: calls still work via REST polling (slightly slower
   invite), proving the socket server is optional, not required.

## Known non-goals of this script
- No TURN server is provisioned: if both browsers sit behind strict
  NATs and the call never connects, that is the documented TURN gap,
  not a pass. Test on one LAN / non-restrictive networks first.
- No PSTN/phone dialling is tested: Communica IDs are in-app only.
- Final visual styling is ON HOLD (DESIGN_HOLD.md): judge function
  here, not final palette/typography.
