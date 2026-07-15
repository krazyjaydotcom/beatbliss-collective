## Scope

### 1. Beat landing page (`src/routes/beats.$slug.tsx`)
- **Mobile compactness**: tighten vertical spacing (reduce `mt-*`/`py-*`), snug header, remove extra bottom padding on `<main>`, denser button grid.
- **Video "posted" timestamp**: show `Posted {relative time} · {date}` under the video (uses existing `beat_landing_videos.recorded_at` or falls back to a new `custom_video_recorded_at` on the beat row).
- **Attachments section**: below the video, render a list of downloadable files (name + size + download button) when the beat has any.
- **Color pass**:
  - All orange accents → blue (`bg-blue-50`, `border-blue-400`, `text-blue-600`, etc.).
  - All purple accents → blue.
  - "by KRAZYJAYDOTCOM" tagline → `text-black`.
  - Player theme (orange → blue).
- **Rename** "Lease Beat" → "Unlimited License (MP3)".
- **Buy button**: add `ShoppingBag` icon.
- **Fade-in animation** on every modal (`animate-fade-in` on the panel; existing keyframe already available).

### 2. Lease modal → Unlimited License modal
- CTA "Continue to Checkout" turns blue (`bg-blue-600`), includes `ShoppingBag` icon.
- Remove "new customer only" text; replace with:
  > "Purchasing unlimited rights gives you full permission to monetize the song you create with this instrumental."

### 3. Exclusive/Custom Inquiry popup
- New table `beat_landing_inquiry_questions` (id, label, field_type, required, sort_order, active).
- New table `beat_landing_inquiries` (id, name, email, beat_id, answers jsonb, created_at).
- Server functions: `listInquiryQuestions` (public), `submitBeatInquiry` (public — validates + inserts + queues email to `jason@krazyjay.com`).
- Modal replaces the old `<a href={application_url}>` on the beat landing page.
- Admin editor at `/admin/beat-landing` → new "Exclusive Inquiry Questions" section: add/edit/reorder/delete questions.

### 4. Purchase email polish (`src/lib/beat-landing-email.server.ts`)
- Buyer email attaches / links the **Unlimited License Agreement** rendered from the existing template in `src/routes/_authenticated/license-example.tsx` (extract shared text into `src/lib/unlimited-license-text.ts`; generate PDF via existing `agreement-pdf.ts` and upload to storage; email includes signed link).
- Admin sale notification to `jason@krazyjay.com` (already wired — verify subject/body).

### 5. Admin beat landing (`src/routes/_authenticated/admin/beat-landing.tsx`)
- **Copy-link button** next to each beat row (copies `https://mybeatcatalog.com/beats/{slug}` to clipboard).
- **Attachments manager** per beat: upload PDF/DOC/etc. to `beat-attachments` storage bucket; list with delete.
- **Video recorded date** field on each beat (or falls back to `created_at`).
- **Email test panel**: input for recipient + buttons: "Test free-download email", "Test purchase-buyer email", "Test admin sale notification", "Test exclusive inquiry". Each calls a server function that sends the real template.

### 6. Schema changes (single migration)
```sql
-- inquiry questions
create table public.beat_landing_inquiry_questions (...);
create table public.beat_landing_inquiries (...);
-- attachments
create table public.beat_landing_attachments (id, beat_id, storage_path, filename, mime, size_bytes, sort_order);
-- optional custom recorded date
alter table public.beats add column if not exists custom_video_recorded_at timestamptz;
-- storage bucket 'beat-attachments' (public, read-only via signed URLs)
```
Includes GRANTs for `anon` SELECT on questions/attachments, `authenticated` full on inquiries via has_role admin, and `service_role` all.

### 7. Not touched (safety)
- Member signup/subscription, homepage, existing checkout, webhook signature verification, member downloads, `process_beat_download`, `beats` core fields.

## Technical notes
- Modal fade-in uses existing `animate-fade-in` keyframe from tailwind config.
- Copy-link uses `navigator.clipboard.writeText`.
- Test-email server function reuses existing `enqueue_email` + templates but forces recipient override; gated by `requireSupabaseAuth` + `has_role admin`.
- Attachments served via same-origin route `/api/public/beat-attachment?id=...` that streams from storage with proper `Content-Disposition`.

## Deliverables
Migrations + ~8 file edits + 3 new files. Build verified.
