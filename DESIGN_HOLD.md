# Communica Design Hold — DO NOT FINALISE STYLING YET

Status: HOLD on final visual styling, by user instruction.

## What this means
- The user has asked for MULTIPLE premium design directions (researched from Pinterest/Behance-style inspirations) to choose from FIRST.
- Design options are being prepared separately. The user will pick one.
- Until that pick is made, NO worker may finalise the Next.js UI styling.

## What keeps building (unaffected)
- Structure, pages, routes, and navigation.
- API routes, auth (custom JWT+bcrypt), DB wiring.
- Own-WebRTC calling logic (signalling + media, with the call-quality requirements).
- Functionality, validation, error handling, QA of function (not final visuals).

## What must stay flexible
- Final palette (colours), icon set details, and typography must NOT be locked in as final.
- Keep styling in central theme tokens (CSS variables in globals.css / a theme file), not hard-coded colours/fonts scattered across components, so the chosen direction can be applied afterwards WITHOUT rework.
- The current WhatsApp-like look from Step 2 (greens, Lucide icons, system fonts) is a WORKING PLACEHOLDER for structure/QA of function — it is NOT the final design, and must not be presented as final.
- Do NOT run a final design QA pass (palette/icon/font realism as final) until the user picks a direction. Step 5 QA must split: functional QA now, design QA after the pick.

## When the pick arrives
- Apply ONLY the chosen direction's palette/icons/typography via the theme tokens.
- Re-run design QA (screen by screen, per DESIGN_REQUIREMENTS.md as updated by the chosen direction) and record it in next-app/QA_REPORT.md.
- Only then may styling be called final.

## Still in force (not overridden by this hold)
- Communica's own name/logo only — no WhatsApp trademarked logo, brand name, or brand assets, in any direction.
- SAZMU AI always labelled AI, never a real human.
- No emoji as UI icons in the final UI (the chosen direction must still use a proper vector icon library).
- Responsive two-mode layout (desktop two-pane / mobile single-pane) and real PWA requirements are structural, not styling — they stay.
- Call-quality requirements stay.
