/**
 * The news page's stories for a span of days (?from=2026-10-10&to=2026-10-15),
 * read when a reader picks a day, a span or a month, a page of 300 at a time
 * (&before= the previous page's `next`). The page itself carries only the
 * newest few hundred; a month of news is several thousand.
 *
 * Cached at the edge for five minutes, like the member feed.
 */
import { NextResponse } from 'next/server';
import { rangeCounts, rangeLatest } from '@/lib/feed/store';
import { toStory } from '@/lib/feed/storyView';
import { isMissingTable } from '@/lib/posts/db';
import { gzipJson } from '@/lib/gzipJson';

export const dynamic = 'force-dynamic';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HEADERS = { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=1800' };

async function handle(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const before = url.searchParams.get('before') ?? undefined;
  if (!DAY.test(from) || !DAY.test(to) || from > to || (before !== undefined && Number.isNaN(Date.parse(before)))) {
    return NextResponse.json({ error: 'bad range' }, { status: 400 });
  }
  try {
    // The span's own totals come with its first page, for the line above the list.
    const [{ items, next }, counts] = await Promise.all([rangeLatest(from, to, before), before ? null : rangeCounts(from, to)]);
    return NextResponse.json({ from, to, stories: items.map(toStory), next, counts }, { headers: HEADERS });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ from, to, stories: [], next: null, unavailable: true });
    throw e;
  }
}

/** The JSON, gzipped for a browser that accepts it (lib/gzipJson). */
export async function GET(req: Request) {
  return gzipJson(req, await handle(req));
}
