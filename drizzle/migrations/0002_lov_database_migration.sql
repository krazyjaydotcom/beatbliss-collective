-- Short, shareable buyer download links: mybeatcatalog.com/d/<12-char code>
ALTER TABLE public.purchase_licenses ADD COLUMN IF NOT EXISTS short_code text;

UPDATE public.purchase_licenses
SET short_code = translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_')
WHERE short_code IS NULL OR short_code = '';

ALTER TABLE public.purchase_licenses
  ALTER COLUMN short_code SET DEFAULT translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_');

ALTER TABLE public.purchase_licenses ALTER COLUMN short_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_licenses_short_code_key
  ON public.purchase_licenses (short_code);
