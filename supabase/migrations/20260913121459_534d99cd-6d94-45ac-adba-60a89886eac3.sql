ALTER TABLE public.beats
  ADD COLUMN IF NOT EXISTS landing_visibility text NOT NULL DEFAULT 'private';

UPDATE public.beats
SET landing_visibility = CASE
  WHEN is_landing_published THEN 'public'
  ELSE 'private'
END;

ALTER TABLE public.beats
  ADD CONSTRAINT beats_landing_visibility_check
  CHECK (landing_visibility IN ('public', 'unlisted', 'private'));

CREATE INDEX IF NOT EXISTS beats_landing_visibility_idx
  ON public.beats (landing_visibility)
  WHERE landing_visibility <> 'private';