# Communica — 4 Premium Design Directions

Each direction is a complete visual system: palette, typography, icon style,
bubble style, buttons, avatars, cards and navigation. They are NOT just
colour swaps — radius, shadow, header treatment, avatar shape and bottom-nav
treatment all change. All four use Communica branding only, Lucide-style
inline SVG icons (no emoji as UI icons), and generic demo names only.
Mockups: `direction-a.html` … `direction-d.html` in this folder.
Screenshots: `screenshots/<direction>/<screen>.png` (9 screens each).

Shared rules (all directions): 44px+ touch targets, bottom nav with
Chats / Updates / Communities / Calls / Settings, search always visible
on the chat list, SAZMU AI always labelled "AI — not a human", Bengali
text in Noto Sans Bengali / Hind Siliguri, no WhatsApp logo or brand assets.

---

## A — "WhatsApp Premium" (refined familiar)

**Idea:** The WhatsApp layout users already trust, polished: cleaner
spacing, crisper header, softer shadows, consistent radii.
**Best for:** fastest user adoption — nothing to relearn.
**Palette:** header `#075E54`, accent `#128C7E`, bright `#25D366`,
own bubble `#D9FDD3`, chat bg `#ECE5DD`, surface `#FFFFFF`,
muted text `#667781`, screen bg `#F0F2F5`, unread badge `#25D366`.
**Typography:** `"Segoe UI", system-ui, Roboto, "Noto Sans Bengali"` —
brand 21px/700, screen titles 22px/700, names 16px/700, previews
14px/400, metadata 12px/400.
**Icons:** Lucide-style outlined, 22px, stroke 2, white on header,
`#075E54` on light surfaces.
**Bubbles:** 12px radius, white received / `#D9FDD3` own, 1px soft
shadow, sender name in `#128C7E` in groups, blue double ticks for read.
**Buttons:** pill buttons, primary `#075E54` white text, bright
`#25D366` for hero actions, danger `#DC2626`.
**Avatars:** 50px circles, solid greens/purples/amber/pink per contact,
AI avatar `#6D28D9`.
**Cards/nav:** flat list rows with hairline dividers; standard bottom
tab bar with top border.
**Pros:** instantly familiar; safest for a WhatsApp-alternative launch.
**Cons:** least distinctive — looks "like WhatsApp, but cleaner".

## B — "Dark Elegant" (premium dark mode)

**Idea:** A night-first premium look: deep charcoal surfaces, emerald
glow accents, glass-blur headers, gradient avatars.
**Best for:** users who live in dark mode; night use; a distinctly
premium, modern feel.
**Palette:** app bg `#0B0F14`, surface `#141A21`, border `#1E293B`,
accent `#10B981`, accent glow `rgba(16,185,129,.35)`, own bubble
gradient `#0F766E → #059669`, other bubble `#1E293B`, text `#F2F5F7`,
muted `#94A3B8`, danger `#DC2626`.
**Typography:** `Inter, system-ui, Roboto, "Noto Sans Bengali"` —
brand 21px/800, screen titles 24px/800, names 16px/700, previews
14px/400, metadata 12px/400, section labels 13px/700 uppercase.
**Icons:** Lucide-style outlined, 22px, stroke 2, `#A8F0C6` on dark
headers, emerald primary buttons.
**Bubbles:** 20px radius (6px on the tail side), gradient own /
`#1E293B` other, no heavy shadow — depth comes from layering.
**Buttons:** pill, primary `#10B981` on `#04120B` text, outline
emerald for secondary, red end-call.
**Avatars:** 52px squircle (16px radius), gradient per contact,
emerald glow ring, AI gradient teal→mint.
**Cards/nav:** glass-blur header and bottom bar, status ring solid
emerald, communities as dark cards with 1px borders.
**Pros:** most premium-looking at a glance; great for OLED / night.
**Cons:** needs careful contrast QA; light-mode users need a separate
theme later; gradients must stay restrained or it turns gaudy.

## C — "Minimal Light" (airy iOS-style)

**Idea:** iOS-style calm: white surfaces, hairline dividers, one blue
accent, big pill bubbles, maximum whitespace.
**Best for:** clarity, older users, long reading sessions, accessibility.
**Palette:** app bg `#FFFFFF`, screen bg `#F2F2F7`, accent `#007AFF`,
own bubble `#007AFF` (white text), other bubble `#F2F2F7`,
text `#000000`, muted `#8A8A8E`, divider `#E5E5EA`, danger `#FF3B30`,
success `#34C759`.
**Typography:** `-apple-system, "SF Pro Text", "Segoe UI", Roboto,
"Noto Sans Bengali"` — brand 26px/800, screen titles 30px/800,
names 17px/600, previews 15px/400, metadata 13px/400.
**Icons:** Lucide-style outlined, 22px, stroke 2, `#007AFF` for
actions, grey for secondary.
**Bubbles:** 22px pill radius, own blue / other light grey, no shadow,
ticks white on own bubbles.
**Buttons:** pill, primary `#007AFF`, outline blue secondary,
red destructive.
**Avatars:** 52px circles, solid iOS palette (blue, green, purple,
orange, pink), AI `#5856D6`.
**Cards/nav:** hairline-divided lists, frosted-glass header and
bottom bar, communities as light-grey rounded cards.
**Pros:** cleanest, most readable, most accessible; ages well.
**Cons:** can feel plain next to B/D; blue accent is strongly
"iOS" — less own-brand character.

## D — "Modern Gradient" (contemporary vibrant)

**Idea:** A 2026-contemporary look: gradient header, colourful gradient
avatars, floating pill bottom nav, soft card shadows.
**Best for:** younger users, standing out in screenshots / marketing,
a brand that wants to look new rather than familiar.
**Palette:** header gradient `#6366F1 → #8B5CF6 → #EC4899`,
app bg `#FFFBF5`, surface `#FFFFFF`, accent gradient
`#6366F1 → #EC4899`, own bubble gradient `#6366F1 → #8B5CF6`,
other bubble `#FFFFFF`, text `#1E1B4B`, muted `#6B7280`,
danger gradient `#EF4444 → #EC4899`.
**Typography:** `"Plus Jakarta Sans", system-ui, Roboto,
"Noto Sans Bengali"` — brand 22px/800, screen titles 24px/800,
names 16px/700, previews 14px/400, metadata 12px/400.
**Icons:** Lucide-style outlined, 22px, stroke 2, white on gradient
headers, `#7C3AED` for actions on light surfaces.
**Bubbles:** 22px radius (8px tail side), gradient own / white with
soft shadow other, sender names in `#7C3AED`.
**Buttons:** pill, gradient primary, outline violet secondary,
gradient red end-call.
**Avatars:** 52px squircle (18px radius), gradient per contact,
gradient ring for status, AI violet gradient.
**Cards/nav:** chat rows and communities as floating white cards
with soft shadows; bottom nav as a floating pill above the bottom edge.
**Pros:** most eye-catching in a gallery / store listing; strong brand.
**Cons:** highest risk of looking busy; gradients must be capped
(header, avatars, primary buttons only) or readability suffers.

---

## Side-by-side comparison

| | A WhatsApp Premium | B Dark Elegant | C Minimal Light | D Modern Gradient |
|---|---|---|---|---|
| Feel | Familiar, trusted | Premium, night | Calm, clear | Fresh, bold |
| Best user | Existing WhatsApp users | Dark-mode users | All ages, readability | Younger / new users |
| Risk | Looks generic | Contrast QA needed | Looks plain | Looks busy |
| Dark mode | Later | Native (this IS dark) | Later | Later |
| Marketing pop | Medium | High | Low-medium | Highest |
