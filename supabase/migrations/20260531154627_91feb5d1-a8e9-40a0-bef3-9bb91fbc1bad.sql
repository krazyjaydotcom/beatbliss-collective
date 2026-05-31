-- Helper: classify a beat-audio storage object by what beat it belongs to
CREATE OR REPLACE FUNCTION public.beat_audio_access_level(_object_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.beats b
      WHERE (b.audio_url_tagged LIKE '%/' || _object_name)
         OR (COALESCE(b.is_member_only, false) = false AND (
              b.audio_url LIKE '%/' || _object_name
              OR b.audio_url_wav LIKE '%/' || _object_name))
    ) THEN 'public'
    WHEN EXISTS (
      SELECT 1 FROM public.beats b
      WHERE COALESCE(b.is_member_only, false) = true AND (
              b.audio_url LIKE '%/' || _object_name
              OR b.audio_url_wav LIKE '%/' || _object_name)
    ) THEN 'member'
    ELSE 'unknown'
  END
$$;

-- Replace the blanket public SELECT on beat-audio
DROP POLICY IF EXISTS "Public read beat-audio" ON storage.objects;

CREATE POLICY "Beat audio scoped read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'beat-audio' AND (
    public.beat_audio_access_level(name) = 'public'
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.subscription_status IN ('active','trialing','past_due')
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Fix chat voice memos: replace the over-broad "any authenticated user can read
-- admin uploads" branch with a check that the requesting user actually owns a
-- thread where this audio was sent.
DROP POLICY IF EXISTS "Chat voice memos readable by participants" ON storage.objects;

CREATE POLICY "Chat voice memos readable by participants"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'chat-voice-memos' AND (
    -- The uploader owns the file (path prefix is their user id)
    (auth.uid() IS NOT NULL AND split_part(name, '/', 1) = auth.uid()::text)
    -- Admins can read all chat audio
    OR public.has_role(auth.uid(), 'admin'::app_role)
    -- Or the requesting user owns a thread that contains a message
    -- pointing at this audio file
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages m
        JOIN public.chat_threads t ON t.id = m.thread_id
        WHERE t.user_id = auth.uid()
          AND m.audio_url LIKE '%/' || name
      )
    )
  )
);