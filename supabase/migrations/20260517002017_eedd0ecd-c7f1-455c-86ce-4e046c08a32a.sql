create or replace function public.claim_beat(
  _email text,
  _beat_id uuid,
  _source text default null,
  _ip_address text default null,
  _user_agent text default null,
  _device_fingerprint text default null
)
returns table (token text, expires_at timestamptz, beat_id uuid, reused boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm text := lower(trim(_email));
  ip_norm text := nullif(trim(coalesce(_ip_address, '')), '');
  ua_norm text := left(nullif(trim(coalesce(_user_agent, '')), ''), 500);
  fingerprint_norm text := nullif(lower(trim(coalesce(_device_fingerprint, ''))), '');
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
  where c.purchased_at is null
    and (
      lower(c.email) = email_norm
      or (fingerprint_norm is not null and c.device_fingerprint = fingerprint_norm)
    )
  order by c.created_at desc
  limit 1;

  if existing.id is not null then
    if existing.expires_at > now() then
      token := existing.token;
      expires_at := existing.expires_at;
      beat_id := existing.beat_id;
      reused := true;
      return next;
      return;
    end if;

    raise exception 'This private offer window has expired. Please contact support if you need help.';
  end if;

  loop
    new_token := public.make_beat_claim_token();
    begin
      insert into public.beat_claims (email, beat_id, token, source, ip_address, user_agent, device_fingerprint, expires_at)
      values (email_norm, _beat_id, new_token, nullif(trim(_source), ''), ip_norm, ua_norm, fingerprint_norm, now() + interval '12 hours')
      returning * into inserted;
      exit;
    exception when unique_violation then
    end;
  end loop;

  token := inserted.token;
  expires_at := inserted.expires_at;
  beat_id := inserted.beat_id;
  reused := false;
  return next;
end;
$$;

grant execute on function public.claim_beat(text, uuid, text, text, text, text) to anon, authenticated;

create or replace function public.admin_delete_beat_claim(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden';
  end if;

  delete from public.beat_claims where id = _id;
end;
$$;

create or replace function public.admin_delete_beat_request(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden';
  end if;

  delete from public.beat_requests where id = _id;
end;
$$;

grant execute on function public.admin_delete_beat_claim(uuid) to authenticated;
grant execute on function public.admin_delete_beat_request(uuid) to authenticated;

notify pgrst, 'reload schema';