-- The night diary: how each thought arrived, and how Claude read it.

alter table public.thoughts
  add column source text not null default 'typed' check (source in ('typed', 'voice', 'flow')),
  -- {"seconds": 12, "wave": [48 bars, 0..1]}: the shape of a spoken note. The audio itself is never kept.
  add column voice jsonb check (voice is null or (jsonb_typeof(voice) = 'object' and pg_column_size(voice) < 4096)),
  -- Written only by the analyze function: emotion, valence, arousal, needs, patterns,
  -- and links to earlier thoughts ({to, kind, why}).
  add column lens jsonb;

-- Spoken notes run longer than typed ones.
alter table public.thoughts drop constraint thoughts_body_check;
alter table public.thoughts add constraint thoughts_body_check check (char_length(btrim(body)) between 1 and 2000);

-- People write their own words; only the server writes Claude's reading of them.
revoke insert, update on public.thoughts from authenticated;
grant insert (topic_id, title, body, kind, tags, happened_at, source, voice) on public.thoughts to authenticated;
grant update (topic_id, title, body, kind, tags, happened_at, source, voice) on public.thoughts to authenticated;
