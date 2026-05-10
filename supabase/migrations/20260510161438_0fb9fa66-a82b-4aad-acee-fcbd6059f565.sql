-- Grant admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('3d2fae25-7306-44d7-99f2-3f9c66c9361e', 'admin')
ON CONFLICT DO NOTHING;

-- Chat threads (one per user)
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  unread_for_admin integer NOT NULL DEFAULT 0,
  unread_for_user integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own thread" ON public.chat_threads
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own thread" ON public.chat_threads
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own thread" ON public.chat_threads
FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all threads" ON public.chat_threads
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all threads" ON public.chat_threads
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_chat_threads_updated
BEFORE UPDATE ON public.chat_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own thread messages" ON public.chat_messages
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
);
CREATE POLICY "Users insert own messages" ON public.chat_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND sender_role = 'user'
  AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
);
CREATE POLICY "Admins view all messages" ON public.chat_messages
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert messages" ON public.chat_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND sender_role = 'admin'
  AND public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Anyone update read_at on own visible messages" ON public.chat_messages
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Trigger to bump thread on new message
CREATE OR REPLACE FUNCTION public.bump_chat_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_threads
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.body, 140),
      unread_for_admin = CASE WHEN NEW.sender_role = 'user' THEN unread_for_admin + 1 ELSE unread_for_admin END,
      unread_for_user = CASE WHEN NEW.sender_role = 'admin' THEN unread_for_user + 1 ELSE unread_for_user END,
      updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_chat_thread
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_chat_thread();

-- RPC to ensure a thread exists for the current user
CREATE OR REPLACE FUNCTION public.ensure_chat_thread()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _id FROM public.chat_threads WHERE user_id = _uid;
  IF _id IS NULL THEN
    INSERT INTO public.chat_threads (user_id) VALUES (_uid) RETURNING id INTO _id;
  END IF;
  RETURN _id;
END;
$$;

-- RPC to mark messages read
CREATE OR REPLACE FUNCTION public.mark_thread_read(_thread_id uuid, _as_admin boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _as_admin THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE public.chat_messages SET read_at = now()
      WHERE thread_id = _thread_id AND sender_role = 'user' AND read_at IS NULL;
    UPDATE public.chat_threads SET unread_for_admin = 0 WHERE id = _thread_id;
  ELSE
    UPDATE public.chat_messages SET read_at = now()
      WHERE thread_id = _thread_id AND sender_role = 'admin' AND read_at IS NULL
      AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = _thread_id AND t.user_id = auth.uid());
    UPDATE public.chat_threads SET unread_for_user = 0
      WHERE id = _thread_id AND user_id = auth.uid();
  END IF;
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_threads REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Allow admins to read all profiles (needed for admin dashboard, support inbox, presence)
CREATE POLICY "Admins view all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));