-- Beat funnels: per-beat landing pages with email capture
CREATE TABLE public.beat_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  headline text,
  video_url text,
  beat_id uuid REFERENCES public.beats(id) ON DELETE SET NULL,
  audio_url text,
  cover_url text,
  download_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$')
);

CREATE INDEX idx_beat_funnels_slug ON public.beat_funnels(slug);

ALTER TABLE public.beat_funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active funnels"
  ON public.beat_funnels FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage funnels"
  ON public.beat_funnels FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_beat_funnels_updated_at
  BEFORE UPDATE ON public.beat_funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leads (emails captured)
CREATE TABLE public.beat_funnel_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES public.beat_funnels(id) ON DELETE CASCADE,
  email text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  forwarded_at timestamptz,
  forward_error text,
  user_agent text,
  ip text
);

CREATE INDEX idx_funnel_leads_funnel ON public.beat_funnel_leads(funnel_id);
CREATE INDEX idx_funnel_leads_email ON public.beat_funnel_leads(funnel_id, email);

ALTER TABLE public.beat_funnel_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view leads"
  ON public.beat_funnel_leads FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Capture lead via SECURITY DEFINER (allows public anonymous insert through this RPC only)
CREATE OR REPLACE FUNCTION public.capture_funnel_lead(_slug text, _email text, _ua text DEFAULT NULL, _ip text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _funnel public.beat_funnels%ROWTYPE;
  _lead_id uuid;
  _captured timestamptz;
BEGIN
  IF _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  SELECT * INTO _funnel FROM public.beat_funnels
   WHERE slug = _slug AND is_active = true;
  IF _funnel.id IS NULL THEN
    RAISE EXCEPTION 'funnel_not_found';
  END IF;

  -- Reuse existing lead if same email already captured (idempotent for the same browser)
  SELECT id, captured_at INTO _lead_id, _captured
    FROM public.beat_funnel_leads
   WHERE funnel_id = _funnel.id AND lower(email) = lower(_email)
   ORDER BY captured_at ASC LIMIT 1;

  IF _lead_id IS NULL THEN
    INSERT INTO public.beat_funnel_leads (funnel_id, email, user_agent, ip)
    VALUES (_funnel.id, lower(_email), _ua, _ip)
    RETURNING id, captured_at INTO _lead_id, _captured;
  END IF;

  RETURN jsonb_build_object(
    'lead_id', _lead_id,
    'captured_at', _captured,
    'download_url', _funnel.download_url,
    'funnel_title', _funnel.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_funnel_lead(text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_funnel_lead_forwarded(_lead_id uuid, _error text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.beat_funnel_leads
  SET forwarded_at = CASE WHEN _error IS NULL THEN now() ELSE forwarded_at END,
      forward_error = _error
  WHERE id = _lead_id;
$$;

GRANT EXECUTE ON FUNCTION public.mark_funnel_lead_forwarded(uuid, text) TO anon, authenticated;