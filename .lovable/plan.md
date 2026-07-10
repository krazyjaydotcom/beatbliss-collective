## Overview

Build a `/beats/:slug` landing page system matching your mockup, plus admin tools for the global video and first-time-lease discount enforcement. Homepage (`/`) stays untouched.

Note: `/beats/$slug` currently renders SEO/tag pages (`src/routes/beats.$slug.tsx`). I'll move those to `/tags/$slug` so `/beats/$slug` can host the new beat landing page. If you'd rather keep SEO on `/beats/`, tell me and I'll use `/b/$slug` for the new pages (that route also exists today as a redirect stub — I can repurpose it).

## Phase 1 — Data & admin foundations

**DB migrations**
- `beats`: add `slug` (unique), `price_cents` (default 2500), `discount_price_cents` (default 1250), `checkout_url`, `application_url`, `seo_title`, `seo_description`, `custom_video_url` (nullable), `producer_name`, `is_published`.
- New `global_video`: single-row table with `video_url`, `updated_at`. Admin-only write; public read.
- New `lease_orders`: `email`, `beat_id`, `amount_cents`, `used_first_time_discount` (bool), `stripe_session_id`, `created_at`. Unique partial index on `email` where `used_first_time_discount = true` — enforces "one discounted lease per email."
- Reuse existing `beat_claims` table for tagged-download name+email capture (already wired).

**Admin panel (`/admin/beats-landing`)**
- Create/edit beat: slug, title, producer, artwork upload, tagged audio upload, leased audio upload, price, checkout URL, application URL, SEO fields, publish toggle, optional per-beat video.
- Global video manager: upload file OR record via `MediaRecorder` (webcam+mic), preview, publish. Stored in Supabase Storage.
- Views: tagged-download leads (from `beat_claims`), lease orders, applications (already exists).

## Phase 2 — Public `/beats/$slug` page

Layout matching your mockup (white bg, black headings, gray sub, purple/gold accents, rounded cards):

1. Header: `MYBEATCATALOG` / `by KRAZYJAYDOTCOM` + `Need Help?` button (closed by default; opens popover with Instagram / Email / Phone links).
2. Headline + subheadline (static copy from your brief).
3. Discount bar: "50% Off Your First Lease for the Next 20 Minutes" + live countdown. Timer start persisted in `localStorage` per-slug so refresh doesn't reset.
4. Video player: per-beat `custom_video_url` if set, else global video.
5. Slim audio player: artwork, title, producer, play/pause, progress, duration, volume.
6. Three action buttons (desktop L→R: Download / Lease / Apply; mobile stack: Lease / Download / Apply):
   - **Download Tagged Beat** (purple) → modal collects first name + email → writes to `beat_claims` → returns signed URL to tagged file.
   - **Purchase Lease — $25** or **$12.50** if timer active and email hasn't used discount (checked at checkout). Gold/orange, visually dominant. Opens Stripe checkout with correct price; on success writes `lease_orders` with `used_first_time_discount` flag.
   - **Apply to Work Direct With Me** (purple outline) → opens existing `AccessApplicationModal` or `application_url` if set.
7. SEO block: small paragraph under fold using `seo_description`. `head()` sets `seo_title` / `seo_description` / og tags.

**First-time discount enforcement**
- Server fn `checkDiscountEligibility({ email })` — queries `lease_orders` for prior discounted order.
- Checkout server fn picks `discount_price_cents` vs `price_cents` based on eligibility + timer flag from client (re-validated server-side by the persisted timer window? — simplest: trust client timer for price display, but always re-check email eligibility server-side before applying discount).

## Phase 3 — Verification

Playwright script hits `/` (unchanged screenshot diff-ish check), `/beats/<seeded-slug>` (renders, audio loads, buttons present, mobile stack order), admin create flow, and confirms duplicate-discount rejection.

## Out of scope (per your brief)
Email verification, fingerprinting, phone verification, fraud detection, related beats, blog, large nav.

## Open questions before I start

1. **URL conflict**: OK to move existing SEO pages from `/beats/$slug` → `/tags/$slug`? Or should new landing pages live at `/b/$slug`?
2. **Need Help contact details**: what Instagram handle, email address, and phone number should I wire in?
3. **Stripe**: your project already has Stripe payments wired (`payments.functions.ts`, `createCheckoutSession`). I'll create two price IDs (`beat_lease_full` $25, `beat_lease_discount` $12.50) via the payments tool. OK?
4. **Global video storage**: create a public Supabase Storage bucket `global-video` for the recorded/uploaded file. OK?
