# 2026-02-24 - Frontend Font Refresh (Sora + DM Sans)

## Task Summary

Updated landing, login, and signup typography to a new font pairing for cleaner readability and a more polished look.

New font stack:
- Heading/brand: `Sora`
- Body text: `DM Sans`

## Files Edited

- `frontend/index.html`
- `frontend/pages/login.html`
- `frontend/pages/signup.html`
- `frontend/assets/css/base.css`
- `frontend/assets/css/landing.css`
- `frontend/assets/css/auth.css`

## Endpoints Added/Changed

None.

## DB Schema / Migration Changes

None.

## Decisions / Tradeoffs

- Kept all HTML structure and auth hooks unchanged; this is styling-only.
- Applied the new Google Fonts import consistently across all three pages to avoid mixed typography.
- Updated only the relevant heading/body `font-family` declarations to minimize risk of unintended layout regressions.
