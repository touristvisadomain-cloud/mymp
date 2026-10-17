/**
 * English headlines for what is already collected: the backlog the
 * half-hourly runs would otherwise take weeks to reach.
 *
 *   npm run feed:translate                        count what has no English yet, and what it would cost; write nothing
 *   npm run feed:translate -- --apply             translate it all and store the English
 *   npm run feed:translate -- --apply --limit 2000          at most 2,000 items per table
 *   npm run feed:translate -- --since 2026-10-01            only items published since that day
 *   npm run feed:translate -- --apply --retry-failed        ask again for the ones that came back unusable
 *   npm run feed:translate -- --apply --only feed|news      one table
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and for
 * --apply GOOGLE_TRANSLATE_KEY (in .env.local or the environment), and
 * supabase/migrations/006_feed_title_en.sql applied. Newest first, 500 at a
 * time with a pause between requests, and safe to stop and run again: only
 * items without English are ever sent.
 */
import fs from 'node:fs';

const envFile = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

import { countPending, translatePending } from '../src/lib/feed/translateRun';
import { translationProvider, translateSummaries } from '../src/lib/feed/translate';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** Google Cloud Translation Basic (v2): $20 per million characters, the first 500,000 a month free. */
const dollars = (chars: number) => (chars / 1_000_000) * 20;

async function main() {
  const apply = process.argv.includes('--apply');
  const retryFailed = process.argv.includes('--retry-failed');
  const limit = Number(arg('--limit') ?? Infinity);
  const sinceDay = arg('--since');
  if (sinceDay && !/^\d{4}-\d{2}-\d{2}$/.test(sinceDay)) throw new Error('--since takes a day: 2026-10-01');
  const since = sinceDay ? `${sinceDay}T00:00:00+06:00` : undefined;
  const only = arg('--only');
  const tables: ('feed' | 'news')[] = only === 'feed' || only === 'news' ? [only] : ['feed', 'news'];

  const counts = await countPending({ since, retryFailed });
  if (!counts) {
    console.log('Nothing to do: Supabase is not configured, or supabase/migrations/006_feed_title_en.sql has not been run (npm run db:migrate).');
    return;
  }
  console.log(`Without English${retryFailed ? ' (failed before)' : ''}: ${counts.feed} feed items on members' pages, ${counts.news} published news posts.`);
  console.log(`Summaries ${translateSummaries() ? 'are' : 'are not'} translated (FEED_TRANSLATE_SUMMARIES=1 to include them).`);

  if (!apply) {
    // A page of each, to show what goes out and to price the lot from it.
    const sample = await translatePending({ dryRun: true, limit: 500, since, retryFailed, tables, provider: null });
    const seen = sample.feed.pending + sample.news.pending;
    const total = (tables.includes('feed') ? counts.feed : 0) + (tables.includes('news') ? counts.news : 0);
    const estimate = seen ? Math.round((sample.characters / seen) * total) : 0;
    console.log(`\nAbout ${estimate.toLocaleString('en-GB')} characters to send (from a sample of ${seen}): about $${dollars(estimate).toFixed(2)} at $20 per million, less the 500,000 free each month.`);
    for (const s of sample.samples ?? []) console.log(`  ${s.bn}`);
    console.log(`\nNothing was sent or written. Run with --apply to translate${translationProvider() ? '' : ' (GOOGLE_TRANSLATE_KEY is not set yet)'}.`);
    return;
  }

  if (!translationProvider()) throw new Error('GOOGLE_TRANSLATE_KEY is not set: put it in .env.local or the environment');
  const done = { feed: 0, news: 0, failed: 0, characters: 0 };
  for (;;) {
    const left = limit - Math.max(done.feed, done.news);
    if (left <= 0) break;
    const r = await translatePending({ limit: Math.min(500, left), since, retryFailed, tables, log: () => {} });
    if (r.status !== 'ok') throw new Error(r.reason ?? r.status);
    const got = r.feed.translated + r.feed.copied + r.feed.failed + r.news.translated + r.news.copied + r.news.failed;
    done.feed += r.feed.translated + r.feed.copied + r.feed.failed;
    done.news += r.news.translated + r.news.copied + r.news.failed;
    done.failed += r.feed.failed + r.news.failed;
    done.characters += r.characters;
    for (const s of (r.samples ?? []).slice(0, 2)) console.log(`  ${s.bn}\n  → ${s.en ?? '(left untranslated)'}`);
    console.log(`… ${done.feed} feed items and ${done.news} news posts so far, ${done.failed} unusable, ${done.characters.toLocaleString('en-GB')} characters`);
    // A retry pass marks nothing new as failed, so it stops when a round changes nothing.
    if (!got || (retryFailed && r.feed.failed + r.news.failed === got)) break;
  }
  console.log(`\nDone: ${done.feed} feed items, ${done.news} news posts; ${done.failed} left untranslated (--retry-failed asks again).`);
  console.log('The English shows on the English pages within five minutes; news posts reach data/news.json at the next build.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
