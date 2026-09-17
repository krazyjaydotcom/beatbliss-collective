CREATE TABLE public.ad_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  media_type text NOT NULL DEFAULT 'audio',
  media_url text NOT NULL,
  cover_url text,
  cta_label text,
  cta_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  skips integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_spots_media_type_check CHECK (media_type IN ('audio','video'))
);

GRANT SELECT ON public.ad_spots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_spots TO authenticated;
GRANT ALL ON public.ad_spots TO service_role;

ALTER TABLE public.ad_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active commercials are publicly readable"
  ON public.ad_spots FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage commercials"
  ON public.ad_spots FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER ad_spots_touch
  BEFORE UPDATE ON public.ad_spots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX ad_spots_active_order_idx ON public.ad_spots (sort_order) WHERE is_active;

CREATE OR REPLACE FUNCTION public.record_ad_event(_ad_id uuid, _event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _event = 'impression' THEN
    UPDATE public.ad_spots SET impressions = impressions + 1 WHERE id = _ad_id;
  ELSIF _event = 'skip' THEN
    UPDATE public.ad_spots SET skips = skips + 1 WHERE id = _ad_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ad_event(uuid, text) TO anon, authenticated;