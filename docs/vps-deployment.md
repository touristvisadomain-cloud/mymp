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
GitHub Actions
  └─ deploy.yml  (push to main, manual run, or a `rebuild` dispatch)
       ├─ build + sync data/*.json + site image + SSH deploy
       └─ worker image from sangsad/Dockerfile, only when sangsad/ changed

VPS  /home/devuser/opt/apps/mymp
  ├─ .env                  written by deploy.yml on every deploy
  ├─ container mymp        the site; Caddy → mymp:3000, also on 127.0.0.1:5000
  └─ container mymp-worker sangsad/worker/src/scheduler.ts
       ├─ 20:00 UTC: parliament jobs → Storage mirror → `rebuild` dispatch
       ├─ every 30 min: news → MYMP public tables → `rebuild` every 3 h
       └─ with WORKER_SITE_JOBS=on: authenticated calls to the MYMP cron routes

Supabase Cron (only while WORKER_SITE_JOBS is off)
  └─ authenticated HTTP calls to the MYMP cron routes

Admin "Publish" and the posts sync → `rebuild` dispatch (src/lib/rebuild.ts)
```

The public parliamentary pages do not query PostgreSQL on each request. A deployment runs `scripts/sync.mjs`, writes the generated `data/*.json` snapshot, runs `next build`, and starts a container containing that snapshot.

## One-time VPS prerequisites

On the VPS, install and configure:

- Docker Engine and Docker Compose plugin
- Caddy or Nginx
- A shared external Docker network named `caddy_net`
- DNS for `mymp.bd` pointing to the VPS
- A dedicated deploy user named `devuser`
- An SSH public key for the GitHub Actions deploy workflow

The application project root is fixed at:

```text
/home/devuser/opt/apps/mymp
```

The repository workflow writes these files there:

```text
/home/devuser/opt/apps/mymp/docker-compose.yml
/home/devuser/opt/apps/mymp/.env
```

The workflow transfers the Docker image over SSH. It does not clone the repository on the VPS.

## GitHub Actions configuration

Create the `prod` environment in the repository and add these secrets.

### Required deploy secrets

```text
DEPLOY_HOST
DEPLOY_SSH_KEY
DEPLOY_ENV_FILE_B64
```

`DEPLOY_ENV_FILE_B64` is the base64 encoding of the complete production runtime environment file. It must include all required application variables, including:

```env
NEXT_PUBLIC_SITE_URL=https://mymp.bd
NEXT_PUBLIC_SUPABASE_URL=https://supabase.mymp.bd
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SANGSAD_SUPABASE_URL=https://supabase.mymp.bd
DATABASE_URL=postgresql://...
DATABASE_SSL=disable
DATABASE_SCHEMA=sangsad
CRON_SECRET=...
```

Keep the service-role key only in this runtime file. Never pass it as a Docker build argument.

### All GitHub Actions secrets and variables

In the `prod` environment (or the repository):

```text
DEPLOY_HOST
DEPLOY_SSH_KEY
DEPLOY_ENV_FILE_B64
MYMP_DEPLOY_TOKEN
```

and one repository variable (Settings → Secrets and variables → Actions → Variables):

```text
WORKER_SITE_JOBS   on | (empty)
```

Use the following ownership:

- `DEPLOY_HOST`, `DEPLOY_SSH_KEY`: GitHub-to-VPS Docker deployment.
- `DEPLOY_ENV_FILE_B64`: complete MYMP VPS runtime `.env`, including `DATABASE_URL`, Supabase keys, `CRON_SECRET`, and the সংসদ settings below. The worker container reads the same file.
- `MYMP_DEPLOY_TOKEN`: fine-grained GitHub token for this repository only, Contents: Read and write. deploy.yml appends it to the VPS `.env`; Publish, the posts sync, `/api/cron/republish` and the worker use it to send the `rebuild` dispatch. Without it nothing rebuilds the site except a push to `main`.
- `WORKER_SITE_JOBS`: `on` moves the MYMP cron calls from Supabase Cron to the worker (see Schedules). deploy.yml appends it to the VPS `.env`.

The worker runs each সংসদ job with these names from the runtime `.env` (sangsad/worker/src/scheduler.ts, `jobEnv`):

- `SANGSAD_DATABASE_URL`, falling back to `DATABASE_URL`. One unquoted line, for example `postgresql://postgres.mymp:PASSWORD@supabase.mymp.bd:5433/postgres`; URL-encode special characters in the password.
- `SANGSAD_DATABASE_SSL` (default `disable`) and `SANGSAD_DATABASE_SCHEMA` (default `sangsad`).
- `SANGSAD_SUPABASE_URL`, `SANGSAD_SUPABASE_SERVICE_ROLE_KEY`, falling back to the site's own Supabase: the public mirror bucket.
- `MYMP_SUPABASE_URL`, `MYMP_SUPABASE_SERVICE_ROLE_KEY`, falling back to the site's own Supabase: where news and Wikipedia enrichment are delivered.

The old repository secrets `MYMP_CRON_SECRET`, `SANGSAD_*` and `MYMP_SUPABASE_*` belonged to the deleted GitHub schedules; no workflow reads them any more.

## Deploying the application

A push to `main`, a manual run, or a `rebuild` dispatch (the older `sangsad-data-updated` name still works) runs, always on `main`:

```bash
npm ci
npm run build
npm run typecheck
docker build ...                                   # the site
docker build -t mymp-worker:<tree hash> sangsad    # only when sangsad/ changed
ssh ... /home/devuser/opt/apps/mymp
docker compose up -d --force-recreate web          # then waits for healthy
docker compose up -d --force-recreate worker
```

Other branches, `prod` included, do not deploy. Deploys queue one at a time (`concurrency: production-deploy`).

`npm run build` is the important step:

```text
scripts/sync.mjs --soft
  → data/*.json
  → public/search-index.json
  → scripts/build-name-idf.ts
  → next build
```

The container image uses `npm run build:local` because the snapshot has already been generated in the workflow. A failed build stops before the VPS container is replaced.

## Schedules

The GitHub schedules are gone; the worker container is the clock
(sangsad/worker/src/scheduler.ts). Times are UTC; Dhaka is UTC+6.

| Job | Runs in | When (UTC) | What |
|---|---|---|---|
| Parliament refresh | worker | 20:00 daily | `parliament` → `parliament:photos` → `parliament:report`, then a rebuild |
| সংসদ news | worker | every 30 min | `news`; on the hour at 00, 03, … 21 also a rebuild when it succeeded |
| RSS + thumbnails / sitemaps | Supabase Cron, or worker when `WORKER_SITE_JOBS=on` | every 15 min, taking turns | `/api/cron/feed?collector=rss`, `thumbs`, `sitemap` |
| YouTube | same | hourly | `/api/cron/feed?collector=youtube` |
| Search | same | hourly at :45 | `/api/cron/feed?collector=search` |
| Government posts sync | same | 00:40, 06:40, 12:40, 18:40 | `/api/cron/sync-posts` |
| Press | same | 03:40 daily | `/api/cron/feed?collector=press` |
| Learning from feedback | same | Monday 04:00 | `/api/cron/feed?collector=learn` |
| Parliament reachability probe | same | every 6 h | `/api/cron/probe` |

A rebuild is the `rebuild` dispatch to deploy.yml. The nightly one also applies
the day's admin edits, which the old Vercel republish cron used to do.

The worker runs one সংসদ job at a time and one site call at a time; a slot that
comes due while the previous one is still running is skipped and logged.

### Moving the site calls from Supabase Cron to the worker

Supabase Cron (`https://supabase.mymp.bd/project/default/integrations/cron/jobs`)
calls the MYMP routes until the worker takes them over. Never let both call
them: the YouTube and search quotas are sized for one caller.

1. Delete or deactivate every Supabase Cron job that calls `mymp.bd/api/cron/`,
   including any that call the removed `/api/cron/sangsad-worker` route.
2. Set the repository variable `WORKER_SITE_JOBS` to `on`.
3. Run deploy.yml once (Actions → Build and deploy Docker image → Run workflow).
   The worker's first log line then says `site jobs on`.

While Supabase Cron keeps them, every request needs `Authorization: Bearer <CRON_SECRET>`,
and never the service-role key.

## Sangsad refresh flow

The normal parliamentary refresh is:

```text
worker, 20:00 UTC
  → pnpm worker parliament
  → pnpm worker parliament:photos
  → pnpm worker parliament:report
  → uploads mirror/parliament/latest.json
  → rebuild dispatch
  → deploy.yml on main
  → npm run build
  → Docker deploy to VPS
```

To run a job by hand with the same environment the schedule uses:

```bash
docker exec mymp-worker pnpm job parliament
docker exec mymp-worker pnpm job health
```

The first setup on the shared database is:

```bash
cd /home/pixelsbd/Node-app/mymp/sangsad
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm worker health
```

For the current self-hosted PostgreSQL endpoint, use:

```env
DATABASE_SSL=disable
DATABASE_SCHEMA=sangsad
```

MYMP tables remain in `public`; Sangsad tables are in `sangsad`. The worker publishes the `mirror` Storage bucket, which is separate from PostgreSQL schemas.

## MYMP database setup

Run the root migrations once against the same shared PostgreSQL database:

```bash
cd /home/pixelsbd/Node-app/mymp
npm run db:migrate
```

This creates MYMP’s `public` tables:

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

Expected response is JSON with `ok: true` and a sync status. A `401` means the bearer value does not match the running container’s `CRON_SECRET`.

## Health checks

### VPS container

```bash
ssh devuser@<DEPLOY_HOST> \
  'cd /home/devuser/opt/apps/mymp && docker compose ps && docker compose logs --tail 100 web'
```

The container health check requests `/` on `127.0.0.1:3000`.

### Worker container

```bash
ssh devuser@<DEPLOY_HOST> \
  'cd /home/devuser/opt/apps/mymp && docker compose logs --tail 200 worker'
```

The first lines after a deploy show `site jobs on|off`, whether rebuilds are on
(`MYMP_DEPLOY_TOKEN`), and the result of the `health` job that runs on every
start: `db ok (...); parliament.gov.bd ok (... sitting members)`.

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
4. Configure the GitHub `prod` environment secrets.
5. Add `MYMP_DEPLOY_TOKEN`, then deploy `main` once.
6. Confirm `mymp.bd` serves through the VPS reverse proxy.
7. Confirm the worker log shows a passing `health` run and `rebuilds on`.
8. Press Publish in /admin and confirm a `repository_dispatch` run of deploy.yml starts.
9. After the first night, confirm `mirror/parliament/latest.json` changed and a rebuild followed.
10. Choose one caller for the MYMP cron routes: Supabase Cron, or the worker with `WORKER_SITE_JOBS=on`.
11. Disable or remove the Vercel project after VPS cutover.
12. Remove `VERCEL_DEPLOY_HOOK_URL` from the runtime `.env`; nothing reads it any more.

## Rollback

A bad build fails before Docker Compose recreates the VPS container. For an already deployed bad image:

```bash
ssh devuser@<DEPLOY_HOST> \
  'docker image ls mymp && cd /home/devuser/opt/apps/mymp && docker compose up -d web'
```

Keep the previous image tag or digest if image rollback is required. Do not delete the previous image until the new container has passed its health check and the public site has been inspected.
