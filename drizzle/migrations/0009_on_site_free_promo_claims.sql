CREATE TABLE public.beat_free_claims (
 request_id uuid PRIMARY KEY,
 environment text NOT NULL CHECK(environment IN ('sandbox','live')),
 promo_id text NOT NULL,
 email text NOT NULL,
 request_data jsonb NOT NULL,
 session_data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.beat_free_claims TO service_role;
ALTER TABLE public.beat_free_claims ENABLE ROW LEVEL SECURITY;
CREATE INDEX beat_free_claims_email_created ON public.beat_free_claims(email,created_at);
CREATE FUNCTION public.reserve_beat_free_claim(p_request_id uuid,p_environment text,p_promo_id text,p_email text,p_request jsonb,p_session jsonb,p_max integer,p_stripe_used integer,p_legacy integer,p_first_time boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing public.beat_free_claims; used integer; sid text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('free-claim:'||p_request_id::text,0));
 SELECT * INTO existing FROM public.beat_free_claims WHERE request_id=p_request_id;
 IF FOUND THEN
  IF existing.environment<>p_environment OR existing.email<>p_email OR existing.request_data<>p_request THEN RAISE EXCEPTION 'Claim details do not match. Start a new claim.'; END IF;
  RETURN existing.session_data;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('free-email:'||p_environment||':'||p_email,0));
 IF (SELECT count(*) FROM public.beat_free_claims WHERE email=p_email AND environment=p_environment AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'Too many claims. Please try again later.'; END IF;
 IF p_first_time AND (EXISTS(SELECT 1 FROM public.purchase_licenses WHERE email=p_email AND payment_environment=p_environment) OR EXISTS(SELECT 1 FROM public.beat_free_claims WHERE email=p_email AND environment=p_environment)) THEN RAISE EXCEPTION 'This code is only for first-time buyers.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_environment||':'||p_promo_id,0));
 used:=public.beat_promo_redemption_count(p_environment,p_promo_id,p_legacy)+greatest(0,p_stripe_used);
 IF p_max IS NOT NULL AND used>=p_max THEN RAISE EXCEPTION 'That discount code has been used up.'; END IF;
 sid:=p_session->>'id';
 IF sid<>'free_'||p_request_id::text OR (p_session->>'amount_total')::integer<>0 OR p_session->>'payment_status'<>'no_payment_required' THEN RAISE EXCEPTION 'Invalid free claim.'; END IF;
 INSERT INTO public.beat_free_claims(request_id,environment,promo_id,email,request_data,session_data) VALUES(p_request_id,p_environment,p_promo_id,p_email,p_request,p_session);
 PERFORM public.record_beat_promo_redemption(p_environment,p_promo_id,sid,p_legacy);
 INSERT INTO public.purchase_funnel_events(event_type,beat_id,license_tier,stripe_session_id,payment_environment,utm_source,utm_medium,utm_campaign,utm_content,session_key)
 SELECT 'checkout_started',(item->>'beatId')::uuid,item->>'tier',sid,p_environment,nullif(p_session->'metadata'->>'utm_source',''),nullif(p_session->'metadata'->>'utm_medium',''),nullif(p_session->'metadata'->>'utm_campaign',''),nullif(p_session->'metadata'->>'utm_content',''),nullif(p_session->'metadata'->>'attribution_session','') FROM jsonb_array_elements(p_request->'items') item;
 RETURN p_session;
END $$;
REVOKE ALL ON FUNCTION public.reserve_beat_free_claim(uuid,text,text,text,jsonb,jsonb,integer,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_beat_free_claim(uuid,text,text,text,jsonb,jsonb,integer,integer,integer,boolean) TO service_role;