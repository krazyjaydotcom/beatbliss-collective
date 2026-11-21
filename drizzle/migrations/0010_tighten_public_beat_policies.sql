DROP POLICY IF EXISTS "Anyone can view beats" ON public.beats;
CREATE POLICY "Anyone can view visible beats" ON public.beats FOR SELECT
USING (is_active AND landing_visibility <> 'private');

DROP POLICY IF EXISTS "Anyone can read attachments" ON public.beat_landing_attachments;
CREATE POLICY "Anyone can read attachments of visible beats" ON public.beat_landing_attachments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.beats b WHERE b.id = beat_id AND b.is_active AND b.landing_visibility <> 'private'));

DROP POLICY IF EXISTS "Anyone can submit inquiries" ON public.beat_landing_inquiries;
CREATE POLICY "Anyone can submit valid inquiries" ON public.beat_landing_inquiries FOR INSERT
WITH CHECK (
  length(btrim(name)) BETWEEN 1 AND 200
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 320
  AND (beat_id IS NULL OR EXISTS (SELECT 1 FROM public.beats b WHERE b.id = beat_id AND b.is_active AND b.landing_visibility <> 'private'))
);