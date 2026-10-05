ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS stems_url text;

CREATE TABLE public.purchase_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_code text NOT NULL UNIQUE,
  email text NOT NULL,
  buyer_name text,
  beat_id uuid REFERENCES public.beats(id) ON DELETE SET NULL,
  beat_title text NOT NULL,
  license_tier text NOT NULL,
  license_label text NOT NULL,
  rights_text text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  stripe_session_id text NOT NULL,
  payment_environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_session_id, beat_id)
);
CREATE INDEX purchase_licenses_email_idx ON public.purchase_licenses (lower(email));

GRANT SELECT ON public.purchase_licenses TO authenticated;
GRANT ALL ON public.purchase_licenses TO service_role;
ALTER TABLE public.purchase_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view purchase licenses" ON public.purchase_licenses
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));