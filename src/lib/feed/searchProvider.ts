/**
 * Where a search for a member's name is sent.
 *
 * Ten of the outlets the feed should carry — যুগান্তর, কালের কণ্ঠ, বাংলাদেশ
 * প্রতিদিন, মানবজমিন, bdnews24, সময়, কালবেলা, বাংলানিউজ২৪, নয়া দিগন্ত, যমুনা —
 * publish no usable feed. The only way to reach them without scraping their
 * pages is to ask a search engine, so the provider sits behind this interface
 * and can be swapped by setting one environment variable.
 *
 *   FEED_SEARCH_PROVIDER = gnews | brave | serpapi | google | bing
 *   FEED_SEARCH_KEY      = the provider's key (gnews needs none)
 *   FEED_SEARCH_CX       = Google Programmable Search only: the engine id
 *
 * Google News' RSS search is the default: no key, no quota, and it reaches
 * months back. Google closed the Custom Search JSON API to new customers
 * (every call answers 403 "does not have the access") and retires it on
 * 2027-01-01; Microsoft retired Bing Search. Brave's free plan gives 2,000
 * queries a month, about 65 a day.
 *
 * Without a key the collector reports that it is not configured and changes
 * nothing, exactly as the mailer does.
 */
export interface SearchHit {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  outletName: string | null;
  /** The outlet's hostname when `url` does not carry it (a redirect link). */
  outletHost?: string | null;
}

export interface SearchProvider {
  name: string;
  /** One query, newest first. `since` is a date the provider may use to narrow. */
  search(query: string, opts: { since?: string; limit?: number }): Promise<SearchHit[]>;
}

import { parseFeed } from './rss';

const UA = 'mymp-feed/1.0 (+https://mymp.bd)';

/**
 * What the provider actually complained about. A bare status code sends the
 * next person hunting; these APIs say plainly whether a key is wrong, an API
 * is not enabled for the project, or a quota is spent.
 */
async function why(res: Response): Promise<string> {
  try {
    const body = await res.text();
    const json = JSON.parse(body) as { error?: { message?: string; status?: string; errors?: { reason?: string; message?: string }[] } };
    const e = json.error;
    const parts = [e?.status, e?.message, e?.errors?.[0]?.reason].filter(Boolean);
    return parts.length ? parts.join(' — ').slice(0, 220) : body.slice(0, 200);
  } catch {
    return 'no message';
  }
}

const iso = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

/** Bing News Search v7. */
function bing(key: string): SearchProvider {
  return {
    name: 'bing',
    async search(query, { limit = 20 }) {
      const url = new URL('https://api.bing.microsoft.com/v7.0/news/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(limit));
      url.searchParams.set('mkt', 'bn-BD');
      url.searchParams.set('sortBy', 'Date');
      const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': key, 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`bing ${res.status}: ${await why(res)}`);
      const json = (await res.json()) as { value?: { name: string; url: string; description?: string; datePublished?: string; provider?: { name: string }[] }[] };
      return (json.value ?? []).map((v) => ({
        title: v.name,
        url: v.url,
        summary: v.description ?? null,
        publishedAt: iso(v.datePublished),
        outletName: v.provider?.[0]?.name ?? null,
      }));
    },
  };
}

/** SerpAPI's Google News engine. */
function serpapi(key: string): SearchProvider {
  return {
    name: 'serpapi',
    async search(query, { limit = 20 }) {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google_news');
      url.searchParams.set('q', query);
      url.searchParams.set('hl', 'bn');
      url.searchParams.set('gl', 'bd');
      url.searchParams.set('num', String(limit));
      url.searchParams.set('api_key', key);
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error(`serpapi ${res.status}: ${await why(res)}`);
      const json = (await res.json()) as { news_results?: { title: string; link: string; snippet?: string; date?: string; source?: { name?: string } }[] };
      return (json.news_results ?? []).map((v) => ({
        title: v.title,
        url: v.link,
        summary: v.snippet ?? null,
        publishedAt: iso(v.date),
        outletName: v.source?.name ?? null,
      }));
    },
  };
}

/** Google Programmable Search, restricted to the sites we cannot read otherwise. */
function google(key: string, cx: string): SearchProvider {
  return {
    name: 'google',
    async search(query, { limit = 10 }) {
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.set('key', key);
      url.searchParams.set('cx', cx);
      url.searchParams.set('q', query);
      url.searchParams.set('num', String(Math.min(limit, 10)));
      url.searchParams.set('sort', 'date');
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`google ${res.status}: ${await why(res)}`);
      const json = (await res.json()) as { items?: { title: string; link: string; snippet?: string; pagemap?: { metatags?: Record<string, string>[] }; displayLink?: string }[] };
      return (json.items ?? []).map((v) => ({
        title: v.title,
        url: v.link,
        summary: v.snippet ?? null,
        publishedAt: iso(v.pagemap?.metatags?.[0]?.['article:published_time']),
        outletName: v.displayLink ?? null,
      }));
    },
  };
}

/**
 * Brave Search API, web search with the news cluster folded in. `site:` terms
 * in the query keep it on the outlets without a feed, as with Google.
 */
function brave(key: string): SearchProvider {
  interface BraveResult { title: string; url: string; description?: string; page_age?: string; age?: string; meta_url?: { hostname?: string } }
  return {
    name: 'brave',
    async search(query, { limit = 20 }) {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(Math.min(limit, 20)));
      url.searchParams.set('country', 'BD');
      url.searchParams.set('search_lang', 'bn');
      url.searchParams.set('text_decorations', '0');
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'application/json', 'x-subscription-token': key },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`brave ${res.status}: ${await why(res)}`);
      const json = (await res.json()) as { web?: { results?: BraveResult[] }; news?: { results?: BraveResult[] } };
      const seen = new Set<string>();
      const out: SearchHit[] = [];
      for (const v of [...(json.news?.results ?? []), ...(json.web?.results ?? [])]) {
        if (!v.url || seen.has(v.url)) continue;
        seen.add(v.url);
        out.push({
          title: v.title,
          url: v.url,
          summary: v.description ?? null,
          publishedAt: iso(v.page_age) ?? iso(v.age),
          outletName: v.meta_url?.hostname?.replace(/^www\./, '') ?? null,
        });
      }
      return out;
    },
  };
}

/**
 * Google News' RSS search. The same index Google News shows, as a feed, with
 * no key: a hundred stories a query, newest first, back as far as the outlet
 * is indexed. Each link is a Google redirect that opens the article, so the
 * outlet comes from the item's <source>, not from the address.
 */
function gnews(): SearchProvider {
  return {
    name: 'gnews',
    async search(query, { limit = 100 }) {
      const url = new URL('https://news.google.com/rss/search');
      url.searchParams.set('q', query);
      url.searchParams.set('hl', 'bn');
      url.searchParams.set('gl', 'BD');
      url.searchParams.set('ceid', 'BD:bn');
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`gnews ${res.status}: ${await why(res)}`);
      const xml = await res.text();
      const out: SearchHit[] = [];
      for (const block of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
        const [item] = parseFeed(`<rss><channel>${block}</channel></rss>`);
        if (!item) continue;
        const source = block.match(/<source url="([^"]*)"[^>]*>([^<]*)<\/source>/);
        const sourceName = source?.[2]?.trim() || null;
        const host = source?.[1] ? new URL(source[1]).hostname.replace(/^www\./, '') : null;
        // Google appends " - Outlet" to every headline.
        const title = sourceName && item.title.endsWith(` - ${sourceName}`) ? item.title.slice(0, -(sourceName.length + 3)).trim() : item.title;
        out.push({ title, url: item.url, summary: null, publishedAt: item.publishedAt, outletName: sourceName, outletHost: host });
        if (out.length >= limit) break;
      }
      return out;
    },
  };
}

/** The configured provider; Google News needs no key, the others return null without one. */
export function searchProvider(): SearchProvider | null {
  const which = (process.env.FEED_SEARCH_PROVIDER ?? 'gnews').toLowerCase();
  if (which === 'gnews') return gnews();
  const key = process.env.FEED_SEARCH_KEY;
  if (!key) return null;
  switch (which) {
    case 'brave': return brave(key);
    case 'bing': return bing(key);
    case 'serpapi': return serpapi(key);
    case 'google': {
      const cx = process.env.FEED_SEARCH_CX;
      return cx ? google(key, cx) : null;
    }
    default: return gnews();
  }
}
