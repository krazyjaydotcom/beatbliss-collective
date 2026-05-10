
-- 1. Tagged audio column
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS audio_url_tagged text;

-- 2. Whitelist submissions
CREATE TABLE IF NOT EXISTS public.whitelist_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  beat_id uuid,
  track_title text NOT NULL,
  artist_name text NOT NULL,
  streaming_url text NOT NULL,
  release_date date,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whitelist_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own submissions"
  ON public.whitelist_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all submissions"
  ON public.whitelist_submissions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Paid members insert own submissions"
  ON public.whitelist_submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.subscription_tier <> 'none'
    )
  );

CREATE POLICY "Users update own pending submissions"
  ON public.whitelist_submissions FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins update any submission"
  ON public.whitelist_submissions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER whitelist_submissions_updated_at
  BEFORE UPDATE ON public.whitelist_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tier-aware download RPC
CREATE OR REPLACE FUNCTION public.process_beat_download(_beat_id uuid, _file_type text DEFAULT 'MP3')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _profile public.profiles%ROWTYPE;
  _beat public.beats%ROWTYPE;
  _credits_cost integer := 1;
  _download_id uuid;
  _agreement_uuid uuid;
  _agreement_code text;
  _agreement_text text;
  _is_paid boolean;
  _free_used integer;
  _free_limit constant integer := 3;
  _license_type text;
  _audio_url text;
  _file_label text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _user_id FOR UPDATE;
  SELECT * INTO _beat FROM public.beats WHERE id = _beat_id;

  IF _beat.id IS NULL THEN
    RAISE EXCEPTION 'Beat not found';
  END IF;

  _is_paid := _profile.subscription_tier IS NOT NULL
    AND _profile.subscription_tier <> 'none'
    AND _profile.subscription_status IN ('active', 'trialing', 'past_due');

  IF _is_paid THEN
    _license_type := 'Unlimited Membership License';
    _file_label := UPPER(COALESCE(_file_type, 'MP3'));
    IF _file_label = 'WAV' THEN
      _audio_url := COALESCE(_beat.audio_url_wav, _beat.audio_url);
      IF _audio_url IS NULL THEN RAISE EXCEPTION 'No audio file available'; END IF;
    ELSE
      _audio_url := COALESCE(_beat.audio_url, _beat.audio_url_wav);
      IF _audio_url IS NULL THEN RAISE EXCEPTION 'No audio file available'; END IF;
    END IF;
    _agreement_text := 'KRAZYJAYDOTCOM Beat Download Agreement' || E'\n\n' ||
      'UNLIMITED MEMBERSHIP LICENSE' || E'\n\n' ||
      'This agreement confirms that the user, as an active paid member of KRAZYJAYDOTCOM, has downloaded the selected beat using their available membership credits. ' ||
      'The user is granted unlimited, non-exclusive rights to record, release, distribute, perform, and MONETIZE music created with this beat across all streaming platforms, social media, sync, live performance, and physical/digital sales. ' ||
      'The user retains 100% of the master recording royalties for the song they create. ' ||
      'The user may NOT resell, redistribute, sublicense, or claim ownership of the original beat itself. ' ||
      'KRAZYJAYDOTCOM retains ownership of the underlying composition and production. ' ||
      'This license remains valid for music released during the active membership period.';
  ELSE
    _license_type := 'Standard Membership License';
    _file_label := 'MP3 (Tagged)';
    _audio_url := _beat.audio_url_tagged;
    IF _audio_url IS NULL THEN
      RAISE EXCEPTION 'This beat is not yet available for free downloads. Upgrade your membership for full access.';
    END IF;
    SELECT COUNT(*) INTO _free_used FROM public.downloads WHERE user_id = _user_id;
    IF _free_used >= _free_limit THEN
      RAISE EXCEPTION 'Free accounts are limited to % downloads. Upgrade your membership to continue.', _free_limit;
    END IF;
    _agreement_text := 'KRAZYJAYDOTCOM Beat Download Agreement' || E'\n\n' ||
      'STANDARD MEMBERSHIP LICENSE (FREE TIER)' || E'\n\n' ||
      'This agreement confirms a free-tier download of a TAGGED preview of the selected beat from KRAZYJAYDOTCOM. ' ||
      'The downloaded file contains an audible producer tag and is licensed for non-commercial use only: personal demos, songwriting, social media drafts, and private listening. ' ||
      'The user MAY NOT release, distribute, monetize, or upload this beat (or any song made with it) to streaming platforms, stores, sync libraries, or any commercial channel. ' ||
      'Free accounts are limited to ' || _free_limit || ' total downloads. ' ||
      'To unlock untagged files, full WAV access, and monetization rights, upgrade to a paid membership for the Unlimited Membership License.';
  END IF;

  IF _profile.credits_balance < _credits_cost THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  UPDATE public.profiles SET credits_balance = credits_balance - _credits_cost WHERE id = _user_id;

  INSERT INTO public.downloads (user_id, beat_id, credits_used, file_type)
  VALUES (_user_id, _beat_id, _credits_cost, _file_label)
  RETURNING id INTO _download_id;

  INSERT INTO public.transactions (user_id, type, credits_amount, beat_id, description)
  VALUES (_user_id, 'download', -_credits_cost, _beat_id, 'Download: ' || _beat.title);

  _agreement_code := 'KJD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  INSERT INTO public.agreements (
    agreement_id, user_id, beat_id, download_id,
    user_name, user_email, beat_title, producer_name,
    license_type, credits_used, file_type, agreement_text
  ) VALUES (
    _agreement_code, _user_id, _beat_id, _download_id,
    COALESCE(_profile.full_name, _profile.display_name, _profile.email),
    _profile.email, _beat.title, 'KRAZYJAYDOTCOM',
    _license_type, _credits_cost, _file_label, _agreement_text
  ) RETURNING id INTO _agreement_uuid;

  RETURN jsonb_build_object(
    'download_id', _download_id,
    'agreement_id', _agreement_uuid,
    'agreement_code', _agreement_code,
    'credits_remaining', _profile.credits_balance - _credits_cost,
    'audio_url', _audio_url,
    'license_type', _license_type,
    'tier', CASE WHEN _is_paid THEN 'paid' ELSE 'free' END
  );
END;
$function$;
