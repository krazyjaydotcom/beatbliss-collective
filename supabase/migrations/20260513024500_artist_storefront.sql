-- Artist Store columns for profiles table
-- Stores public artist storefront data as text/json only. No file storage is required.

alter table public.profiles
  add column if not exists store_username text unique,
  add column if not exists store_name text,
  add column if not exists store_bio text,
  add column if not exists store_artwork_url text,
  add column if not exists store_tracks jsonb not null default '[]'::jsonb,
  add column if not exists store_buy_url text,
  add column if not exists store_donate_url text;

create index if not exists profiles_store_username_idx
  on public.profiles (store_username)
  where store_username is not null;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Public can view artist stores'
  ) then
    create policy "Public can view artist stores"
      on public.profiles
      for select
      to anon, authenticated
      using (store_username is not null);
  end if;
end $$;
