ALTER TABLE public.beats
  ADD COLUMN IF NOT EXISTS trackout_price_cents integer;

ALTER TABLE public.lease_orders
  ADD COLUMN IF NOT EXISTS license_tier text;
