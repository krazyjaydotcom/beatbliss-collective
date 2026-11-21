-- Run with a privileged SQL test connection. Everything is rolled back;
-- no licenses, customers or emails are created by these checks.
BEGIN;
DO $$
BEGIN
 IF has_function_privilege('anon','public.reserve_beat_free_claim(uuid,text,text,text,jsonb,jsonb,integer,integer,integer,boolean)','execute')
 OR has_function_privilege('authenticated','public.reserve_beat_free_claim(uuid,text,text,text,jsonb,jsonb,integer,integer,integer,boolean)','execute')
 THEN RAISE EXCEPTION 'Public callers must not bypass promo validation'; END IF;
 IF NOT has_function_privilege('service_role','public.reserve_beat_free_claim(uuid,text,text,text,jsonb,jsonb,integer,integer,integer,boolean)','execute')
 THEN RAISE EXCEPTION 'Trusted checkout must be able to reserve'; END IF;
END $$;
DO $$
DECLARE rid uuid := gen_random_uuid(); next_id uuid; beat uuid; req jsonb; sess jsonb;
 promo text := 'promo_test_'||gen_random_uuid()::text;
 email text := gen_random_uuid()::text||'@example.invalid';
 rejected boolean := false;
BEGIN
 SELECT id INTO STRICT beat FROM public.beats LIMIT 1;
 req := jsonb_build_object('items',jsonb_build_array(jsonb_build_object('beatId',beat,'tier','nonexclusive')),'name','Rollback test','code','TEST','email',email);
 sess := jsonb_build_object('id','free_'||rid,'amount_total',0,'payment_status','no_payment_required');
 PERFORM public.reserve_beat_free_claim(rid,'sandbox',promo,email,req,sess,1,0,0,false);
 -- Idempotent retry remains allowed after the one permitted use is consumed.
 PERFORM public.reserve_beat_free_claim(rid,'sandbox',promo,email,req,sess,1,0,0,false);
 IF public.beat_promo_redemption_count('sandbox',promo,0) <> 1 THEN RAISE EXCEPTION 'Retry consumed another promo use'; END IF;
 next_id := gen_random_uuid();
 BEGIN
  PERFORM public.reserve_beat_free_claim(next_id,'sandbox',promo,email,req,jsonb_set(sess,'{id}',to_jsonb('free_'||next_id)),1,0,0,false);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'That discount code has been used up.' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'One-use promo limit not enforced'; END IF;
 rejected := false;
 BEGIN
  PERFORM public.reserve_beat_free_claim(rid,'sandbox',promo,email,jsonb_set(req,'{name}','"Different buyer"'),sess,1,0,0,false);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'Claim details do not match. Start a new claim.' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Claim identity was not bound'; END IF;
END $$;
DO $$
DECLARE rid uuid; beat uuid; req jsonb; sess jsonb; rejected boolean := false;
 promo text := 'promo_test_'||gen_random_uuid()::text;
 email text := gen_random_uuid()::text||'@example.invalid';
BEGIN
 SELECT id INTO STRICT beat FROM public.beats LIMIT 1;
 req := jsonb_build_object('items',jsonb_build_array(jsonb_build_object('beatId',beat,'tier','nonexclusive')),'email',email);
 rid := gen_random_uuid();
 sess := jsonb_build_object('id','free_'||rid,'amount_total',0,'payment_status','no_payment_required');
 PERFORM public.reserve_beat_free_claim(rid,'sandbox',promo,email,req,sess,NULL,0,0,true);
 rid := gen_random_uuid();
 BEGIN
  PERFORM public.reserve_beat_free_claim(rid,'sandbox',promo,email,req,jsonb_set(sess,'{id}',to_jsonb('free_'||rid)),NULL,0,0,true);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'This code is only for first-time buyers.' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'First-purchase reservation limit not enforced'; END IF;
END $$;
DO $$
DECLARE rid uuid; beat uuid; req jsonb; sess jsonb; rejected boolean := false;
 promo text := 'promo_test_'||gen_random_uuid()::text;
 email text := gen_random_uuid()::text||'@example.invalid';
BEGIN
 SELECT id INTO STRICT beat FROM public.beats LIMIT 1;
 req := jsonb_build_object('items',jsonb_build_array(jsonb_build_object('beatId',beat,'tier','nonexclusive')),'email',email);
 FOR i IN 1..10 LOOP
  rid := gen_random_uuid();
  sess := jsonb_build_object('id','free_'||rid,'amount_total',0,'payment_status','no_payment_required');
  PERFORM public.reserve_beat_free_claim(rid,'sandbox',promo,email,req,sess,NULL,0,0,false);
 END LOOP;
 rid := gen_random_uuid();
 BEGIN
  PERFORM public.reserve_beat_free_claim(rid,'sandbox',promo,email,req,jsonb_set(sess,'{id}',to_jsonb('free_'||rid)),NULL,0,0,false);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'Too many claims. Please try again later.' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Ten-claims-per-hour guard not enforced'; END IF;
END $$;
ROLLBACK;