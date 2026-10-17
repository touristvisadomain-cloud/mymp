/**
 * Pictures for the stories that arrived without one.
 *
 * Many outlets' feeds and sitemaps carry a headline and a link and nothing
 * else, so a third of the stories on members' pages showed an empty box. Every
 * one of those articles names its own share picture in the page head
 * (og:image, the one Facebook shows), so the page is read once for that tag and
 * nothing else is kept.
 *
 * Only stories attached to a member are looked at. A story whose
 * page cannot be read, or names no picture, has its updated_at moved forward,
 * so each run tries the stories tried least recently first.
 */
import { restDb, type Db } from '@/lib/posts/db';
import { FEED_UA } from './rss';
import { isGoogleNewsLink, resolveGoogleNews } from './googleNews';
import { canonicalUrl } from './store';

function db(): Db {
  const d = restDb();
  if (!d) throw new Error('Supabase is not configured.');
  return d;
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();

const metaContent = (html: string, prop: string): string | null => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re) ?? html.match(alt);
  return m ? decode(m[1]!) : null;
};

/**
 * The share picture a page names for itself, as an absolute address, or null
 * when it names none or only the outlet's house graphic.
 */
export function pageImage(html: string, pageUrl: string): string | null {
  for (const prop of ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']) {
    const raw = metaContent(html, prop);
    if (!raw) continue;
    let url: string;
    try {
      url = new URL(raw, pageUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(url)) continue;
    // The same whole-word test the feed reader uses, plus the outlet's logo,
    // which several sites name as the picture of a story that has none.
    const file = url.split('?')[0]!.split('/').pop() ?? '';
    if (/^(no[-_]?image|no[-_]?img|placeholder|default|blank)[-_.]?/i.test(file)) continue;
    if (/(^|[-_.])(logo|favicon|og-default|default-og|share-default)([-_.]|$)/i.test(file)) continue;
    return url.slice(0, 800);
  }
  return null;
}

export interface ThumbnailCounts { tried: number; found: number; unreadable: number; none: number; ranOut: boolean }

export async function fillThumbnails(opts: { days?: number; limit?: number; budgetMs?: number; concurrency?: number; triedBefore?: string } = {}): Promise<ThumbnailCounts> {
  const sb = db();
  const deadline = Date.now() + (opts.budgetMs ?? 40_000);
  const since = new Date(Date.now() - (opts.days ?? 3) * 86_400_000).toISOString();
  const rows = await sb.get<{ id: number; url: string }[]>(
    `feed_items?type=eq.news&thumbnail_url=is.null&published_at=gte.${encodeURIComponent(since)}` +
      (opts.triedBefore ? `&updated_at=lt.${encodeURIComponent(opts.triedBefore)}` : '') +
      `&select=id,url,feed_item_mps!inner(mp_id)&order=updated_at.asc&limit=${opts.limit ?? 30}`,
  );

  const counts: ThumbnailCounts = { tried: 0, found: 0, unreadable: 0, none: 0, ranOut: false };
  const queue = [...rows];
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      if (Date.now() > deadline - 12_000) { counts.ranOut = true; return; }
      counts.tried++;
      // A story stored by its Google News link: first the outlet's own address,
      // which the story then keeps, unless another row already has it.
      let pageUrl = row.url;
      if (isGoogleNewsLink(row.url)) {
        const real = await resolveGoogleNews(row.url);
        if (real) {
          pageUrl = real;
          const canonical = canonicalUrl(real);
          const [taken] = await sb.get<{ id: number }[]>(`feed_items?canonical_url=eq.${encodeURIComponent(canonical)}&select=id&limit=1`);
          if (!taken) await sb.patch(`feed_items?id=eq.${row.id}`, { url: real, canonical_url: canonical });
        }
      }
      let html = '';
      try {
        const res = await fetch(pageUrl, {
          headers: { 'user-agent': FEED_UA, accept: 'text/html' },
          signal: AbortSignal.timeout(10_000),
          redirect: 'follow',
        });
        // The picture is named in the head, well inside the first 150 KB.
        if (res.ok) html = (await res.text()).slice(0, 150_000);
      } catch {
        // Counted below as unreadable.
      }
      const image = html ? pageImage(html, pageUrl) : null;
      if (image) counts.found++;
      else if (html) counts.none++;
      else counts.unreadable++;
      await sb.patch(`feed_items?id=eq.${row.id}`, image
        ? { thumbnail_url: image }
        : { updated_at: new Date().toISOString() });
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 6 }, worker));
  return counts;
}
