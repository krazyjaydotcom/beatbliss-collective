
-- 1. Invites: drop public-readable policy and provide a token-scoped function
DROP POLICY IF EXISTS "Public can read invite by token" ON public.invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token text)
RETURNS TABLE (id uuid, used_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.used_at
  FROM public.invites i
  WHERE i.token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- 2. Profiles: drop column-leaking storefront policy and expose only safe public fields via a function
DROP POLICY IF EXISTS "Public can view storefront profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_storefront_profile(_username text)
RETURNS TABLE (
  store_username text,
  store_name text,
  store_bio text,
  store_artwork_url text,
  store_tracks jsonb,
  store_buy_url text,
  store_donate_url text,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.store_username,
    p.store_name,
    p.store_bio,
    p.store_artwork_url,
    p.store_tracks,
    p.store_buy_url,
    p.store_donate_url,
    p.display_name,
    p.avatar_url
  FROM public.profiles p
  WHERE p.store_username IS NOT NULL
    AND p.store_username = _username
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_profile(text) TO anon, authenticated;

-- 3. Chat voice memos: replace broad public SELECT with owner/admin scoped policy
DROP POLICY IF EXISTS "Anyone can read chat voice memos" ON storage.objects;

CREATE POLICY "Chat voice memos readable by participants"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'chat-voice-memos'
  AND (
    -- File owner
    split_part(name, '/', 1) = (auth.uid())::text
    -- Admins
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    -- Authenticated members listening to a clip uploaded by an admin
    OR (
      auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id::text = split_part(name, '/', 1)
          AND ur.role = 'admin'::public.app_role
      )
    )
  )
);
