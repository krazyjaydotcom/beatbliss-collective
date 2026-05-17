create table if not exists public.homepage_settings (
  id text primary key default 'main',
  hero_media_type text not null default 'image' check (hero_media_type in ('image', 'video')),
  hero_media_url text,
  updated_at timestamptz not null default now()
);

alter table public.homepage_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'homepage_settings'
      and policyname = 'Anyone can read homepage settings'
  ) then
    create policy "Anyone can read homepage settings"
      on public.homepage_settings
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'homepage_settings'
      and policyname = 'Admins can manage homepage settings'
  ) then
    create policy "Admins can manage homepage settings"
      on public.homepage_settings
      for all
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end $$;

insert into public.homepage_settings (id, hero_media_type, hero_media_url)
values ('main', 'image', null)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
