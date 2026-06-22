## The strategy

Right now `/your-beat-slug` is a beat player with a hero pitch and a small "Join catalog" button in the corner of the bottom player. Visitors hear the beat, may hit the 3-preview limit, and only then see the offer modal. For 21 emails/week, that's leaving conversions on the table.

The page needs to do three things in this order, on every visit:

1. **Confirm they're in the right place** — the beat they came for plays immediately.
2. **Make the $49.99/mo offer impossible to miss** — price, what they get, and why now.
3. **Repeat the ask** every time their attention shifts (after a preview, when they scroll, when they try to leave).

Below is a recommended structure plus an implementation plan you can approve to build.

---

## Recommended page structure (top to bottom)

```text
┌─────────────────────────────────────────────────────────┐
│ 1. STICKY OFFER BAR (top)                               │
│    "🔥 Get unlimited beats — $49.99/mo · Join now →"    │
├─────────────────────────────────────────────────────────┤
│ 2. HERO — split layout                                  │
│    LEFT: "Your beat is playing 👇" + headline + price   │
│          + big "Get Full Access — $49.99/mo" button     │
│          + 3 bullet benefits + trust line               │
│    RIGHT: Now-playing card (the beat from the email)    │
├─────────────────────────────────────────────────────────┤
│ 3. WHAT YOU GET (3-up icons)                            │
│    Unlimited downloads · New beats weekly · Direct DM   │
├─────────────────────────────────────────────────────────┤
│ 4. SOCIAL PROOF                                         │
│    "Trusted by X artists" + testimonials + logos        │
├─────────────────────────────────────────────────────────┤
│ 5. PRICING CARD                                         │
│    $49.99/mo · what's included · big Apply button       │
│    Anchor: "less than one custom beat"                  │
├─────────────────────────────────────────────────────────┤
│ 6. MORE BEATS PREVIEW (the gallery you already have)    │
├─────────────────────────────────────────────────────────┤
│ 7. FAQ (handles objections — cancel anytime, licensing) │
├─────────────────────────────────────────────────────────┤
│ 8. FINAL CTA BLOCK                                      │
├─────────────────────────────────────────────────────────┤
│ 9. FOOTER                                               │
└─────────────────────────────────────────────────────────┘
+ SLIM PERSISTENT PLAYER at the very bottom (already exists)
+ EXIT-INTENT MODAL on desktop when leaving the page
+ "Free previews left: X/3" badge that turns red at 1 left
```

### Why this order

- **Sticky bar + hero price**: the #1 lift in landing-page testing is putting the price and primary CTA above the fold. Don't make them scroll to learn what you're selling.
- **"Your beat is playing"** framing matches the email expectation, then immediately pivots to "…and there are 100s more."
- **Social proof before pricing** — proof must come before the ask.
- **Pricing card**: dedicated block so the offer is its own moment, not a footnote.
- **FAQ**: kills the top objections that block subscriptions (cancellation, licensing, refund).
- **Exit intent + preview-limit modal**: catches the people who would have bounced.

---

## Conversion mechanics to add

These are the small details that move the number:

- **Price anchoring**: show "$49.99/mo · less than one custom beat" everywhere the price appears.
- **Urgency without lying**: "New beats added every week" or "Cohort closes Sunday" if true. Avoid fake countdowns.
- **Scarcity copy**: "Private membership" / "Application required" — you already do this, keep it.
- **Risk reversal**: "Cancel anytime" pill next to the price kills the #1 objection.
- **Single primary CTA color** (your `--primary`) used ONLY for "Apply For Access / Get Full Access". Secondary actions get outline.
- **Stronger post-preview modal**: after the 3rd preview, replace the small "dozens more" copy with a full-screen sheet showing price, 3 benefits, testimonial, and the CTA — this is your highest-intent moment.
- **UTM-aware tracking**: log which email/beat drove the click so you can see what converts. (Beat ID is already in the URL — we add tracking to checkout starts.)
- **Auto-scroll cue**: small bouncing arrow under the hero so visitors discover the offer below.

---

## Email side (so 21/week stays effective)

Not code, but worth saying since you asked:
- Each email = one beat link to `mybeatcatalog.com/<beat-slug>` (already built).
- Rotate the beat — never repeat in the same week.
- Subject line = beat title or mood ("Dark Tower just dropped" / "For when the verse hits different").
- Body: 1 line + the link. The page does the selling, not the email.
- Track which beats convert best in the new "Access Applications" admin view and lean into those moods.

---

## Implementation plan

Build it in 3 phases so you can ship the high-impact pieces first.

### Phase 1 — High-impact above-the-fold (biggest conversion lift)
1. **Sticky offer bar** component at the top of `/` and `/$slug` with price + CTA.
2. **Rewrite `Hero`** to be conversion-first:
   - Headline: "Unlimited Beats. One Catalog. $49.99/mo."
   - Sub: "Your beat is playing below. Apply now to unlock the full library."
   - Price + "Get Full Access" primary CTA + "Cancel anytime" pill.
   - 3 bullet benefits with icons.
3. **Strengthen the bottom player CTA**: make "Join catalog" full-width on mobile and always visible (it's currently `md:flex` only).

### Phase 2 — Proof + pricing + objections
4. **`<WhatYouGet />`** 3-icon strip (Unlimited downloads · Weekly drops · Direct DM with KrazyJay).
5. **`<SocialProof />`** with a testimonials carousel — admin-managed in a new `testimonials` table so you can add them from `/admin`.
6. **`<PricingCard />`** standalone section with the $49.99/mo offer card.
7. **`<FAQ />`** accordion answering: What do I get? Can I cancel? Can I monetize songs? What if I'm not happy?
8. **Upgrade the `JoinCatalogModal`** that fires after 3 previews — bigger, price front-and-center, one testimonial, one CTA.

### Phase 3 — Catch-the-bouncer + measurement
9. **Exit-intent modal** on desktop (mouse-leave to top of viewport).
10. **Final CTA block** above the footer.
11. **Conversion tracking**: add a `funnel_events` table that logs `page_view`, `preview_played`, `limit_hit`, `apply_clicked`, `checkout_started` keyed by `beat_id` so you can see in `/admin` which beats drive sign-ups.
12. **Admin "Offer Page" editor** so you can A/B test headline, price copy, and CTA wording without code.

---

## Technical details

- All new sections live in `src/components/funnel/` and are composed into `src/routes/$slug.tsx` and `src/routes/index.tsx` (same layout for both).
- `StickyOfferBar` and the upgraded `HomeFunnelPlayer` CTA share one shared "Apply For Access" handler that opens `AccessApplicationModal` (already wired).
- New `testimonials` table: `id, name, role, quote, avatar_url, sort_order, is_active` with admin-only RLS write and public anon read.
- New `funnel_events` table: `id, event, beat_id, session_id, created_at, meta jsonb` with anon insert and admin-only read.
- Settings (headline, sub, price string, CTA text, FAQ items) stored in the existing `homepage_settings` table so you can edit copy without redeploying.
- Pricing card "Apply" button reuses the existing `AccessApplicationModal` flow — no checkout changes needed in this scope. (We can wire it straight to Stripe checkout in a follow-up if you want.)
- Sticky bar respects the existing site nav and hides itself when the bottom player modal is open.

---

## What I'd ask before building

1. Do you want **Phase 1 only** for a fast win, or all 3 phases together?
2. Should the primary CTA send people straight to **Stripe checkout** for $49.99/mo, or keep the **"Apply For Access" application flow** that's there today?
3. Do you have **2–4 testimonials** I can use, or should we ship the section with placeholders you swap from `/admin` later?
