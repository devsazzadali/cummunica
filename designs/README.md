# Communica — Premium Design Options (choose first, build second)

The user asked for MANY premium design options, researched from
Behance / Pinterest-style sources, BEFORE any one design is finalised.
This folder is that exploration. Nothing here is final, and nothing here
changes the Next.js build — the chosen direction will be applied later
via theme tokens.

## What is in this folder

- [RESEARCH.md](sandbox://workspace/communica/designs/RESEARCH.md) —
  what makes a chat UI look premium, feature by feature, with links to
  the public sources consulted. No copied images or brand assets.
- [DIRECTIONS.md](sandbox://workspace/communica/designs/DIRECTIONS.md) —
  the 4 directions in full: palette hex codes, typography, icons,
  bubbles, buttons, avatars, cards, pros/cons.
- [index.html](sandbox://workspace/communica/designs/index.html) —
  gallery page linking every direction and every screenshot.
- `direction-a.html` … `direction-d.html` — interactive mockups
  (open in a browser, switch screens with the top pill bar or bottom nav).
  Note: the top pill bar in the mockups is mockup navigation only, not
  part of the final app UI.
- `screenshots/<direction>/<screen>.png` — 36 rendered screenshots
  (4 directions × 9 screens), verified: all non-blank (37–99 KB each),
  all hashes distinct within each direction, and one chat-list
  screenshot per direction inspected visually.

## The 4 directions at a glance

- **A — WhatsApp Premium:** refined familiar greens. Safest adoption.
- **B — Dark Elegant:** deep charcoal + emerald glow. Most premium
  at a glance, native dark mode.
- **C — Minimal Light:** airy iOS-style white + one blue accent.
  Cleanest and most readable.
- **D — Modern Gradient:** violet→pink gradients, colourful avatars,
  floating pill nav. Most eye-catching in marketing.

Full comparison, palettes and typography: see DIRECTIONS.md.

## Recommendation (honest, not final)

**Pick B — Dark Elegant as the headline theme, with A as the light
companion, if the user wants maximum "premium" feeling.** Reasons:
(1) it is the most visually distinct from plain WhatsApp while keeping
the same familiar chat layout, so users recognise it instantly but
still feel it is new; (2) dark mode is now a co-equal design target,
not a toggle, and B is designed dark-first rather than inverted;
(3) its emerald accent keeps a green family link to the WhatsApp-like
brief without copying WhatsApp's exact look.
If the priority is instead maximum adoption with zero relearning,
pick A. If readability for all ages matters most, pick C. If the
launch needs to stand out in screenshots and store listings, pick D.
A single pick is still required — do not ship a mix of all four.

## Screenshot file list (all 36)

Direction A — WhatsApp Premium:
- [Chat List](sandbox://workspace/communica/designs/screenshots/direction-a/chat-list.png)
- [1:1 Chat](sandbox://workspace/communica/designs/screenshots/direction-a/chat.png)
- [Group Chat](sandbox://workspace/communica/designs/screenshots/direction-a/group-chat.png)
- [Calls List](sandbox://workspace/communica/designs/screenshots/direction-a/calls.png)
- [Call Screen](sandbox://workspace/communica/designs/screenshots/direction-a/call-screen.png)
- [Updates / Status](sandbox://workspace/communica/designs/screenshots/direction-a/updates.png)
- [Communities](sandbox://workspace/communica/designs/screenshots/direction-a/communities.png)
- [SAZMU AI Chat](sandbox://workspace/communica/designs/screenshots/direction-a/sazmu.png)
- [Settings](sandbox://workspace/communica/designs/screenshots/direction-a/settings.png)

Direction B — Dark Elegant:
- [Chat List](sandbox://workspace/communica/designs/screenshots/direction-b/chat-list.png)
- [1:1 Chat](sandbox://workspace/communica/designs/screenshots/direction-b/chat.png)
- [Group Chat](sandbox://workspace/communica/designs/screenshots/direction-b/group-chat.png)
- [Calls List](sandbox://workspace/communica/designs/screenshots/direction-b/calls.png)
- [Call Screen](sandbox://workspace/communica/designs/screenshots/direction-b/call-screen.png)
- [Updates / Status](sandbox://workspace/communica/designs/screenshots/direction-b/updates.png)
- [Communities](sandbox://workspace/communica/designs/screenshots/direction-b/communities.png)
- [SAZMU AI Chat](sandbox://workspace/communica/designs/screenshots/direction-b/sazmu.png)
- [Settings](sandbox://workspace/communica/designs/screenshots/direction-b/settings.png)

Direction C — Minimal Light:
- [Chat List](sandbox://workspace/communica/designs/screenshots/direction-c/chat-list.png)
- [1:1 Chat](sandbox://workspace/communica/designs/screenshots/direction-c/chat.png)
- [Group Chat](sandbox://workspace/communica/designs/screenshots/direction-c/group-chat.png)
- [Calls List](sandbox://workspace/communica/designs/screenshots/direction-c/calls.png)
- [Call Screen](sandbox://workspace/communica/designs/screenshots/direction-c/call-screen.png)
- [Updates / Status](sandbox://workspace/communica/designs/screenshots/direction-c/updates.png)
- [Communities](sandbox://workspace/communica/designs/screenshots/direction-c/communities.png)
- [SAZMU AI Chat](sandbox://workspace/communica/designs/screenshots/direction-c/sazmu.png)
- [Settings](sandbox://workspace/communica/designs/screenshots/direction-c/settings.png)

Direction D — Modern Gradient:
- [Chat List](sandbox://workspace/communica/designs/screenshots/direction-d/chat-list.png)
- [1:1 Chat](sandbox://workspace/communica/designs/screenshots/direction-d/chat.png)
- [Group Chat](sandbox://workspace/communica/designs/screenshots/direction-d/group-chat.png)
- [Calls List](sandbox://workspace/communica/designs/screenshots/direction-d/calls.png)
- [Call Screen](sandbox://workspace/communica/designs/screenshots/direction-d/call-screen.png)
- [Updates / Status](sandbox://workspace/communica/designs/screenshots/direction-d/updates.png)
- [Communities](sandbox://workspace/communica/designs/screenshots/direction-d/communities.png)
- [SAZMU AI Chat](sandbox://workspace/communica/designs/screenshots/direction-d/sazmu.png)
- [Settings](sandbox://workspace/communica/designs/screenshots/direction-d/settings.png)

## Limits, honestly stated

- These are design mockups with demo data (generic demo names only),
  not the Next.js app and not wired to any database.
- Icons are Lucide-style inline SVGs drawn for these mockups, not
  emoji; the final app must use the lucide-react library.
- No direction was rendered for Landing / Register / Login / Keypad /
  Archived / Favourites / New Group in this exploration — those 9
  screens above cover every major feature, and the remaining screens
  will follow the chosen direction's tokens.
- No WhatsApp logo, brand assets, or third-party artwork were used.
- The user must still pick ONE direction before final styling is
  applied to the Next.js build.
