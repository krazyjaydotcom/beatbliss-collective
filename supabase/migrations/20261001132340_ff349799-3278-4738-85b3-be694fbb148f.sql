CREATE TABLE public.ses_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  from_email text,
  subject text NOT NULL,
  body text NOT NULL,
  purpose text NOT NULL,
  basis text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  ses_message_id text,
  error text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ses_send_log TO authenticated;
GRANT ALL ON public.ses_send_log TO service_role;
ALTER TABLE public.ses_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ses log" ON public.ses_send_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert ses log" ON public.ses_send_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update ses log" ON public.ses_send_log FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read email attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'email-attachments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins upload email attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'email-attachments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete email attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'email-attachments' AND public.has_role(auth.uid(), 'admin'));