# MYMP VPS deployment and Supabase Cron

This is the production runbook for the self-hosted VPS deployment.

## Now: a Railpack platform (since 2026-10-09)

The site is built and run by a hosting platform from `railpack.json` (the site)
and `sangsad/railpack.json` (the worker). `.github/workflows/deploy.yml` is
switched off (every line commented out), so the GitHub flow described further
down is not what runs today. Until one of the two is chosen for good, keep both
in mind:

- **Site service** (`railpack.json`): build `npm run build:local`, start `npx next start`.
  `build:local` skips `scripts/sync.mjs`, so the site shows the committed `data/`
  snapshot and no admin edit, vote count or parliament refresh reaches it.
  Switch the build to `npm run build` **only after** the admin database holds its
  data again: the build now refuses to publish when the database has less than
  half of the snapshot's corrections, vote counts or published news
  (`src/lib/dataFloor.mjs`; `ALLOW_DATA_DROP=1` overrides it once).
- **Worker service** (`sangsad/railpack.json`): start `pnpm schedule`, the same
  clock as the worker container below. Give it the site's environment plus the
  সংসদ names listed under "All GitHub Actions secrets and variables", and
  `MYMP_INTERNAL_URL` pointing at the site service if `WORKER_SITE_JOBS=on`.
- **Rebuilds**: set `DEPLOY_HOOK_URL` to the platform's deploy webhook in both
  services (`DEPLOY_HOOK_METHOD=GET` and `DEPLOY_HOOK_TOKEN` if the platform wants
  them). Without it, Publish, the posts sync and the worker fall back to the
  GitHub dispatch, which does nothing while deploy.yml is off.
- **Runtime environment** of the site service: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`
  at least. Without them `/api/feed/<slug>` answers `"unavailable": true` and the
  news pages fall back to the snapshot's September stories.

## Production architecture

```text
Dokploy (Railpack)
  └─ railpack.json
       ├─ install npm + pnpm, install sangsad deps
       ├─ build:local (scripts/sync.mjs --soft → next build)
       └─ npx next start

VPS  (Dokploy-managed)
  ├─ container mymp        the site; Caddy → mymp:3000, also on 127.0.0.1:5000
  └─ .env                  Dokploy runtime environment variables

Supabase Cron
  └─ authenticated HTTP calls to the MYMP cron routes
       ├─ 20:00 UTC: /api/cron/sangsad?job=parliament-nightly
       ├─ every 30 min: /api/cron/sangsad?job=news
       ├─ feed collectors (rss, sitemap, thumbs, youtube, search, press, learn)
       ├─ /api/cron/sync-posts
       └─ /api/cron/probe

Admin "Publish" and the posts sync → `rebuild` dispatch (src/lib/rebuild.ts)
```

The public parliamentary pages do not query PostgreSQL on each request. A deployment runs `scripts/sync.mjs`, writes the generated `data/*.json` snapshot, runs `next build`, and starts a container containing that snapshot.

## One-time VPS prerequisites

On the VPS, install and configure:

- Dokploy with Railpack builder
- Caddy or Nginx (reverse proxy)
- DNS for `mymp.bd` pointing to the VPS

The application is deployed via Dokploy using `railpack.json`. No GitHub Actions deployment is needed.

## Dokploy configuration

### Build configuration

The `railpack.json` at the project root handles the build:

```json
{
  "packages": { "node": "24", "pnpm": "12.3.4" },
  "steps": {
    "install-sangsad": { "commands": ["cd sangsad && pnpm install --frozen-lockfile"] },
    "build": { "commands": ["npm run build:local"] }
  },
  "deploy": { "startCommand": "npx next start" }
}
```

pnpm is installed alongside npm so the sangsad worker jobs can run from the Next.js API routes (`/api/cron/sangsad`).

### Runtime environment variables

Set these in Dokploy's environment configuration. All are available as secrets in `railpack.json`.

**Site:**
```env
NEXT_PUBLIC_SITE_URL=https://mymp.bd
NEXT_PUBLIC_SUPABASE_URL=https://supabase.mymp.bd
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
DATABASE_SSL=disable
DATABASE_SCHEMA=sangsad
CRON_SECRET=...
ADMIN_BOOTSTRAP_EMAIL=...
DOKPLOY_API_KEY=your-dokploy-api-key
DOKPLOY_APP_ID=IQfdSnupvUCx5WVuhR2dH
# DOKPLOY_API_URL=http://13.140.59.8:3000  # optional, this is the default
```

**Optional (legacy GitHub fallback):**
```env
MYMP_DEPLOY_TOKEN=...     # only if not using Dokploy webhook
DEPLOY_REPOSITORY=...     # only if not using Dokploy webhook
```

**Sangsad worker jobs** (used by `/api/cron/sangsad`):
```env
SANGSAD_SUPABASE_URL=https://supabase.mymp.bd
SANGSAD_DATABASE_URL=postgresql://...
SANGSAD_DATABASE_SSL=disable
SANGSAD_DATABASE_SCHEMA=sangsad
SANGSAD_SUPABASE_SERVICE_ROLE_KEY=...
MYMP_SUPABASE_URL=https://supabase.mymp.bd
MYMP_SUPABASE_SERVICE_ROLE_KEY=...
APP_ENV=production
```

**Optional:**
```env
WORKER_SITE_JOBS=     # no longer needed; Supabase Cron handles everything
RESEND_API_KEY=...    # for posts sync email notifications
MAIL_FROM=...         # email sender address
YOUTUBE_API_KEY=...   # for YouTube feed collector
```

The sangsad worker jobs (`parliament`, `parliament:photos`, `parliament:report`, `news`, etc.) run as `pnpm worker <job>` inside the `sangsad/` directory via the `/api/cron/sangsad` API route. They use `SANGSAD_DATABASE_URL` (falling back to `DATABASE_URL`) with schema `sangsad`.

## Schedules

All scheduled jobs are managed by Supabase Cron (`supabase/migrations/005_cron.sql`).
Times are UTC; Dhaka is UTC+6.

| Job | Route | Schedule (UTC) | What |
|---|---|---|---|
| Parliament nightly | `/api/cron/sangsad?job=parliament-nightly` | 20:00 daily | `parliament` → `parliament:photos` → `parliament:report` → rebuild |
| সংসদ news | `/api/cron/sangsad?job=news` | every 30 min | reads news sources, matches to members |
| RSS | `/api/cron/feed?collector=rss` | :00, :30 | RSS feed collection |
| Thumbnails | `/api/cron/feed?collector=thumbs` | :00, :30 | fill missing thumbnails |
| Sitemaps | `/api/cron/feed?collector=sitemap` | :15, :45 | sitemap collection |
| YouTube | `/api/cron/feed?collector=youtube` | :15 hourly | YouTube channel scan |
| Search | `/api/cron/feed?collector=search` | :45 hourly | search index update |
| Government posts | `/api/cron/sync-posts` | :40 every 6h | cabinet.gov.bd sync |
| Press | `/api/cron/feed?collector=press` | 03:40 daily | press collection |
| Learning | `/api/cron/feed?collector=learn` | Mon 04:00 | learn from feedback |
| Probe | `/api/cron/probe` | :00 every 6h | parliament.gov.bd reachability |

The nightly parliament jobs also trigger a site rebuild (via `repository_dispatch` or the `/api/cron/republish` route), which applies the day's admin edits.

### Running a job by hand

```bash
# Test the sangsad health check
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://mymp.bd/api/cron/sangsad?job=health"

# Run parliament jobs manually
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://mymp.bd/api/cron/sangsad?job=parliament-nightly"

# Run a single sangsad job
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://mymp.bd/api/cron/sangsad?job=news"
```

### First-time sangsad database setup

```bash
cd /home/pixelsbd/Node-app/mymp/sangsad
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm worker health
```

## MYMP database setup

Run the root migrations once against the same shared PostgreSQL database:

```bash
cd /home/pixelsbd/Node-app/mymp
npm run db:migrate
```

This creates MYMP's `public` tables:

```text
admin_users, overrides, hidden_entities, news_posts, corrections,
audit_log, sync_runs, election_results, posts, post_sync_runs,
post_aliases, feed_items, feed_item_mps, mp_name_variants,
mp_feed_settings, app_settings, feed_runs, feed_match_feedback
```

The Sangsad tables are not in this list and must not be recreated in `public`.

## Cron endpoint security

All cron routes require:

```http
Authorization: Bearer <CRON_SECRET>
```

Test from an authorized machine without exposing the secret in shell history where possible:

```bash
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://mymp.bd/api/cron/sync-posts?trigger=manual"
```

Expected response is JSON with `ok: true` and a sync status. A `401` means the bearer value does not match the running container's `CRON_SECRET`.

## Health checks

### VPS container

```bash
curl -fsS https://mymp.bd/
```

Or via Dokploy's dashboard. The container health check requests `/` on `127.0.0.1:3000`.

### Sangsad jobs

```bash
# Health check (DB + parliament.gov.bd connectivity)
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://mymp.bd/api/cron/sangsad?job=health"
```

The response includes the database timestamp and parliament.gov.bd member count.

### Supabase mirror

```bash
curl -fsS \
  https://supabase.mymp.bd/storage/v1/object/public/mirror/parliament/latest.json
```

Confirm the JSON has:

```text
version = 1
fetchedAt within 36 hours
responses[/api/members?parliamentNo=13] contains at least 300 records
responses[/api/committees] exists
```

### Public build freshness

After a deployment, inspect the generated metadata inside the build source or deployment artifact:

```bash
cat data/meta.json | head -40
```

The important fields are:

```text
syncedAt
builtAt
via: engine or live
source
counts
```

## Cutover checklist

1. Apply both root MYMP and Sangsad migrations.
2. Run `pnpm db:seed` and `pnpm worker health`.
3. Confirm `sangsad` has the normalized tables and `public` has MYMP tables.
4. Set all environment variables in Dokploy.
5. Deploy via Dokploy.
6. Confirm `mymp.bd` serves through the VPS reverse proxy.
7. Run the Supabase Cron migration (`supabase/migrations/005_cron.sql`).
8. Confirm the sangsad health check passes: `GET /api/cron/sangsad?job=health`.
9. Press Publish in /admin and confirm a rebuild is triggered.
10. After the first night, confirm `mirror/parliament/latest.json` changed and a rebuild followed.

## Rollback

Dokploy keeps previous deployments. Roll back via the Dokploy dashboard if a bad build is deployed.

For manual rollback, redeploy the previous image tag via Dokploy's UI.