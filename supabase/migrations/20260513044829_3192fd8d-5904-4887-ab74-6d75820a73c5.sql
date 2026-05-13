
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.invites ALTER COLUMN stripe_customer_id DROP NOT NULL;
ALTER TABLE public.invites ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.invites ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

-- Backfill used_by from legacy claimed_by_user_id where present
UPDATE public.invites SET used_by = claimed_by_user_id WHERE used_by IS NULL AND claimed_by_user_id IS NOT NULL;

-- Public read by token (needed for /join/[token] validation pre-auth)
DROP POLICY IF EXISTS "Public can read invite by token" ON public.invites;
CREATE POLICY "Public can read invite by token"
ON public.invites
FOR SELECT
TO anon, authenticated
USING (true);

-- Admins can insert invites
DROP POLICY IF EXISTS "Admins insert invites" ON public.invites;
CREATE POLICY "Admins insert invites"
ON public.invites
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
