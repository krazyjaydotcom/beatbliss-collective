## Why this is a great idea (and how to make it stronger)

Sending a personalized "here's the beat I made you" link is one of the highest-converting funnel patterns in beat sales — the recipient feels singled out, the bar to listen is zero, and the upsell ("there are 100s more like this") is honest.

A few small upgrades to your original idea that make it convert better:

1. **Auto-play the linked beat on arrival.** That's the whole reason they clicked. No "press play" friction.
2. **Show the recipient's "personal" beat visibly at the top of the queue** ("Sent to you →"), so they feel the personal touch even though the rest of the page is generic.
3. **Count plays, not page time.** A "5 listens, then join" rule is concrete and feels fair — much better than a hard timer.
4. **Persist the play count in localStorage** so refreshing the page doesn't reset it (otherwise the gate is meaningless).
5. **Track which beat link drove each signup.** That tells you which beats actually convert, so you know which ones to send next time.

## What gets built

### 1. Sticky bottom player on `/` (home page only)
- Reuses the visual style of the existing beat store player.
- Always visible at the bottom of the home page; rest of the homepage scrolls above it.
- Shows current beat artwork, title, play/pause, progress bar, next/previous, and a small "Queue (5)" list that expands upward.

### 2. Shareable link format: `mybeatcatalog.com/?b=<beat-slug-or-id>`
- When `?b=` is present: that beat loads first, auto-plays, labeled "🎧 Sent to you".
- The next 4 in the queue are the 4 newest claimable beats (excluding the linked one).
- When `?b=` is missing: just the 5 newest beats, no auto-play, no "sent to you" label. So the home page still works normally for organic traffic.

### 3. Play-count gate
- Each time a beat finishes (or the user manually skips after >10s of listening), increment a counter in `localStorage`.
- After 5 plays, the next play attempt opens a modal:
  > **You've heard 5. There are 100s more.**
  > Join the Beat Catalog to unlock the full library — start free, no card required.
  > [ Create Free Account ] [ Already a member? Sign in ]
- Modal cannot be dismissed back into more playback — only by signing up, signing in, or closing (which keeps the player paused).

### 4. Attribution tracking
- When the modal opens (and again on signup), record the `?b=` slug that brought them in.
- Stored on the new user's profile as `signup_source_beat_id` so you can later see "this link → this signup".

## Technical details

**New / changed files:**
- `src/routes/index.tsx` — add sticky player + queue logic; read `?b=` via `validateSearch`.
- `src/components/home-funnel-player.tsx` (new) — the sticky bar UI, audio element, play counter, "sent to you" label.
- `src/components/join-catalog-modal.tsx` (new) — the gate modal with "Create Free Account" CTA pointing at `/signup?b=<slug>`.
- `src/lib/funnel-attribution.ts` (new) — small helpers: read/write play count from `localStorage`, persist `signup_source_beat_id` after auth.
- `src/lib/home-player.functions.ts` (new) — one `createServerFn` that returns `{ featuredBeat, queue }` given an optional `?b=` slug. Uses the publishable-key server client (public-safe) and calls the existing `list_claimable_beats` RPC, then filters/orders.
- `supabase/migrations/<timestamp>_signup_source_beat.sql` — add nullable `signup_source_beat_id uuid` column to `profiles` so we can attribute conversions. No RLS changes needed (the user can already update their own profile).

**Audio source for previews:**
Uses `audio_url_tagged` (the tagged MP3) for all 5 beats — same as the existing public claim flow. No member-only audio is exposed.

**Play count rule (specifics):**
- A "play" counts when: (a) the audio's `ended` event fires, OR (b) the user manually skips/changes track after listening ≥10 seconds. Scrubbing doesn't count.
- Counter key: `mbc_home_plays_v1`. Stored as a small JSON `{ count, beatIds: string[] }` so we don't double-count replays of the same beat.

**What this plan does NOT change:**
- `/beats`, `/beat-claim`, `/beats/$slug`, member features, downloads, credits, Stripe, or any existing modal/flow.
- The existing hero/landing content on `/` stays — the player is added underneath, not in place of it.

## Open follow-ups (small, can do after first pass)
- A "Send a private beat link" copy-link button on `/account` so you can grab `mybeatcatalog.com/?b=<slug>` URLs in one click.
- Optional: track plays + signups in a tiny `beat_link_events` table later, if you want real analytics beyond the per-profile attribution column.
