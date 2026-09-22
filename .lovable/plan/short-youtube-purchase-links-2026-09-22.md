# Short YouTube purchase links

## Changes
- Generate compact YouTube links in the form `https://mybeatcatalog.com/yt/<beat-slug>`.
- Add an optional `?s=<short-id>` only when a Short ID is entered.
- Resolve the short address into the existing exact-beat autoplay and purchase experience while restoring YouTube campaign attribution.
- Preserve the existing ordinary share link unchanged.

## Validation
- Verify the compact link opens the correct beat, requests playback, opens purchasing, and records the same campaign/Short ID attribution.
- Check the build without publishing.
