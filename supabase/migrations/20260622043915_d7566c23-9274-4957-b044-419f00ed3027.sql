
CREATE TABLE public.home_gallery_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  transition TEXT NOT NULL DEFAULT 'fade',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT home_gallery_transition_chk CHECK (transition IN ('fade','slide','zoom','crossfade'))
);

GRANT SELECT ON public.home_gallery_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_gallery_images TO authenticated;
GRANT ALL ON public.home_gallery_images TO service_role;

ALTER TABLE public.home_gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active gallery images"
  ON public.home_gallery_images FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage gallery images"
  ON public.home_gallery_images FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER home_gallery_images_updated_at
  BEFORE UPDATE ON public.home_gallery_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for home_gallery bucket
CREATE POLICY "Public can read home_gallery objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'home_gallery');

CREATE POLICY "Admins can upload home_gallery objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'home_gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update home_gallery objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'home_gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete home_gallery objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'home_gallery' AND public.has_role(auth.uid(), 'admin'));
