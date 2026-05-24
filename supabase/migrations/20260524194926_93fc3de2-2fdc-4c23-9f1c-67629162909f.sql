
CREATE TABLE public.access_application_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  question_text text NOT NULL,
  helper_text text NOT NULL DEFAULT '',
  placeholder text NOT NULL DEFAULT '',
  input_type text NOT NULL DEFAULT 'text',
  icon text NOT NULL DEFAULT 'user',
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_application_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active questions"
ON public.access_application_questions FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins read all questions"
ON public.access_application_questions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage questions"
ON public.access_application_questions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_access_questions_updated
BEFORE UPDATE ON public.access_application_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.access_application_questions (sort_order, label, question_text, helper_text, placeholder, input_type, icon, is_required) VALUES
(10, 'Artist / label name', 'What artist or label name should I know?', 'This helps me know who I am listening for.', 'Your artist or label name', 'text', 'user', true),
(20, 'Email address', 'Where should I send the next step?', 'Use the email you check most often.', 'you@example.com', 'email', 'mail', true),
(30, 'Phone number', 'What''s the best phone number to reach you?', 'Only for serious follow-up if the fit looks right.', 'Best number to reach you', 'tel', 'phone', true),
(40, 'Link to music', 'Where can I hear your music?', 'Optional, but helpful. Spotify, YouTube, SoundCloud, or a private link works.', 'Music link (optional)', 'text', 'music', false);
