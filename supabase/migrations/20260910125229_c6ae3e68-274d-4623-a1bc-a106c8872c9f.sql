CREATE TABLE public.crm_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  name text,
  phone text,
  stage text NOT NULL DEFAULT 'new_lead',
  source text NOT NULL DEFAULT 'manual',
  notes text NOT NULL DEFAULT '',
  next_follow_up_at date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_prospects TO authenticated;
GRANT ALL ON public.crm_prospects TO service_role;
ALTER TABLE public.crm_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prospects" ON public.crm_prospects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX crm_prospects_email_idx ON public.crm_prospects (lower(email));

CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  due_date date,
  status text NOT NULL DEFAULT 'open',
  prospect_id uuid REFERENCES public.crm_prospects(id) ON DELETE SET NULL,
  customer_email text,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tasks" ON public.crm_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX crm_tasks_due_idx ON public.crm_tasks (status, due_date);

CREATE TRIGGER crm_prospects_touch BEFORE UPDATE ON public.crm_prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER crm_tasks_touch BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();