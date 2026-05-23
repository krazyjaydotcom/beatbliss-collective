
-- Extend notifications with type and target_url
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS target_url text;

-- Admin RPC: create a single notification (one user) or broadcast (all active members)
CREATE OR REPLACE FUNCTION public.admin_create_notification(
  _title text,
  _body text DEFAULT '',
  _type text DEFAULT 'general',
  _target_url text DEFAULT NULL,
  _user_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, target_url)
    VALUES (_user_id, _title, COALESCE(_body, ''), COALESCE(_type, 'general'), _target_url);
    RETURN 1;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, target_url)
  SELECT p.id, _title, COALESCE(_body, ''), COALESCE(_type, 'general'), _target_url
  FROM public.profiles p
  WHERE p.subscription_status = 'active';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Admin RPC: broadcast a chat message (text or audio) into each active member's thread
CREATE OR REPLACE FUNCTION public.admin_broadcast_chat_message(
  _body text DEFAULT '',
  _audio_url text DEFAULT NULL,
  _audio_mime text DEFAULT NULL,
  _audio_duration_seconds integer DEFAULT NULL,
  _user_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin uuid := auth.uid();
  _target_user uuid;
  _thread_id uuid;
  _count integer := 0;
  _is_audio boolean := _audio_url IS NOT NULL;
  _notif_title text;
  _notif_body text;
  _notif_type text;
BEGIN
  IF NOT public.has_role(_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _is_audio THEN
    _notif_title := 'New voice message from KrazyJay';
    _notif_body := 'Tap to listen';
    _notif_type := 'admin_audio_message';
  ELSE
    _notif_title := 'New message from KrazyJay';
    _notif_body := left(COALESCE(_body, ''), 140);
    _notif_type := 'admin_message';
  END IF;

  FOR _target_user IN
    SELECT p.id FROM public.profiles p
    WHERE (_user_id IS NULL AND p.subscription_status = 'active')
       OR (_user_id IS NOT NULL AND p.id = _user_id)
  LOOP
    -- Ensure thread exists
    SELECT id INTO _thread_id FROM public.chat_threads WHERE user_id = _target_user;
    IF _thread_id IS NULL THEN
      INSERT INTO public.chat_threads (user_id) VALUES (_target_user) RETURNING id INTO _thread_id;
    END IF;

    INSERT INTO public.chat_messages (
      thread_id, sender_id, sender_role, body,
      audio_url, audio_mime, audio_duration_seconds
    ) VALUES (
      _thread_id, _admin, 'admin',
      COALESCE(NULLIF(_body, ''), CASE WHEN _is_audio THEN 'Voice memo' ELSE '' END),
      _audio_url, _audio_mime, _audio_duration_seconds
    );

    INSERT INTO public.notifications (user_id, title, body, type, target_url)
    VALUES (_target_user, _notif_title, _notif_body, _notif_type, '/messages');

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- Catalog update notifications: when a beat is released (insert with release_at null/past,
-- or update flipping release_at from future to past), notify active members.
CREATE OR REPLACE FUNCTION public.notify_beat_released()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_live boolean;
  _was_live boolean;
BEGIN
  _is_live := NEW.is_active AND (NEW.release_at IS NULL OR NEW.release_at <= now());

  IF TG_OP = 'INSERT' THEN
    _was_live := false;
  ELSE
    _was_live := OLD.is_active AND (OLD.release_at IS NULL OR OLD.release_at <= now());
  END IF;

  IF _is_live AND NOT _was_live THEN
    INSERT INTO public.notifications (user_id, title, body, type, target_url)
    SELECT p.id,
           'New beat: ' || NEW.title,
           'A new beat just dropped in the catalog.',
           'catalog_update',
           '/beats'
    FROM public.profiles p
    WHERE p.subscription_status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_beat_released_ins ON public.beats;
CREATE TRIGGER trg_notify_beat_released_ins
AFTER INSERT ON public.beats
FOR EACH ROW EXECUTE FUNCTION public.notify_beat_released();

DROP TRIGGER IF EXISTS trg_notify_beat_released_upd ON public.beats;
CREATE TRIGGER trg_notify_beat_released_upd
AFTER UPDATE OF release_at, is_active ON public.beats
FOR EACH ROW EXECUTE FUNCTION public.notify_beat_released();
