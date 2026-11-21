CREATE TABLE public.beat_checkout_fulfillments (
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  session_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','complete')),
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(environment,session_id)
);
GRANT ALL ON public.beat_checkout_fulfillments TO service_role;
ALTER TABLE public.beat_checkout_fulfillments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.beat_promo_usage (
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  promo_id text NOT NULL,
  legacy_count integer NOT NULL DEFAULT 0 CHECK (legacy_count >= 0),
  PRIMARY KEY(environment,promo_id)
);
GRANT ALL ON public.beat_promo_usage TO service_role;
ALTER TABLE public.beat_promo_usage ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.beat_promo_redemptions (
  environment text NOT NULL,
  promo_id text NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(environment,session_id),
  FOREIGN KEY(environment,promo_id) REFERENCES public.beat_promo_usage(environment,promo_id)
);
GRANT ALL ON public.beat_promo_redemptions TO service_role;
ALTER TABLE public.beat_promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_beat_checkout(p_environment text,p_session_id text,p_token uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result text;
BEGIN
 INSERT INTO public.beat_checkout_fulfillments(environment,session_id) VALUES(p_environment,p_session_id) ON CONFLICT DO NOTHING;
 SELECT status INTO result FROM public.beat_checkout_fulfillments WHERE environment=p_environment AND session_id=p_session_id FOR UPDATE;
 IF result='complete' THEN RETURN 'complete'; END IF;
 UPDATE public.beat_checkout_fulfillments SET status='processing',lease_token=p_token,lease_until=now()+interval '10 minutes',updated_at=now()
 WHERE environment=p_environment AND session_id=p_session_id AND (status='pending' OR lease_until<now());
 IF NOT FOUND THEN RETURN 'busy'; END IF;
 RETURN 'claimed';
END $$;
REVOKE ALL ON FUNCTION public.claim_beat_checkout(text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_beat_checkout(text,text,uuid) TO service_role;
CREATE FUNCTION public.beat_promo_redemption_count(p_environment text,p_promo_id text,p_legacy_count integer DEFAULT 0) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT legacy_count FROM public.beat_promo_usage WHERE environment=p_environment AND promo_id=p_promo_id),p_legacy_count)
 + (SELECT count(*)::integer FROM public.beat_promo_redemptions WHERE environment=p_environment AND promo_id=p_promo_id);
$$;
REVOKE ALL ON FUNCTION public.beat_promo_redemption_count(text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.beat_promo_redemption_count(text,text,integer) TO service_role;
CREATE FUNCTION public.record_beat_promo_redemption(p_environment text,p_promo_id text,p_session_id text,p_legacy_count integer DEFAULT 0) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_environment||':'||p_promo_id,0));
 INSERT INTO public.beat_promo_usage(environment,promo_id,legacy_count) VALUES(p_environment,p_promo_id,greatest(0,p_legacy_count)) ON CONFLICT DO NOTHING;
 INSERT INTO public.beat_promo_redemptions(environment,promo_id,session_id) VALUES(p_environment,p_promo_id,p_session_id) ON CONFLICT DO NOTHING;
 RETURN public.beat_promo_redemption_count(p_environment,p_promo_id,p_legacy_count);
END $$;
REVOKE ALL ON FUNCTION public.record_beat_promo_redemption(text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_beat_promo_redemption(text,text,text,integer) TO service_role;
CREATE FUNCTION public.record_beat_checkout_item(p_license jsonb,p_funnel jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved public.purchase_licenses; order_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_license->>'stripe_session_id'||':'||p_license->>'beat_id',0));
 INSERT INTO public.purchase_licenses(agreement_code,email,buyer_name,beat_id,beat_title,license_tier,license_label,rights_text,amount_cents,stripe_session_id,payment_environment)
 VALUES(p_license->>'agreement_code',p_license->>'email',p_license->>'buyer_name',(p_license->>'beat_id')::uuid,p_license->>'beat_title',p_license->>'license_tier',p_license->>'license_label',p_license->>'rights_text',(p_license->>'amount_cents')::integer,p_license->>'stripe_session_id',p_license->>'payment_environment')
 ON CONFLICT(stripe_session_id,beat_id) DO NOTHING;
 SELECT * INTO STRICT saved FROM public.purchase_licenses WHERE stripe_session_id=p_license->>'stripe_session_id' AND beat_id=(p_license->>'beat_id')::uuid;
 SELECT id INTO order_id FROM public.lease_orders WHERE stripe_session_id=saved.stripe_session_id AND beat_id=saved.beat_id LIMIT 1;
 IF order_id IS NULL THEN
  INSERT INTO public.lease_orders(email,beat_id,amount_cents,used_first_time_discount,stripe_session_id,license_tier)
  VALUES(saved.email,saved.beat_id,saved.amount_cents,false,saved.stripe_session_id,saved.license_tier);
 END IF;
 INSERT INTO public.purchase_funnel_events(event_type,beat_id,license_tier,utm_source,utm_medium,utm_campaign,utm_content,session_key,stripe_session_id,amount_cents,payment_environment)
 VALUES('purchase_confirmed',saved.beat_id,saved.license_tier,nullif(p_funnel->>'utm_source',''),nullif(p_funnel->>'utm_medium',''),nullif(p_funnel->>'utm_campaign',''),nullif(p_funnel->>'utm_content',''),nullif(p_funnel->>'session_key',''),saved.stripe_session_id,saved.amount_cents,saved.payment_environment)
 ON CONFLICT(payment_environment,stripe_session_id,beat_id) WHERE event_type='purchase_confirmed' AND stripe_session_id IS NOT NULL AND beat_id IS NOT NULL DO NOTHING;
 RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.record_beat_checkout_item(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_beat_checkout_item(jsonb,jsonb) TO service_role;