-- Storage buckets for beat assets (admin-uploaded)
INSERT INTO storage.buckets (id, name, public) VALUES ('beat-audio', 'beat-audio', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('beat-covers', 'beat-covers', true) ON CONFLICT (id) DO NOTHING;

-- Public read for both buckets
CREATE POLICY "Public read beat-audio" ON storage.objects FOR SELECT USING (bucket_id = 'beat-audio');
CREATE POLICY "Public read beat-covers" ON storage.objects FOR SELECT USING (bucket_id = 'beat-covers');

-- Admins can upload/manage objects in those buckets
CREATE POLICY "Admins write beat-audio" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'beat-audio' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update beat-audio" ON storage.objects FOR UPDATE
  USING (bucket_id = 'beat-audio' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete beat-audio" ON storage.objects FOR DELETE
  USING (bucket_id = 'beat-audio' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write beat-covers" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'beat-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update beat-covers" ON storage.objects FOR UPDATE
  USING (bucket_id = 'beat-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete beat-covers" ON storage.objects FOR DELETE
  USING (bucket_id = 'beat-covers' AND public.has_role(auth.uid(), 'admin'));

-- Admin gift credits: SECURITY DEFINER so admin can update other users' balances
CREATE OR REPLACE FUNCTION public.admin_gift_credits(_user_id uuid, _amount integer, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount = 0 THEN
    RAISE EXCEPTION 'amount must be non-zero';
  END IF;

  UPDATE public.profiles
  SET credits_balance = credits_balance + _amount
  WHERE id = _user_id
  RETURNING credits_balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  INSERT INTO public.transactions (user_id, type, credits_amount, description)
  VALUES (_user_id, 'gift', _amount, COALESCE(_note, 'Admin gift'));

  RETURN jsonb_build_object('new_balance', _new_balance);
END;
$$;

-- Admin imports a beat row (bypasses any future restrictions, uses admin check)
CREATE OR REPLACE FUNCTION public.admin_import_beat(
  _title text, _genre text, _mood text, _bpm integer, _music_key text,
  _duration_seconds integer, _audio_url text, _cover_url text, _producer_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  -- Skip if a beat with the same audio_url already exists
  SELECT id INTO _id FROM public.beats WHERE audio_url = _audio_url LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  INSERT INTO public.beats (title, genre, mood, bpm, music_key, duration_seconds, audio_url, cover_url, producer_name, is_member_only)
  VALUES (_title, _genre, COALESCE(_mood, 'Unknown'), _bpm, COALESCE(_music_key, 'C'), _duration_seconds, _audio_url, _cover_url, COALESCE(_producer_name, 'KRAZYJAY'), false)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;