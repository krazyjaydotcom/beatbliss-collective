-- Only capture snapshots on freshly issued rows (created_at defaulted to the current transaction time).
-- Restores from Records & Trash re-insert historical rows with their original timestamps and payload, so they are left untouched.
CREATE OR REPLACE FUNCTION public.purchase_licenses_credit_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.credit_snapshot := OLD.credit_snapshot; -- immutable once issued
    RETURN NEW;
  END IF;
  IF NEW.credit_snapshot IS NULL AND NEW.beat_id IS NOT NULL AND NEW.created_at = now() THEN
    NEW.credit_snapshot := public.beat_credit_snapshot(NEW.beat_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.agreements_credit_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE snap jsonb; s int; e int; marker_end text := 'KRAZYJAYDOTCOM retains ownership of the underlying composition and production. ';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.credit_snapshot := OLD.credit_snapshot;
    NEW.agreement_text := OLD.agreement_text;
    RETURN NEW;
  END IF;
  IF NEW.credit_snapshot IS NOT NULL OR NEW.created_at IS DISTINCT FROM now() THEN RETURN NEW; END IF;
  s := position('WRITER & PUBLISHING CREDITS (REQUIRED)' IN NEW.agreement_text);
  IF s = 0 THEN RETURN NEW; END IF;
  snap := public.beat_credit_snapshot(NEW.beat_id);
  IF snap IS NULL THEN RETURN NEW; END IF;
  e := position(marker_end IN NEW.agreement_text);
  IF e = 0 OR e < s THEN RETURN NEW; END IF;
  NEW.agreement_text := substr(NEW.agreement_text, 1, s - 1) || (snap->>'terms_text') || E'\n'
    || substr(NEW.agreement_text, e + length(marker_end));
  NEW.credit_snapshot := snap;
  RETURN NEW;
END $$;

COMMENT ON COLUMN public.purchase_licenses.credit_snapshot IS 'Buyer-facing producer credit terms captured when issued; NULL = legacy fixed credits. Immutable.';
COMMENT ON COLUMN public.agreements.credit_snapshot IS 'Buyer-facing producer credit terms captured when issued; NULL = legacy fixed credits. Immutable.';