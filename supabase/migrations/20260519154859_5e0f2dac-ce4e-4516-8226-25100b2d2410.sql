
-- Tags
create table if not exists public.beat_tags (
  slug text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

alter table public.beat_tags enable row level security;

create policy "Anyone can read beat tags" on public.beat_tags
  for select using (true);
create policy "Admins manage beat tags" on public.beat_tags
  for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Tag assignments
create table if not exists public.beat_tag_assignments (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  tag_slug text not null references public.beat_tags(slug) on delete cascade,
  created_at timestamptz not null default now(),
  unique(beat_id, tag_slug)
);

create index if not exists beat_tag_assignments_tag_idx on public.beat_tag_assignments(tag_slug);
create index if not exists beat_tag_assignments_beat_idx on public.beat_tag_assignments(beat_id);

alter table public.beat_tag_assignments enable row level security;

create policy "Anyone can read tag assignments" on public.beat_tag_assignments
  for select using (true);
create policy "Admins manage tag assignments" on public.beat_tag_assignments
  for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Beats: add active/featured flags
alter table public.beats add column if not exists is_active boolean not null default true;
alter table public.beats add column if not exists is_featured boolean not null default false;

-- SEO landing pages
create table if not exists public.seo_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  target_keyword text not null,
  seo_title text not null,
  meta_description text not null,
  h1 text not null,
  intro text not null,
  sections jsonb not null default '[]'::jsonb,
  tag_slugs text[] not null default '{}',
  related_page_slugs text[] not null default '{}',
  is_published boolean not null default true,
  featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seo_pages enable row level security;

create policy "Anyone can read published seo pages" on public.seo_pages
  for select using (is_published = true);
create policy "Admins read all seo pages" on public.seo_pages
  for select using (public.has_role(auth.uid(),'admin'));
create policy "Admins manage seo pages" on public.seo_pages
  for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create trigger seo_pages_touch
  before update on public.seo_pages
  for each row execute function public.touch_updated_at();

-- Dynamic beat lookup
create or replace function public.list_beats_by_tags(_slugs text[])
returns table (
  id uuid, title text, producer_name text, genre text, mood text, music_key text,
  bpm int, duration_seconds int, cover_url text, audio_url text, audio_url_tagged text,
  is_featured boolean, tag_slugs text[], created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select b.id, b.title, b.producer_name, b.genre, b.mood, b.music_key,
         b.bpm, b.duration_seconds, b.cover_url, b.audio_url, b.audio_url_tagged,
         b.is_featured,
         coalesce(array_agg(distinct a2.tag_slug) filter (where a2.tag_slug is not null), '{}') as tag_slugs,
         b.created_at
  from public.beats b
  join public.beat_tag_assignments a on a.beat_id = b.id
  left join public.beat_tag_assignments a2 on a2.beat_id = b.id
  where b.is_active = true
    and (b.release_at is null or b.release_at <= now())
    and coalesce(b.audio_url_tagged, b.audio_url) is not null
    and a.tag_slug = any(_slugs)
  group by b.id
  order by b.is_featured desc, b.created_at desc;
$$;

-- Seed tags
insert into public.beat_tags(slug, label) values
  ('cinematic','Cinematic'),('rnb','R&B'),('emotional','Emotional'),('trap','Trap'),
  ('night-drive','Night Drive'),('dark','Dark'),('pop','Pop'),('cyberpunk','Cyberpunk'),
  ('ambient','Ambient'),('trap-soul','Trap Soul'),('moody','Moody'),
  ('background-music','Background Music'),('synth','Synth'),('futuristic','Futuristic'),
  ('808','808'),('pain','Pain'),('melodic','Melodic')
on conflict (slug) do nothing;

-- Seed SEO pages
insert into public.seo_pages (slug, target_keyword, seo_title, meta_description, h1, intro, sections, tag_slugs, related_page_slugs, sort_order) values
('cinematic-rnb-type-beats','cinematic r&b type beats',
 'Cinematic R&B Type Beats — Premium Instrumentals | MYBEATCATALOG',
 'Hand-crafted cinematic R&B type beats with rich textures, lush chords, and film-score energy. Preview and claim a beat instantly.',
 'Cinematic R&B Type Beats',
 'Cinematic R&B type beats blend the emotional intimacy of modern R&B with the wide, filmic dynamics of a movie score. These instrumentals are built for artists who want their songs to feel bigger than the room — vocals that float over swelling strings, layered keys, and 808s that breathe instead of pound.',
 '[
  {"heading":"What makes cinematic R&B beats work","body":"The magic is in the contrast. A cinematic R&B beat usually starts intimate — a single Rhodes chord, vinyl crackle, a half-whispered vocal chop — then expands into a full arrangement with strings, pads, and sub-bass. That dynamic arc gives singers and writers room to take a listener on a journey instead of locking them into a single mood."},
  {"heading":"Who these beats are perfect for","body":"R&B vocalists, alternative singer-songwriters, and rap artists experimenting with melodic delivery. They also suit content creators scoring trailers, fashion edits, or short films where the music needs to carry emotion without distracting from picture."},
  {"heading":"How artists use them","body":"Most writers approach cinematic R&B beats top-line first — they hum a melody to the intro, then build verses around the quieter chord stabs and save the biggest hooks for the swell. Producers and engineers love them because they leave space for ad-libs, reverbs, and layered harmonies without crowding the low end."},
  {"heading":"Related beat styles","body":"If you like this vibe, also explore Late Night R&B type beats, Moody R&B, Dark Cinematic instrumentals, and Emotional Background Music."}
 ]'::jsonb,
 array['cinematic','rnb'],
 array['late-night-rnb-type-beats','moody-rnb-type-beats','dark-cinematic-beats','emotional-background-music'],10),

('emotional-trap-type-beats','emotional trap type beats',
 'Emotional Trap Type Beats — Melodic & Pain Instrumentals',
 'Emotional trap type beats with melodic guitars, pain-driven melodies, and hard-hitting 808s. Pick a beat and start writing tonight.',
 'Emotional Trap Type Beats',
 'Emotional trap is where melody meets weight. These beats pair vulnerable guitar loops, distant piano lines, and pain-leaning chord progressions with the same heavy 808s and crisp hi-hats that define modern trap — perfect for artists writing about real life, loss, growth, and the in-between.',
 '[
  {"heading":"What makes emotional trap beats work","body":"The contrast between a sad, exposed melody and a confident drum pattern lets the rapper or singer sit somewhere in between — vulnerable on the verses, untouchable on the hook. The space in the arrangement is just as important as the sounds, so vocals can carry the song."},
  {"heading":"Who these beats are perfect for","body":"Melodic rappers, alt-trap artists, and singers blending trap with R&B or pop. They also work for short-form video creators who need a track that feels honest in the first three seconds."},
  {"heading":"How artists use them","body":"A common workflow is freestyling a hook over the loop before drums come in, then locking the cadence to the 808 pattern on the verses. Many writers double the melody an octave up in their topline to give the final mix more emotional reach."},
  {"heading":"Related beat styles","body":"Pair this style with Dark Trap Soul, Moody R&B, and Pain-leaning Melodic Trap from the catalog."}
 ]'::jsonb,
 array['emotional','trap','pain','melodic'],
 array['dark-trap-soul-type-beats','moody-rnb-type-beats','dark-cinematic-beats'],20),

('night-drive-type-beats','night drive type beats',
 'Night Drive Type Beats — Moody Ambient R&B Instrumentals',
 'Night drive type beats with neon-lit synths, moody R&B chords, and ambient textures. Score the late-night highway in your headphones.',
 'Night Drive Type Beats',
 'Night drive beats are built for the highway at 2am — headlights, empty roads, and a low rumble in the chest. Expect glossy synths, dark moody chords, ambient pads, and patient drums that prioritize feel over flash.',
 '[
  {"heading":"What makes night drive beats work","body":"Tempo restraint and atmosphere. The drums rarely push past mid-tempo, the bass moves slowly, and the top layer is usually a wash of pads or a single arpeggio that catches the light. It''s music designed to feel cinematic on its own, before any vocal is added."},
  {"heading":"Who these beats are perfect for","body":"R&B and alternative artists, lofi and synthwave producers, and video creators making car edits, travel reels, drone footage, or moody narrative pieces."},
  {"heading":"How artists use them","body":"Songwriters often treat night drive beats as a soundscape: less rapid-fire writing, more breath and space. Many tracks land between 75 and 95 BPM, leaving room for double-time delivery in choruses without losing the cruising feel."},
  {"heading":"Related beat styles","body":"Explore Dark Cinematic beats, Cinematic R&B, Late Night R&B, and Ambient Trap for similar nocturnal energy."}
 ]'::jsonb,
 array['night-drive','moody','ambient','rnb','dark'],
 array['dark-cinematic-beats','cinematic-rnb-type-beats','late-night-rnb-type-beats','ambient-trap-beats'],30),

('dark-cinematic-beats','dark cinematic beats',
 'Dark Cinematic Beats — Film Score Instrumentals',
 'Dark cinematic beats with brooding strings, deep sub-bass, and trailer-grade tension. Built for artists, filmmakers, and content creators.',
 'Dark Cinematic Beats',
 'Dark cinematic beats live where film score meets modern production. Brooding strings, low piano clusters, deep sub-bass, and slow-burning percussion combine into instrumentals that can score a trailer or anchor a serious rap record.',
 '[
  {"heading":"What makes dark cinematic beats work","body":"Tension and release. Long sustained chords, dynamic swells, and carefully placed silence build pressure, then drums or 808s break the spell. The arrangements feel composed rather than looped, which is what makes them sound expensive."},
  {"heading":"Who these beats are perfect for","body":"Rappers chasing a serious tone, dark pop and alternative artists, indie filmmakers, trailer editors, and content creators producing high-stakes narrative video."},
  {"heading":"How artists use them","body":"In song form, writers tend to ride the low-end and use the swells as natural hook moments. In picture, editors will often cut to the first big drop, leaving the intro to set up the visual story."},
  {"heading":"Related beat styles","body":"Pair with Cinematic R&B, Night Drive, Cyberpunk, and Emotional Background Music."}
 ]'::jsonb,
 array['cinematic','dark'],
 array['cinematic-rnb-type-beats','night-drive-type-beats','cyberpunk-beats','emotional-background-music'],40),

('late-night-rnb-type-beats','late night r&b type beats',
 'Late Night R&B Type Beats — Slow Burn Instrumentals',
 'Late night R&B type beats with smoky chords, slow grooves, and vocal-friendly space. Pick a beat and write tonight.',
 'Late Night R&B Type Beats',
 'Late night R&B beats are slow burns. Warm Rhodes, slick basslines, brushed drums, and just enough air for a vocalist to whisper or wail. They are the catalog''s after-midnight section — intimate, sensual, and a little melancholic.',
 '[
  {"heading":"What makes late night R&B beats work","body":"Restraint. The grooves sit between 60 and 90 BPM, the chords lean jazzy, and the drums almost always stay in the background. The whole arrangement is built around vocal performance, not production tricks."},
  {"heading":"Who these beats are perfect for","body":"R&B and soul singers, songwriters cutting demos, podcast intros that need a mood, and creators making editorial or fashion video."},
  {"heading":"How artists use them","body":"Most singers start by recording a free-form vocal pass over the loop, then refine cadence and melody around the chord changes. Engineers love how much headroom these beats leave for harmonies."},
  {"heading":"Related beat styles","body":"Try Cinematic R&B, Moody R&B, Night Drive, and Emotional Trap-Soul for adjacent vibes."}
 ]'::jsonb,
 array['rnb','moody','ambient'],
 array['cinematic-rnb-type-beats','moody-rnb-type-beats','night-drive-type-beats','dark-trap-soul-type-beats'],50),

('cyberpunk-beats','cyberpunk beats',
 'Cyberpunk Beats — Dark Futuristic Synth Instrumentals',
 'Cyberpunk beats with dark synths, futuristic textures, and heavy 808s. Score your dystopia or drop your next single.',
 'Cyberpunk Beats',
 'Cyberpunk beats fuse dystopian synth design with modern trap weight. Detuned leads, rusted pads, mechanical percussion, and aggressive 808s sit under a thin layer of static and grime — the sound of a city that never quite turns its lights off.',
 '[
  {"heading":"What makes cyberpunk beats work","body":"Sound design. Almost every layer is custom — analog-style basses, processed vocal chops, gritty drums, and atmospheric foley. The arrangements often shift between sparse verse sections and full, almost overwhelming hooks."},
  {"heading":"Who these beats are perfect for","body":"Hard-edged rappers, alternative electronic artists, game soundtrack creators, animators, and short film directors building futuristic worlds."},
  {"heading":"How artists use them","body":"Vocally, these tracks reward processed delivery — distortion, vocoder, doubled half-time hooks. In film/game, the sparse intros work well as score beds before the drop hits an action moment."},
  {"heading":"Related beat styles","body":"Compare with Dark Cinematic, Ambient Trap, and Night Drive for darker, synth-forward sister styles."}
 ]'::jsonb,
 array['cyberpunk','dark','synth','futuristic','808'],
 array['dark-cinematic-beats','ambient-trap-beats','night-drive-type-beats'],60),

('ambient-trap-beats','ambient trap beats',
 'Ambient Trap Beats — Atmospheric Instrumentals',
 'Ambient trap beats with floating pads, slow textures, and modern trap drums. Built for melodic writers and visual creators.',
 'Ambient Trap Beats',
 'Ambient trap blends the floating, evolving textures of ambient music with the rhythmic backbone of modern trap. Long pads, processed vocal chops, and reversed swells sit on top of patient 808s and shuffled hi-hats.',
 '[
  {"heading":"What makes ambient trap beats work","body":"Negative space. The producers leave huge gaps for vocals, reverbs, and movement. The drums often arrive late, which makes the first drop feel earned rather than rushed."},
  {"heading":"Who these beats are perfect for","body":"Melodic rappers, alternative R&B singers, lofi creators, and anyone scoring atmospheric video — drone shots, editorial cuts, slow-motion narrative."},
  {"heading":"How artists use them","body":"Many writers layer multiple harmony parts over ambient trap, treating it more like a choir arrangement than a rap beat. Producers often duck the pads under the lead vocal to keep the mix clear."},
  {"heading":"Related beat styles","body":"Pair with Cinematic R&B, Night Drive, Dark Trap Soul, and Cyberpunk for adjacent moods."}
 ]'::jsonb,
 array['ambient','trap','moody'],
 array['cinematic-rnb-type-beats','night-drive-type-beats','dark-trap-soul-type-beats','cyberpunk-beats'],70),

('emotional-background-music','emotional background music',
 'Emotional Background Music — Instrumentals for Video & Content',
 'Emotional background music with cinematic chords and clean mixes — perfect for vlogs, edits, podcasts, and brand video.',
 'Emotional Background Music',
 'Emotional background music is built to sit under picture and voice. These instrumentals lean cinematic and intimate at once — soft piano, warm strings, gentle percussion, and a mix that leaves the top end open for narration or dialogue.',
 '[
  {"heading":"What makes this style work","body":"The arrangements are deliberately spacious. There is no busy melody competing for attention with the spoken word, but the harmonic movement is rich enough to carry the emotional beats of a story on its own."},
  {"heading":"Who these beats are perfect for","body":"YouTubers, brand video editors, podcast producers, wedding and event videographers, and singer-songwriters cutting acoustic-leaning records."},
  {"heading":"How creators use them","body":"Editors usually drop these instrumentals under a voice-over, then cut their picture to the natural swells. Songwriters use them as harmonic starting points to build vocal melodies on top of a fully-formed bed."},
  {"heading":"Related beat styles","body":"Browse Dark Cinematic, Cinematic R&B, Late Night R&B, and Night Drive for adjacent moods."}
 ]'::jsonb,
 array['background-music','cinematic','ambient'],
 array['dark-cinematic-beats','cinematic-rnb-type-beats','night-drive-type-beats','late-night-rnb-type-beats'],80),

('dark-trap-soul-type-beats','dark trap soul type beats',
 'Dark Trap Soul Type Beats — Moody Vocal-Driven Instrumentals',
 'Dark trap soul type beats blending soulful chords with modern trap drums. Perfect for melodic rappers and R&B writers.',
 'Dark Trap Soul Type Beats',
 'Dark trap soul fuses R&B''s harmonic warmth with trap''s rhythmic muscle. Expect chopped soul samples, gritty Rhodes chords, deep 808s, and drum patterns that bounce without losing their late-night attitude.',
 '[
  {"heading":"What makes dark trap soul beats work","body":"The contrast between the sample work and the drums. The chord progressions feel classic, almost vintage, while the drums sound completely modern. That mix is why this lane has dominated streaming for years."},
  {"heading":"Who these beats are perfect for","body":"Melodic rappers, R&B-leaning artists, songwriters writing topline records, and creators scoring narrative content that needs both soul and weight."},
  {"heading":"How artists use them","body":"Many writers approach trap soul like an R&B song with a rap structure — verses sung or half-sung, hooks doubled and harmonized, ad-libs filling the gaps. Producers leave the low end intentionally minimal to make room for the 808 and vocals."},
  {"heading":"Related beat styles","body":"Compare with Emotional Trap, Moody R&B, and Cinematic R&B for adjacent vibes."}
 ]'::jsonb,
 array['trap-soul','dark','rnb','moody'],
 array['emotional-trap-type-beats','moody-rnb-type-beats','cinematic-rnb-type-beats'],90),

('moody-rnb-type-beats','moody r&b type beats',
 'Moody R&B Type Beats — Atmospheric Instrumentals',
 'Moody R&B type beats with atmospheric chords, smoky textures, and vocal-ready space. Find a beat and write your next record.',
 'Moody R&B Type Beats',
 'Moody R&B beats sit in the shadows of the catalog. Atmospheric chord stacks, warm sub-bass, processed vocal chops, and patient drums create a canvas for singers and writers to explore vulnerable, complicated subject matter.',
 '[
  {"heading":"What makes moody R&B beats work","body":"They prioritize feeling over flashiness. The chord choices lean jazzy and slightly dissonant, the drums sit low in the mix, and effects like reverb and delay are used as instruments rather than polish."},
  {"heading":"Who these beats are perfect for","body":"R&B singers, alt-pop artists, melodic rappers, and writers cutting demos that need to feel cinematic from bar one. They also work well for fashion, lifestyle, and editorial video edits."},
  {"heading":"How artists use them","body":"Many writers approach moody R&B by recording multiple vocal passes — a quiet, almost spoken verse, then a fuller, layered chorus — to mirror the emotional dynamics of the beat itself."},
  {"heading":"Related beat styles","body":"Explore Late Night R&B, Cinematic R&B, Dark Trap Soul, and Night Drive for similar atmospheres."}
 ]'::jsonb,
 array['rnb','moody','dark'],
 array['late-night-rnb-type-beats','cinematic-rnb-type-beats','dark-trap-soul-type-beats','night-drive-type-beats'],100)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
