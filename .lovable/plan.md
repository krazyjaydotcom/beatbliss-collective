# SEO Beat Discovery System

A scalable tag-driven SEO landing page system. Each page targets one keyword, renders editor-managed copy, pulls active beats by tag, and reuses the existing claim modal flow.

## What gets built

### 1. Database (Supabase migration)

New tables (all RLS: public read where active/published, admins manage):

- **`beat_tags`** — master tag list
  - `slug` (text, unique), `label` (text), `created_at`
- **`beat_tag_assignments`** — many-to-many
  - `beat_id` (uuid), `tag_slug` (text), unique(beat_id, tag_slug)
- **`seo_pages`** — landing page configs
  - `slug` (text, unique), `target_keyword`, `seo_title`, `meta_description`, `h1`, `intro`, `sections` (jsonb array of `{heading, body}`), `tag_slugs` (text[]), `related_page_slugs` (text[]), `is_published` (bool), `sort_order` (int), `featured` (bool), timestamps
- **`beats`** add columns: `is_active` (bool default true), `is_featured` (bool default false)

Seed the 10 tag rows + 10 SEO pages with copy.

Helper RPC `list_beats_by_tags(_slugs text[])` returns active beats matching ANY of the tags, ordered featured→created_at.

### 2. Public routes

- **`/beats/$slug`** (`src/routes/beats.$slug.tsx`)
  - Loader fetches `seo_pages` row + matching beats via RPC
  - `head()` sets seo_title, meta_description, og tags, canonical
  - Renders: H1, intro, dynamic beat grid, body sections, related pages internal links, empty state when no beats
  - Reuses styling from `beat-claim.tsx` (dark theme, blue CTA, mini wave)

### 3. Shared claim modal

Extract the existing modal from `src/routes/beat-claim.tsx` into `src/components/beat-claim-modal.tsx` (props: `beat`, `open`, `onClose`, `source`). Both `beat-claim` route and new SEO pages import it. Calls the same `/api/public/beat-claim` endpoint → routes to `/offer/$token`.

### 4. Admin

New page `src/routes/_authenticated/admin/seo-pages.tsx` — list/create/edit SEO pages (slug, keyword, title, meta, H1, intro, sections JSON, tag slugs, related slugs, published, featured, sort).

Update existing `src/routes/_authenticated/admin/beats.tsx` to add: tag multi-select (from `beat_tags`), active toggle, featured toggle.

New `src/routes/_authenticated/admin/tags.tsx` — manage `beat_tags`.

Admin nav gets two new links.

### 5. Seed pages

Cinematic R&B, Emotional Trap, Night Drive, Dark Cinematic, Late Night R&B, Cyberpunk, Ambient Trap, Emotional Background Music, Dark Trap Soul, Moody R&B — each with 700–1000 words across intro + 4 sections + tag mapping per spec.

## Technical notes

- `list_claimable_beats()` already filters by audio availability — new RPC will additionally require `is_active = true` and intersect with `beat_tag_assignments`.
- SEO route uses `createFileRoute("/beats/$slug")` loader pattern with `head({loaderData})` for per-page meta.
- Canonical host: `https://mybeatcatalog.com`.
- All copy stored in DB so future pages need no code changes.

## Out of scope

- No new payment/claim backend logic — reuses existing `claimBeatAndSendFox` flow.
- Doesn't modify offer page, existing admin beats CRUD beyond adding tag/active/featured fields, or auth.

## Files touched

- new: migration, `src/routes/beats.$slug.tsx`, `src/components/beat-claim-modal.tsx`, `src/routes/_authenticated/admin/seo-pages.tsx`, `src/routes/_authenticated/admin/tags.tsx`
- edited: `src/routes/beat-claim.tsx` (use shared modal), `src/routes/_authenticated/admin/beats.tsx` (tag/active/featured controls), `src/routes/_authenticated/admin.tsx` (nav links)
