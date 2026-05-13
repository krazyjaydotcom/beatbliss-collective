create extension if not exists pgcrypto;

create or replace function public.is_admin_user(_user_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  admin_found boolean := false;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'user_roles'
  ) then
    execute 'select exists (select 1 from public.user_roles where user_id = $1 and role = ''admin'')'
      into admin_found
      using _user_id;
  end if;

  return admin_found;
end;
$$;

create table if not exists public.beat_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  style text,
  reference_artists text,
  tempo text,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists beat_requests_one_per_month_idx
  on public.beat_requests (user_id, date_trunc('month', created_at));

alter table public.beat_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beat_requests' and policyname = 'Users can read own beat requests'
  ) then
    create policy "Users can read own beat requests"
      on public.beat_requests
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beat_requests' and policyname = 'Users can insert own beat requests'
  ) then
    create policy "Users can insert own beat requests"
      on public.beat_requests
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beat_requests' and policyname = 'Admins can read all beat requests'
  ) then
    create policy "Admins can read all beat requests"
      on public.beat_requests
      for select
      using (public.is_admin_user(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beat_requests' and policyname = 'Admins can update all beat requests'
  ) then
    create policy "Admins can update all beat requests"
      on public.beat_requests
      for update
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invites add column if not exists token text;
alter table public.invites add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.invites add column if not exists used_by uuid references auth.users (id) on delete set null;
alter table public.invites add column if not exists used_at timestamptz;
alter table public.invites add column if not exists created_at timestamptz not null default now();

create unique index if not exists invites_token_unique_idx on public.invites (token);

alter table public.invites enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invites' and policyname = 'Anyone can read invites'
  ) then
    create policy "Anyone can read invites"
      on public.invites
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invites' and policyname = 'Admins can insert invites'
  ) then
    create policy "Admins can insert invites"
      on public.invites
      for insert
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invites' and policyname = 'Admins can update invites'
  ) then
    create policy "Admins can update invites"
      on public.invites
      for update
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;

alter table public.beats add column if not exists release_at timestamptz;
