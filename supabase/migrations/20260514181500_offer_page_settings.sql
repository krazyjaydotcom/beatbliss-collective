create table if not exists public.offer_page_settings (
  id text primary key default 'main',
  video_url text,
  eyebrow text not null default 'Your beat is reserved',
  headline_template text not null default '{beat} is Reserved For You',
  intro_text text not null default 'This is a private offer. Watch the video below to see everything you get with your membership before the timer expires.',
  video_title text not null default 'Watch the private offer video',
  video_body text not null default 'A quick breakdown of how MYBEATCATALOG helps artists create, release, and stay consistent.',
  beat_title text not null default 'Preview the beat',
  benefits_title text not null default 'Membership includes',
  benefits jsonb not null default '["Full Beat Catalog","New Beats Weekly","Direct Artist Access","Cancel Anytime"]'::jsonb,
  section_order jsonb not null default '["video","beat","benefits"]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.offer_page_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'offer_page_settings'
      and policyname = 'Anyone can read offer page settings'
  ) then
    create policy "Anyone can read offer page settings"
      on public.offer_page_settings
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'offer_page_settings'
      and policyname = 'Admins manage offer page settings'
  ) then
    create policy "Admins manage offer page settings"
      on public.offer_page_settings
      for all
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;

insert into public.offer_page_settings (id)
values ('main')
on conflict (id) do nothing;