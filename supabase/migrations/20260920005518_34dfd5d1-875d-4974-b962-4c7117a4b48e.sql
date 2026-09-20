CREATE TABLE public.audio_tag_settings (
  id integer PRIMARY KEY DEFAULT 1,
  tag_url text,
  is_enabled boolean NOT NULL DEFAULT false,
  interval_seconds integer NOT NULL DEFAULT 40,
  start_offset_seconds integer NOT NULL DEFAULT 10,
  volume numeric NOT NULL DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_tag_settings_single_row CHECK (id = 1)
);

GRANT SELECT ON public.audio_tag_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.audio_tag_settings TO authenticated;
GRANT ALL ON public.audio_tag_settings TO service_role;

ALTER TABLE public.audio_tag_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audio tag settings are publicly readable"
  ON public.audio_tag_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert audio tag settings"
  ON public.audio_tag_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update audio tag settings"
  ON public.audio_tag_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER audio_tag_settings_touch
  BEFORE UPDATE ON public.audio_tag_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.audio_tag_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;