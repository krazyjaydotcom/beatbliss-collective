create extension if not exists pgcrypto;

create table if not exists public.exclusive_requests (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_amount numeric(10,2),
  intended_use text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'open', 'closed', 'sold', 'rejected')),
  minimum_bid numeric(10,2),
  bid_deadline timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exclusive_bids (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.exclusive_requests(id) on delete cascade,
  beat_id uuid not null references public.beats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, user_id)
);

create index if not exists exclusive_requests_beat_idx on public.exclusive_requests(beat_id);
create index if not exists exclusive_requests_status_idx on public.exclusive_requests(status);
create index if not exists exclusive_requests_requested_by_idx on public.exclusive_requests(requested_by);
create index if not exists exclusive_requests_deadline_idx on public.exclusive_requests(bid_deadline);
create index if not exists exclusive_bids_request_idx on public.exclusive_bids(request_id);
create index if not exists exclusive_bids_beat_idx on public.exclusive_bids(beat_id);
create index if not exists exclusive_bids_user_idx on public.exclusive_bids(user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_exclusive_requests_updated_at on public.exclusive_requests;
create trigger touch_exclusive_requests_updated_at
before update on public.exclusive_requests
for each row execute function public.touch_updated_at();

drop trigger if exists touch_exclusive_bids_updated_at on public.exclusive_bids;
create trigger touch_exclusive_bids_updated_at
before update on public.exclusive_bids
for each row execute function public.touch_updated_at();

alter table public.exclusive_requests enable row level security;
alter table public.exclusive_bids enable row level security;

drop policy if exists "Users can create exclusive requests" on public.exclusive_requests;
create policy "Users can create exclusive requests"
  on public.exclusive_requests for insert
  to authenticated
  with check (requested_by = auth.uid());

drop policy if exists "Users can view their exclusive requests" on public.exclusive_requests;
create policy "Users can view their exclusive requests"
  on public.exclusive_requests for select
  to authenticated
  using (requested_by = auth.uid());

drop policy if exists "Admins manage exclusive requests" on public.exclusive_requests;
create policy "Admins manage exclusive requests"
  on public.exclusive_requests for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Users can view their exclusive bids" on public.exclusive_bids;
create policy "Users can view their exclusive bids"
  on public.exclusive_bids for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins manage exclusive bids" on public.exclusive_bids;
create policy "Admins manage exclusive bids"
  on public.exclusive_bids for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.list_my_exclusive_opportunities()
returns table (
  request_id uuid,
  beat_id uuid,
  beat_title text,
  cover_url text,
  genre text,
  bpm integer,
  requested_amount numeric,
  minimum_bid numeric,
  bid_deadline timestamptz,
  current_high_bid numeric,
  my_bid numeric,
  bidder_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id as request_id,
    b.id as beat_id,
    b.title as beat_title,
    b.cover_url,
    b.genre,
    b.bpm,
    r.requested_amount,
    r.minimum_bid,
    r.bid_deadline,
    coalesce((select max(eb.amount) from public.exclusive_bids eb where eb.request_id = r.id), 0)::numeric as current_high_bid,
    (select eb.amount from public.exclusive_bids eb where eb.request_id = r.id and eb.user_id = auth.uid() limit 1) as my_bid,
    (select count(*)::integer from public.exclusive_bids eb where eb.request_id = r.id) as bidder_count
  from public.exclusive_requests r
  join public.beats b on b.id = r.beat_id
  where r.status = 'open'
    and r.bid_deadline is not null
    and r.bid_deadline > now()
    and exists (
      select 1
      from public.downloads d
      where d.beat_id = r.beat_id
        and d.user_id = auth.uid()
    )
  order by r.bid_deadline asc;
$$;

create or replace function public.place_exclusive_bid(_request_id uuid, _amount numeric, _note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.exclusive_requests%rowtype;
  uid uuid := auth.uid();
  min_amount numeric;
  existing_amount numeric;
begin
  if uid is null then
    raise exception 'You must be logged in to bid.';
  end if;

  select * into req
  from public.exclusive_requests
  where id = _request_id;

  if req.id is null then
    raise exception 'Exclusive request not found.';
  end if;

  if req.status <> 'open' or req.bid_deadline is null or req.bid_deadline <= now() then
    raise exception 'This bidding window is closed.';
  end if;

  if not exists (
    select 1 from public.downloads d
    where d.beat_id = req.beat_id and d.user_id = uid
  ) then
    raise exception 'Only members who downloaded this beat can bid.';
  end if;

  min_amount := greatest(coalesce(req.minimum_bid, 0), coalesce(req.requested_amount, 0), 1);
  if _amount < min_amount then
    raise exception 'Minimum bid is $%.', min_amount;
  end if;

  select amount into existing_amount
  from public.exclusive_bids
  where request_id = _request_id and user_id = uid;

  if existing_amount is not null and _amount <= existing_amount then
    raise exception 'Enter a higher amount than your current bid.';
  end if;

  insert into public.exclusive_bids (request_id, beat_id, user_id, amount, note)
  values (_request_id, req.beat_id, uid, _amount, nullif(trim(coalesce(_note, '')), ''))
  on conflict (request_id, user_id)
  do update set amount = excluded.amount, note = excluded.note;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.list_my_exclusive_opportunities() to authenticated;
grant execute on function public.place_exclusive_bid(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';