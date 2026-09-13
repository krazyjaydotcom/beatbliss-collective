# Beat Link Visibility Fix

## What will change
- Add three landing-page visibility choices:
  - **Public** — the direct link opens and the beat may appear in public lookups.
  - **Unlisted** — the direct link opens, but the beat is excluded from public lookup/discovery.
  - **Private** — the direct link returns the existing “Beat not found” screen.
- Keep catalog/member availability separate, so changing a landing-page link does not alter existing member access.
- Generate a unique URL slug automatically whenever Public or Unlisted is selected and one is missing.

## Admin controls
- Replace the current Live/Draft wording with clear Public/Unlisted/Private status controls.
- Add bulk actions for all three choices from the selected-beats action bar.
- Keep per-beat editing available and show/copy links for both Public and Unlisted pages.
- Explain each visibility choice briefly beside the control.

## Data safety
- Add one non-destructive visibility field to existing beats.
- Preserve current behavior by converting existing published pages to Public and existing unpublished pages to Private.
- Do not change audio, purchases, memberships, checkout, or existing URLs.

## Validation
- Confirm the reported Crawlin record can receive a generated slug and open when Public or Unlisted.
- Confirm Private links return the not-found screen.
- Confirm Unlisted beats are omitted from the public beat lookup endpoint while Public beats remain discoverable.
- Run type checks and test desktop/mobile admin controls plus direct public links.

## Technical details
- Add a constrained `landing_visibility` field with values `public`, `unlisted`, and `private`.
- Update the public beat loader, public beat lookup, admin list/update functions, and bulk visibility action.
- Preserve the existing `is_active` catalog guard; inactive catalog records remain unavailable even if their landing visibility was previously public.
