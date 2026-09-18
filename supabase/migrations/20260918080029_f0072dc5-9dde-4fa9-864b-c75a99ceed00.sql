-- Play tracking
CREATE TABLE public.beat_plays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beat_id uuid NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  is_member boolean NOT NULL DEFAULT false,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.beat_plays TO authenticated;
GRANT ALL ON public.beat_plays TO service_role;
ALTER TABLE public.beat_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read beat plays" ON public.beat_plays
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX beat_plays_beat_created_idx ON public.beat_plays (beat_id, created_at DESC);
CREATE INDEX beat_plays_created_idx ON public.beat_plays (created_at DESC);

CREATE OR REPLACE FUNCTION public.record_beat_play(_beat_id uuid, _session_key text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _beat_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.beat_plays (beat_id, is_member, session_key)
  VALUES (_beat_id, auth.uid() IS NOT NULL, left(coalesce(_session_key, ''), 64));
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_beat_play(uuid, text) TO anon, authenticated;

-- Ad analytics over time
CREATE TABLE public.ad_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id uuid NOT NULL REFERENCES public.ad_spots(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('impression','skip','click')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_events TO authenticated;
GRANT ALL ON public.ad_events TO service_role;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read ad events" ON public.ad_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ad_events_ad_created_idx ON public.ad_events (ad_id, created_at DESC);

ALTER TABLE public.ad_spots ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_ad_event(_ad_id uuid, _event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _event NOT IN ('impression','skip','click') THEN RETURN; END IF;
  INSERT INTO public.ad_events (ad_id, event) VALUES (_ad_id, _event);
  IF _event = 'impression' THEN
    UPDATE public.ad_spots SET impressions = impressions + 1 WHERE id = _ad_id;
  ELSIF _event = 'skip' THEN
    UPDATE public.ad_spots SET skips = skips + 1 WHERE id = _ad_id;
  ELSE
    UPDATE public.ad_spots SET clicks = clicks + 1 WHERE id = _ad_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_ad_event(uuid, text) TO anon, authenticated;

-- Embedded commercial support (YouTube / Vimeo)
ALTER TABLE public.ad_spots DROP CONSTRAINT IF EXISTS ad_spots_media_type_check;
ALTER TABLE public.ad_spots ADD CONSTRAINT ad_spots_media_type_check
  CHECK (media_type IN ('audio','video','embed'));

-- License tiers
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS nonexclusive_price_cents integer;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS exclusive_price_cents integer;