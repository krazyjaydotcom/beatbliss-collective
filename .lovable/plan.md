# YouTube-ready compact purchase flow

## Purchase drawer
- Rework beat details into a full-height flex drawer with compact beat identity and controls, independently scrollable license/detail content, and a nonshrinking purchase footer.
- Keep all three license choices, the selected license’s essential restriction or delivery summary, and Buy Now visible on initial open at 360×640, 390×844, and desktop.
- Place Add to cart beside Buy Now, keep Save and Share compact, and move full terms and expanded license details into the scrollable region.
- Transition the same drawer to embedded checkout while preserving the existing payment integration and Back to licensing behavior.

## YouTube sharing
- Expand Share into a compact panel while preserving ordinary device sharing.
- Add a production-domain YouTube purchase link containing the exact beat, automatic-play request, purchase-drawer state, and required campaign parameters.
- Add an optional Short ID field for `utm_content`, copyable CTA text, and a concise note about links in Shorts descriptions/comments.
- Keep a visible Play preview fallback when browser autoplay is blocked.

## Funnel reporting
- Add a privacy-minimal funnel event record for attributed landing, successful preview playback, license selection, Buy Now, checkout start, and server-confirmed paid purchase.
- Carry campaign, beat, license, and optional Short ID into Stripe metadata; deduplicate paid events by the verified checkout session ID.
- Add a compact, admin-only campaign/beat/Short ID report to the existing Plays & Ads page.

## Validation
- Verify the build and cold production-style links without publishing.
- Test ordinary sharing, YouTube link/CTA copying, autoplay fallback, all three license selections, expandable details, and pinned purchase actions at 360×640, 390×844, short landscape, enlarged text, and desktop.
- Open embedded checkout only far enough to verify session startup; do not submit payment.
