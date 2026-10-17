/**
 * The translation run: headlines that are on a member's page and have no
 * English yet are translated and stored beside the Bangla.
 *
 * Called after every collector run by /api/cron/feed (a few hundred at most,
 * inside a time box), on its own by /api/cron/feed?collector=translate, and by
 * `npm run feed:translate` for the backlog. Without GOOGLE_TRANSLATE_KEY it
 * does nothing; before supabase/migrations/006 is run it does nothing either.
 *
 * Two tables: the feed (feed_items: headline, and the summary when
 * FEED_TRANSLATE_SUMMARIES=1) and the editor-published news (news_posts:
 * headline and excerpt), which the build's sync carries into data/news.json.
 *
 * Only items on a member's page are translated: the feed also keeps every
 * story of a general outlet's feed, and nobody reads those in any language.
 * A headline whose answer was unusable is marked `en_source = 'failed'` with
 * the time, so it is not asked for on every run; `--retry-failed` asks again.
 */
import { restDb, DbError, type Db } from '@/lib/posts/db';
import { FEED_FROM_INSTANT } from './window';
import { englishColumns, isMissingColumn } from './store';
import { translateTexts, translationProvider, translateSummaries, billableChars, TranslateError, type Provider, type Translated } from './translate';
import { siteGlossary } from './translateGlossary';

export interface TranslateRunOptions {
  /** Most items per table per run. */
  limit?: number;
  /** Stop starting new work after this many milliseconds. */
  budgetMs?: number;
  /** Only items published since this instant (ISO); the feed's window by default. */
  since?: string;
  /** Count and show what would be sent; translate and write nothing. */
  dryRun?: boolean;
  /** Ask again for the headlines that came back unusable before. */
  retryFailed?: boolean;
  /** Which tables; both by default. */
  tables?: ('feed' | 'news')[];
  provider?: Provider | null;
  log?: (line: string) => void;
}

export interface TranslateRunResult {
  status: 'ok' | 'skipped' | 'failed';
  reason?: string;
  provider?: string;
  feed: { pending: number; translated: number; copied: number; failed: number };
  news: { pending: number; translated: number; copied: number; failed: number };
  /** Characters sent (or, on a dry run, that would be): what Google bills. */
  characters: number;
  samples?: { bn: string; en?: string }[];
}

const q = (v: string) => encodeURIComponent(v);
const empty = () => ({ pending: 0, translated: 0, copied: 0, failed: 0 });

/** Writes, a few at a time: the gateway answers a burst of hundreds with 502s. */
async function patchAll(db: Db, patches: { path: string; body: object }[], concurrency = 4) {
  for (let i = 0; i < patches.length; i += concurrency) {
    await Promise.all(patches.slice(i, i + concurrency).map((p) => db.patch(p.path, p.body)));
  }
}

const englishFields = (title: Translated, summary: Translated | undefined, now: string) => ({
  title_en: title?.text ?? null,
  ...(summary !== undefined ? { summary_en: summary?.text ?? null } : {}),
  en_source: title ? title.source : 'failed',
  en_at: now,
});

/** How many items still have no English (all of them, not a page): for the backfill's dry run. */
export async function countPending(opts: { since?: string; retryFailed?: boolean } = {}): Promise<{ feed: number; news: number } | null> {
  const db = restDb();
  if (!db || !(await englishColumns())) return null;
  const which = opts.retryFailed ? 'en_source=eq.failed' : 'en_at=is.null';
  const since = opts.since ?? FEED_FROM_INSTANT;
  const [feed, news] = await Promise.all([
    db.count(`feed_items?select=id,feed_item_mps!inner(mp_id)&feed_item_mps.status=neq.removed&${which}&published_at=gte.${q(since)}`),
    db.count(`news_posts?select=id&status=eq.published&${which}`).catch(() => 0),
  ]);
  return { feed, news };
}

export async function translatePending(opts: TranslateRunOptions = {}): Promise<TranslateRunResult> {
  const log = opts.log ?? (() => {});
  const result: TranslateRunResult = { status: 'ok', feed: empty(), news: empty(), characters: 0 };
  const provider = opts.provider === undefined ? translationProvider() : opts.provider;
  if (!provider && !opts.dryRun) return { ...result, status: 'skipped', reason: 'GOOGLE_TRANSLATE_KEY is not set' };
  result.provider = provider?.name ?? 'google';
  const db = restDb();
  if (!db) return { ...result, status: 'skipped', reason: 'Supabase is not configured' };
  if (!(await englishColumns())) return { ...result, status: 'skipped', reason: 'the English columns do not exist yet: run supabase/migrations/006_feed_title_en.sql (npm run db:migrate)' };

  const deadline = opts.budgetMs ? Date.now() + opts.budgetMs : undefined;
  const limit = Math.max(1, opts.limit ?? 300);
  const since = opts.since ?? FEED_FROM_INSTANT;
  const tables = opts.tables ?? ['feed', 'news'];
  const glossary = siteGlossary();
  const withSummaries = translateSummaries();
  const which = opts.retryFailed ? 'en_source=eq.failed' : 'en_at=is.null';
  const samples: { bn: string; en?: string }[] = [];

  try {
    if (tables.includes('feed')) {
      // On at least one member's page (any status but removed: a hidden item can be shown again), newest first.
      const rows = await db.get<{ id: number; title: string; summary: string | null }[]>(
        `feed_items?select=id,title,summary,feed_item_mps!inner(mp_id)&feed_item_mps.status=neq.removed&${which}` +
          `&published_at=gte.${q(since)}&order=published_at.desc,id.desc&limit=${limit}`,
      );
      result.feed.pending = rows.length;
      const summaries = withSummaries ? rows.map((r) => r.summary) : [];
      result.characters += billableChars(rows.map((r) => r.title), glossary) + billableChars(summaries, glossary);
      if (opts.dryRun) {
        samples.push(...rows.slice(0, 8).map((r) => ({ bn: r.title })));
      } else if (rows.length && provider) {
        const titles = await translateTexts(rows.map((r) => r.title), { provider, glossary, deadline });
        const sums = withSummaries ? await translateTexts(summaries, { provider, glossary, deadline }) : undefined;
        const now = new Date().toISOString();
        const patches: { path: string; body: object }[] = [];
        rows.forEach((r, k) => {
          const t = titles[k]!;
          // Out of time before this one was sent: left for the next run, not marked failed.
          if (!t && deadline && Date.now() > deadline) return;
          if (t?.source === 'google') result.feed.translated++;
          else if (t) result.feed.copied++;
          else result.feed.failed++;
          patches.push({ path: `feed_items?id=eq.${r.id}`, body: englishFields(t, sums ? sums[k] ?? null : undefined, now) });
          if (samples.length < 8) samples.push({ bn: r.title, en: t?.text });
        });
        await patchAll(db, patches);
      }
      log(`feed: ${rows.length} without English`);
    }

    if (tables.includes('news') && !(deadline && Date.now() > deadline)) {
      let rows: { id: string; title_bn: string; excerpt_bn: string | null }[] = [];
      try {
        rows = await db.get(`news_posts?select=id,title_bn,excerpt_bn&status=eq.published&${which}&order=published_on.desc,id&limit=${limit}`);
      } catch (e) {
        // news_posts may be a step behind feed_items when the migration was pasted in part.
        if (!isMissingColumn(e, 'en_')) throw e;
        log('news_posts has no English columns yet');
      }
      result.news.pending = rows.length;
      result.characters += billableChars(rows.map((r) => r.title_bn), glossary) + billableChars(rows.map((r) => r.excerpt_bn), glossary);
      if (opts.dryRun) {
        samples.push(...rows.slice(0, 3).map((r) => ({ bn: r.title_bn })));
      } else if (rows.length && provider) {
        const titles = await translateTexts(rows.map((r) => r.title_bn), { provider, glossary, deadline });
        const excerpts = await translateTexts(rows.map((r) => r.excerpt_bn), { provider, glossary, deadline });
        const now = new Date().toISOString();
        const patches: { path: string; body: object }[] = [];
        rows.forEach((r, k) => {
          const t = titles[k]!;
          if (!t && deadline && Date.now() > deadline) return;
          if (t?.source === 'google') result.news.translated++;
          else if (t) result.news.copied++;
          else result.news.failed++;
          patches.push({
            path: `news_posts?id=eq.${q(r.id)}`,
            body: { title_en: t?.text ?? null, excerpt_en: excerpts[k]?.text ?? null, en_source: t ? t.source : 'failed', en_at: now },
          });
        });
        await patchAll(db, patches);
      }
      log(`news_posts: ${rows.length} without English`);
    }
  } catch (e) {
    if (e instanceof TranslateError || e instanceof DbError) {
      return { ...result, status: 'failed', reason: e.message, samples };
    }
    throw e;
  }
  return { ...result, samples };
}
