begin;
-- Extend existing admin-only Trash to purchased licenses and saved drafts.
-- Preserve the deployed authorization, dependency checks, atomicity and restore logic.
do $migration$
declare definition text;
begin
 select pg_get_functiondef(oid) into strict definition from pg_proc where proname='admin_manage_records' and pronamespace='public'::regnamespace;
 if position('''purchase_licenses''' in definition)=0 then
  if position('''access_applications'',''agreements''' in definition)=0 then raise exception 'Unexpected record manager; review before applying'; end if;
  definition := replace(definition, '''access_applications'',''agreements''', '''access_applications'',''admin_email_drafts'',''purchase_licenses'',''agreements''');
  execute definition;
 end if;
end $migration$;
-- Bird acceptance is separate from delivery; ambiguous transport outcomes are retained.
alter table public.email_send_log drop constraint if exists email_send_log_status_check;
alter table public.email_send_log add constraint email_send_log_status_check check (status in ('pending','sent','suppressed','failed','bounced','complained','dlq','accepted','unknown'));

commit;
