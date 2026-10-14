CREATE TABLE public.beat_credit_configs (
  beat_id uuid PRIMARY KEY REFERENCES public.beats(id) ON DELETE CASCADE,
  production_credit text NOT NULL DEFAULT '',
  contributors jsonb NOT NULL DEFAULT '[]'::jsonb,
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beat_credit_configs TO authenticated;
GRANT ALL ON public.beat_credit_configs TO service_role;
ALTER TABLE public.beat_credit_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage beat credits" ON public.beat_credit_configs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Percentage: blank (null) = unspecified; else finite number 0..100 with <=2 decimals.
CREATE OR REPLACE FUNCTION public._credit_pct(_v jsonb, _field text, _idx int)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE n numeric;
BEGIN
  IF _v IS NULL OR jsonb_typeof(_v) = 'null' THEN RETURN NULL; END IF;
  IF jsonb_typeof(_v) <> 'number' THEN
    RAISE EXCEPTION 'Contributor %: % must be a number or blank', _idx, _field;
  END IF;
  n := (_v #>> '{}')::numeric;
  IF n < 0 OR n > 100 THEN RAISE EXCEPTION 'Contributor %: % must be between 0 and 100', _idx, _field; END IF;
  IF n <> round(n, 2) THEN RAISE EXCEPTION 'Contributor %: % allows at most 2 decimal places', _idx, _field; END IF;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.validate_beat_credit_contributors(_c jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  el jsonb; i int := 0;
  tw numeric := 0; tp numeric := 0; tm numeric := 0; ts numeric := 0;
  v numeric; ipi text; f text;
BEGIN
  IF jsonb_typeof(_c) <> 'array' THEN RAISE EXCEPTION 'Contributors must be a list'; END IF;
  IF jsonb_array_length(_c) > 50 THEN RAISE EXCEPTION 'Too many contributors (max 50)'; END IF;
  FOR el IN SELECT * FROM jsonb_array_elements(_c) LOOP
    i := i + 1;
    IF jsonb_typeof(el) <> 'object' THEN RAISE EXCEPTION 'Contributor % is invalid', i; END IF;
    IF coalesce(btrim(el->>'legal_name'), '') = '' AND coalesce(btrim(el->>'credit_name'), '') = '' THEN
      RAISE EXCEPTION 'Contributor %: a name is required', i;
    END IF;
    IF coalesce(el->>'role', '') NOT IN ('producer', 'co_producer', 'additional_production') THEN
      RAISE EXCEPTION 'Contributor %: role must be producer, co-producer or additional production', i;
    END IF;
    FOREACH f IN ARRAY ARRAY['writer_ipi', 'publisher_ipi'] LOOP
      IF el ? f AND jsonb_typeof(el->f) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'Contributor %: % must be text', i, f;
      END IF;
      ipi := coalesce(el->>f, '');
      IF ipi <> '' AND ipi !~ '^[0-9]{9,11}$' THEN
        RAISE EXCEPTION 'Contributor %: % must be 9-11 digits (leading zeros allowed) or blank', i, f;
      END IF;
    END LOOP;
    FOREACH f IN ARRAY ARRAY['legal_name','credit_name','pro','publisher_name','publisher_pro'] LOOP
      IF length(coalesce(el->>f, '')) > 200 THEN RAISE EXCEPTION 'Contributor %: % is too long', i, f; END IF;
    END LOOP;
    v := public._credit_pct(el->'writer_pct', 'writer %', i); tw := tw + coalesce(v, 0);
    v := public._credit_pct(el->'publishing_pct', 'publishing %', i); tp := tp + coalesce(v, 0);
    v := public._credit_pct(el->'master_pct', 'master %', i); tm := tm + coalesce(v, 0);
    v := public._credit_pct(el->'sales_pct', 'sales %', i); ts := ts + coalesce(v, 0);
  END LOOP;
  IF tw > 100 THEN RAISE EXCEPTION 'Writer share total is % (max 100)', tw; END IF;
  IF tp > 100 THEN RAISE EXCEPTION 'Publishing share total is % (max 100)', tp; END IF;
  IF tm > 100 THEN RAISE EXCEPTION 'Beat master total is % (max 100)', tm; END IF;
  IF ts > 100 THEN RAISE EXCEPTION 'Beat-sale proceeds total is % (max 100)', ts; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.beat_credit_configs_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.validate_beat_credit_contributors(NEW.contributors);
  IF length(NEW.production_credit) > 300 THEN RAISE EXCEPTION 'Production credit is too long'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER beat_credit_configs_validate BEFORE INSERT OR UPDATE ON public.beat_credit_configs
  FOR EACH ROW EXECUTE FUNCTION public.beat_credit_configs_validate();

CREATE OR REPLACE FUNCTION public._pct_txt(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim_scale(n)::text
$$;

-- Canonical buyer-facing credit terms. Sales % and admin notes are never included.
CREATE OR REPLACE FUNCTION public.format_beat_credit_terms(_production_credit text, _contributors jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  el jsonb; out text; lines text := ''; nm text; legal text; roleLbl text;
  w numeric; p numeric; m numeric;
  tw numeric := 0; tp numeric := 0; tm numeric := 0;
  anyw bool := false; anyp bool := false; anym bool := false;
BEGIN
  FOR el IN SELECT * FROM jsonb_array_elements(_contributors) LOOP
    legal := nullif(btrim(coalesce(el->>'legal_name','')), '');
    nm := coalesce(nullif(btrim(coalesce(el->>'credit_name','')), ''), legal);
    roleLbl := CASE el->>'role' WHEN 'producer' THEN 'Producer' WHEN 'co_producer' THEN 'Co-producer' ELSE 'Additional production' END;
    lines := lines || E'\n  • ' || nm || CASE WHEN legal IS NOT NULL AND legal <> nm THEN ' (' || legal || ')' ELSE '' END || ' — ' || roleLbl;
    w := CASE WHEN jsonb_typeof(el->'writer_pct') = 'number' THEN (el->>'writer_pct')::numeric END;
    p := CASE WHEN jsonb_typeof(el->'publishing_pct') = 'number' THEN (el->>'publishing_pct')::numeric END;
    m := CASE WHEN jsonb_typeof(el->'master_pct') = 'number' THEN (el->>'master_pct')::numeric END;
    IF legal IS NOT NULL THEN
      lines := lines || E'\n      Writer: ' || legal
        || ' (IPI ' || coalesce(nullif(el->>'writer_ipi',''), 'not provided') || '; PRO ' || coalesce(nullif(btrim(coalesce(el->>'pro','')),''), 'not provided') || ')'
        || CASE WHEN w IS NOT NULL THEN ' — ' || public._pct_txt(w) || '% of the final song''s writer share' ELSE ' — writer share not specified' END;
    END IF;
    IF nullif(btrim(coalesce(el->>'publisher_name','')), '') IS NOT NULL THEN
      lines := lines || E'\n      Publishing: ' || btrim(el->>'publisher_name')
        || ' (IPI ' || coalesce(nullif(el->>'publisher_ipi',''), 'not provided') || '; PRO ' || coalesce(nullif(btrim(coalesce(el->>'publisher_pro','')),''), 'not provided') || ')'
        || CASE WHEN p IS NOT NULL THEN ' — ' || public._pct_txt(p) || '% of the final song''s publisher share' ELSE ' — publisher share not specified' END;
    ELSIF p IS NOT NULL THEN
      lines := lines || E'\n      Publishing: ' || public._pct_txt(p) || '% of the final song''s publisher share';
    END IF;
    IF m IS NOT NULL THEN
      lines := lines || E'\n      Underlying beat master: ' || public._pct_txt(m) || '% of the underlying beat recording (not the licensee''s new song)';
    END IF;
    IF w IS NOT NULL THEN anyw := true; tw := tw + w; END IF;
    IF p IS NOT NULL THEN anyp := true; tp := tp + p; END IF;
    IF m IS NOT NULL THEN anym := true; tm := tm + m; END IF;
  END LOOP;

  out := 'PRODUCTION CREDIT (REQUIRED): ' || btrim(_production_credit) || E'\n\n'
    || 'WRITER & PUBLISHING CREDITS (REQUIRED)' || E'\n'
    || 'All songs created using this beat must credit the following contributors on all metadata, split sheets, distributor uploads, and PRO registrations:'
    || lines;
  IF anyw OR anyp OR anym THEN
    out := out || E'\n\nListed split totals:';
    IF anyw THEN out := out || E'\n  • Writer: ' || public._pct_txt(tw) || '% of the final song''s writer share listed here; the remaining ' || public._pct_txt(100 - tw) || '% is not addressed by these producer credits.'; END IF;
    IF anyp THEN out := out || E'\n  • Publishing: ' || public._pct_txt(tp) || '% of the final song''s publisher share listed here; the remaining ' || public._pct_txt(100 - tp) || '% is not addressed by these producer credits.'; END IF;
    IF anym THEN out := out || E'\n  • Underlying beat master: ' || public._pct_txt(tm) || '% of the underlying beat recording listed here; the remaining ' || public._pct_txt(100 - tm) || '% is unallocated in these terms.'; END IF;
  END IF;
  out := out || E'\n\n'
    || 'Failure to register these credits and splits accurately voids the rights granted by this license. '
    || 'The licensee may NOT resell, redistribute, sublicense, or claim sole ownership of the original beat itself. '
    || 'Rights in the underlying composition and beat recording are retained by their respective owners; nothing in this agreement transfers those rights.';
  RETURN out;
END $$;

-- Snapshot of buyer-facing terms for a beat, or NULL when the beat has no configuration (legacy behavior).
CREATE OR REPLACE FUNCTION public.beat_credit_snapshot(_beat_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'captured_at', now(),
    'production_credit', c.production_credit,
    'contributors', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'legal_name', e->'legal_name', 'credit_name', e->'credit_name', 'role', e->'role',
        'writer_ipi', e->'writer_ipi', 'pro', e->'pro',
        'publisher_name', e->'publisher_name', 'publisher_ipi', e->'publisher_ipi', 'publisher_pro', e->'publisher_pro',
        'writer_pct', e->'writer_pct', 'publishing_pct', e->'publishing_pct', 'master_pct', e->'master_pct'
      ) ORDER BY ord)
      FROM jsonb_array_elements(c.contributors) WITH ORDINALITY AS t(e, ord)), '[]'::jsonb),
    'terms_text', public.format_beat_credit_terms(c.production_credit, c.contributors)
  )
  FROM public.beat_credit_configs c
  WHERE c.beat_id = _beat_id AND jsonb_array_length(c.contributors) > 0
$$;
REVOKE EXECUTE ON FUNCTION public.beat_credit_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.beat_credit_snapshot(uuid) TO service_role;

-- Public pre-purchase terms for listed beats (no sales splits, no notes).
CREATE OR REPLACE FUNCTION public.get_beat_credit_terms(_beat_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.beat_credit_snapshot(b.id)->>'terms_text'
  FROM public.beats b
  WHERE b.id = _beat_id AND b.is_active AND b.landing_visibility IN ('public', 'unlisted')
$$;
GRANT EXECUTE ON FUNCTION public.get_beat_credit_terms(uuid) TO anon, authenticated, service_role;

-- Admin inline preview of unsaved edits.
CREATE OR REPLACE FUNCTION public.admin_preview_beat_credit_terms(_production_credit text, _contributors jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.validate_beat_credit_contributors(_contributors);
  RETURN public.format_beat_credit_terms(_production_credit, _contributors);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_preview_beat_credit_terms(text, jsonb) TO authenticated;

-- Admin save with stale-write protection.
CREATE OR REPLACE FUNCTION public.admin_save_beat_credits(_beat_id uuid, _production_credit text, _contributors jsonb, _admin_notes text, _expected_updated_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur timestamptz; res timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.beats WHERE id = _beat_id) THEN RAISE EXCEPTION 'Beat not found'; END IF;
  IF jsonb_array_length(coalesce(_contributors, '[]'::jsonb)) > 0 AND btrim(coalesce(_production_credit, '')) = '' THEN
    RAISE EXCEPTION 'Production credit line is required';
  END IF;
  SELECT updated_at INTO cur FROM public.beat_credit_configs WHERE beat_id = _beat_id FOR UPDATE;
  IF cur IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'These credits were changed elsewhere. Reload before saving.';
  END IF;
  INSERT INTO public.beat_credit_configs (beat_id, production_credit, contributors, admin_notes, updated_by)
  VALUES (_beat_id, btrim(coalesce(_production_credit, '')), coalesce(_contributors, '[]'::jsonb), coalesce(_admin_notes, ''), auth.uid())
  ON CONFLICT (beat_id) DO UPDATE SET production_credit = EXCLUDED.production_credit, contributors = EXCLUDED.contributors,
    admin_notes = EXCLUDED.admin_notes, updated_by = EXCLUDED.updated_by
  RETURNING updated_at INTO res;
  RETURN res;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_save_beat_credits(uuid, text, jsonb, text, timestamptz) TO authenticated;

-- Snapshots on issued agreements (NULL = legacy terms).
ALTER TABLE public.purchase_licenses ADD COLUMN credit_snapshot jsonb;
ALTER TABLE public.agreements ADD COLUMN credit_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.purchase_licenses_credit_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.beat_id IS NOT NULL THEN NEW.credit_snapshot := public.beat_credit_snapshot(NEW.beat_id); ELSE NEW.credit_snapshot := NULL; END IF;
  ELSE
    NEW.credit_snapshot := OLD.credit_snapshot; -- immutable once issued
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_licenses_credit_snapshot BEFORE INSERT OR UPDATE ON public.purchase_licenses
  FOR EACH ROW EXECUTE FUNCTION public.purchase_licenses_credit_snapshot();

CREATE OR REPLACE FUNCTION public.agreements_credit_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE snap jsonb; s int; e int; marker_end text := 'KRAZYJAYDOTCOM retains ownership of the underlying composition and production. ';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.credit_snapshot := OLD.credit_snapshot;
    RETURN NEW;
  END IF;
  NEW.credit_snapshot := NULL;
  s := position('WRITER & PUBLISHING CREDITS (REQUIRED)' IN NEW.agreement_text);
  IF s = 0 THEN RETURN NEW; END IF; -- tiers without producer credits stay unchanged
  snap := public.beat_credit_snapshot(NEW.beat_id);
  IF snap IS NULL THEN RETURN NEW; END IF; -- legacy behavior
  e := position(marker_end IN NEW.agreement_text);
  IF e = 0 OR e < s THEN RETURN NEW; END IF;
  NEW.agreement_text := substr(NEW.agreement_text, 1, s - 1) || (snap->>'terms_text') || E'\n'
    || substr(NEW.agreement_text, e + length(marker_end));
  NEW.credit_snapshot := snap;
  RETURN NEW;
END $$;
CREATE TRIGGER agreements_credit_snapshot BEFORE INSERT OR UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.agreements_credit_snapshot();