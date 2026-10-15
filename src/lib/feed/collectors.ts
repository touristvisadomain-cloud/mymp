/**
 * The two collectors that cost money or quota: YouTube, and the search that
 * reaches the outlets with no feed.
 *
 * Both work their way through the 348 members a slice at a time rather than
 * all at once, so a run is small, predictable and inside its quota. Which
 * members a run takes is decided by counting the collector's earlier runs, so
 * a late or skipped run still takes the next slice, with the members who hold a
 * government or House post taken twice as often as the rest.
 */
import { allMembers, currentPosts, districtOf, getMemberById } from '@/lib/data';
import { matchItem, type FeedIndex } from './matchMp';
import { buildIndex, ingest, type IngestCounts } from './collect';
import { searchProvider } from './searchProvider';
import { NEWS_SOURCES, SEARCH_ONLY_SOURCES } from '../../../config/news-sources';
import { TRUSTED_CHANNELS } from '../../../config/feed-matching';
import { OFFICIAL_CHANNELS, OFFICIAL_CHANNEL_IDS } from '../../../config/video-channels';

/** The outlet a channel belongs to, by its Bangla name, so a video reads "যুগান্তর" and not "Daily Jugantor". */
const CHANNEL_OUTLET = new Map(OFFICIAL_CHANNELS.map((c) => [c.id, NEWS_SOURCES.find((s) => s.key === c.source)?.nameBn ?? null]));
import { attach, finishRun, startRun, turnOf, upsertItem, type FeedItemInput, type RunResult } from './store';
import { restDb, type Db } from '@/lib/posts/db';

function db(): Db {
  const d = restDb();
  if (!d) throw new Error('Supabase is not configured.');
  return d;
}

const YOUTUBE_KEY = () => process.env.YOUTUBE_API_KEY;
/**
 * search.list costs 100 units, and a default key gets 10,000 a day: a hundred
 * searches, for 348 members. So a run takes four members, once an hour, which
 * spends 9,600 units a day and walks the whole House in about three and a half
 * days. Members holding a post appear twice in the cycle, so they come round
 * twice as often. YOUTUBE_MEMBERS_PER_RUN raises it if the key's quota is.
 */
const SEARCH_COST = 100;
/**
 * The earliest a member's video search reaches: the start of the election
 * year, so the campaign months before the 13th parliament sat are in too.
 */
const FEED_START = '2026-01-01T00:00:00Z';
/** channels.list and playlistItems.list cost one unit each. */
const CHEAP_COST = 1;
const PER_RUN = () => Math.max(0, Number(process.env.YOUTUBE_MEMBERS_PER_RUN ?? 3));

interface Target {
  id: string;
  nameBn: string | null;
  seatBn: string | null;
  priority: boolean;
}

/** Everyone, with the post holders marked so they come round twice as often. */
function targets(): Target[] {
  const withPost = new Set(currentPosts().map((p) => p.memberId).filter(Boolean) as string[]);
  return allMembers
    .filter((m) => !m.resignedOn)
    .map((m) => ({ id: m.id, nameBn: m.nameBn, seatBn: m.seat?.nameBn ?? null, priority: withPost.has(m.id) }));
}

/**
 * The few members this run takes, walking the same cycle every time so that
 * over a few days everyone is covered and nobody twice in a row. A member who
 * holds a post sits in the cycle twice.
 */
export function sliceFor(list: Target[], perRun: number, tick: number): Target[] {
  if (!list.length) return [];
  const cycle = [...list, ...list.filter((t) => t.priority)];
  const start = (tick * perRun) % cycle.length;
  const out: Target[] = [];
  for (let i = 0; out.length < perRun && i < cycle.length; i++) {
    const t = cycle[(start + i) % cycle.length]!;
    if (!out.some((x) => x.id === t.id)) out.push(t);
  }
  return out;
}

/* ---------------------------------------------------------------- YouTube */

interface YtItem {
  id: { videoId?: string };
  snippet: { title: string; description: string; publishedAt: string; channelId: string; channelTitle: string; thumbnails?: { high?: { url: string } } };
}

/**
 * Videos for a slice of members. One search.list per member, ordered by date,
 * nothing older than the member's feed start. The quota used is recorded on
 * the run, so the admin can see how close to the ceiling a day is.
 */
export async function runYoutubeCollector(opts: { trigger?: string; perRun?: number; since?: string; budgetMs?: number } = {}): Promise<RunResult & { runId?: number }> {
  const key = YOUTUBE_KEY();
  const run = await startRun('youtube', opts.trigger ?? 'manual');
  const counts: IngestCounts = { found: 0, stored: 0, attached: 0, lowConfidence: 0, unmatched: 0 };
  const errors: { source: string; message: string }[] = [];

  if (!key) {
    const result: RunResult = {
      status: 'aborted', itemsFound: 0, itemsNew: 0, itemsAttached: 0, unmatched: 0, lowConfidence: 0, quotaUsed: 0,
      errors: [{ source: 'youtube', message: 'YOUTUBE_API_KEY is not set, so no video was fetched' }],
    };
    await finishRun(run, result);
    return result;
  }

  const perRun = opts.perRun ?? PER_RUN();
  const turn = await turnOf('youtube', run, 60);
  const slice = perRun ? sliceFor(targets(), perRun, turn) : [];
  const index = await buildIndex();
  let quota = 0;

  // The cheap half first: a few channels' latest uploads, matched against all.
  // Both halves share one budget, so a run always answers inside the minute a
  // serverless function has; what is left over is the next run's work.
  const deadline = Date.now() + (opts.budgetMs ?? 40_000);
  const uploads = await collectChannelUploads(key, index, counts, errors, deadline, turn);
  quota += uploads.quota;
  const items: FeedItemInput[] = [];
  const published = opts.since ?? new Date(Date.now() - 30 * 86_400_000).toISOString();

  for (const t of slice) {
    if (!t.nameBn || Date.now() > deadline) continue;
    const q = [t.nameBn, t.seatBn].filter(Boolean).join(' ');
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('order', 'date');
    // A search costs the same 100 units whatever the page size, and only the
    // official channels' results are kept, so take the most it gives.
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('relevanceLanguage', 'bn');
    // A member with no video on the page yet (hidden ones do not count) is
    // searched back to the start of the year: a thirty-day window left most of
    // the House with an empty video strip for good.
    let after = published;
    if (!opts.since) {
      const had = await db().get<unknown[]>(`feed_item_mps?mp_id=eq.${encodeURIComponent(t.id)}&status=eq.visible&select=feed_item_id,feed_items!inner(type)&feed_items.type=eq.video&limit=1`).catch(() => [1]);
      if (!had.length) after = FEED_START;
    }
    url.searchParams.set('publishedAfter', after);
    url.searchParams.set('key', key);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      quota += SEARCH_COST;
      if (!res.ok) {
        const body = await res.text();
        errors.push({ source: 'youtube', message: `${t.nameBn}: ${res.status} ${body.slice(0, 120)}` });
        // A quota error ends the run; hammering it only wastes the rest of the day.
        if (res.status === 403 && /quota/i.test(body)) break;
        continue;
      }
      const json = (await res.json()) as { items?: YtItem[] };
      for (const v of json.items ?? []) {
        if (!v.id.videoId) continue;
        // Only the listed outlets' own channels (config/video-channels.ts): a
        // party page, a fan channel or a stranger saying the name is dropped.
        if (!OFFICIAL_CHANNEL_IDS.has(v.snippet.channelId)) continue;
        items.push({
          type: 'video',
          title: v.snippet.title,
          url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
          summary: v.snippet.description?.slice(0, 600) ?? null,
          outletName: CHANNEL_OUTLET.get(v.snippet.channelId) ?? v.snippet.channelTitle,
          outletId: 'youtube',
          channelId: v.snippet.channelId,
          thumbnailUrl: v.snippet.thumbnails?.high?.url ?? `https://i.ytimg.com/vi/${v.id.videoId}/hqdefault.jpg`,
          publishedAt: new Date(v.snippet.publishedAt).toISOString(),
          source: 'youtube',
        });
      }
    } catch (e) {
      errors.push({ source: 'youtube', message: `${t.nameBn}: ${(e as Error).message}` });
    }
  }

  await ingest(items, index, counts, deadline);
  const result: RunResult = {
    status: errors.length && !counts.found ? 'failed' : 'ok',
    itemsFound: counts.found,
    itemsNew: counts.stored,
    itemsAttached: counts.attached,
    unmatched: counts.unmatched,
    lowConfidence: counts.lowConfidence,
    quotaUsed: quota,
    errors,
    detail: { members: slice.length, channels: uploads.channels, searches: slice.length },
  };
  await finishRun(run, result);
  return { ...result, runId: run.id };
}

/**
 * The latest uploads of the news channels, matched against every member.
 *
 * A name search costs 100 units and covers one member; reading a channel's
 * uploads costs 1 and can name any of the 348. This is where most of the video
 * in the feed comes from, and it is why a member nobody searched for still gets
 * their press conference on their page the same day.
 */
async function collectChannelUploads(
  key: string,
  index: FeedIndex,
  counts: IngestCounts,
  errors: { source: string; message: string }[],
  deadline: number,
  turn: number,
): Promise<{ quota: number; channels: number }> {
  const sb = db();
  // Resolving a handle costs a unit, so the uploads playlist is remembered.
  let cache: Record<string, string> = {};
  try {
    const [row] = await sb.get<{ value: Record<string, string> }[]>("app_settings?key=eq.youtube_uploads&select=value");
    cache = row?.value ?? {};
  } catch { /* the settings row appears on first write */ }

  let quota = 0;
  let channels = 0;
  const items: FeedItemInput[] = [];
  const resolved: Record<string, string> = { ...cache };

  // A few channels an hour rather than all twenty: a serverless run has a
  // minute, and every channel still comes round three times a day.
  const perRun = Math.max(1, Number(process.env.YOUTUBE_CHANNELS_PER_RUN ?? 5));
  const start = (turn * perRun) % TRUSTED_CHANNELS.length;
  const chosen = Array.from({ length: Math.min(perRun, TRUSTED_CHANNELS.length) }, (_, i) => TRUSTED_CHANNELS[(start + i) % TRUSTED_CHANNELS.length]!);

  for (const channel of chosen) {
    if (Date.now() > deadline) break;
    try {
      let playlist = cache[channel.handle];
      if (!playlist) {
        const u = new URL('https://www.googleapis.com/youtube/v3/channels');
        u.searchParams.set('part', 'contentDetails');
        u.searchParams.set('forHandle', channel.handle);
        u.searchParams.set('key', key);
        const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
        quota += CHEAP_COST;
        if (!r.ok) { errors.push({ source: 'youtube', message: `${channel.handle}: ${r.status}` }); continue; }
        const j = (await r.json()) as { items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] };
        playlist = j.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? '';
        if (!playlist) { errors.push({ source: 'youtube', message: `${channel.handle}: no such channel` }); continue; }
        resolved[channel.handle] = playlist;
      }

      const u = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      u.searchParams.set('part', 'snippet');
      u.searchParams.set('playlistId', playlist);
      u.searchParams.set('maxResults', '25');
      u.searchParams.set('key', key);
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
      quota += CHEAP_COST;
      if (!r.ok) { errors.push({ source: 'youtube', message: `${channel.name}: ${r.status}` }); continue; }
      const j = (await r.json()) as {
        items?: { snippet: { title: string; description: string; publishedAt: string; channelId: string; channelTitle: string; thumbnails?: { high?: { url: string } }; resourceId?: { videoId?: string } } }[];
      };
      channels++;
      for (const v of j.items ?? []) {
        const id = v.snippet.resourceId?.videoId;
        if (!id) continue;
        items.push({
          type: 'video',
          title: v.snippet.title,
          url: `https://www.youtube.com/watch?v=${id}`,
          summary: v.snippet.description?.slice(0, 600) ?? null,
          outletName: channel.name,
          outletId: 'youtube-trusted',
          channelId: v.snippet.channelId,
          thumbnailUrl: v.snippet.thumbnails?.high?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          publishedAt: new Date(v.snippet.publishedAt).toISOString(),
          source: 'youtube',
        });
      }
    } catch (e) {
      errors.push({ source: 'youtube', message: `${channel.name}: ${(e as Error).message}` });
    }
  }

  if (Object.keys(resolved).length !== Object.keys(cache).length) {
    await sb.insert('app_settings', {
      key: 'youtube_uploads',
      value: resolved,
      note: 'Uploads playlist of each trusted channel, so a handle is resolved once rather than every hour.',
      updated_by: 'youtube collector',
    }).catch(async () => { await sb.patch('app_settings?key=eq.youtube_uploads', { value: resolved }); });
  }

  await ingest(items, index, counts, deadline);
  return { quota, channels };
}

/* ---------------------------------------------------------------- search */

/**
 * The outlets with no feed, reached by asking a search engine for each
 * member's name and constituency. 348 members are spread across the six-hour
 * window, about one a minute, so no provider sees a burst.
 */
export async function runSearchCollector(opts: { trigger?: string; perRun?: number } = {}): Promise<RunResult & { runId?: number }> {
  const provider = searchProvider();
  const run = await startRun('search', opts.trigger ?? 'manual');
  const counts: IngestCounts = { found: 0, stored: 0, attached: 0, lowConfidence: 0, unmatched: 0 };
  const errors: { source: string; message: string }[] = [];

  if (!provider) {
    const result: RunResult = {
      status: 'aborted', itemsFound: 0, itemsNew: 0, itemsAttached: 0, unmatched: 0, lowConfidence: 0,
      errors: [{ source: 'search', message: 'FEED_SEARCH_KEY is not set for the chosen FEED_SEARCH_PROVIDER, so the outlets without a feed were not searched' }],
    };
    await finishRun(run, result);
    return result;
  }

  // Four members an hour, like the video collector: Google News' feed has no
  // published quota, but a hundred queries a day from one address is a polite
  // trickle, and it walks the whole House every three and a half days.
  // FEED_SEARCH_PER_RUN changes it (a Brave free key wants 2).
  const perRun = opts.perRun ?? Math.max(1, Number(process.env.FEED_SEARCH_PER_RUN ?? 4));
  const slice = sliceFor(targets(), perRun, await turnOf('search', run, 60));
  const index = await buildIndex();
  const sites = SEARCH_ONLY_SOURCES.map((s) => new URL(s.homepage).hostname.replace(/^www\./, ''));
  // Ten site: terms a query: a search engine truncates or ignores a longer
  // one, so the outlets are asked in groups and a member costs a few queries.
  const groups = Array.from({ length: Math.ceil(sites.length / 10) }, (_, i) => sites.slice(i * 10, i * 10 + 10));
  const queries = slice.length * groups.length;
  const items: FeedItemInput[] = [];

  for (const t of slice) {
    if (!t.nameBn) continue;
    for (const group of groups) {
      // "নাম" seat (site:… OR site:…) keeps the search on the outlets we cannot read.
      const q = `"${t.nameBn}" ${t.seatBn ?? ''} (${group.map((s) => `site:${s}`).join(' OR ')})`.trim();
      try {
        const hits = await provider.search(q, { limit: 20 });
        for (const h of hits) {
          const where = h.outletHost ?? h.url;
          const outlet = SEARCH_ONLY_SOURCES.find((s) => where.includes(new URL(s.homepage).hostname.replace(/^www\./, '')));
          // A hit from somewhere else is a search engine ignoring site:, not news.
          if (!outlet) continue;
          items.push({
            type: 'news',
            title: h.title,
            url: h.url,
            summary: h.summary,
            outletName: outlet.nameBn,
            outletId: outlet.key,
            publishedAt: h.publishedAt ?? new Date().toISOString(),
            source: 'search',
          });
        }
      } catch (e) {
        errors.push({ source: 'search', message: `${t.nameBn}: ${(e as Error).message}` });
      }
      // A short gap between queries, so the provider sees a trickle.
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  await ingest(items, index, counts);
  // A provider that refuses every call on permission grounds is a credential
  // waiting to be sorted, not a broken collector: the run says so and the
  // schedule stays green rather than turning red every hour.
  const allRefused = queries > 0 && errors.length >= queries && errors.every((e) => /403|PERMISSION_DENIED|401/.test(e.message));
  const result: RunResult = {
    status: allRefused ? 'aborted' : queries > 0 && errors.length >= queries ? 'failed' : 'ok',
    itemsFound: counts.found,
    itemsNew: counts.stored,
    itemsAttached: counts.attached,
    unmatched: counts.unmatched,
    lowConfidence: counts.lowConfidence,
    errors: allRefused
      ? [{ source: 'search', message: `the search provider refused every call: ${errors[0]!.message.replace(/^[^:]*: /, '')}` }]
      : errors,
    detail: { members: slice.length, provider: provider.name, searches: queries },
  };
  await finishRun(run, result);
  return { ...result, runId: run.id };
}

/* ---------------------------------------------------------------- parliament notices */

/**
 * Notices and gazette items that name a member. They are already synced into
 * data/activity.json for the profile's own notice list; here they become feed
 * items too, so one page shows everything about a member in date order.
 */
export async function runPressCollector(opts: { trigger?: string } = {}): Promise<RunResult & { runId?: number }> {
  const run = await startRun('press', opts.trigger ?? 'manual');
  const index = await buildIndex();
  const counts: IngestCounts = { found: 0, stored: 0, attached: 0, lowConfidence: 0, unmatched: 0 };
  const { activity } = await import('@/lib/activity');
  const notices = activity.notices.filter((n) => n.pdfUrl && n.date && n.titleBn);
  const items: FeedItemInput[] = notices.map((n) => ({
    type: 'press' as const,
    title: n.titleBn!,
    url: n.pdfUrl!,
    summary: null,
    outletName: 'বাংলাদেশ জাতীয় সংসদ',
    outletId: 'parliament',
    publishedAt: new Date(`${n.date}T10:00:00+06:00`).toISOString(),
    source: 'parliament' as const,
  }));
  // A notice names its member by seat, which the matcher already reads, but the
  // sync has also matched many of them by hand: those attachments come first.
  await ingest(items, index, counts);
  for (const n of notices) {
    if (!n.memberId) continue;
    const stored = await upsertItem({
      type: 'press', title: n.titleBn!, url: n.pdfUrl!, summary: null,
      outletName: 'বাংলাদেশ জাতীয় সংসদ', outletId: 'parliament',
      publishedAt: new Date(`${n.date}T10:00:00+06:00`).toISOString(), source: 'parliament',
    });
    if (!stored) continue;
    const already = matchItem(index, { title: n.titleBn! }).some((m) => m.mpId === n.memberId);
    if (already) continue;
    const r = await attach({ itemId: stored.id, mpId: n.memberId, score: 100, lowConfidence: false, signals: [{ signal: 'parliament-notice', points: 100 }] });
    if (r === 'new') counts.attached++;
  }
  const result: RunResult = {
    status: 'ok',
    itemsFound: counts.found,
    itemsNew: counts.stored,
    itemsAttached: counts.attached,
    unmatched: counts.unmatched,
    lowConfidence: counts.lowConfidence,
    errors: [],
  };
  await finishRun(run, result);
  return { ...result, runId: run.id };
}

/** Used by the admin to say what is configured and what is not. */
export const collectorReadiness = () => ({
  rss: true,
  youtube: !!YOUTUBE_KEY(),
  search: !!searchProvider(),
  press: true,
  memberCount: allMembers.filter((m) => !m.resignedOn).length,
  district: (id: string) => districtOf(getMemberById(id)?.seat ?? null)?.bn ?? null,
});
