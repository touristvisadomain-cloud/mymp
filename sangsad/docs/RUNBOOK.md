# Runbook

The data engine behind mymp.bd lives in the `sangsad/` folder of the `sumongetup/mymp` repository. Every command below runs from that folder. Its CI workflow is `.github/workflows/sangsad-ci.yml` at the repository root (GitHub only reads workflows from the root) and triggers only on changes under `sangsad/`. mymp.bd's own build ignores this folder. Vercel rebuilds mymp.bd on every push, including pushes that only change this folder: an "ignored build step" for such pushes also cancelled deploy-hook builds (the admin's Publish button, the nightly rebuild, the news rebuild) whenever the latest commit touched only this folder, so it was removed on 2026-09-11.

## First-time setup

```bash
pnpm install
cp .env.example .env        # fill DATABASE_URL and the Supabase keys
pnpm db:migrate             # applies migrations, then re-applies RLS policies (idempotent)
                            # (or, once, paste packages/db/setup.sql into Supabase → SQL Editor; regenerate it with pnpm --filter @sangsad/db sql:bundle)
pnpm db:seed                # parliaments, divisions, districts, 350 constituencies from parliament.gov.bd
pnpm worker parliament      # members, terms, parties, committees, sessions, notices
```

Fixtures: `FIXTURES=1` lets code load the `TEST_` files in `fixtures/`. The loader throws on a production deployment: when `VERCEL_ENV=production`, when `APP_ENV=production`, or when `NEXT_PUBLIC_SITE_URL` is on mymp.bd (NODE_ENV is not used, because `next build` sets it to production even in CI).

**Supabase connection.** Use the **session pooler** string from the dashboard's Connect sheet: host `aws-0-ap-southeast-1.pooler.supabase.com`, port 5432, user `postgres.<project-ref>`. The direct host `db.<ref>.supabase.co` is IPv6-only and does not resolve on many networks. Set the database password when the project is created and copy it then: on the first project (2026-09-10) four dashboard password resets never reached the pooler (28P01 every time), and a fresh project with its creation password worked at once.


## Everyday commands

| Task | Command |
|---|---|
| Typecheck everything | `pnpm typecheck` |
| Unit + integration tests (Vitest; the db package runs the real migration, RLS file and seed logic on PGlite, an in-process Postgres) | `pnpm test` |
| Change the schema | edit `packages/db/src/schema.ts` → `pnpm db:generate` → review the SQL in `packages/db/migrations/` → `pnpm db:migrate` |
| Change RLS | edit `packages/db/sql/rls.sql` → `pnpm db:migrate` (re-applies all policies) |
| Run a worker job | `pnpm worker <job>` (Phase 1: `health`) |

## Workers

`worker/src/index.ts` runs one named job per invocation and records it in `ingest_runs` (started, finished, ok, counts, error text). The scheduled runner (GitHub Actions in `.github/workflows/`, from Phase 2) calls the same entry point, so a job behaves identically on a laptop and in CI.

Jobs today:

| Job | What it does | Needs |
|---|---|---|
| `health` | proves the database and parliament.gov.bd are reachable | DATABASE_URL |
| `parliament` | writes the public mirror mymp.bd builds from (below), then members, parties, officers, committees (roster rule), sessions and sittings, notices matched to members and committees, earlier terms of sitting members with corroborated matching | DATABASE_URL, plus NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the mirror; about 45 requests at 1/s |
| `parliament:photos` | copies official photos into the public Storage bucket `member-photos` (only members whose copy is missing are fetched), then writes the photo map for mymp.bd | plus NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY |
| `sources:inspect` | inspects the 80 news sources (robots.txt, the homepage's feed links, known feed addresses, the usual feed and news-sitemap paths) and writes the result to `config/sources.json` and the table in `docs/SOURCES.md`; commit both | nothing but network; run by hand when outlets change |
| `news` | reads every active source (RSS or Google News sitemap), keeps new headlines from the last 7 days, matches them to sitting members (`worker/src/matcher/match.ts`), and delivers matches to mymp.bd's `news_posts`: 0.85 or more as published, 0.50 to 0.85 as drafts | DATABASE_URL; MYMP_SUPABASE_URL and MYMP_SUPABASE_SERVICE_ROLE_KEY to deliver; NEWS_AUTO_PUBLISH=false makes every match a draft |
| `news:rematch` | re-runs the current matcher over the last week's stored headlines (after a matcher change); editor-approved or rejected matches are kept, deliveries skip what mymp.bd already has | as `news` |
| `results:2026` | 2026 general-election results for every territorial seat from two published sources: The Business Standard's Election 2026 page (every candidate and count for 297 seats, one request; robots.txt allows it and its 10-second Crawl-delay is honoured) first, Wikipedia (Bangla, then English, through `/wiki/<title>?action=raw`) where TBS has no final count and as a check everywhere else. Each note says which source, whether Wikipedia's winner count agrees, faults found in the source (a doubled candidate, counts missing), and why a winner is not the sitting member when a 2026 by-election box shows it. Seats checked by hand to be one person under two spellings are in `config/results-reviewed.json`. Writes `docs/reports/results-<date>.json` and, with the mymp secrets, inserts new seats into `election_results` as drafts | MYMP_SUPABASE_URL and MYMP_SUPABASE_SERVICE_ROLE_KEY to write |
| `results:2026:refresh` | the same, and rewrites this job's own earlier rows (from TBS or Wikipedia, never saved by an editor); it never changes a row's published or draft status | as above |
| `social:wikipedia` | official website and social links of sitting members from their own Wikipedia articles (the constituency article names the article; infobox website and {{Official website}}, {{Facebook}}, {{Twitter}}, {{YouTube}}, {{Instagram}} and Bangla forms). Social networks themselves are never visited. Profiles only, and a network the two languages disagree on is dropped. Writes `docs/reports/social-wikipedia-<date>.json` and, with the mymp secrets, member overrides plus a `socialSource` override the profile shows as the source; a link an editor saved is never replaced, and an editor saving the member's links on the admin form drops `socialSource` | as above |
| `bio:wikipedia` | education, birthplace and (where parliament.gov.bd records none) profession of sitting members from the infobox of their own Wikipedia article, found the same way as for social links. Bangla first, English only for a field the Bangla article lacks; English professions are translated only through a fixed table, others dropped; "politician" and offices are not professions; an article whose birth year is more than ten years from parliament.gov.bd's is set aside. Writes `docs/reports/bio-wikipedia-<date>.json` and, with the mymp secrets, member overrides plus `bioFromWiki` (fields) and `bioSource` (articles); the profile marks those facts with * and links the article. Editor-saved values are never replaced; an editor saving one of those fields removes it from bioFromWiki | as above |
| `og:cards` | a 1200x630 link-preview card (photo, name, seat, party on the site green) for every sitting member, drawn in headless Chrome with the local Noto Sans Bengali (Satori and canvas break Bangla conjuncts), kept inside the centre square for WhatsApp crops. Uploads `mirror/og/mp/<id>.jpg` and `mirror/og/latest.json` (id → version); only cards whose content changed are redrawn (`OG_CARDS_ALL=1` redraws all). mymp.bd's sync reads the list into member.shareImage, but since 2026-09-11 the pages share the plain official photo instead (the owner's choice: WhatsApp shows a small square where a card's text cannot be read), so this job is not in the nightly run; run it by hand if the cards are wanted again | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; Chrome (CHROME_PATH if not in a usual place) |
| `parliament:report` | writes `docs/reports/parliament-<date>.md`: counts against the source, the unseated seat, officers, every member with a missing photo, email, profession, date of birth or party | DATABASE_URL |

The worker container on the VPS (`worker/src/scheduler.ts`, service `worker` in the root `docker-compose.yml`) runs the three parliament jobs at 02:00 Dhaka and then asks GitHub to rebuild mymp.bd. It reads mymp.bd's runtime `.env`: `SANGSAD_DATABASE_URL`, `SANGSAD_SUPABASE_URL` and `SANGSAD_SUPABASE_SERVICE_ROLE_KEY` (see `docs/vps-deployment.md` in the repository root for the fallbacks), and `MYMP_DEPLOY_TOKEN` for the rebuild. Any job by hand, with the same environment: `docker exec mymp-worker pnpm job <job>`.

## News

The worker container runs `news` every 30 minutes and, every 3 hours when it succeeded, asks GitHub to rebuild mymp.bd so new headlines reach the static pages. Besides the `SANGSAD_*` settings it delivers with `MYMP_SUPABASE_URL` and `MYMP_SUPABASE_SERVICE_ROLE_KEY`, which default to mymp.bd's own Supabase.

Only headline, outlet, date and link reach the site. The feed summary (160 characters at most) is stored for the matcher and never shown. A wrong match is removed in mymp.bd's admin (News: reject or unpublish); `news:rematch` never re-delivers a story mymp.bd already holds.

To see what the matcher decided and why: `select am.status, am.confidence, am.match_reason, a.title from article_members am join articles a on a.id = am.article_id order by a.published_at desc limit 50;`

## The mirror mymp.bd builds from

The `parliament` job writes `mirror/parliament/latest.json` (plus a dated copy for rollback) to the public Storage bucket `mirror`: the parliament.gov.bd responses mymp.bd's `scripts/sync.mjs` needs, keyed by the exact request path. The photos job writes `mirror/photos/latest.json`, member id to our stored photo. mymp.bd reads both at build time when the copy is at most 36 hours old and reads parliament.gov.bd directly otherwise, so its own derivations (slugs, committees, notices, seat history) stay one piece of code.

The bucket is public, and the source's records carry every member's mobile number, a second mobile and email, a signature image, user ids and officers' phone numbers. `worker/src/jobs/mirror.ts` therefore rebuilds each record from an allow-list of fields, keeps a mobile number only as `hasMobile`, and scans the whole document for private field names before uploading; `mirror.test.ts` covers this. A copy with fewer than 300 sitting members is refused, so a bad night never replaces a good copy.

After the nightly jobs the worker asks GitHub to rebuild mymp.bd, whether or not they succeeded: the build reads this copy when it is fresh and parliament.gov.bd otherwise.

To check what mymp.bd will read: open `https://<engine-ref>.supabase.co/storage/v1/object/public/mirror/parliament/latest.json` and look at `fetchedAt`. To force a build straight from parliament.gov.bd: `node scripts/sync.mjs --live` in the repository root.

To re-run a failed job: run it again by name; every job is idempotent (upserts keyed on the source's ids).

To find why a source failed: `select * from ingest_runs where job = '<name>' order by started_at desc limit 20;` and read `error_text`.

## Fixing a broken source

1. Check `docs/SOURCES.md` for how the source was read the last time it worked.
2. Re-inspect: robots.txt, then RSS/JSON/XHR, in that order. Update the entry with the date and what changed.
3. If the source now blocks automated access, do not work around it. Set its `status` to `blocked` in `config/sources.json`, note it in SOURCES.md, and tell the owner.

## Environments

- **Website:** mymp.bd, the Next.js app at the repository root (Vercel). It reads this database at build time (from phase M1).
- **Database:** the sangsad Supabase project (Singapore, in the mymp organization). Migrations run from a developer machine or CI with the session pooler URL.
- **Backups:** Supabase daily backups (Phase 6 adds a weekly `pg_dump` to Storage).
