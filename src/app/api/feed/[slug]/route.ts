/**
 * A member's news and video feed, read by the section on their profile.
 *
 * The profile page itself is prerendered, so the feed is fetched from here at
 * view time. One request brings the pinned items, the current month and the
 * month list; `?m=2026-08` brings one earlier month when a reader opens it,
 * `?from=2026-10-10&to=2026-10-15` a span of days the reader picked, and
 * `?recent=60` the newest items whatever their month (the app's member page).
 * `?lang=en` names the outlets in English and puts the English headline in `title`.
 *
 * Cached at the edge for five minutes: a headline that lands during a coffee
 * break is soon enough, and the site keeps its "no function on the read path
 * to speak of" shape.
 */
import { NextResponse } from 'next/server';
import { getMember } from '@/lib/data';
import { monthCounts, monthItems, pinnedItems, recentItems, rangeItems, feedSettings, RANGE_LIMIT, type FeedType } from '@/lib/feed/store';
import { isMissingTable } from '@/lib/posts/db';
import { gzipJson } from '@/lib/gzipJson';
import { feedInEnglish } from '@/lib/app/news';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE = 'public, s-maxage=300, stale-while-revalidate=1800';

// The mobile app reads this route too, and reads it from a web preview during
// development; the data is the same public feed the site's own pages show.
const HEADERS = { 'cache-control': CACHE, 'access-control-allow-origin': '*' };
/** Errors and the empty feed are readable from the app too, but not cached. */
const OPEN = { 'access-control-allow-origin': '*' };

/** The current month in Dhaka, where the feed's days are counted. */
const dhakaMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).slice(0, 7);

async function handle(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const member = getMember(slug);
  if (!member) return NextResponse.json({ error: 'not found' }, { status: 404, headers: OPEN });

  const url = new URL(req.url);
  const month = url.searchParams.get('m');
  const type = url.searchParams.get('type');
  const typeFilter: FeedType | undefined = type === 'news' || type === 'video' ? type : undefined;

  try {
    // The app's member page: the newest items whatever their month, with the pinned ones.
    const recent = Number(url.searchParams.get('recent'));
    if (recent > 0) {
      const [pinned, items] = await Promise.all([pinnedItems(member.id), recentItems(member.id, recent, typeFilter)]);
      const pinnedIds = new Set(pinned.map((p) => p.id));
      return NextResponse.json({ pinned, items: items.filter((i) => !pinnedIds.has(i.id)) }, { headers: HEADERS });
    }
    // A span of days the reader picked (?from=2026-10-10&to=2026-10-15), across months.
    const fromDay = url.searchParams.get('from');
    const toDay = url.searchParams.get('to');
    if (fromDay || toDay) {
      const day = /^\d{4}-\d{2}-\d{2}$/;
      if (!fromDay || !toDay || !day.test(fromDay) || !day.test(toDay) || fromDay > toDay) {
        return NextResponse.json({ error: 'bad range' }, { status: 400, headers: OPEN });
      }
      const items = await rangeItems(member.id, fromDay, toDay, typeFilter);
      return NextResponse.json({ from: fromDay, to: toDay, items, more: items.length >= RANGE_LIMIT }, { headers: HEADERS });
    }
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'bad month' }, { status: 400, headers: OPEN });
      const items = await monthItems(member.id, month, typeFilter);
      return NextResponse.json({ month, items }, { headers: HEADERS });
    }

    const current = dhakaMonth();
    const [pinned, items, counts, settings] = await Promise.all([
      pinnedItems(member.id),
      monthItems(member.id, current, typeFilter),
      monthCounts(member.id),
      feedSettings(),
    ]);
    const pinnedIds = new Set(pinned.map((p) => p.id));
    const setting = settings.get(member.id);
    return NextResponse.json(
      {
        month: current,
        pinned,
        items: items.filter((i) => !pinnedIds.has(i.id)),
        months: counts.months,
        total: counts.total,
        news: counts.news,
        video: counts.video,
        outlets: counts.outlets,
        startsAt: setting?.feedStartAt ?? null,
      },
      { headers: HEADERS },
    );
  } catch (e) {
    // Before the migration is run there is no feed; the section says so rather than breaking.
    if (isMissingTable(e)) return NextResponse.json({ month: dhakaMonth(), pinned: [], items: [], months: [], total: 0, news: 0, video: 0, outlets: [], startsAt: null, unavailable: true }, { headers: OPEN });
    throw e;
  }
}

/**
 * The JSON, gzipped for a browser that accepts it (lib/gzipJson). Every item
 * carries `titleEn` and `summaryEn` (the English, null until translated). With
 * `?lang=en` (the app's English version) the outlets are named in English and
 * `title`/`summary` are the English where there is some, the outlet's own in
 * `titleOriginal`/`summaryOriginal` (lib/app/news.ts, feedInEnglish).
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  let res = await handle(req, ctx);
  if (res.ok && new URL(req.url).searchParams.get('lang') === 'en') {
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    res = NextResponse.json(feedInEnglish(await res.json()), { status: res.status, headers });
  }
  return gzipJson(req, res);
}
