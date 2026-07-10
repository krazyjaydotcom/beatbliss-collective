
-- 1. Extend beats with landing-page fields
ALTER TABLE public.beats
  ADD COLUMN IF NOT EXISTS landing_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS discount_price_cents integer NOT NULL DEFAULT 1250,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS application_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS custom_video_url text,
  ADD COLUMN IF NOT EXISTS is_landing_published boolean NOT NULL DEFAULT false;

-- 2. Global video singleton + contact info for Need Help popover
CREATE TABLE IF NOT EXISTS public.global_video (
  id integer PRIMARY KEY DEFAULT 1,
  video_url text,
  contact_instagram text,
  contact_email text,
  contact_phone text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT global_video_singleton CHECK (id = 1)
);

GRANT SELECT ON public.global_video TO anon, authenticated;
GRANT ALL ON public.global_video TO service_role;

ALTER TABLE public.global_video ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global video"
  ON public.global_video FOR SELECT
  USING (true);

CREATE POLICY "Admins manage global video"
  ON public.global_video FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.global_video (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TRIGGER update_global_video_updated_at
  BEFORE UPDATE ON public.global_video
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Lease orders (records lease purchases + enforces one-per-email discount)
CREATE TABLE IF NOT EXISTS public.lease_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  beat_id uuid REFERENCES public.beats(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  used_first_time_discount boolean NOT NULL DEFAULT false,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.lease_orders TO authenticated;
GRANT ALL ON public.lease_orders TO service_role;

ALTER TABLE public.lease_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view lease orders"
  ON public.lease_orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Unique partial index: one discounted lease per email
CREATE UNIQUE INDEX IF NOT EXISTS lease_orders_email_discount_unique
  ON public.lease_orders (lower(email))
  WHERE used_first_time_discount = true;

-- 4. Beat lead captures (name + email for free tagged download)
CREATE TABLE IF NOT EXISTS public.beat_lead_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id uuid REFERENCES public.beats(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.beat_lead_captures TO authenticated;
GRANT ALL ON public.beat_lead_captures TO service_role;

ALTER TABLE public.beat_lead_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view lead captures"
  ON public.beat_lead_captures FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS beat_lead_captures_beat_idx ON public.beat_lead_captures(beat_id);
CREATE INDEX IF NOT EXISTS lease_orders_beat_idx ON public.lease_orders(beat_id);
CREATE INDEX IF NOT EXISTS beats_landing_slug_idx ON public.beats(landing_slug) WHERE landing_slug IS NOT NULL;
