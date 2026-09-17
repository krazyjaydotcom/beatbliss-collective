# Ad-supported listening for guests

## My honest take

It's a good idea, with one condition: keep it light. The store is already open to
visitors, so nothing is being taken away — you're adding a reason to sign up.
Artists are used to this from Spotify and YouTube. What turns people off is an
unskippable interruption early in a session. Since you chose skippable ads with a
sign-up button, the risk is low: most people skip in 2 seconds, the ones who care
read the offer, and the message still lands every time.

One adjustment I'd suggest: don't fire the first ad until someone has actually
settled in. Let a visitor hear their first 5 beats clean, then start the cycle.
First impressions of the catalog matter more than the first ad impression.

## What gets built

### Guest listening meter
A counter that runs only for signed-out visitors, kept in the browser for the
session:
- counts beats started and seconds of audio actually played
- when either 5 beats or 10 minutes is reached (whichever comes first), the next
  play triggers an ad
- after the ad, both counters reset and normal playback resumes with the beat
  they asked for
- signed-in visitors never see any of it — no counter, no ad, no delay

### The ad itself
A full-screen overlay over the store:
- audio ads show the cover image you upload plus the ad title
- video ads play the video
- "Skip" is available from the first second
- a clear "Sign up free — no ads" button next to it, going to the existing sign-up
- Escape closes it, same as skipping
- the beat the visitor clicked starts as soon as the ad ends or is skipped
- the store's own audio is paused during the ad, never two sounds at once

### Admin: Marketing > Commercials
A new admin page to manage the ad list:
- add an ad with a title, audio or video file, optional cover image, optional
  click-through link and button text
- turn each ad on/off, reorder them
- they rotate in order per visitor, so everyone doesn't hear the same spot
- a preview button so you can watch/hear it before enabling
- a simple counter of how many times each ad was shown and skipped

## Technical notes

- New table `ad_spots` (title, media_url, media_type audio|video, cover_url,
  cta_label, cta_url, is_active, sort_order, impressions, skips) with admin-only
  write policies and a narrow public read of active rows only.
- New table or column-free counters: impressions/skips incremented through a
  security-definer function callable by anon, so no write access is exposed.
- Media uploads go to a new public storage bucket `ad-media`.
- Listening meter lives in `player-provider.tsx` (session storage, guest only);
  ad gate rendered above the player so it survives route changes.
- Rotation index stored per browser so ads cycle in your chosen order.
- Nothing about pricing, licensing, private/unlisted rules, member features or
  existing audio behaviour changes.

## Limits

- Counters are per browser, so clearing storage restarts the cycle. That's the
  normal trade-off for not requiring an account.
- Ad playback stats are simple impression/skip counts, not third-party ad
  analytics.
