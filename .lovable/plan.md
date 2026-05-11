## Beat Funnel — One Page Per Beat

A new flow you control from `/admin/funnels`. You create a funnel for each beat you DM out, share the link, capture the email, deliver the beat, and pitch the catalog with a 12-hour timer.

### 1. Database

Two new tables:

- `beat_funnels` — `slug` (unique, URL-friendly), `title`, `headline`, `video_url` (YouTube/Loom embed), `beat_id` (optional FK to beats) OR `audio_url` + `cover_url` for ad-hoc beats, `download_url` (the file you actually deliver), `is_active`, `created_at`.
- `beat_funnel_leads` — `funnel_id`, `email`, `captured_at`, `forwarded_at` (when the webhook fired). Public INSERT (anyone can opt in); admin-only SELECT.

### 2. Admin: `/admin/funnels`

- Table of all funnels with view counts + lead counts + a "Copy link" button.
- "New funnel" form: slug, title, headline, pick a beat from your catalog (or paste audio URL), download URL, video URL.
- Edit / deactivate.

### 3. Public landing: `/b/$slug`

- Hero with beat title, mini player (uses your existing tagged audio).
- Below that: the embedded video.
- Email capture form: "Enter your email to download the beat free".
- On submit:
  1. Insert into `beat_funnel_leads`.
  2. Fire webhook → your external email tool (ConvertKit/Mailchimp/Zapier).
  3. Redirect to `/b/$slug/offer?e={email}` (also stamps a 12h start time keyed to the email).

### 4. Offer page: `/b/$slug/offer`

- Big "Your beat is on the way to {email}" confirmation + download button (uses funnel's `download_url`).
- Below it, the catalog pitch with a **12-hour countdown timer** keyed off the lead's `captured_at` (server-truth, not just localStorage).
- CTA → `/checkout?plan=artist_monthly_v2` ($37/mo) and `/checkout?plan=artist_yearly` ($599/yr).
- After timer expires, the special offer copy switches to a softer evergreen pitch (still functional, no fake "expired" wall).

### 5. Webhook to your email tool

- New secret: `BEAT_FUNNEL_LEAD_WEBHOOK_URL`. You set it once with your ConvertKit/Mailchimp/Zapier hook URL.
- Server function POSTs JSON: `{ email, funnel_slug, funnel_title, beat_title, captured_at }`.
- Your external tool runs the 7-email sequence — Lovable just hands off the lead. If the secret isn't set, the lead is still captured in the DB; the webhook step is skipped silently.

### Out of scope (ask later)

- Built-in 7-email sequence (you opted to use external).
- Bulk-importing leads into your existing email tool.
- A/B testing variants of the offer page.
- Auto-creating funnels from every beat (you chose manual).

### Files

New:
- migration: `beat_funnels`, `beat_funnel_leads`
- `src/lib/funnels.functions.ts` — public `submitFunnelLead`, admin `createFunnel`/`listFunnels`/`toggleFunnel`
- `src/lib/funnels.server.ts` — webhook forwarder
- `src/routes/b.$slug.tsx` — public landing
- `src/routes/b.$slug.offer.tsx` — upsell with timer
- `src/routes/_authenticated/admin/funnels.tsx`
- `src/components/CountdownTimer.tsx`

Edited:
- `src/routes/_authenticated/admin/index.tsx` — add Funnels tile
- secret added: `BEAT_FUNNEL_LEAD_WEBHOOK_URL`
