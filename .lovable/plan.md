## Goal

Differentiate license tiers based on subscription, add audio-tagged previews for free users with a 3-download limit, and add a whitelist submission section for paying members.

## 1. License tiers

Drive license type from the user's `subscription_tier` at download time:

- `none` (free) → **Standard Membership License**
  - Only `tagged` (watermarked) MP3 file
  - Max **3 lifetime downloads**
  - Non-monetizable, demo/social use only
- `artist` / `label` (paid, active) → **Unlimited Membership License**
  - Untagged MP3 or WAV
  - No download cap (still spends credits as today)
  - Monetization rights granted

The `process_beat_download` RPC is updated to:
- Read the caller's tier from `profiles`
- Block free users from non-tagged files and from a 4th download (count from `downloads` table)
- Set `license_type` and a tier-appropriate `agreement_text` accordingly
- Return the correct `audio_url` (tagged vs clean)

## 2. Audio-tagged catalog

Add a watermarked variant alongside the existing files:

- New column `beats.audio_url_tagged` (nullable text)
- Admin upload flow gets a third slot: drop a "tagged" MP3 (filename containing `tag`/`tagged` auto-pairs, otherwise a per-row picker in the bulk uploader)
- Existing beats without a tagged file can still be downloaded by paid users; free users see a "preview only" lock until a tagged version exists
- Admin bulk editor gets a "Replace tagged audio" action

This matches the old "audio tag" concept (your producer tag on the watermarked version).

## 3. Whitelist submissions (paid only)

New table `whitelist_submissions`:
- `user_id`, `beat_id` (which beat of yours was used), `track_title`, `artist_name`, `streaming_url` (Spotify/Apple/SoundCloud/YouTube), `release_date`, `notes`, `status` (`pending` / `approved` / `rejected`), `admin_notes`, timestamps
- RLS: paid users insert/select their own; admins see all and update status

UI:
- New page `/_authenticated/account/whitelist` — list of the user's submissions + a "Submit a track" form, gated by `subscription_tier !== 'none'`. Free users see an upgrade card.
- Sidebar/account nav entry "Whitelist"
- New admin page `/admin/whitelist` to review and approve/reject

## 4. UX hooks

- Beats grid: free users see a "Free preview (tagged)" badge and the download button shows remaining free credits "X of 3 left" and disables when none remain or the beat has no tagged file
- Account page: shows current license tier and entitlements
- Agreement PDF already pulls `license_type` from the row, so it updates automatically

## Out of scope this round

- Re-encoding existing beats with a producer tag (you'll upload tagged files going forward; I'll add a one-click "needs tagged" filter in admin so you can backfill)
- Automated whitelist verification — it stays manual review
- Any change to checkout, pricing, or subscription detection logic

## Technical notes

- Schema: `ALTER TABLE beats ADD COLUMN audio_url_tagged text;`
- New `whitelist_submissions` table + RLS using `has_role` and `auth.uid() = user_id`; insert policy adds `EXISTS` check on `profiles.subscription_tier <> 'none'`
- `process_beat_download(_beat_id, _file_type)` rewritten to:
  - Look up `subscription_tier`
  - If `none`: enforce `count(downloads where user_id) < 3`, force `_file_type = 'MP3'`, require `audio_url_tagged IS NOT NULL`, set license to Standard, return `audio_url_tagged`
  - Else: existing path, license = "Unlimited Membership License", return `audio_url` or `audio_url_wav`
- Admin bulk uploader (`src/routes/_authenticated/admin/beats.tsx`) extended to detect `*tag*` files and write to `audio_url_tagged`
- New routes:
  - `src/routes/_authenticated/account.whitelist.tsx`
  - `src/routes/_authenticated/admin/whitelist.tsx`
- Admin sidebar (`admin.tsx`) gets a "Whitelist" nav item
