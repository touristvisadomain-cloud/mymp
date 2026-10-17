-- English headlines for the English pages.
--
-- The news is collected in Bangla. From this migration on, a headline (and,
-- when switched on, its summary) is translated to English by machine once it
-- is on a member's page, and the English pages show the English with a note
-- that it was translated automatically. The Bangla is never changed: these are
-- extra columns beside it, and an English page without them shows the Bangla
-- as before.
--
-- Run with `npm run db:migrate` (scripts/migrate-db.mjs applies every file in
-- order) or paste into the Supabase SQL editor. Safe to run again.
--
--   title_en    the English headline; null until translated
--   summary_en  the English summary (only with FEED_TRANSLATE_SUMMARIES=1)
--   en_source   who wrote the English: 'google' (Google Translate),
--               'original' (the outlet published in English, copied as it is),
--               'manual' (an editor), or 'failed' (the translation came back
--               unusable; tried again by `npm run feed:translate -- --retry-failed`)
--   en_at       when; null means not yet tried, which is what the translator looks for
--
-- When the source edits a headline the collector clears all four, so the new
-- words are translated again.

alter table public.feed_items add column if not exists title_en   text;
alter table public.feed_items add column if not exists summary_en text;
alter table public.feed_items add column if not exists en_source  text;
alter table public.feed_items add column if not exists en_at      timestamptz;

-- What the translator asks for on every run: the newest untried items.
create index if not exists feed_items_untranslated_idx on public.feed_items (published_at desc) where en_at is null;

-- The editor-published news (news_posts, written to data/news.json by the
-- build's sync) gets the same, with excerpt_en for its excerpt.
alter table public.news_posts add column if not exists title_en   text;
alter table public.news_posts add column if not exists excerpt_en text;
alter table public.news_posts add column if not exists en_source  text;
alter table public.news_posts add column if not exists en_at      timestamptz;
