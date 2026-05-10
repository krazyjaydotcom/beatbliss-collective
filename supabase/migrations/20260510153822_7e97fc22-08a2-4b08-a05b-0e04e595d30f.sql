
REVOKE EXECUTE ON FUNCTION public.process_beat_download(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_beat_download(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
