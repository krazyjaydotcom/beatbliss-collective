alter table public.offer_page_settings
  add column if not exists show_intro_text boolean not null default true,
  add column if not exists show_video_body boolean not null default true,
  add column if not exists show_video_cta boolean not null default true,
  add column if not exists video_cta_text text not null default 'See Special Offer';

update public.offer_page_settings
set
  show_intro_text = coalesce(show_intro_text, true),
  show_video_body = coalesce(show_video_body, true),
  show_video_cta = coalesce(show_video_cta, true),
  video_cta_text = coalesce(nullif(video_cta_text, ''), 'See Special Offer')
where id = 'main';

notify pgrst, 'reload schema';
