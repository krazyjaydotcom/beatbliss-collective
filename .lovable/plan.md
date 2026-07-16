## Goal

Make the beat landing page fit entirely above the fold on both desktop and mobile, and let visitors read the full license terms in a modal instead of navigating to `/license-example`.

## Changes (only `src/routes/beats.$slug.tsx`)

### 1. Fit above the fold

Reduce vertical footprint so the header, title, video, primary CTA, secondary CTAs, and payment row all fit in a single viewport at ~800px desktop height and standard mobile heights.

- **Title block**: shrink from `text-4xl sm:text-6xl md:text-7xl` to `text-3xl sm:text-4xl md:text-5xl`; drop the pills row (genre/mood already appear in the meta line under the title); reduce top padding.
- **Video**: switch from `aspect-video` (16:9) to a shorter `aspect-[21/9]` on desktop and `aspect-video` capped by `max-h-[38vh]` on mobile so the frame never dominates.
- **License CTA card**: tighten padding (`p-4 sm:p-5`), shrink price to `text-3xl sm:text-4xl`, collapse the 4-item bullet list into a single compact line of comma-separated benefits ("Unlimited MP3 · Unlimited songs · Streams & sales · Keep 100% royalties").
- **Secondary CTAs**: convert from stacked cards to a two-column compact row on mobile as well (smaller icon circle `h-9 w-9`, single-line labels, `py-2.5`).
- **Trust row + payment methods**: merge into one line — 4 tiny trust chips + payment badges on the same flex-wrap row; remove the standalone "View full license terms" text link (replaced by button on the CTA card, see #2).
- **Posted-at + discount pill**: keep, but as inline text next to the title meta line instead of separate stacked rows.
- **Main container**: reduce `pb-[140px]` (space for sticky player) to `pb-[96px]` and shrink the sticky player's own height (smaller padding, hide the mini-waveform on mobile) so the fold gains ~40px back.
- **Attachments and SEO description** stay below the fold (intentional — they're supplemental).

### 2. License terms in a modal

- Add a new `LicenseTermsModal` component inside the same file. Content mirrors the copy currently on `/_authenticated/license-example` (intro paragraph, Writer & Publishing Credits box with Jason A. Spencer / March 26th Publishing / ASCAP, resale restrictions). No fetch needed — copy is static.
- Add state `licenseOpen` in `BeatLandingPage`.
- Replace both existing links to `/license-example`:
  - The desktop nav "Licensing Info" link → button that opens the modal.
  - The "View full license terms" underline link → a small "View License Terms" text button placed inside the blue License CTA card (under the benefits line), opening the modal.
- Keep the standalone `/license-example` route file untouched (still reachable from `/account` etc.).

## Verification

- Build passes (`bun run build:dev`).
- Manually resize preview to 1280×800 desktop and 390×844 mobile; confirm the purchase button, secondary CTAs, and payment row are visible without scrolling.
- Click "View License Terms" → modal opens with the full agreement text; Escape / backdrop closes it.

## Not changing

- Sticky bottom player logic, checkout flow, download flow, inquiry flow.
- Email system, server functions, database, other routes.
- The `/license-example` route itself.
