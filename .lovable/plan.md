## Goal
Remove the pricing section from the public landing pages, and keep `/` (home) and `/$slug` (beat-share pages) visually identical — the only difference being the floating beat player on `/$slug`.

## Changes

**`src/routes/index.tsx`**
- Remove `<PricingCard onApplyForAccess={open} />` from the main section.
- Remove the now-unused `PricingCard` import.

**`src/routes/$slug.tsx`**
- Remove `<PricingCard onApplyForAccess={open} />` from the main section.
- Remove the now-unused `PricingCard` import.
- Keep `<HomeFunnelPlayer beatId={beatId} … />` (this is the one intentional difference vs. `/`).

Resulting section order on both routes:
`StickyOfferBar → SiteNav → Hero → WhatYouGet → HomeGallerySection → FaqSection → SiteFooter` (+ `HomeFunnelPlayer` on `/$slug`).

## Not changing
- `src/components/funnel/pricing-card.tsx` stays in the repo (unused) in case you want to drop it back in later. Say the word if you want it deleted.
- `src/components/pricing.tsx` (the older pricing block) is already not referenced from these routes — leaving it alone.
- The FAQ still references the $49.99/mo offer, and the sticky bar still shows the price + "Get Access" CTA, which keeps the conversion path intact without a full pricing card on the page.