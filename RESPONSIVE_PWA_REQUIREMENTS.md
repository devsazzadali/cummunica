# Communica Responsive + PWA — STANDING REQUIREMENTS

Applies to ALL layout work in the Next.js build (Step 1 scaffold manifest, Step 2 pages, Step 5 QA, and any later UI fix). A layout that is only phone-width on desktop does NOT pass.

## 1. Study WhatsApp fully as reference (layout logic, not brand)
Before finalising layouts, study WhatsApp's real interfaces in full:
- WhatsApp mobile app: single-pane, bottom tabs, chat list, chat view, calls, status.
- WhatsApp Web (desktop browser): two-pane layout — chat list on the left, open chat on the right, header bars, search.
Match their layout logic, spacing, and behaviour, not just colours.
Do NOT copy WhatsApp's logo, brand name, or proprietary assets — Communica branding stays throughout.

## 2. Responsive, two modes
### Desktop web browser — WhatsApp Web mode
- Wide two-pane layout: chat list sidebar + active chat pane side by side.
- Usable with mouse/keyboard.
- NO phone-frame box constraining the whole page on desktop.

### Mobile — mobile app mode
- Single-pane screens.
- Bottom tab bar: Chats / Updates / Communities / Calls / Settings.
- Touch targets >= 44px.
- No horizontal scrolling.
- Safe-area handling (notch / home indicator).

### Breakpoints
- Must switch cleanly between modes.
- Test at 360px, 768px, and 1280px+ widths.
- Any mode missing or broken fails that step.

## 3. PWA support — real, not just a claim
- Web app manifest: name Communica, theme/background colours matching the UI.
- Icons at 192px and 512px — generate simple Communica-branded icons, NOT WhatsApp's logo.
- Service worker for app-shell offline caching.
- Installable (add-to-home-screen), standalone display, theme-color meta.
- Record PWA verification in next-app/QA_REPORT.md: manifest valid, service worker registers, install-prompt criteria met.

## 4. QA — test each mode separately
QA must test, and record pass/fail separately in next-app/QA_REPORT.md:
- Desktop mode (1280px+): two-pane layout, sidebar + chat pane, mouse/keyboard usable, no phone frame.
- Tablet/intermediate (768px): clean breakpoint switch, no broken layout, no horizontal scroll.
- Mobile mode (360px): single-pane, bottom tabs, touch targets >= 44px, safe-area, no horizontal scroll.
- PWA: manifest valid, icons 192/512 present and Communica-branded, service worker registers, standalone/install criteria met.
Any mode missing or broken is a FAIL: reported to the developer, fixed, re-tested until pass, with PM approval before the step closes.
