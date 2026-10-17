/**
 * The news page's stories for a span of days (?from=2026-10-10&to=2026-10-15),
 * read when a reader picks a day, a span or a month, a page of 300 at a time
 * (&before= the previous page's `next`). The page itself carries only the
 * newest few hundred; a month of news is several thousand.
 *
 * Cached at the edge for five minutes, like the member feed. Readable from any
 * origin: the mobile app's web build reads it too.
 */
import { NextResponse } from 'next/server';
import { newsRange } from '@/lib/feed/range';
import { gzipJson } from '@/lib/gzipJson';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=1800', 'access-control-allow-origin': '*' };

async function handle(req: Request) {
  const r = await newsRange(new URL(req.url).searchParams);
  if (!r.ok) return NextResponse.json({ error: 'bad range' }, { status: 400, headers: { 'access-control-allow-origin': '*' } });
  if (r.unavailable) return NextResponse.json({ from: r.from, to: r.to, stories: [], next: null, unavailable: true }, { headers: { 'access-control-allow-origin': '*' } });
  return NextResponse.json({ from: r.from, to: r.to, stories: r.stories, next: r.next, counts: r.counts }, { headers: HEADERS });
}

/** The JSON, gzipped for a browser that accepts it (lib/gzipJson). */
export async function GET(req: Request) {
  return gzipJson(req, await handle(req));
}
