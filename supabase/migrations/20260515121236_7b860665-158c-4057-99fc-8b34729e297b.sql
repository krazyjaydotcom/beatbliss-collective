
-- 1. beat_claims: add anti-restart columns + indexes
ALTER TABLE public.beat_claims
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_fingerprint text;

CREATE INDEX IF NOT EXISTS beat_claims_email_lower_idx ON public.beat_claims (lower(email));
CREATE INDEX IF NOT EXISTS beat_claims_token_idx ON public.beat_claims (token);
CREATE INDEX IF NOT EXISTS beat_claims_beat_id_idx ON public.beat_claims (beat_id);
CREATE INDEX IF NOT EXISTS beat_claims_ip_idx ON public.beat_claims (ip_address);
CREATE INDEX IF NOT EXISTS beat_claims_fp_idx ON public.beat_claims (device_fingerprint);
CREATE INDEX IF NOT EXISTS beat_claims_created_desc_idx ON public.beat_claims (created_at DESC);

-- Rewrite claim_beat with anti-restart logic on email / IP / device fingerprint
CREATE OR REPLACE FUNCTION public.claim_beat(
  _email text,
  _beat_id uuid,
  _source text DEFAULT NULL,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _device_fingerprint text DEFAULT NULL
)
RETURNS TABLE(token text, expires_at timestamptz, beat_id uuid, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_norm text := lower(trim(_email));
  fp text := nullif(trim(_device_fingerprint), '');
  ip text := nullif(trim(_ip_address), '');
  existing public.beat_claims%ROWTYPE;
  new_token text;
  inserted public.beat_claims%ROWTYPE;
BEGIN
  IF length(email_norm) < 6 OR position('@' IN email_norm) = 0
     OR position('.' IN split_part(email_norm, '@', 2)) = 0 THEN
    RAISE EXCEPTION 'Enter a valid email address.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.beats b
    WHERE b.id = _beat_id
      AND (b.release_at IS NULL OR b.release_at <= now())
      AND coalesce(b.audio_url_tagged, b.audio_url) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This beat is not available for claiming.';
  END IF;

  -- Reuse any active claim that matches by email, device, or IP
  SELECT * INTO existing
  FROM public.beat_claims c
  WHERE c.expires_at > now()
    AND c.purchased_at IS NULL
    AND (
      lower(c.email) = email_norm
      OR (fp IS NOT NULL AND c.device_fingerprint = fp)
      OR (ip IS NOT NULL AND c.ip_address = ip)
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF existing.id IS NOT NULL THEN
    token := existing.token;
    expires_at := existing.expires_at;
    beat_id := existing.beat_id;
    reused := true;
    RETURN NEXT; RETURN;
  END IF;

  -- Block restart: if expired unpaid claim exists for same email/device/IP,
  -- do not let them start a new 12-hour timer.
  IF EXISTS (
    SELECT 1 FROM public.beat_claims c
    WHERE c.purchased_at IS NULL
      AND (
        lower(c.email) = email_norm
        OR (fp IS NOT NULL AND c.device_fingerprint = fp)
        OR (ip IS NOT NULL AND c.ip_address = ip)
      )
  ) THEN
    RAISE EXCEPTION 'Your previous offer has already expired. Please contact support to discuss next steps.';
  END IF;

  LOOP
    new_token := public.make_beat_claim_token();
    BEGIN
      INSERT INTO public.beat_claims (
        email, beat_id, token, source, expires_at,
        ip_address, user_agent, device_fingerprint
      )
      VALUES (
        email_norm, _beat_id, new_token, nullif(trim(_source), ''),
        now() + interval '12 hours',
        ip, nullif(trim(_user_agent), ''), fp
      )
      RETURNING * INTO inserted;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- token collision, retry
    END;
  END LOOP;

  token := inserted.token;
  expires_at := inserted.expires_at;
  beat_id := inserted.beat_id;
  reused := false;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_beat(text, uuid, text, text, text, text) TO anon, authenticated;

-- 2. offer_page_settings
CREATE TABLE IF NOT EXISTS public.offer_page_settings (
  id text PRIMARY KEY DEFAULT 'main',
  video_url text,
  eyebrow text,
  headline_template text,
  subheadline text,
  intro_text text,
  video_title text,
  video_body text,
  beat_title text,
  benefits_title text,
  price_display text,
  checkout_copy text,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  section_order jsonb NOT NULL DEFAULT '["video","beat","benefits"]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_page_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read offer settings" ON public.offer_page_settings;
CREATE POLICY "Anyone can read offer settings"
  ON public.offer_page_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage offer settings" ON public.offer_page_settings;
CREATE POLICY "Admins manage offer settings"
  ON public.offer_page_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.offer_page_settings (id) VALUES ('main')
ON CONFLICT (id) DO NOTHING;

-- 3. profiles storefront columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_username text UNIQUE,
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS store_bio text,
  ADD COLUMN IF NOT EXISTS store_artwork_url text,
  ADD COLUMN IF NOT EXISTS store_tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS store_buy_url text,
  ADD COLUMN IF NOT EXISTS store_donate_url text;

CREATE INDEX IF NOT EXISTS profiles_store_username_idx ON public.profiles (store_username);

DROP POLICY IF EXISTS "Public can view storefront profiles" ON public.profiles;
CREATE POLICY "Public can view storefront profiles"
  ON public.profiles FOR SELECT
  USING (store_username IS NOT NULL);

-- 4. beat_requests
CREATE TABLE IF NOT EXISTS public.beat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  style text,
  reference_artists text,
  tempo text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beat_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own beat requests" ON public.beat_requests;
CREATE POLICY "Users insert own beat requests"
  ON public.beat_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own beat requests" ON public.beat_requests;
CREATE POLICY "Users view own beat requests"
  ON public.beat_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all beat requests" ON public.beat_requests;
CREATE POLICY "Admins view all beat requests"
  ON public.beat_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update beat requests" ON public.beat_requests;
CREATE POLICY "Admins update beat requests"
  ON public.beat_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_beat_requests_updated_at ON public.beat_requests;
CREATE TRIGGER update_beat_requests_updated_at
  BEFORE UPDATE ON public.beat_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS beat_requests_user_id_idx ON public.beat_requests (user_id);
CREATE INDEX IF NOT EXISTS beat_requests_created_desc_idx ON public.beat_requests (created_at DESC);

NOTIFY pgrst, 'reload schema';
