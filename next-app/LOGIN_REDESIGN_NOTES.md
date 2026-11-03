# Login / Register redesign — research notes (Workstream 1, 2026-11-03)

Scope: UI/styling only for `/login` and `/register`. Auth logic, API routes,
`src/lib/auth.ts`, rate limits and JWT+bcrypt behaviour are unchanged.
Direction A (WhatsApp green) is retired for these pages; branding is
pink/magenta-led. No logos, brand assets, screenshots or images were copied;
only layout/interaction patterns below were used.

## Patterns used (from public pattern round-ups, not copied designs)

1. Split screen with a value proposition (SaaS standard)
   - Two columns on desktop: form on one side, benefits/brand panel on the
     other. The panel answers "why sign in" while the form stays short.
   - Sources: Eleken "50+ login page examples for SaaS designers" (split
     layout, clear hierarchy); The Plus Addons "Login Page Examples"
     (design 4: split screen with a value proposition is the safest default).
2. Gradient brand panel, floating white form card
   - Brand panel uses a pink → magenta → violet gradient with a wordmark,
     tagline and short feature bullets; the form sits in a white card with
     soft shadow and rounded corners.
   - Source: Aceternity UI "Login Form With Gradient" (gradient column +
     form column, labelled inputs, sign-up link below the form).
3. Brand colour carried into the primary action
   - The primary button and link accents use the brand pink, not a neutral
     grey, so the page reads as one product (cf. Asana's coral/pink button
     and link accents in the SaaS Boat round-up).
   - Source: SaaS Boat / Medium "SaaS Login Page Design: 35 Examples".
4. Password show/hide toggle + inline, honest error states
   - Eye/EyeOff toggle on the password field; errors shown in a red alert
     box with `role="alert"` plus the existing honest DemoNote text
     ("no real login happened" / "no account was created") — never a fake
     success. This matches the Eleken/OptiFlow note: inline hints right
     above/near the fields when something goes wrong.
5. Mobile = centred card, panel collapses
   - Below the desktop breakpoint the brand panel becomes a compact header
     strip (wordmark + tagline only, no bullets) and the form card is
     centred with full-width inputs — no horizontal overflow at 360px.
     This is the "Centered Card" fallback pattern from the WooCommerce
     login-template round-up (Visser Labs): single card, no promo panel,
     when space is tight.
6. Cross-links, not tabs
   - Login ↔ Register are separate pages linked to each other (keeps the
     existing routes and submit logic intact) rather than a tab switcher;
     a "Need help?" link points to `/support` (built by Workstream 2).

## Communica application

- Brand panel bullets (Lucide icons only, no emoji): Chats (MessageCircle),
  Audio & video calls (PhoneCall), SAZMU AI — labelled "AI" (Sparkles).
- Fonts: existing bundled Noto Sans Bengali via `layout.tsx` / `--font-sans`
  is reused; no new font download.
- Contrast: white text on the deep pink/magenta gradient; body text
  #111B21 on white; error text #991B1B on #FDF2F8 with a #F9A8D4 border.
- Files: `src/app/login/page.tsx`, `src/app/register/page.tsx`,
  `src/components/auth-brand.tsx` (shared panel), `src/app/globals.css`
  (scoped `.auth-*` classes + `.btn-pink` only; no other page styles changed).
