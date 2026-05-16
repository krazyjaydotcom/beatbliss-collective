alter table public.chat_messages
  add column if not exists audio_url text,
  add column if not exists audio_mime text,
  add column if not exists audio_duration_seconds integer;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-voice-memos',
  'chat-voice-memos',
  true,
  10485760,
  array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users upload chat voice memos" on storage.objects;
create policy "Authenticated users upload chat voice memos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-voice-memos'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

drop policy if exists "Anyone can read chat voice memos" on storage.objects;
create policy "Anyone can read chat voice memos"
  on storage.objects
  for select
  using (bucket_id = 'chat-voice-memos');

drop policy if exists "Owners can update chat voice memos" on storage.objects;
create policy "Owners can update chat voice memos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'chat-voice-memos'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
  with check (
    bucket_id = 'chat-voice-memos'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

drop policy if exists "Owners can delete chat voice memos" on storage.objects;
create policy "Owners can delete chat voice memos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-voice-memos'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

create or replace function public.bump_chat_thread()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.chat_threads
  set last_message_at = new.created_at,
      last_message_preview = left(coalesce(nullif(new.body, ''), 'Voice memo'), 140),
      unread_for_admin = case when new.sender_role = 'user' then unread_for_admin + 1 else unread_for_admin end,
      unread_for_user = case when new.sender_role = 'admin' then unread_for_user + 1 else unread_for_user end,
      updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

notify pgrst, 'reload schema';
