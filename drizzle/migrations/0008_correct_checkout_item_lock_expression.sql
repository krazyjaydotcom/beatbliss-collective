CREATE OR REPLACE FUNCTION public.record_beat_checkout_item(p_license jsonb,p_funnel jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved public.purchase_licenses; order_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended((p_license->>'stripe_session_id')||':'||(p_license->>'beat_id'),0));
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