
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS audio_url_wav text;

CREATE OR REPLACE FUNCTION public.admin_bulk_update_beats(
  _ids uuid[],
  _genre text DEFAULT NULL,
  _mood text DEFAULT NULL,
  _bpm integer DEFAULT NULL,
  _music_key text DEFAULT NULL,
  _is_member_only boolean DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.beats SET
    genre = COALESCE(_genre, genre),
    mood = COALESCE(_mood, mood),
    bpm = COALESCE(_bpm, bpm),
    music_key = COALESCE(_music_key, music_key),
    is_member_only = COALESCE(_is_member_only, is_member_only)
  WHERE id = ANY(_ids);
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
