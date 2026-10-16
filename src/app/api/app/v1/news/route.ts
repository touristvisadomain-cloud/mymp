/**
 * The whole-site news and video list, the same one /songbad draws.
 *
 * Five minutes at the edge, as the web page has: a headline that lands during
 * a bus ride is soon enough, and the app never waits on a cold function.
 */
import { NextResponse } from 'next/server';
import { newsPageStories, latestVideos } from '@/lib/feed/storyView';
import { gzipJson } from '@/lib/gzipJson';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handle(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 200) || 200, 400);
  const type = url.searchParams.get('type');

  // Videos are read as videos: picked out of the newest mixed stories they were a handful.
  if (type === 'video') {
    return NextResponse.json(
      { stories: (await latestVideos(limit)).slice(0, limit) },
      { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=1800', 'access-control-allow-origin': '*' } },
    );
  }
  const { stories } = await newsPageStories(limit);
  const filtered = type === 'news' ? stories.filter((s) => s.kind !== 'video') : stories;

  return NextResponse.json(
    { stories: filtered.slice(0, limit) },
    { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=1800', 'access-control-allow-origin': '*' } },
  );
}

/** The JSON, gzipped for a browser that accepts it (lib/gzipJson). */
export async function GET(req: Request) {
  return gzipJson(req, await handle(req));
}
