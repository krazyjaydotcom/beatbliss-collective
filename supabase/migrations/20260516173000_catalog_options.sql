create extension if not exists pgcrypto;

create table if not exists public.catalog_options (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('signature_sound', 'mood')),
  value text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalog_options_type_value_unique
  on public.catalog_options (type, lower(value));

alter table public.catalog_options enable row level security;

drop policy if exists "Authenticated can read catalog options" on public.catalog_options;
create policy "Authenticated can read catalog options"
  on public.catalog_options
  for select
  to authenticated
  using (true);

drop policy if exists "Admins manage catalog options" on public.catalog_options;
create policy "Admins manage catalog options"
  on public.catalog_options
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

insert into public.catalog_options (type, value, sort_order) values
  ('signature_sound', 'Trap', 10),
  ('signature_sound', 'R&B', 20),
  ('signature_sound', 'Melodic', 30),
  ('signature_sound', 'Drill', 40),
  ('signature_sound', 'Gospel', 50),
  ('signature_sound', 'Cinematic', 60),
  ('signature_sound', 'Emotional', 70),
  ('signature_sound', 'Motivational', 80),
  ('signature_sound', 'Dark', 90),
  ('signature_sound', 'Chill', 100),
  ('mood', 'Unknown', 10),
  ('mood', 'Hard', 20),
  ('mood', 'Chill', 30),
  ('mood', 'Dark', 40),
  ('mood', 'Pain', 50),
  ('mood', 'Uplifting', 60),
  ('mood', 'Inspirational', 70),
  ('mood', 'Motivational', 80)
on conflict do nothing;

notify pgrst, 'reload schema';
