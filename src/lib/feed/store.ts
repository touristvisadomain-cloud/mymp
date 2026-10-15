/**
 * Everything the feed reads and writes in Supabase, in one place.
 *
 * It talks PostgREST with the service key rather than the admin's Supabase
 * client, because the same functions run inside a route handler and inside
 * scripts/feed-collect.ts under plain Node, where `server-only` cannot be
 * imported. No browser ever holds these keys: the public feed is served by the
 * site's own route handler.
 */
import { createHash } from 'node:crypto';
import { isGenericThumbnail } from '../../../config/feed-matching';
import { restDb, DbError, type Db } from '@/lib/posts/db';
import { allMembers } from '@/lib/data';
import { FEED_FROM, FEED_FROM_INSTANT, FEED_FROM_MONTH, notBeforeWindow } from './window';

/** Only stories from the window, on an embedded feed_items row. */
const IN_WINDOW = `&feed_items.published_at=gte.${encodeURIComponent(FEED_FROM_INSTANT)}`;

/**
 * Members who have left the House. The news page lists sitting members' news
 * only; a former member's own profile still shows theirs.
 */
const LEFT = allMembers.filter((m) => m.resignedOn).map((m) => m.id);
const SITTING_ONLY = LEFT.length ? `&mp_id=not.in.(${LEFT.join(',')})` : '';

export type FeedType = 'news' | 'video' | 'press' | 'social';
export type FeedSource = 'rss' | 'search' | 'youtube' | 'engine' | 'parliament' | 'manual';
export type AttachStatus = 'visible' | 'hidden' | 'removed';

export interface FeedItemInput {
  type: FeedType;
  title: string;
  url: string;
  summary?: string | null;
  outletName?: string | null;
  outletId?: string | null;
  channelId?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  publishedAt: string;
  source: FeedSource;
}

export interface AlsoIn { outletName: string | null; url: string }

export interface FeedItemRow {
  id: number;
  type: FeedType;
  title: string;
  url: string;
  canonical_url: string;
  summary: string | null;
  outlet_name: string | null;
  outlet_id: string | null;
  channel_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string;
  source: FeedSource;
  also_in: AlsoIn[];
}

/** Tracking parameters and AMP paths make one story look like many. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|ref_src|igshid|mc_cid|mc_eid|__twitter)/i.test(key)) u.searchParams.delete(key);
    }
    u.pathname = u.pathname.replace(/\/amp\/?$/, '/').replace(/\.amp$/, '').replace(/\/+$/, '') || '/';
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Same story, same words: used to tell an edit at the source from a new item. */
export const contentHash = (title: string, summary?: string | null) =>
  createHash('sha256').update(`${title.trim()}\n${(summary ?? '').trim()}`).digest('hex');

/**
 * Nothing is published later than now. A few outlets stamp Dhaka time as UTC,
 * which put their stories hours into the future and kept them at the top of
 * every list (The Daily Observer, 2026-10-12); those take the time we saw them.
 */
export function notLaterThanNow(publishedAt: string, now = Date.now()): string {
  const t = Date.parse(publishedAt);
  return Number.isFinite(t) && t > now + 10 * 60_000 ? new Date(now).toISOString() : publishedAt;
}

/** Headlines compare past punctuation and spacing, for the 48-hour syndication check. */
export const headlineKey = (title: string) =>
  title.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}]+/gu, '').toLowerCase();

function db(): Db {
  const d = restDb();
  if (!d) throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return d;
}

const q = (v: string | number) => encodeURIComponent(String(v));

export interface UpsertResult {
  id: number;
  isNew: boolean;
  /** True when the source changed the headline or summary since we stored it. */
  edited: boolean;
}

/**
 * Stores one item, or recognises one we already have. A story carried by
 * several outlets keeps the first row and lists the others in also_in, so a
 * member's page shows it once.
 */
export async function upsertItem(input: FeedItemInput): Promise<UpsertResult | null> {
  // An outlet's stand-in picture says nothing about the story; the card's own
  // placeholder is better than the same front page on every card.
  if (isGenericThumbnail(input.thumbnailUrl)) input = { ...input, thumbnailUrl: null };
  input = { ...input, publishedAt: notLaterThanNow(input.publishedAt) };
  const canonical = canonicalUrl(input.url);
  const hash = contentHash(input.title, input.summary);
  const sb = db();

  const [existing] = await sb.get<{ id: number; content_hash: string | null; thumbnail_url: string | null }[]>(
    `feed_items?canonical_url=eq.${q(canonical)}&select=id,content_hash,thumbnail_url&limit=1`,
  );
  if (existing) {
    // A picture the first pass did not take is still worth having: the reader
    // only learned to look for one after these rows were stored.
    const gainedPicture = !existing.thumbnail_url && !!input.thumbnailUrl;
    if (existing.content_hash !== hash || gainedPicture) {
      await sb.patch(`feed_items?id=eq.${existing.id}`, {
        title: input.title,
        summary: input.summary ?? null,
        ...(gainedPicture ? { thumbnail_url: input.thumbnailUrl } : {}),
        content_hash: hash,
        updated_at: new Date().toISOString(),
      });
      return { id: existing.id, isNew: false, edited: existing.content_hash !== hash };
    }
    return { id: existing.id, isNew: false, edited: false };
  }

  // The same headline from another outlet within two days is the same story.
  const since = new Date(new Date(input.publishedAt).getTime() - 48 * 3600 * 1000).toISOString();
  const until = new Date(new Date(input.publishedAt).getTime() + 48 * 3600 * 1000).toISOString();
  const near = await sb.get<{ id: number; title: string; also_in: AlsoIn[] | null }[]>(
    `feed_items?type=eq.${input.type}&published_at=gte.${q(since)}&published_at=lte.${q(until)}&select=id,title,also_in&limit=300`,
  );
  const key = headlineKey(input.title);
  const twin = near.find((n) => headlineKey(n.title) === key);
  if (twin) {
    const alsoIn = [...(twin.also_in ?? [])];
    if (!alsoIn.some((a) => canonicalUrl(a.url) === canonical)) {
      alsoIn.push({ outletName: input.outletName ?? null, url: input.url });
      await sb.patch(`feed_items?id=eq.${twin.id}`, { also_in: alsoIn });
    }
    return { id: twin.id, isNew: false, edited: false };
  }

  try {
    const [row] = await sb.insert<{ id: number }>('feed_items', {
      type: input.type,
      title: input.title,
      url: input.url,
      canonical_url: canonical,
      summary: input.summary ?? null,
      outlet_name: input.outletName ?? null,
      outlet_id: input.outletId ?? null,
      channel_id: input.channelId ?? null,
      thumbnail_url: input.thumbnailUrl ?? null,
      duration_seconds: input.durationSeconds ?? null,
      published_at: input.publishedAt,
      source: input.source,
      content_hash: hash,
    });
    return row ? { id: row.id, isNew: true, edited: false } : null;
  } catch (e) {
    // Another run inserted the same address a moment ago.
    if (e instanceof DbError && /duplicate key|23505/.test(e.body)) {
      const [again] = await sb.get<{ id: number }[]>(`feed_items?canonical_url=eq.${q(canonical)}&select=id&limit=1`);
      return again ? { id: again.id, isNew: false, edited: false } : null;
    }
    throw e;
  }
}

export interface AttachInput {
  itemId: number;
  mpId: string;
  score: number;
  lowConfidence: boolean;
  signals: unknown;
  attachedBy?: string;
}

/**
 * Links an item to a member. An attachment an editor has already ruled on is
 * left exactly as it is: "removed" means never again, on this member's page.
 */
export async function attach(input: AttachInput): Promise<'new' | 'kept'> {
  const sb = db();
  const [existing] = await sb.get<{ status: string }[]>(
    `feed_item_mps?feed_item_id=eq.${input.itemId}&mp_id=eq.${q(input.mpId)}&select=status&limit=1`,
  );
  if (existing) return 'kept';
  await sb.insert('feed_item_mps', {
    feed_item_id: input.itemId,
    mp_id: input.mpId,
    score: input.score,
    low_confidence: input.lowConfidence,
    signals: input.signals,
    attached_by: input.attachedBy ?? 'system',
  });
  return 'new';
}

/** How many items a member has been given today, for the flood cap. */
export async function attachedToday(mpId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await db().get<{ feed_item_id: number }[]>(
    `feed_item_mps?mp_id=eq.${q(mpId)}&attached_at=gte.${q(start.toISOString())}&select=feed_item_id&limit=200`,
  );
  return rows.length;
}

export interface RunHandle { id: number }

/**
 * Which turn of its rotation a collector is on: the number of its runs before
 * this one. The turn used to come from the clock, which walks the rotation only
 * when every scheduled run happens; GitHub fired the half-hourly schedules every
 * three to six hours, so most outlets and members were never reached. Counting
 * runs means a late or missed run still takes the next slice. Falls back to the
 * clock when the count cannot be read.
 */
export async function turnOf(collector: string, run: RunHandle | null, clockMinutes: number): Promise<number> {
  const clock = Math.floor(Date.now() / (clockMinutes * 60_000));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!run || !url || !key) return clock;
  try {
    const res = await fetch(`${url}/rest/v1/feed_runs?collector=eq.${q(collector)}&id=lt.${run.id}&status=neq.aborted&select=id`, {
      method: 'HEAD',
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(10_000),
    });
    const total = Number(res.headers.get('content-range')?.split('/')[1]);
    return res.ok && Number.isFinite(total) ? total : clock;
  } catch {
    return clock;
  }
}

export async function startRun(collector: string, trigger: string): Promise<RunHandle> {
  const [row] = await db().insert<{ id: number }>('feed_runs', { collector, trigger, status: 'running' });
  return { id: row!.id };
}

export interface RunResult {
  status: 'ok' | 'failed' | 'aborted';
  itemsFound: number;
  itemsNew: number;
  itemsAttached: number;
  unmatched: number;
  lowConfidence: number;
  quotaUsed?: number;
  errors: { source: string; message: string }[];
  detail?: unknown;
}

export async function finishRun(run: RunHandle, r: RunResult) {
  await db().patch(`feed_runs?id=eq.${run.id}`, {
    finished_at: new Date().toISOString(),
    status: r.status,
    items_found: r.itemsFound,
    items_new: r.itemsNew,
    items_attached: r.itemsAttached,
    unmatched: r.unmatched,
    low_confidence: r.lowConfidence,
    quota_used: r.quotaUsed ?? 0,
    errors: r.errors,
    detail: r.detail ?? null,
  });
}

/** What the last finished run of this collector found, for the empty-run guard. */
export async function lastRun(collector: string): Promise<{ items_found: number; status: string } | null> {
  const rows = await db().get<{ items_found: number; status: string }[]>(
    `feed_runs?collector=eq.${q(collector)}&status=neq.running&select=items_found,status&order=started_at.desc&limit=1`,
  );
  return rows[0] ?? null;
}

export async function nameVariants(): Promise<Map<string, { variant: string; weight: number }[]>> {
  const out = new Map<string, { variant: string; weight: number }[]>();
  const sb = db();
  for (let offset = 0; ; offset += 1000) {
    const rows = await sb.get<{ mp_id: string; variant: string; weight: string }[]>(
      `mp_name_variants?select=mp_id,variant,weight&order=id&limit=1000&offset=${offset}`,
    );
    for (const r of rows) {
      const list = out.get(r.mp_id) ?? [];
      list.push({ variant: r.variant, weight: Number(r.weight) });
      out.set(r.mp_id, list);
    }
    if (rows.length < 1000) break;
  }
  return out;
}

export interface FeedSettings { mpId: string; feedStartAt: string | null; needsConfirming: boolean }

export async function feedSettings(): Promise<Map<string, FeedSettings>> {
  const rows = await db().get<{ mp_id: string; feed_start_at: string | null; nomination_filed_at: string | null; needs_confirming: boolean }[]>(
    'mp_feed_settings?select=mp_id,feed_start_at,nomination_filed_at,needs_confirming&limit=500',
  );
  const out = new Map<string, FeedSettings>();
  for (const r of rows) {
    out.set(r.mp_id, { mpId: r.mp_id, feedStartAt: r.feed_start_at ?? r.nomination_filed_at, needsConfirming: Boolean(r.needs_confirming) });
  }
  return out;
}

/* ---------------------------------------------------------------- reading a member's feed */

export interface FeedEntry {
  id: number;
  type: FeedType;
  title: string;
  url: string;
  summary: string | null;
  outletName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string;
  alsoIn: AlsoIn[];
  pinned: boolean;
  lowConfidence: boolean;
}

interface JoinRow {
  feed_item_id: number;
  pinned: boolean;
  pinned_until: string | null;
  low_confidence: boolean;
  feed_items: FeedItemRow | null;
}

const SELECT_ITEM = 'feed_item_id,pinned,pinned_until,low_confidence,feed_items(id,type,title,url,summary,outlet_name,thumbnail_url,duration_seconds,published_at,also_in)';
const SELECT_ITEM_INNER = SELECT_ITEM.replace('feed_items(', 'feed_items!inner(');

const toEntry = (r: JoinRow): FeedEntry | null => {
  const i = r.feed_items;
  if (!i) return null;
  const pinned = r.pinned && (!r.pinned_until || new Date(r.pinned_until) > new Date());
  return {
    id: i.id,
    type: i.type,
    title: i.title,
    url: i.url,
    summary: i.summary,
    outletName: i.outlet_name,
    thumbnailUrl: i.thumbnail_url,
    durationSeconds: i.duration_seconds,
    publishedAt: i.published_at,
    alsoIn: i.also_in ?? [],
    pinned,
    lowConfidence: r.low_confidence,
  };
};

/** One member's visible items for a month ("2026-09"), newest first. */
export async function monthItems(mpId: string, month: string, type?: FeedType): Promise<FeedEntry[]> {
  if (month < FEED_FROM_MONTH) return [];
  const from = `${month}-01T00:00:00+06:00`;
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, '0')}`;
  const to = `${next}-01T00:00:00+06:00`;
  const typeFilter = type ? `&feed_items.type=eq.${type}` : '';
  // An inner join, so the month filter drops rows instead of blanking their item.
  // Without it every attachment came back, other months' with an empty item, and a
  // member with more than 300 of them (the Prime Minister) got an empty month.
  const rows = await db().get<JoinRow[]>(
    `feed_item_mps?mp_id=eq.${q(mpId)}&status=eq.visible&select=${SELECT_ITEM_INNER}` +
      `&feed_items.published_at=gte.${q(from)}&feed_items.published_at=lt.${q(to)}${typeFilter}` +
      '&order=feed_items(published_at).desc&limit=300',
  );
  return rows.map(toEntry).filter((x): x is FeedEntry => !!x);
}

/** Most items a span returns; past this the reader is told to narrow it. */
export const RANGE_LIMIT = 1000;

/** One member's visible items from one Dhaka day to another, both included, newest first. */
export async function rangeItems(mpId: string, fromDay: string, toDay: string, type?: FeedType): Promise<FeedEntry[]> {
  if (toDay < FEED_FROM) return [];
  const from = `${notBeforeWindow(fromDay)}T00:00:00+06:00`;
  const [y, m, d] = toDay.split('-').map(Number);
  const to = `${new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10)}T00:00:00+06:00`;
  const typeFilter = type ? `&feed_items.type=eq.${type}` : '';
  const rows = await db().get<JoinRow[]>(
    `feed_item_mps?mp_id=eq.${q(mpId)}&status=eq.visible&select=${SELECT_ITEM_INNER}` +
      `&feed_items.published_at=gte.${q(from)}&feed_items.published_at=lt.${q(to)}${typeFilter}` +
      `&order=feed_items(published_at).desc&limit=${RANGE_LIMIT}`,
  );
  return rows.map(toEntry).filter((x): x is FeedEntry => !!x);
}

/** One member's newest visible items across every month, for the app's member page. */
export async function recentItems(mpId: string, limit: number, type?: FeedType): Promise<FeedEntry[]> {
  const typeFilter = type ? `&feed_items.type=eq.${type}` : '';
  const rows = await db().get<JoinRow[]>(
    `feed_item_mps?mp_id=eq.${q(mpId)}&status=eq.visible&select=${SELECT_ITEM_INNER}${typeFilter}${IN_WINDOW}` +
      `&order=feed_items(published_at).desc&limit=${Math.min(Math.max(limit, 1), 200)}`,
  );
  return rows.map(toEntry).filter((x): x is FeedEntry => !!x);
}

/** An item as the whole-site news page shows it: with everyone it names. */
export interface LatestEntry extends FeedEntry {
  mpIds: string[];
}

/**
 * The newest items across every member, for /songbad.
 *
 * One story often names two members — a minister and the member who answered
 * him — so the rows are folded by item and each keeps the list of who it is
 * about, rather than appearing twice in the list.
 */
export async function latestItems(opts: { limit?: number; type?: FeedType } = {}): Promise<LatestEntry[]> {
  const limit = opts.limit ?? 300;
  const typeFilter = opts.type ? `&feed_items.type=eq.${opts.type}` : '';
  const rows = await db().get<(JoinRow & { mp_id: string })[]>(
    `feed_item_mps?status=eq.visible${SITTING_ONLY}&select=mp_id,${SELECT_ITEM}${typeFilter}${IN_WINDOW}` +
      `&feed_items=not.is.null&order=feed_items(published_at).desc&limit=${Math.min(limit * 3, 2000)}`,
  );
  const byItem = new Map<number, LatestEntry>();
  for (const r of rows) {
    const entry = toEntry(r);
    if (!entry) continue;
    const seen = byItem.get(entry.id);
    if (seen) {
      if (!seen.mpIds.includes(r.mp_id)) seen.mpIds.push(r.mp_id);
      continue;
    }
    byItem.set(entry.id, { ...entry, mpIds: [r.mp_id] });
  }
  return [...byItem.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

/** Items on at least one member's page: the site's news, as /songbad counts it. */
const ON_A_PAGE = `feed_items?select=id,feed_item_mps!inner(mp_id)&feed_item_mps.status=eq.visible${SITTING_ONLY.replace('&mp_id=', '&feed_item_mps.mp_id=')}`;

/** Today in Dhaka, and the instant it began. */
const dhakaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

export interface SiteCounts {
  today: { news: number; video: number; outlets: number };
  total: { news: number; video: number };
  /** Every month with anything in it, newest first. */
  months: { month: string; news: number; video: number }[];
}

/**
 * The news page's numbers: today's, everything's, and each month's. Counted by
 * the database (a HEAD request per figure), so they are the real totals and
 * not the length of whatever list the page happens to show.
 */
export async function siteCounts(): Promise<SiteCounts> {
  const sb = db();
  const today = dhakaToday();
  const since = `${today}T00:00:00+06:00`;
  const span = (from: string, to?: string) => `&published_at=gte.${q(from)}${to ? `&published_at=lt.${q(to)}` : ''}`;

  const [first] = await sb.get<{ published_at: string }[]>(`${ON_A_PAGE.replace('select=id,', 'select=published_at,')}&published_at=gte.${q(FEED_FROM_INSTANT)}&order=published_at.asc&limit=1`);
  const months: string[] = [];
  if (first) {
    // Nothing before the window (lib/feed/window.ts) is counted or listed.
    const earliest = new Date(first.published_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).slice(0, 7);
    const start = earliest > FEED_FROM_MONTH ? earliest : FEED_FROM_MONTH;
    for (let m = today.slice(0, 7); m >= start; ) {
      months.push(m);
      const [y, mo] = m.split('-').map(Number);
      m = mo === 1 ? `${y! - 1}-12` : `${y}-${String(mo! - 1).padStart(2, '0')}`;
    }
  }
  const nextMonth = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return mo === 12 ? `${y! + 1}-01` : `${y}-${String(mo! + 1).padStart(2, '0')}`;
  };

  const [todayNews, todayVideo, todayRows] = await Promise.all([
    sb.count(`${ON_A_PAGE}&type=neq.video${span(since)}`),
    sb.count(`${ON_A_PAGE}&type=eq.video${span(since)}`),
    sb.get<{ outlet_name: string | null }[]>(`${ON_A_PAGE.replace('select=id,', 'select=outlet_name,')}${span(since)}&limit=3000`),
  ]);
  // Three months at a time: twenty counts at once is more than the gateway takes.
  const perMonth: { month: string; news: number; video: number }[] = [];
  for (let i = 0; i < months.length; i += 3) {
    perMonth.push(...(await Promise.all(months.slice(i, i + 3).map(async (m) => {
      const range = span(`${m}-01T00:00:00+06:00`, `${nextMonth(m)}-01T00:00:00+06:00`);
      const [news, video] = await Promise.all([sb.count(`${ON_A_PAGE}&type=neq.video${range}`), sb.count(`${ON_A_PAGE}&type=eq.video${range}`)]);
      return { month: m, news, video };
    }))));
  }
  const withItems = perMonth.filter((m) => m.news + m.video > 0);
  return {
    today: { news: todayNews, video: todayVideo, outlets: new Set(todayRows.map((r) => r.outlet_name).filter(Boolean)).size },
    total: { news: withItems.reduce((n, m) => n + m.news, 0), video: withItems.reduce((n, m) => n + m.video, 0) },
    months: withItems,
  };
}

/** How many news items and videos a span holds, both Dhaka days included. */
export async function rangeCounts(fromDay: string, toDay: string): Promise<{ news: number; video: number }> {
  if (toDay < FEED_FROM) return { news: 0, video: 0 };
  fromDay = notBeforeWindow(fromDay);
  const [y, m, d] = toDay.split('-').map(Number);
  const to = `${new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10)}T00:00:00+06:00`;
  const span = `&published_at=gte.${q(`${fromDay}T00:00:00+06:00`)}&published_at=lt.${q(to)}`;
  const [news, video] = await Promise.all([db().count(`${ON_A_PAGE}&type=neq.video${span}`), db().count(`${ON_A_PAGE}&type=eq.video${span}`)]);
  return { news, video };
}

/** How many stories the news page's day and month view brings at a time. */
export const NEWS_RANGE_PAGE = 300;

/**
 * The items on members' pages between two Dhaka days, both included, newest
 * first, with everyone each one names: the news page's day and month view.
 * A month is several thousand, so it comes a page at a time: `before` is the
 * previous page's `next`, and the last page has none. The database answers at
 * most a thousand rows a request, so the rows are read in slices.
 */
export async function rangeLatest(fromDay: string, toDay: string, before?: string): Promise<{ items: LatestEntry[]; next: string | null }> {
  if (toDay < FEED_FROM) return { items: [], next: null };
  fromDay = notBeforeWindow(fromDay);
  const [y, m, d] = toDay.split('-').map(Number);
  const end = before ?? `${new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10)}T00:00:00+06:00`;
  const window = `&feed_items.published_at=gte.${q(`${fromDay}T00:00:00+06:00`)}&feed_items.published_at=${before ? 'lte' : 'lt'}.${q(end)}`;
  const byItem = new Map<number, LatestEntry>();
  let exhausted = false;
  for (let offset = 0; byItem.size <= NEWS_RANGE_PAGE; offset += 1000) {
    const rows = await db().get<(JoinRow & { mp_id: string })[]>(
      `feed_item_mps?status=eq.visible${SITTING_ONLY}&select=mp_id,${SELECT_ITEM_INNER}${window}` +
        `&order=feed_items(published_at).desc,feed_item_id.desc&offset=${offset}&limit=1000`,
    );
    for (const r of rows) {
      const entry = toEntry(r);
      if (!entry) continue;
      const seen = byItem.get(entry.id);
      if (seen) { if (!seen.mpIds.includes(r.mp_id)) seen.mpIds.push(r.mp_id); continue; }
      byItem.set(entry.id, { ...entry, mpIds: [r.mp_id] });
    }
    if (rows.length < 1000) { exhausted = true; break; }
  }
  const items = [...byItem.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const page = items.slice(0, NEWS_RANGE_PAGE);
  // The next page starts where this one stopped; an item on the boundary may
  // come twice, and the page drops the repeat by its id.
  const next = items.length > NEWS_RANGE_PAGE || !exhausted ? (page.at(-1)?.publishedAt ?? null) : null;
  return { items: page, next };
}

/** The items pinned to the top of a member's feed. */
export async function pinnedItems(mpId: string): Promise<FeedEntry[]> {
  const rows = await db().get<JoinRow[]>(
    `feed_item_mps?mp_id=eq.${q(mpId)}&status=eq.visible&pinned=is.true&select=${SELECT_ITEM_INNER}${IN_WINDOW}&order=feed_items(published_at).desc&limit=20`,
  );
  return rows.map(toEntry).filter((x): x is FeedEntry => !!x && x.pinned);
}

export interface MonthCount { month: string; total: number; news: number; video: number }

/**
 * How many items a member has in each month. Read in one go and counted here,
 * because PostgREST cannot group, and a member's whole feed is small.
 */
export async function monthCounts(mpId: string): Promise<{ months: MonthCount[]; total: number; news: number; video: number; outlets: string[] }> {
  // A page at a time: one request stops at 1000 rows, and the Prime Minister has more.
  const rows: { feed_items: { published_at: string; type: FeedType; outlet_name: string | null } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await db().get<typeof rows>(
      `feed_item_mps?mp_id=eq.${q(mpId)}&status=eq.visible&select=feed_items!inner(published_at,type,outlet_name)${IN_WINDOW}&order=feed_item_id&offset=${from}&limit=1000`,
    );
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const by = new Map<string, MonthCount>();
  const outlets = new Set<string>();
  let total = 0;
  let news = 0;
  let video = 0;
  for (const r of rows) {
    const i = r.feed_items;
    if (!i) continue;
    // Months are Bangladesh months: an item published at 1am Dhaka belongs to that day.
    const month = new Date(i.published_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).slice(0, 7);
    const e = by.get(month) ?? { month, total: 0, news: 0, video: 0 };
    e.total++;
    if (i.type === 'video') e.video++; else e.news++;
    by.set(month, e);
    total++;
    if (i.type === 'video') video++; else news++;
    if (i.outlet_name) outlets.add(i.outlet_name);
  }
  return {
    months: [...by.values()].sort((a, b) => b.month.localeCompare(a.month)),
    total,
    news,
    video,
    outlets: [...outlets].sort((a, b) => a.localeCompare(b, 'bn')),
  };
}
