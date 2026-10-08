# Developer handover

Everything a new developer needs to work on **আমার এমপি / MY MP** (mymp.bd).
Read this once, top to bottom, before the first commit. It is short on purpose.

- Website repo: `sumongetup/mymp` (this one). Next.js, deployed as Docker on the VPS; see `docs/vps-deployment.md`.
- App repo: `sumongetup/mymp-app` (separate). Flutter, built on Codemagic,
  published as `bd.mymp.app` on Google Play. It reads this site's
  `/api/app/v1/*` routes, so a breaking change here breaks the app.

## 1. What you get access to, and what you do not

| | |
| --- | --- |
| GitHub | **Write** on `sumongetup/mymp`. Push branches, open pull requests. |
| VPS | No. Merging to `main` deploys through `.github/workflows/deploy.yml`. |
| Supabase | No. The service role key is not shared. |
| Play Console | No. |

This is not a matter of trust, it is the blast radius. `SUPABASE_SERVICE_ROLE_KEY`
bypasses row level security on the whole database, and the VPS `.env` holds it
in plain view of anyone with server access. Anything you need that requires
those keys, ask the owner to run.

You can do all normal work without them. See the next section.

## 2. Local setup

```bash
git clone https://github.com/sumongetup/mymp.git
cd mymp
npm install
npm run dev          # http://localhost:3000
```

That is all. **The public site needs no environment variables.** `data/` is a
committed snapshot, so every public page renders from files in the repo.

Two things will be missing locally and that is expected:

- `/admin` shows a setup page instead of the panel (no Supabase variables).
- `npm run build` will try to reach Supabase during the sync step. Use
  `npm run build:local` instead, which skips it.

If you ever do get given keys, copy `.env.example` to `.env.local` and fill it.
Never commit `.env.local`.

## 3. How the data actually reaches a visitor

This is the one thing to understand before touching anything.

```
parliament.gov.bd  ─┐
ecs.gov.bd          ├─► scripts/sync.mjs ─► data/*.json ─► next build ─► static pages
cabinet.gov.bd     ─┘          ▲
                               │
Supabase: overrides, hidden, news, results, feed
```

- **No database is read when a visitor loads a page.** Public pages must never
  call auth or Supabase. The generated snapshot is bundled into the VPS Docker
  image and served as static/build-time data.
- `scripts/sync.mjs` runs at the start of every build (`npm run build` =
  `sync --soft` then the name index then `next build`). It fetches the official
  sources, then applies every row from the Supabase `overrides` table and every
  `hidden` flag on top, then writes `data/*.json`.
- So an edit made in `/admin` is not live until a build runs. Sangsad refreshes
  dispatch the GitHub VPS deployment workflow; Supabase Cron handles protected
  application jobs such as posts sync and feed collection. See
  `docs/vps-deployment.md` for schedules and cutover steps.
- `data/*.json` is committed. Treat it as generated output: regenerate with
  `npm run sync`, do not hand-edit it. Corrections belong in the `overrides`
  table (via `/admin`), not in the JSON.

## 4. Repo layout

```
config/               news sources, sync sources, feed matching rules
data/                 the committed snapshot (generated, do not hand-edit)
docs/                 this file, feed notes, QA reports
public/               images, search-index.json, og assets
sangsad/              the election/results dataset and its own tooling
scripts/              sync, feed collectors, one-off data scripts
supabase/             schema.sql and migrations (owner runs them)
src/app/(site)/       every public route
src/app/admin/        the Supabase-backed editing panel
src/app/api/app/v1/   the JSON the Flutter app calls
src/app/api/cron/     republish, sync-posts, feed
src/lib/data.ts       typed access to data/ plus derived statistics
src/lib/districts.ts  the single source of district ↔ seat grouping
src/lib/search.ts     bilingual search (Bengali or English, same results)
src/lib/seo/          titles, descriptions, structured data
src/components/       shared UI
.github/workflows/    deploy to the VPS, CI for sangsad/
```

Public routes: `/` `/mp` `/mp/[slug]` `/ason` `/ason/[slug]` `/jela`
`/jela/[slug]` `/dol` `/dol/[slug]` `/committee` `/committee/[slug]`
`/ministers` `/upodeshta` `/odhibeshon` `/parisonkhan` `/nirbachon`
`/sangrakkhito-ason` `/songbad` `/somporke` `/sutro` `/jogajog` `/gopaniyota`.

## 5. Scripts

```bash
npm run dev          # local site
npm run build        # sync --soft + name index + next build (needs Supabase)
npm run build:local  # same without the Supabase step
npm run sync         # refresh data/ from the official sources
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # unit tests in src/lib (node:test, 63 of them)
npm run og-image     # regenerate the share image
npm run idf          # rebuild the name index used by news matching
npm run feed:rss     # news feed collectors, see docs/feed/README.md
npm run sync:posts   # blog posts from Supabase into the build
```

`npx vitest` does not work on this repo and is not meant to. The gate before
any pull request is:

```bash
npm test && npx tsc --noEmit && npx eslint .
```

## 6. Deploy model

- Push a branch, open a pull request. There is no preview deployment: check
  your work locally with `npm run build:local && npm start`.
- Merge to `main` deploys **production** (mymp.bd) through
  `.github/workflows/deploy.yml`, in about five minutes. No other branch deploys.
- Do not push straight to `main`. Branch, push, open the pull request, let the
  owner look at it.
- A failed build never replaces the live site, but a green build with wrong data
  does. Check locally before asking for a merge.

## 7. Rules this project holds to

These are editorial rules, not style preferences. Breaking one is a bug even if
the code is correct.

1. **Nothing invented.** If a source has no value, the page says the value is
   missing. No zeros, no guesses, no "approximately". Vote counts, turnout and
   attendance that no reachable source publishes simply do not appear.
2. **Every page names its source.** The site is a government-information site
   for Play Store purposes and was once rejected for not naming sources well
   enough. `/sutro` lists every kind of information and where it comes from.
   If you add a new kind of information, add its row there too.
3. **Two seat counts, never mixed.** The constituency result is BNP 211 /
   Jamaat 68. The seated parliament is BNP 247 / Jamaat 77, because the 50
   reserved women's seats are allocated after the general result. Every chart
   says which one it shows.
4. **Verified and unverified are labelled differently.** A member's Facebook
   page is shown as "official" only when a source other than the page itself
   says it is theirs. Otherwise the link is shown with a visible
   "যাচাই করা হয়নি" label. Never promote one to the other without a source.
5. **No personal contact details.** Official parliament email only. Personal
   mobile numbers exist in the API and are deliberately not published.
6. **Committee rosters are checked before they are shown.** Many committees in
   the source still list the previous parliament's members. Those are shown as
   awaiting an update, never as current members.
7. **Public pages read no session.** See section 3.
8. **No reader data.** No accounts, no ads, no tracking. Keep it that way.
9. **The site is independent.** It is not a government site and says so. Do not
   add wording that could read as official or affiliated.

## 8. Gotchas that have cost time before

- **Never run `npm run build` while `npm run dev` is running.** They share
  `.next` and the dev server breaks. Recovery: kill both, `rm -rf .next`,
  restart. Same the other way round: kill `next start` before rebuilding, or
  you will measure the old pages.
- **PostgREST stops at 1000 rows.** Any Supabase select without paging silently
  truncates. Page it and verify the count.
- **Bangla in `git commit -m` breaks.** The shell parses the words as
  pathspecs. Use `git commit -F -` with the message on stdin.
- **Long heredocs mangle backslashes.** Write scripts to a file instead of
  piping them in.
- **New columns need grants.** A column added by migration is writable by the
  service key but invisible to the anon key until you `GRANT SELECT` on it.
- **`data/` conflicts in pull requests** are normal, because the nightly build
  commits nothing but the owner's local syncs do. Regenerate rather than
  resolving by hand.

## 9. Before you ask for a merge

- [ ] `npm test && npx tsc --noEmit && npx eslint .` all clean
- [ ] Checked locally (`npm run build:local && npm start`), on a phone width as well
- [ ] No new Supabase or auth call in anything under `src/app/(site)`
- [ ] Any new information type has a row on `/sutro`
- [ ] Any new page is in `src/app/sitemap.xml/route.ts` and reachable from a
      link, not only from the URL
- [ ] Bengali text proofread; numbers rendered with `bn()` / `bnGroup()`, not
      raw digits
- [ ] `data/*.json` either untouched or regenerated by `npm run sync`

## 10. Who runs what

| Task | Who |
| --- | --- |
| Code, branches, pull requests | developer |
| Merge to `main` | owner |
| Supabase migrations, keys, grants | owner |
| `/admin` content edits, publish | owner |
| Play Console releases, app signing | owner |
| Domain, DNS, VPS and GitHub settings | owner |

Questions about data or editorial rules go to the owner, not into an
assumption. Anything the sources do not say, the site does not say.
