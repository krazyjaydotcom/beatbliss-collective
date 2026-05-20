ALTER TABLE public.beats
  ADD COLUMN IF NOT EXISTS single_sale_price_cents integer,
  ADD COLUMN IF NOT EXISTS single_sale_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_sale_description text;

ALTER TABLE public.homepage_settings
  ADD COLUMN IF NOT EXISTS hero_image_filter jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('homepage-media', 'homepage-media', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read homepage media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'homepage-media');

CREATE POLICY "Admins upload homepage media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'homepage-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update homepage media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'homepage-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete homepage media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'homepage-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));