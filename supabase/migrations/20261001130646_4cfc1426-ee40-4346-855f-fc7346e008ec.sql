CREATE TABLE public.inquiry_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL CHECK (source_table IN ('beat_landing_inquiries','access_applications')),
  source_id uuid NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','suppressed','failed')),
  error text,
  sent_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.inquiry_replies TO authenticated;
GRANT ALL ON public.inquiry_replies TO service_role;
ALTER TABLE public.inquiry_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage inquiry replies" ON public.inquiry_replies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX inquiry_replies_source_idx ON public.inquiry_replies (source_table, source_id);