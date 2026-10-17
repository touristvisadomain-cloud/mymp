// news.json alone, not lib/data: that would carry every member and seat into this function.
import newsJson from '../../../../../data/news.json';
import type { NewsPost } from '@/lib/data';
import type { TickerItem } from '@/components/NewsTicker';

// The ticker's headlines, at most five minutes old: the CDN serves this and the
// database is read once per five minutes at most, whatever the traffic.
export const revalidate = 300;

const LIMIT = 12;

const fromBuild = (): TickerItem[] =>
  [...(newsJson as NewsPost[])]
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn))
    .slice(0, LIMIT)
    .map(({ id, titleBn, titleEn, sourceName, sourceUrl }) => ({ id, titleBn, titleEn: titleEn ?? null, sourceName, sourceUrl }));

/** Published headlines only, newest first, the same filter the site sync uses. */
async function fromDatabase(): Promise<TickerItem[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const read = (columns: string) =>
      fetch(
        `${url}/rest/v1/news_posts?select=${columns}&status=eq.published&order=published_on.desc,created_at.desc&limit=${LIMIT}`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate } },
      );
    // With the English headline once supabase/migrations/006 has added it; without, until then.
    let r = await read('id,title_bn,title_en,source_name,source_url');
    if (r.status === 400) r = await read('id,title_bn,source_name,source_url');
    if (!r.ok) return null;
    const rows = (await r.json()) as { id: string; title_bn: string; title_en?: string | null; source_name: string; source_url: string }[];
    return rows.map((x) => ({ id: x.id, titleBn: x.title_bn, titleEn: x.title_en ?? null, sourceName: x.source_name, sourceUrl: x.source_url }));
  } catch {
    return null;
  }
}

export async function GET() {
  const live = await fromDatabase();
  return Response.json({ items: live?.length ? live : fromBuild() });
}
