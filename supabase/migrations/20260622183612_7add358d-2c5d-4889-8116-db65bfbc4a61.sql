CREATE TABLE public.access_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text,
  email text,
  phone text,
  music text,
  source text,
  beat_id uuid,
  beat_title text,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_agent text,
  ip text
);

CREATE INDEX idx_access_applications_created_at ON public.access_applications (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_applications TO authenticated;
GRANT ALL ON public.access_applications TO service_role;

ALTER TABLE public.access_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access applications"
  ON public.access_applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete access applications"
  ON public.access_applications FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));