
-- 1) inquiry question set (editable by admin, readable by everyone for the popup)
CREATE TABLE IF NOT EXISTS public.beat_landing_inquiry_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  placeholder text,
  field_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.beat_landing_inquiry_questions TO anon, authenticated;
GRANT ALL ON public.beat_landing_inquiry_questions TO service_role;
ALTER TABLE public.beat_landing_inquiry_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active inquiry questions"
  ON public.beat_landing_inquiry_questions FOR SELECT
  USING (active = true);

CREATE POLICY "Admins manage inquiry questions"
  ON public.beat_landing_inquiry_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_inquiry_questions_updated
  BEFORE UPDATE ON public.beat_landing_inquiry_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) inquiry submissions
CREATE TABLE IF NOT EXISTS public.beat_landing_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id uuid REFERENCES public.beats(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.beat_landing_inquiries TO anon, authenticated;
GRANT SELECT, DELETE ON public.beat_landing_inquiries TO authenticated;
GRANT ALL ON public.beat_landing_inquiries TO service_role;
ALTER TABLE public.beat_landing_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit inquiries"
  ON public.beat_landing_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins read inquiries"
  ON public.beat_landing_inquiries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete inquiries"
  ON public.beat_landing_inquiries FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) attachments per beat
CREATE TABLE IF NOT EXISTS public.beat_landing_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id uuid NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.beat_landing_attachments TO anon, authenticated;
GRANT ALL ON public.beat_landing_attachments TO service_role;
ALTER TABLE public.beat_landing_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read attachments"
  ON public.beat_landing_attachments FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_beat_landing_attachments_beat ON public.beat_landing_attachments(beat_id, sort_order);

-- 4) custom "video posted at" timestamp
ALTER TABLE public.beats
  ADD COLUMN IF NOT EXISTS custom_video_recorded_at timestamptz;

-- 5) seed default inquiry questions (idempotent)
INSERT INTO public.beat_landing_inquiry_questions (label, placeholder, field_type, required, sort_order)
SELECT * FROM (VALUES
  ('Your name', 'Full name or artist name', 'text', true, 10),
  ('Email', 'you@example.com', 'email', true, 20),
  ('Phone (optional)', '(555) 555-5555', 'text', false, 30),
  ('What kind of project?', 'Single, EP, film sync, custom beat, etc.', 'textarea', true, 40),
  ('Budget range', 'Approximate USD range', 'text', false, 50),
  ('Timeline / when do you need it?', 'e.g. 2 weeks', 'text', false, 60),
  ('Anything else we should know?', '', 'textarea', false, 70)
) AS v(label, placeholder, field_type, required, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.beat_landing_inquiry_questions LIMIT 1);
