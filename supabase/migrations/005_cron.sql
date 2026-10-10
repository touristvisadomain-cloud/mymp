-- Supabase Cron: all scheduled jobs for mymp.bd.
--
-- Replaces the Docker worker container's scheduler (sangsad/worker/src/scheduler.ts)
-- and the deleted GitHub Actions workflows. Every job is an HTTP call to the site's
-- /api/cron/* routes, authenticated with CRON_SECRET.
--
-- Run once in the Supabase SQL editor AFTER:
--   1. Enabling extensions: pg_cron and pg_net (Dashboard → Database → Extensions)
--   2. Setting the two variables below (site URL and CRON_SECRET value)
--
-- Idempotent: safe to run again — existing jobs are replaced.

-- ─── CONFIGURATION ─────────────────────────────────────────────────────────────
-- Replace these with your actual values before running.
-- The base URL is where the Next.js app is reachable from the public internet.
-- The secret must match the CRON_SECRET in your Dokploy environment.

-- ─── HELPER FUNCTION ──────────────────────────────────────────────────────────
-- Unschedule if exists, then schedule a new cron job.
CREATE OR REPLACE FUNCTION cron_reschedule(
  p_name    text,
  p_cron    text,
  p_url     text,
  p_headers jsonb,
  p_timeout int
) RETURNS void AS $$
BEGIN
  BEGIN PERFORM cron.unschedule(p_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule(p_name, p_cron,
    format('SELECT net.http_get(%L, ''{}''::jsonb, %L::jsonb, %s)',
      p_url, p_headers, p_timeout));
END;
$$ LANGUAGE plpgsql;

-- ─── SCHEDULE ALL JOBS ────────────────────────────────────────────────────────

DO $$
DECLARE
  base_url text := 'https://mymp.bd';           -- ← your site's public URL
  secret   text := 'x2mullS4DTCrvzH-vvaNxMFkHJH2wbuoiPJZSxr0pIY';      -- ← your CRON_SECRET value
  h        jsonb;
  t_short  int := 30000;    -- 30s  (feed, probe, posts, press, learn)
  t_medium int := 600000;   -- 10m  (news, search, thumbs)
  t_long   int := 2700000;  -- 45m  (parliament-nightly)
BEGIN
  h := jsonb_build_object('Authorization', 'Bearer ' || secret);

  -- ─── সংসদ (sangsad) jobs ───────────────────────────────────────────────────

  -- Parliament nightly: parliament → parliament:photos → parliament:report → rebuild
  -- Runs at 20:00 UTC (02:00 Dhaka). The endpoint runs the full chain in the background.
  PERFORM cron_reschedule('mymp-sangsad-parliament-nightly', '0 20 * * *',
    base_url || '/api/cron/sangsad?job=parliament-nightly', h, t_long);

  -- News: reads active sources, matches stories to members. Every 30 minutes.
  PERFORM cron_reschedule('mymp-sangsad-news', '*/30 * * * *',
    base_url || '/api/cron/sangsad?job=news', h, t_medium);

  -- ─── Feed collectors ────────────────────────────────────────────────────────

  -- RSS + thumbnails: every 30 min at :00 and :30
  PERFORM cron_reschedule('mymp-feed-rss', '0,30 * * * *',
    base_url || '/api/cron/feed?collector=rss', h, t_short);
  PERFORM cron_reschedule('mymp-feed-thumbs', '0,30 * * * *',
    base_url || '/api/cron/feed?collector=thumbs', h, t_short);

  -- Sitemap: every 30 min at :15 and :45
  PERFORM cron_reschedule('mymp-feed-sitemap', '15,45 * * * *',
    base_url || '/api/cron/feed?collector=sitemap', h, t_short);

  -- YouTube: every hour at :15
  PERFORM cron_reschedule('mymp-feed-youtube', '15 * * * *',
    base_url || '/api/cron/feed?collector=youtube', h, t_short);

  -- Search index: every hour at :45
  PERFORM cron_reschedule('mymp-feed-search', '45 * * * *',
    base_url || '/api/cron/feed?collector=search', h, t_medium);

  -- Press: daily at 03:40 UTC
  PERFORM cron_reschedule('mymp-feed-press', '40 3 * * *',
    base_url || '/api/cron/feed?collector=press', h, t_short);

  -- Learn from feedback: Monday 04:00 UTC
  PERFORM cron_reschedule('mymp-feed-learn', '0 4 * * 1',
    base_url || '/api/cron/feed?collector=learn', h, t_short);

  -- ─── Other site jobs ────────────────────────────────────────────────────────

  -- Posts sync (cabinet.gov.bd → site): every 6 hours at :40
  PERFORM cron_reschedule('mymp-sync-posts', '40 */6 * * *',
    base_url || '/api/cron/sync-posts', h, t_short);

  -- Probe (parliament.gov.bd reachability): every 6 hours at :00
  PERFORM cron_reschedule('mymp-probe', '0 */6 * * *',
    base_url || '/api/cron/probe', h, t_short);

  RAISE NOTICE 'All cron jobs scheduled.';
END;
$$;