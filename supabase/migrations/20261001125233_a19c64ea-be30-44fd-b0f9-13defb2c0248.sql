CREATE TABLE public.admin_email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'single' CHECK (mode IN ('single','bulk')),
  to_email text,
  audience text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_email_drafts TO authenticated;
GRANT ALL ON public.admin_email_drafts TO service_role;
ALTER TABLE public.admin_email_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email drafts" ON public.admin_email_drafts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER admin_email_drafts_updated BEFORE UPDATE ON public.admin_email_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();