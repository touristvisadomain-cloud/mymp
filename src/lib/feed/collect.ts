/**
 * The collectors: what runs on a schedule, what it writes, and the guards that
 * keep a broken source from emptying a feed.
 *
 * Safeguards, all of them learned from the engine this replaces:
 *   * a run that finds nothing when the last one found more than fifty is
 *     aborted without writing: a source that changes its page must not look
 *     like a quiet news day;
 *   * a member is given at most 50 new items a day by a collector; past that
 *     the rest wait for a reviewer, so one name collision cannot flood a page;
 *   * an attachment an editor has ruled on is never touched again.
 */
import { allMembers, currentPosts, districtOf } from '@/lib/data';
import { buildFeedIndex, matchItem, type FeedIndex, type FeedMp } from './matchMp';
import { RSS_SOURCES, SITEMAP_SOURCES } from '../../../config/news-sources';
import { pressNamesOf } from '../../../config/press-names';
import { fetchFeed } from './rss';
import {
  attach, attachedToday, finishRun, lastRun, nameVariants, startRun, turnOf, upsertItem,
  type FeedItemInput, type RunResult,
} from './store';

const DAILY_CAP_PER_MP = 50;

/** The member list the matcher works against, with posts and name variants. */
export async function buildIndex(): Promise<FeedIndex> {
  const variants = await nameVariants();
  const postsByMember = new Map<string, { titles: string[]; ministries: string[] }>();
  for (const p of currentPosts()) {
    if (!p.memberId) continue;
    const e = postsByMember.get(p.memberId) ?? { titles: [], ministries: [] };
    e.titles.push(p.title);
    if (p.ministryBn) e.ministries.push(p.ministryBn);
    postsByMember.set(p.memberId, e);
  }
  const mps: FeedMp[] = allMembers
    .filter((m) => !m.resignedOn)
    .map((m) => {
      const d = m.seat ? districtOf(m.seat) : null;
      const post = postsByMember.get(m.id);
      return {
        id: m.id,
        nameBn: m.nameBn,
        nameEn: m.nameEn,
        seatBn: m.seat?.nameBn ?? null,
        seatEn: m.seat?.nameEn ?? null,
        districtBn: d?.bn ?? null,
        districtEn: d?.en ?? null,
        partyBn: m.party?.nameBn ?? null,
        partyAbbr: m.party?.abbr ?? null,
        posts: post?.titles ?? [],
        partyOffices: partyOffice(m.party?.abbr, m.partyRoleBn),
        ministries: post?.ministries ?? [],
        // The editors' variants and the names the press prints (config/press-names.ts).
        variants: [...(variants.get(m.id) ?? []), ...pressNamesOf(m.id).map((variant) => ({ variant, weight: 1 }))],
      };
    });
  return buildFeedIndex(mps);
}

/** How headlines write the parties whose leaders they call by office alone. */
const PARTY_SHORT: Record<string, string[]> = { BNP: ['বিএনপি'], BJEI: ['জামায়াত', 'জামায়াতের'], NCP: ['এনসিপি', 'এনসিপির'] };

/**
 * A party office as headlines write it when they leave the name out:
 * "…: জামায়াত আমির", "বিএনপি চেয়ারম্যান বললেন". Only a role at the party's
 * national level (no ", জেলা …" after it) is one person.
 */
function partyOffice(abbr: string | undefined, role: string | null | undefined): string[] {
  const short = abbr ? PARTY_SHORT[abbr] : undefined;
  const r = role?.trim();
  if (!short || !r || r.includes(',')) return [];
  return short.map((p) => `${p} ${r}`);
}

export interface IngestCounts { found: number; stored: number; attached: number; lowConfidence: number; unmatched: number; ranOut?: boolean }

/**
 * Stores a batch of items and attaches each to the members it names. Shared by
 * every collector, so one story is matched the same way wherever it came from.
 */
export interface IngestOptions {
  /**
   * Store only what names a member. A feed carries an outlet's top twenty
   * stories and keeping all of them costs nothing; a sitemap carries its whole
   * day, and keeping the football and the weather with it would grow the table
   * by a hundred thousand rows a week for no page.
   */
  onlyMatched?: boolean;
}

export async function ingest(items: FeedItemInput[], index: FeedIndex, counts: IngestCounts, deadline?: number, opts: IngestOptions = {}) {
  const givenToday = new Map<string, number>();
  for (const item of items) {
    // A serverless function has a minute; the terminal has as long as it takes.
    // Whatever is left over is picked up by the next run, which sees it as new.
    if (deadline && Date.now() > deadline) { counts.ranOut = true; break; }
    counts.found++;

    // Matching first costs nothing — it is local — and saves the write.
    if (opts.onlyMatched && !matchItem(index, { title: item.title, summary: item.summary }).length) {
      counts.unmatched++;
      continue;
    }
    const stored = await upsertItem(item);
    if (!stored) continue;
    if (stored.isNew) counts.stored++;

    const matches = matchItem(index, { title: item.title, summary: item.summary });
    if (!matches.length) {
      counts.unmatched++;
      continue;
    }
    for (const m of matches) {
      let today = givenToday.get(m.mpId);
      if (today === undefined) {
        today = await attachedToday(m.mpId);
        givenToday.set(m.mpId, today);
      }
      // Past the cap the match is still recorded, but as something to review.
      // The cap guards against one name collision flooding a page with today's
      // news; a backfill reading months of archive in one day is not that, so a
      // story older than two days never counts against it.
      const fresh = Date.now() - new Date(item.publishedAt).getTime() < 2 * 86_400_000;
      const overCap = fresh && today >= DAILY_CAP_PER_MP;
      const result = await attach({
        itemId: stored.id,
        mpId: m.mpId,
        score: m.score,
        lowConfidence: m.lowConfidence || overCap,
        signals: overCap ? [...m.signals, { signal: 'daily-cap', points: 0, detail: `আজ ইতিমধ্যে ${today}টি` }] : m.signals,
      });
      if (result === 'new') {
        counts.attached++;
        givenToday.set(m.mpId, today + 1);
        if (m.lowConfidence || overCap) counts.lowConfidence++;
      }
    }
  }
}

export interface CollectorOptions {
  trigger?: string;
  dryRun?: boolean;
  /** Stop storing after this many milliseconds and leave the rest for the next run. */
  budgetMs?: number;
}

/** Every configured feed, once. */
export async function runRssCollector(opts: CollectorOptions = {}): Promise<RunResult & { runId?: number }> {
  // The budget counts from the start: fetching thirty feeds takes time too, and
  // a run that outlives the serverless minute is killed and left as 'running'.
  const deadline = opts.budgetMs ? Date.now() + opts.budgetMs : undefined;
  const run = opts.dryRun ? null : await startRun('rss', opts.trigger ?? 'manual');
  const errors: { source: string; message: string }[] = [];
  const detail: Record<string, number> = {};
  const index = await buildIndex();
  const counts: IngestCounts = { found: 0, stored: 0, attached: 0, lowConfidence: 0, unmatched: 0 };

  const batches = await Promise.all(
    RSS_SOURCES.map(async (source) => {
      const items: FeedItemInput[] = [];
      for (const url of source.rss ?? []) {
        const { items: got, error } = await fetchFeed(url, deadline ? 12_000 : 20_000);
        if (error) {
          errors.push({ source: source.key, message: `${url}: ${error}` });
          continue;
        }
        for (const it of got) {
          if (!it.publishedAt) continue;
          items.push({
            type: 'news',
            title: it.title,
            url: it.url,
            summary: it.summary,
            outletName: source.nameBn,
            outletId: source.key,
            thumbnailUrl: it.thumbnailUrl ?? null,
            publishedAt: it.publishedAt,
            source: 'rss',
          });
        }
      }
      detail[source.key] = items.length;
      return items;
    }),
  );
  const items = batches.flat();

  // A collector that suddenly finds nothing has broken, not gone quiet.
  const previous = opts.dryRun ? null : await lastRun('rss');
  if (!items.length && (previous?.items_found ?? 0) > 50) {
    const result: RunResult = {
      status: 'aborted', itemsFound: 0, itemsNew: 0, itemsAttached: 0, unmatched: 0, lowConfidence: 0,
      errors: [...errors, { source: 'rss', message: `no items at all, while the last run found ${previous!.items_found}: nothing was written` }],
      detail,
    };
    if (run) await finishRun(run, result);
    return result;
  }

  if (!opts.dryRun) {
    // An international feed is mostly about elsewhere: only what names a member is stored from it.
    const narrow = new Set(RSS_SOURCES.filter((s) => s.onlyMatched).map((s) => s.key));
    await ingest(items.filter((i) => !narrow.has(i.outletId ?? '')), index, counts, deadline);
    await ingest(items.filter((i) => narrow.has(i.outletId ?? '')), index, counts, deadline, { onlyMatched: true });
  } else counts.found = items.length;

  const result: RunResult = {
    status: RSS_SOURCES.every((s) => !detail[s.key]) ? 'failed' : 'ok',
    itemsFound: counts.found,
    itemsNew: counts.stored,
    itemsAttached: counts.attached,
    unmatched: counts.unmatched,
    lowConfidence: counts.lowConfidence,
    errors: counts.ranOut
      ? [...errors, { source: 'rss', message: `stopped at the time budget with ${items.length - counts.found} items left; the next run takes them` }]
      : errors,
    detail,
  };
  if (run) await finishRun(run, result);
  return { ...result, runId: run?.id };
}

/** One sitemap address, with the date filled in for the outlets that need one. */
export function sitemapUrls(source: { sitemaps?: { url: string; daily?: boolean }[] }, days: string[]): string[] {
  const out: string[] = [];
  for (const s of source.sitemaps ?? []) {
    if (!s.daily) out.push(s.url);
    else for (const d of days) out.push(s.url.replace('{d}', d));
  }
  return out;
}

const dayString = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);

/**
 * The outlets' own news sitemaps: everything they have filed, not the top
 * twenty their feeds carry.
 *
 * Two things keep this inside a serverless minute and inside what a newsroom's
 * server should be asked for. Only a slice of the outlets is read per run —
 * a sitemap covers a day or two, so reading each of them once an hour loses
 * nothing — and the requests within a run are spaced, because several of these
 * hosts answer 403 when asked twice in the same second.
 */
export async function runSitemapCollector(opts: CollectorOptions & { perRun?: number } = {}): Promise<RunResult & { runId?: number }> {
  const run = opts.dryRun ? null : await startRun('sitemap', opts.trigger ?? 'manual');
  const errors: { source: string; message: string }[] = [];
  const detail: Record<string, number> = {};
  const index = await buildIndex();
  const counts: IngestCounts = { found: 0, stored: 0, attached: 0, lowConfidence: 0, unmatched: 0 };
  const deadline = opts.budgetMs ? Date.now() + opts.budgetMs : undefined;

  const perRun = opts.perRun ?? 8;
  const tick = await turnOf('sitemap', run, 30);
  const all = SITEMAP_SOURCES;
  const start = (tick * perRun) % Math.max(all.length, 1);
  const slice = Array.from({ length: Math.min(perRun, all.length) }, (_, i) => all[(start + i) % all.length]!);

  // Yesterday as well as today: a day's sitemap is complete only once the day
  // is over, and at two in the morning today's holds almost nothing.
  const days = [dayString(0), dayString(1)];
  const items: FeedItemInput[] = [];
  for (const source of slice) {
    let got = 0;
    for (const url of sitemapUrls(source, days)) {
      const { items: fetched, error } = await fetchFeed(url, 25_000);
      if (error) {
        errors.push({ source: source.key, message: `${url}: ${error}` });
        continue;
      }
      for (const it of fetched) {
        if (!it.publishedAt) continue;
        items.push({
          type: 'news',
          title: it.title,
          url: it.url,
          summary: it.summary,
          outletName: source.nameBn,
          outletId: source.key,
          thumbnailUrl: it.thumbnailUrl ?? null,
          publishedAt: it.publishedAt,
          // The outlet's own machine-readable index of its own articles, which
          // is what `rss` means here; the run row says which collector fetched it.
          source: 'rss',
        });
        got++;
      }
      // Spaced, so a newsroom's server is never asked twice in the same breath.
      await new Promise((r) => setTimeout(r, 1200));
      if (deadline && Date.now() > deadline) break;
    }
    detail[source.key] = got;
    if (deadline && Date.now() > deadline) break;
  }

  const previous = opts.dryRun ? null : await lastRun('sitemap');
  if (!items.length && (previous?.items_found ?? 0) > 50) {
    const result: RunResult = {
      status: 'aborted', itemsFound: 0, itemsNew: 0, itemsAttached: 0, unmatched: 0, lowConfidence: 0,
      errors: [...errors, { source: 'sitemap', message: `no items at all, while the last run found ${previous!.items_found}: nothing was written` }],
      detail,
    };
    if (run) await finishRun(run, result);
    return result;
  }

  if (!opts.dryRun) await ingest(items, index, counts, deadline, { onlyMatched: true });
  else counts.found = items.length;

  const result: RunResult = {
    // Failed means nothing came back from any outlet. Errors were counted per
    // address before, and a daily outlet has two, so three blocked outlets out
    // of eight marked a run red while it had just read 942 headlines.
    status: slice.length && errors.length && slice.every((s) => !detail[s.key]) ? 'failed' : 'ok',
    itemsFound: counts.found,
    itemsNew: counts.stored,
    itemsAttached: counts.attached,
    unmatched: counts.unmatched,
    lowConfidence: counts.lowConfidence,
    errors,
    detail,
  };
  if (run) await finishRun(run, result);
  return { ...result, runId: run?.id };
}
