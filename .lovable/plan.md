## Scope
Add a "Copy share link" button next to each beat in the admin beats list so you can grab a home-page share URL in one click and paste it into any email tool.

## What gets changed
- `src/routes/_authenticated/admin/beats.tsx`
  - Add a button in each beat row (next to the existing "Copy buy link" button) that copies `https://<host>/?b=<beat-uuid>` to clipboard via `navigator.clipboard`.
  - Toast confirmation on copy success.
  - Reuses existing `Copy` icon + ghost button pattern already in the file.

## What does NOT change
- Home page, sticky player, offer modal, attribution tracking, queue logic — already working.
- No new routes, tables, or backend code.
- No email-sending infrastructure added; you keep using your existing email tool (Brevo, Gmail, etc.).

## Result
You open admin beats, click the copy button on any beat, paste into your email, and recipients land on the home page with that beat auto-loaded and your offer visible.