# আমার এমপি · MY MP

Open reference for the members of the Bangladesh parliament: all 349 sitting
members, their seats, parties and committees, in Bengali with English names
alongside.

## How the data gets here

Everything comes from the parliament's own open JSON API and is committed as a
snapshot under `data/`. No database is queried when a visitor loads a page.

```bash
npm run sync     # pull parliament.gov.bd into data/ and public/search-index.json
npm run dev      # local site
npm run build    # prerenders every page
```

`npm run sync` writes `data/members.json`, `committees.json`, `parties.json`,
`seats.json` and `meta.json`, plus the search index. Re-run it whenever the
parliament publishes changes, then rebuild.

**Do not run `npm run build` while `npm run dev` is running.** They share
`.next` and the dev server breaks. Stop dev first.

## Rules this project holds to

- **Nothing invented.** If a source has no value, the page says so instead of
  showing a zero or a guess. Vote counts, turnout, attendance and oath dates are
  not published anywhere we can reach, so they do not appear.
- **Two different seat counts, never mixed up.** The constituency result is BNP
  211 / Jamaat 68. The seated parliament is BNP 247 / Jamaat 77, because the 50
  reserved women's seats are allocated after the general result. Any chart says
  which one it is showing.
- **Committee rosters are checked before they are shown.** The API returns a
  record per committee per parliament, so the same committee appears twice, and
  35 of the 66 still list members of the previous parliament. Those are shown as
  awaiting an update rather than presenting former members as current.
- **No personal phone numbers.** Every sitting member has one in the API. The
  sync stores only whether one exists, pending a decision on publishing them.
- **Public pages read no session.** Nothing under the public routes may call
  auth, or the whole site stops being cacheable.

## Layout

```
data/                 committed snapshot, refreshed by npm run sync
scripts/sync.mjs      the sync
src/lib/data.ts       typed access + derived statistics
src/lib/search.ts     bilingual search: type Bengali or English, same results
src/components/       shared UI
src/app/              routes
```

Routes: `/` `/mp` `/mp/[slug]` `/ason/[slug]` `/dol` `/dol/[slug]`
`/committee` `/committee/[slug]` `/parisonkhan` `/nirbachon` `/songbad`

## Admin panel and database

`/admin` is a Supabase-backed panel: edit members per field, hide/unhide,
publish news, clear the corrections queue, read the audit log, manage users.
Until the database variables exist it shows a setup page and nothing else
changes.

How an edit reaches the public site (there is still no database on the read
path): every build runs `scripts/sync.mjs --soft` first, which fetches
parliament.gov.bd, applies every override and hidden flag from Supabase,
writes the published news to `data/news.json`, then `next build` prerenders.
"Publish" in the admin asks GitHub to rebuild and redeploy the site on the VPS
(`src/lib/rebuild.ts`); Supabase Cron does the same nightly at 02:00 Dhaka
time, after the parliament jobs. See `docs/vps-deployment.md`.

To connect, once:

1. Create a Supabase project dedicated to this site. Run `supabase/schema.sql`
   in its SQL editor.
2. Supabase → Authentication → Users → Add user: the first admin's email and
   password.
3. Set the variables in `.env.example` in Dokploy's environment configuration.
   `ADMIN_BOOTSTRAP_EMAIL` is that first user; the admin row is created on
   their first sign-in.
4. Add `MYMP_DEPLOY_TOKEN` (a fine-grained GitHub token for this repository,
   Contents: Read and write) so Publish can rebuild.
5. Run the Supabase Cron migration (`supabase/migrations/005_cron.sql`) to
   schedule all periodic jobs.

Every admin table has row level security on and no policies, so the anon key
can read nothing; only server actions holding the service key touch them.

## Earlier parliaments, results and social links

- `data/history.json` is written by the sync from the source's records of the 4th, 5th and 7th to 12th parliaments. People are matched across parliaments by the secretariat's own person id (`empId`), never by name alone; seats are matched by number within the same district, and anything before the 2008 delimitation is flagged on the page.
- Vote counts do not exist in the source. `supabase/migrations/002_election_results.sql` adds a table an admin fills from the Election Commission's gazette at /admin/results; only `published` rows are copied into `data/results.json` at build time.
- Social links are admin-entered member overrides (facebook, x, youtube, instagram, website) and are refused unless they are https URLs on the matching network.

## New here?

`docs/developer.md` is the handover: access, local setup, how an edit reaches a
visitor, the scripts, the deploy model, the editorial rules and the traps.

## Not built yet

The public correction form (the queue exists), the news scraper (news is
entered by hand and reviewed), and the contact-an-MP relay.
