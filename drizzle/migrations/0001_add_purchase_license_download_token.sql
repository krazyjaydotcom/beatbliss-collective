ALTER TABLE public.purchase_licenses ADD COLUMN IF NOT EXISTS download_token text;
UPDATE public.purchase_licenses SET download_token = encode(gen_random_bytes(24), 'hex') WHERE download_token IS NULL;
ALTER TABLE public.purchase_licenses ALTER COLUMN download_token SET DEFAULT encode(gen_random_bytes(24), 'hex');
ALTER TABLE public.purchase_licenses ALTER COLUMN download_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS purchase_licenses_download_token_key ON public.purchase_licenses (download_token);