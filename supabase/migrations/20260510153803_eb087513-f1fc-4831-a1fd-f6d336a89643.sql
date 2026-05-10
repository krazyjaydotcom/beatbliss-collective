
-- 1. Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_balance integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS full_name text;

-- 2. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 3. Beats (public catalog)
CREATE TABLE public.beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  producer_name text NOT NULL DEFAULT 'KRAZYJAY',
  genre text NOT NULL,
  mood text NOT NULL,
  music_key text NOT NULL,
  bpm integer NOT NULL,
  duration_seconds integer NOT NULL,
  cover_url text,
  audio_url text,
  is_member_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view beats" ON public.beats FOR SELECT USING (true);
CREATE POLICY "Admins manage beats" ON public.beats FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Notes
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beat_id uuid REFERENCES public.beats(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own notes select" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users CRUD own notes insert" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users CRUD own notes update" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users CRUD own notes delete" ON public.notes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Downloads
CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beat_id uuid NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  credits_used integer NOT NULL DEFAULT 1,
  file_type text NOT NULL DEFAULT 'MP3',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own downloads" ON public.downloads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all downloads" ON public.downloads FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 6. Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  credits_amount integer NOT NULL DEFAULT 0,
  beat_id uuid REFERENCES public.beats(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 7. Agreements
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beat_id uuid NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  download_id uuid REFERENCES public.downloads(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  user_email text NOT NULL,
  beat_title text NOT NULL,
  producer_name text NOT NULL DEFAULT 'KRAZYJAYDOTCOM',
  license_type text NOT NULL DEFAULT 'Standard Membership License',
  credits_used integer NOT NULL DEFAULT 1,
  file_type text NOT NULL DEFAULT 'MP3',
  agreement_text text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pdf_url text
);
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own agreements" ON public.agreements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all agreements" ON public.agreements FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 8. RPC: process download atomically (deduct credits, log download, transaction, agreement)
CREATE OR REPLACE FUNCTION public.process_beat_download(_beat_id uuid, _file_type text DEFAULT 'MP3')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _profile public.profiles%ROWTYPE;
  _beat public.beats%ROWTYPE;
  _credits_cost integer := 1;
  _download_id uuid;
  _agreement_uuid uuid;
  _agreement_code text;
  _agreement_text text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _user_id FOR UPDATE;
  SELECT * INTO _beat FROM public.beats WHERE id = _beat_id;

  IF _beat.id IS NULL THEN
    RAISE EXCEPTION 'Beat not found';
  END IF;

  IF _profile.credits_balance < _credits_cost THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  UPDATE public.profiles SET credits_balance = credits_balance - _credits_cost WHERE id = _user_id;

  INSERT INTO public.downloads (user_id, beat_id, credits_used, file_type)
  VALUES (_user_id, _beat_id, _credits_cost, _file_type)
  RETURNING id INTO _download_id;

  INSERT INTO public.transactions (user_id, type, credits_amount, beat_id, description)
  VALUES (_user_id, 'download', -_credits_cost, _beat_id, 'Download: ' || _beat.title);

  _agreement_code := 'KJD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  _agreement_text := 'KRAZYJAYDOTCOM Beat Download Agreement' || E'\n\n' ||
    'This agreement confirms that the user has downloaded the selected beat from KRAZYJAYDOTCOM using their available membership credits. ' ||
    'The user is granted a limited license to use the downloaded beat according to the license type attached to their membership plan or purchase. ' ||
    'The user may use the beat for recording, songwriting, demo creation, social media content, and music distribution, unless otherwise restricted by their selected license. ' ||
    'The user may not resell, redistribute, upload, share, or claim ownership of the beat as their own original production. ' ||
    'KRAZYJAYDOTCOM retains full ownership of the original beat composition, production, arrangement, and master file unless an exclusive rights agreement is separately purchased. ' ||
    'By downloading this beat, the user agrees to the terms of this license and acknowledges that one or more credits may be deducted from their account.';

  INSERT INTO public.agreements (
    agreement_id, user_id, beat_id, download_id,
    user_name, user_email, beat_title, producer_name,
    license_type, credits_used, file_type, agreement_text
  ) VALUES (
    _agreement_code, _user_id, _beat_id, _download_id,
    COALESCE(_profile.full_name, _profile.display_name, _profile.email),
    _profile.email, _beat.title, 'KRAZYJAYDOTCOM',
    'Standard Membership License', _credits_cost, _file_type, _agreement_text
  ) RETURNING id INTO _agreement_uuid;

  RETURN jsonb_build_object(
    'download_id', _download_id,
    'agreement_id', _agreement_uuid,
    'agreement_code', _agreement_code,
    'credits_remaining', _profile.credits_balance - _credits_cost,
    'audio_url', _beat.audio_url
  );
END;
$$;

-- 9. Seed beats
INSERT INTO public.beats (title, genre, mood, music_key, bpm, duration_seconds, is_member_only) VALUES
  ('No Looking Back', 'Trap', 'Hard', 'C# Minor', 140, 151, true),
  ('Focused', 'Trap', 'Motivational', 'D Minor', 150, 165, false),
  ('Late Nights', 'R&B', 'Smooth', 'G Minor', 120, 182, false),
  ('Built Different', 'Trap', 'Hard', 'E Minor', 145, 148, false),
  ('Can''t Lose', 'Trap', 'Bouncy', 'F Minor', 130, 139, false),
  ('Take Over', 'Drill', 'Dark', 'D# Minor', 142, 156, false),
  ('Right Now', 'Trap', 'Confident', 'A Minor', 148, 160, false),
  ('On My Mind', 'R&B', 'Melancholic', 'B Minor', 110, 195, false);
