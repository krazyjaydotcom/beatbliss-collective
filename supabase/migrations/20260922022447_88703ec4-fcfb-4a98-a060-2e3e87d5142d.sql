CREATE TABLE public.purchase_funnel_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('attributed_landing','preview_play','license_selected','buy_now_clicked','checkout_started','purchase_confirmed')),
  beat_id uuid REFERENCES public.beats(id) ON DELETE SET NULL,
  license_tier text CHECK (license_tier IS NULL OR license_tier IN ('nonexclusive','unlimited','trackout')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  session_key text,
  stripe_session_id text,
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),
  payment_environment text CHECK (payment_environment IS NULL OR payment_environment IN ('sandbox','live')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.purchase_funnel_events TO authenticated;
GRANT ALL ON public.purchase_funnel_events TO service_role;
ALTER TABLE public.purchase_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read purchase funnel events"
  ON public.purchase_funnel_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX purchase_funnel_events_created_idx ON public.purchase_funnel_events (created_at DESC);
CREATE INDEX purchase_funnel_events_campaign_idx ON public.purchase_funnel_events (utm_campaign, beat_id, created_at DESC);
CREATE UNIQUE INDEX purchase_funnel_events_paid_session_unique
  ON public.purchase_funnel_events (payment_environment, stripe_session_id)
  WHERE event_type = 'purchase_confirmed' AND stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_purchase_funnel_event(
  _event_type text,
  _beat_id uuid DEFAULT NULL,
  _license_tier text DEFAULT NULL,
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _session_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _event_type NOT IN ('attributed_landing','preview_play','license_selected','buy_now_clicked') THEN
    RETURN;
  END IF;
  IF _license_tier IS NOT NULL AND _license_tier NOT IN ('nonexclusive','unlimited','trackout') THEN
    RETURN;
  END IF;
  IF _beat_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.beats WHERE id = _beat_id AND is_active = true
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.purchase_funnel_events (
    event_type, beat_id, license_tier, utm_source, utm_medium, utm_campaign, utm_content, session_key
  ) VALUES (
    _event_type,
    _beat_id,
    _license_tier,
    nullif(left(coalesce(_utm_source, ''), 100), ''),
    nullif(left(coalesce(_utm_medium, ''), 100), ''),
    nullif(left(coalesce(_utm_campaign, ''), 160), ''),
    nullif(left(coalesce(_utm_content, ''), 160), ''),
    nullif(left(coalesce(_session_key, ''), 64), '')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_purchase_funnel_event(text, uuid, text, text, text, text, text, text) TO anon, authenticated;