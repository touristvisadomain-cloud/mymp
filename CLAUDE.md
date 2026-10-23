@AGENTS.md

# আমার এমপি · MY MP (mymp.bd)

A non-partisan public reference about the members of the 13th Bangladesh parliament: every
member, seat, party, committee, the cabinet, the 2026 election results on a map, and parliament
news, in Bangla first with an English version. Its Android app lives in a separate repo
(`../mymp-app`) and reads this site's JSON API.

Read `docs/developer.md` once before the first change: it explains the data flow and the rules.

## Tech stack

| Part | What |
| --- | --- |
| Site | Next.js (App Router; this version has breaking changes, see AGENTS.md), React, TypeScript |
| Styling | Tailwind CSS v4, tokens in `src/app/globals.css`; fonts Noto Sans Bengali |
| Maps | Google Maps JS (key from `/api/maps-key`), Leaflet + OpenStreetMap fallback; boundaries as GeoJSON in `public/geo/` |
| Data | committed JSON snapshot in `data/`, built by `scripts/sync.mjs` from parliament.gov.bd, ecs.gov.bd, cabinet.gov.bd |
| Database | Supabase (PostgreSQL): overrides, hidden, news, results, feed, audit_log, admin users. Only `/admin`, cron routes and scripts use it |
| Scripts | Node + `tsx` (TypeScript), `puppeteer-core` for screenshots |
| Tests | `node:test` (`src/lib/**/*.test.ts`), `tsc`, ESLint |
| Deploy | Dokploy on a VPS: every push to `main` builds and deploys production in about 10 minutes |
| App | Flutter, repo `../mymp-app`, built on Codemagic (started by the owner), Google Play `bd.mymp.app` |

## Folder structure

```
src/app/[lang]/(site)/   public routes (Bangla at /, English at /en)
src/app/admin/           Supabase-backed editing panel
src/app/api/app/v1/      JSON the Flutter app reads (contract in docs/app-api.md)
src/app/api/cron/        republish, sync-posts, feed, sangsad, probe
src/app/api/             also corrections, maps-key, news, og images, feed
src/components/          shared UI (PascalCase .tsx)
src/lib/                 data access, search, seat finder, profiles, SEO (src/lib/seo/)
src/i18n/                t('বাংলা','English') helper, names, glossary (README.md)
data/                    generated snapshot, committed; never hand-edit
config/                  news sources, sync sources, feed matching rules
scripts/                 sync, feed collectors, geo builders, one-off data scripts
public/geo/              seat and district boundaries (GeoJSON)
supabase/                schema.sql and migrations (the owner runs them)
sangsad/                 the election/results dataset and its own tooling (pnpm workspace)
docs/                    developer guide, VPS deployment, app API, feed notes, QA, proposal
.claude/agents/          the agent team (see below)
```

Public routes: `/` `/mp` `/mp/[slug]` `/ason` `/ason/[slug]` `/jela` `/jela/[slug]` `/dol`
`/dol/[slug]` `/ministers` `/ministers/[slug]` `/upodeshta/[slug]` `/committee`
`/committee/[slug]` `/odhibeshon` `/songbad` `/nirbachon` `/parisonkhan` `/sangrakkhito-ason`
`/sutro` `/somporke` `/gopaniyota` `/jogajog`, each also under `/en`.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000 (never at the same time as a build)
npm run build:local  # production build without the Supabase sync step
npm test             # unit tests (node:test)
npx tsc --noEmit     # type check (also: npm run typecheck)
npx eslint .         # lint
npm run i18n:check   # English coverage; i18n:pages, i18n:bn-intact for the rest
```

The gate before any change is called done:

```bash
npm test && npx tsc --noEmit && npx eslint .
```

App repo: `cd ../mymp-app && flutter analyze && flutter test`.

These touch production and run **only when the owner asks**: `npm run build` (syncs from Supabase),
`npm run sync`, `npm run db:migrate`, every `npm run feed:*`, `npm run sync:posts`,
`npm run seo:indexnow`, and `scripts/apply-*.ts --apply`.

## Naming rules

- Components: PascalCase files and exports (`SeatMap.tsx`, `MemberPhoto.tsx`).
- Library modules: camelCase files (`findSeat.ts`, `memberProfile.ts`); tests next to them as
  `*.test.ts` or in `__tests__/`.
- Scripts: kebab-case (`build-seat-geo.ts`, `feed-collect.ts`); TypeScript run with `tsx`.
- Routes: transliterated Bangla slugs (`ason`, `jela`, `dol`, `odhibeshon`); member, seat and
  district slugs are lowercase kebab-case English (`tarique-rahman`, `dhaka-17`, `cumilla`).
  Never rename a public URL.
- Text: always through `t('বাংলা', 'English')`; Bangla is the original. Bangla digits on Bangla
  pages. No em-dashes in user-facing text.
- Comments explain why, in plain English sentences.
- App (Dart): snake_case files, `UpperCamelCase` classes, `t('বাংলা', 'English')` from
  `lib/i18n.dart`, colours from `lib/theme.dart`.

## Rules the content holds to

1. Nothing invented. A value no reachable source publishes is shown as missing, never as 0 or a guess.
2. Every page names its source; a new kind of information gets a row on `/sutro`.
3. Two seat counts, never mixed: the constituency result and the seated parliament (with the 50
   reserved women's seats). Every chart says which one it shows.
4. Verified and unverified accounts are labelled differently ("যাচাই করা হয়নি").
5. No personal phone numbers or private addresses; official parliament email only.
6. Committee rosters still listing the previous parliament are shown as awaiting an update.
7. Profiles: sources listed, an independent second check before publishing, at most one neutral
   sentence on a controversy with the latest court outcome.

## Never do

- Never write to the production database unless the owner explicitly asks in the conversation.
  Show a preview (before and after) first, and write only after the owner says go.
- Never run `npm run sync`, `npm run db:migrate`, `npm run build`, `feed:*` or `scripts/apply-*`
  with `--apply` against production unless asked.
- Never print, log or commit secrets: `.env.local`, `SUPABASE_SERVICE_ROLE_KEY`, Maps keys,
  keystores, `local.properties`.
- Never push to or merge into `main` (site or app) without the owner's OK: `main` is production.
  When asked, push one ref only (`git push origin HEAD:main`).
- Never touch any server other than the Dokploy production VPS.
- Never hand-edit `data/*.json`; corrections go in the Supabase `overrides` table with an
  `audit_log` row.
- Never make a public page read auth, cookies or Supabase: the site must stay static and cacheable.
- Never break the app contract: `/api/app/v1/*` changes are additive; update `docs/app-api.md`.
- Never commit `mp-links-review.md` or `.claude/launch.json` (local files).
- Never add analytics, a crash reporter or a data-collecting dependency to the app, and never ask
  for location except when the reader taps the seat-finder button.
- Never run `npm run build` while `npm run dev` is running (they share `.next`).
- Never write Bangla through shell one-liners; use the Write/Edit tools (shells corrupt Bangla).
- Never start a Codemagic build: the owner starts them.

## Agent team

Defined in `.claude/agents/`:

| Agent | Does | Writes code |
| --- | --- | --- |
| planner | Turns a request into ordered steps, files, risks and checks | No |
| ui-ux-designer | Layout and interaction specs for site and app | No (writes specs) |
| frontend-dev | Pages, components, maps, SEO in the Next.js site | Yes |
| backend-dev | Data pipeline, scripts, app API, Supabase, admin, cron | Yes |
| flutter-dev | The Android app in `../mymp-app` | Yes |
| copywriter | Bangla and English text, profiles, store listing | No (writes text) |
| fact-checker | Verifies facts against official and news sources | No |
| qa-tester | Read-only review; reports Critical / Warning / Suggestion | No |

Usual flow: planner, then designer and copywriter as needed, then the dev agent, then
fact-checker for any new facts, then qa-tester before the owner merges.
