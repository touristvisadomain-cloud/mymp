/**
 * The whole-site news and video list, the same one /songbad draws.
 *
 *   ?type=news|video   only headlines, or only videos
 *   ?limit=200         how many (at most 400)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD[&before=…]   a span of days, a page of 300
 *                      at a time, as /api/news/range answers it
 *   ?counts=1          the news page's figures instead (as /news/counts)
 *   ?lang=en           in English, the headlines too where they have been translated
 *
 * Five minutes at the edge, as the web page has: a headline that lands during
 * a bus ride is soon enough, and the app never waits on a cold function.
 */
import { newsPageStories, latestVideos } from '@/lib/feed/storyView';
import { newsRange } from '@/lib/feed/range';
import { meta } from '@/lib/data';
import { storyIn, newsCounts } from '@/lib/app/news';
import { appJson, appLang, LIVE } from '@/lib/app/respond';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = appLang(req);
  const head = { version: meta.builtAt, lang };

  if (url.searchParams.get('counts') === '1') return appJson(req, { ...head, ...(await newsCounts()) }, { cache: LIVE });

  // A span of days, read a page at a time.
  if (url.searchParams.has('from') || url.searchParams.has('to')) {
    const r = await newsRange(url.searchParams);
    if (!r.ok) return appJson(req, { error: 'bad range' }, { status: 400 });
    return appJson(
      req,
      { ...head, from: r.from, to: r.to, stories: r.stories.map((s) => storyIn(s, lang)), next: r.next, counts: r.counts, ...(r.unavailable ? { unavailable: true } : {}) },
      { cache: r.unavailable ? 'no-store' : LIVE },
    );
  }

  const limit = Math.min(Number(url.searchParams.get('limit') ?? 200) || 200, 400);
  const type = url.searchParams.get('type');

  // Videos are read as videos: picked out of the newest mixed stories they were a handful.
  if (type === 'video') {
    return appJson(req, { ...head, stories: (await latestVideos(limit)).slice(0, limit).map((s) => storyIn(s, lang)) }, { cache: LIVE });
  }
  const { stories } = await newsPageStories(limit);
  const filtered = type === 'news' ? stories.filter((s) => s.kind !== 'video') : stories;
  return appJson(req, { ...head, stories: filtered.slice(0, limit).map((s) => storyIn(s, lang)) }, { cache: LIVE });
}
