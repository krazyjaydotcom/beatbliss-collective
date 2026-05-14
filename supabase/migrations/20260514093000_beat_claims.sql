create extension if not exists pgcrypto;

create table if not exists public.beat_claims (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  beat_id uuid not null references public.beats (id) on delete cascade,
  token text not null unique,
  source text,
  checkout_session_id text,
  purchased_at timestamptz,
  expires_at timestamptz not null default (now() + interval '12 hours'),
  created_at timestamptz not null default now()
);

alter table public.beat_claims add column if not exists email text;
alter table public.beat_claims add column if not exists beat_id uuid references public.beats (id) on delete cascade;
alter table public.beat_claims add column if not exists token text;
alter table public.beat_claims add column if not exists source text;
alter table public.beat_claims add column if not exists checkout_session_id text;
alter table public.beat_claims add column if not exists purchased_at timestamptz;
alter table public.beat_claims add column if not exists expires_at timestamptz not null default (now() + interval '12 hours');
alter table public.beat_claims add column if not exists created_at timestamptz not null default now();

create unique index if not exists beat_claims_token_unique_idx on public.beat_claims (token);
create index if not exists beat_claims_email_idx on public.beat_claims (lower(email));
create index if not exists beat_claims_beat_id_idx on public.beat_claims (beat_id);
create index if not exists beat_claims_created_at_idx on public.beat_claims (created_at desc);

alter table public.beat_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beat_claims' and policyname = 'Admins can read all beat claims'
  ) then
    create policy "Admins can read all beat claims"
      on public.beat_claims
      for select
      using (public.is_admin_user(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beat_claims' and policyname = 'Admins can update all beat claims'
  ) then
    create policy "Admins can update all beat claims"
      on public.beat_claims
      for update
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beat_claims' and policyname = 'Admins can delete beat claims'
  ) then
    create policy "Admins can delete beat claims"
      on public.beat_claims
      for delete
      using (public.is_admin_user(auth.uid()));
  end if;
end
$$;

create or replace function public.make_beat_claim_token()
returns text
language plpgsql
volatile
as $$
declare
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  raw text := '';
  i integer;
begin
  for i in 1..12 loop
    raw := raw || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;
  return substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
end;
$$;

create or replace function public.list_claimable_beats()
returns table (
  id uuid,
  title text,
  producer_name text,
  genre text,
  mood text,
  music_key text,
  bpm integer,
  duration_seconds integer,
  cover_url text,
  audio_url text,
  audio_url_tagged text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.title,
    b.producer_name,
    b.genre,
    b.mood,
    b.music_key,
    b.bpm,
    b.duration_seconds,
    b.cover_url,
    b.audio_url,
    b.audio_url_tagged,
    b.created_at
  from public.beats b
  where (b.release_at is null or b.release_at <= now())
    and coalesce(b.audio_url_tagged, b.audio_url) is not null
  order by b.created_at desc;
$$;

create or replace function public.claim_beat(_email text, _beat_id uuid, _source text default null)
returns table (token text, expires_at timestamptz, beat_id uuid, reused boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm text := lower(trim(_email));
  existing public.beat_claims%rowtype;
  new_token text;
  inserted public.beat_claims%rowtype;
begin
  if length(email_norm) < 6 or position('@' in email_norm) = 0 or position('.' in split_part(email_norm, '@', 2)) = 0 then
    raise exception 'Enter a valid email address.';
  end if;

  if not exists (
    select 1
    from public.beats b
    where b.id = _beat_id
      and (b.release_at is null or b.release_at <= now())
      and coalesce(b.audio_url_tagged, b.audio_url) is not null
  ) then
    raise exception 'This beat is not available for claiming.';
  end if;

  select * into existing
  from public.beat_claims c
  where lower(c.email) = email_norm
    and c.expires_at > now()
  order by c.created_at desc
  limit 1;

  if existing.id is not null then
    token := existing.token;
    expires_at := existing.expires_at;
    beat_id := existing.beat_id;
    reused := true;
    return next;
    return;
  end if;

  loop
    new_token := public.make_beat_claim_token();
    begin
      insert into public.beat_claims (email, beat_id, token, source, expires_at)
      values (email_norm, _beat_id, new_token, nullif(trim(_source), ''), now() + interval '12 hours')
      returning * into inserted;
      exit;
    exception when unique_violation then
      -- Try another token.
    end;
  end loop;

  token := inserted.token;
  expires_at := inserted.expires_at;
  beat_id := inserted.beat_id;
  reused := false;
  return next;
end;
$$;

create or replace function public.get_beat_offer(_token text)
returns table (
  claim_id uuid,
  token text,
  email text,
  expires_at timestamptz,
  created_at timestamptz,
  purchased_at timestamptz,
  beat_id uuid,
  title text,
  producer_name text,
  genre text,
  mood text,
  music_key text,
  bpm integer,
  duration_seconds integer,
  cover_url text,
  audio_url text,
  audio_url_tagged text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as claim_id,
    c.token,
    c.email,
    c.expires_at,
    c.created_at,
    c.purchased_at,
    b.id as beat_id,
    b.title,
    b.producer_name,
    b.genre,
    b.mood,
    b.music_key,
    b.bpm,
    b.duration_seconds,
    b.cover_url,
    b.audio_url,
    b.audio_url_tagged
  from public.beat_claims c
  join public.beats b on b.id = c.beat_id
  where c.token = _token
  limit 1;
$$;

grant execute on function public.list_claimable_beats() to anon, authenticated;
grant execute on function public.claim_beat(text, uuid, text) to anon, authenticated;
grant execute on function public.get_beat_offer(text) to anon, authenticated;
