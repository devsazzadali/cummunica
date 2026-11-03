# Communica Design — STANDING REQUIREMENTS

Applies to ALL UI work in the Next.js build (Step 2 pages, Step 4 call UI, Step 5 QA, and any later UI fix). These override the emoji-based prototype icons.

## 1. Premium icons — no emoji as UI icons
- Replace ALL emoji icons in the UI with a proper premium vector icon library.
- Preferred: Lucide icons — install `lucide-react` in next-app and use it everywhere.
- Fallback only if Lucide lacks a glyph: Material Symbols or Heroicons.
- NO emoji as UI icons anywhere: not in chat, calls, nav, buttons, or status.
- Icons must be crisp vector SVGs at consistent sizes and stroke width.
- Note: emoji inside user-typed message CONTENT is user content, not a UI icon — the ban is on UI chrome/icons. Do not strip emoji from message text itself.
- Every icon used must actually render (imported correctly, no missing/broken SVGs).

## 2. WhatsApp-like realism (generic layout, not brand copying)
Match WhatsApp's real UI as closely as layout / colour / font allow:
- Header greens: #075E54 / #008069 family, as in the existing prototype.
- Chat background pattern tone: #ECE5DD family.
- Own-message bubble green: #D9FDD3 family; other-message bubble: white.
- Timestamp + read-receipt styling: single tick (sent), double tick (delivered), blue double tick (read).
- Bottom tab bar, search bar, chat list rows with avatar, name, preview, time, unread badge.
- Fonts: system stack matching WhatsApp — Segoe UI / Helvetica Neue / Roboto, plus Noto Sans Bengali / Hind Siliguri for Bengali text. No novelty fonts.
- Keep the phone-friendly layout from the 22-screen prototype; convert it to real Next.js pages/components, not a copy-paste of the HTML file.

## 3. Brand distinction — MUST state in README
- Do NOT copy WhatsApp's trademarked logo, brand name, or brand assets.
- The app is Communica, with its own name/logo.
- Only the generic chat-app layout, colours, and typography are WhatsApp-like.
- State this distinction explicitly in next-app/README.md.

## 4. QA — design checks (record in next-app/QA_REPORT.md)
QA must check, screen by screen (all 22 screens), and record pass/fail:
- Icon rendering: no emoji icons, no missing icons, no broken SVGs.
- Colour realism: header greens, chat background, own/other bubbles on-palette.
- Font realism: system stack + Bengali fonts, no novelty fonts.
- Chat realism details: timestamps, single/double/blue ticks, unread badges, search bar, bottom tabs.
- A screen with emoji icons or off-palette colours does NOT pass — it goes back to the developer, is fixed, and is re-tested until pass, with PM approval before the step closes.
