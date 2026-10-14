CREATE OR REPLACE FUNCTION public.beat_credit_configs_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE el jsonb; f text;
BEGIN
  PERFORM public.validate_beat_credit_contributors(NEW.contributors);
  FOR el IN SELECT * FROM jsonb_array_elements(NEW.contributors) LOOP
    FOREACH f IN ARRAY ARRAY['legal_name','credit_name','pro','publisher_name','publisher_pro'] LOOP
      IF el ? f AND jsonb_typeof(el->f) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION '% must be text', f;
      END IF;
    END LOOP;
    IF jsonb_typeof(el->'writer_pct') = 'number' AND coalesce(btrim(el->>'legal_name'), '') = '' THEN
      RAISE EXCEPTION 'A legal writer name is required for a writer share';
    END IF;
    IF jsonb_typeof(el->'publishing_pct') = 'number' AND coalesce(btrim(el->>'publisher_name'), '') = '' THEN
      RAISE EXCEPTION 'A publisher name is required for a publishing share';
    END IF;
  END LOOP;
  IF jsonb_array_length(NEW.contributors) > 0 AND btrim(NEW.production_credit) = '' THEN
    RAISE EXCEPTION 'Production credit line is required';
  END IF;
  IF length(NEW.production_credit) > 300 THEN RAISE EXCEPTION 'Production credit is too long'; END IF;
  IF length(NEW.admin_notes) > 4000 THEN RAISE EXCEPTION 'Admin notes are too long'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_beat_credits(_beat_id uuid, _production_credit text, _contributors jsonb, _admin_notes text, _expected_updated_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur timestamptz; res timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM id FROM public.beats WHERE id = _beat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Beat not found'; END IF;
  SELECT updated_at INTO cur FROM public.beat_credit_configs WHERE beat_id = _beat_id;
  IF cur IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'These credits were changed elsewhere. Close and reopen this beat before saving.';
  END IF;
  INSERT INTO public.beat_credit_configs (beat_id, production_credit, contributors, admin_notes, updated_by)
  VALUES (_beat_id, btrim(coalesce(_production_credit, '')), coalesce(_contributors, '[]'::jsonb), coalesce(_admin_notes, ''), auth.uid())
  ON CONFLICT (beat_id) DO UPDATE SET production_credit = EXCLUDED.production_credit, contributors = EXCLUDED.contributors,
    admin_notes = EXCLUDED.admin_notes, updated_by = EXCLUDED.updated_by
  RETURNING updated_at INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_save_beat_credits(uuid, text, jsonb, text, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_preview_beat_credit_terms(text, jsonb) FROM PUBLIC, anon;