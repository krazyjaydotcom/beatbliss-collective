# Add Trackout/STEMS license tier

Make the storefront offer four license options: **Non-Exclusive MP3**, **Unlimited License (WAV+MP3)**, **Trackout/STEMS Access**, and **Exclusive Rights**.

## What will change

1. **Database**
   - Add `trackout_price_cents` to `public.beats` so each beat can set its own trackout price.
   - Add `license_tier` to `public.lease_orders` so purchases record which tier was bought.
   - Include the required `GRANT`s and keep existing RLS.

2. **License engine (`src/lib/licensing.ts`)**
   - Add `"trackout"` to `LicenseTier`.
   - Add metadata label "Trackout/STEMS Access" with appropriate blurb and bullets.
   - Update `tierPriceCents`, `TIER_ORDER`, and `isLicenseTier`.

3. **Storefront data**
   - `src/lib/store.functions.ts`: expose `trackoutPriceCents` on `StoreBeat` and select the new column.
   - `src/components/store/cart-provider.tsx`: types already flow through `LicenseTier`; no logic change needed.

4. **Checkout (`src/lib/cart.functions.ts`)**
   - Accept `"trackout"` in the input validator.
   - Resolve trackout price from `trackout_price_cents`.

5. **License panel (`src/components/store/license-panel.tsx`)**
   - The tier list already renders from `TIER_ORDER`/`TIER_META`, so the new option appears automatically.
   - Keep the existing inquiry-only behavior: when no price is set, the tier shows "Inquire".

6. **Admin beat landing (`src/routes/_authenticated/admin/beat-landing.tsx` and `src/lib/beat-landing.functions.ts`)**
   - Add a "Trackout price (cents)" input in the beat edit dialog.
   - Include `trackout_price_cents` in the server function selects and validator.

7. **Payment webhook (`src/routes/api/public/payments/webhook.ts`)**
   - Record `license_tier` on reconciled `lease_orders` rows for cart and single-beat purchases.

8. **Supabase generated types**
   - Add the two new columns to `src/integrations/supabase/types.ts`.

9. **Verification**
   - Run typecheck and build.
   - Spot-check the license panel on mobile/desktop to confirm all four options render and the Trackout tier respects the configured price.
