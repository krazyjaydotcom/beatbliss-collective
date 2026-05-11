
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  tier text NOT NULL DEFAULT 'artist',
  environment text NOT NULL DEFAULT 'sandbox',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  claimed_by_user_id uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_token ON public.invites(token);
CREATE INDEX idx_invites_email ON public.invites(email);
CREATE INDEX idx_invites_customer ON public.invites(stripe_customer_id);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view invites" ON public.invites FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_invites_updated_at BEFORE UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomically claim an invite: mark used, link profile to Stripe customer, set tier
CREATE OR REPLACE FUNCTION public.claim_invite(_token text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite public.invites%ROWTYPE;
BEGIN
  SELECT * INTO _invite FROM public.invites WHERE token = _token FOR UPDATE;

  IF _invite.id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF _invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_used';
  END IF;
  IF _invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'revoked';
  END IF;
  IF _invite.expires_at < now() THEN
    RAISE EXCEPTION 'expired';
  END IF;

  UPDATE public.invites
  SET used_at = now(), claimed_by_user_id = _user_id
  WHERE id = _invite.id;

  UPDATE public.profiles
  SET stripe_customer_id = _invite.stripe_customer_id,
      subscription_tier = _invite.tier,
      subscription_status = 'active'
  WHERE id = _user_id;

  RETURN jsonb_build_object(
    'email', _invite.email,
    'tier', _invite.tier,
    'stripe_customer_id', _invite.stripe_customer_id
  );
END;
$$;
