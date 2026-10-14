/**
 * Reads members' news back to the election out of the outlets' dated archives.
 *
 * The collectors only see what an outlet has on its site today, so a member
 * who reached print in March and not since has an empty page: on 2026-09-16,
 * 234 of 348 members had no story at all. Four outlets keep an archive of
 * every article address by day or by month, and put the headline in the
 * address (সমকাল, চ্যানেল ২৪, বাংলা ট্রিবিউন, দেশ রূপান্তর; see `archives` in
 * config/news-sources.ts). The headline is read from the address and matched;
 * only the articles that name a member are opened, once, for their real
 * headline, picture and time. Nothing else about an article is kept.
 *
 *   npm run feed:archive                       since the election year began (2026-01-01)
 *   npm run feed:archive -- --since 2026-08-01
 *   npm run feed:archive -- --only samakal     one outlet
 *   npm run feed:archive -- --dry-run          count matches, write nothing
 *
 * Requests to one host are spaced (--gap seconds, default 8). Run it from a
 * home connection: দেশ রূপান্তর refuses data-centre addresses.
 */
import fs from 'node:fs';

const envFile = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

import { NEWS_SOURCES } from '../config/news-sources';
import { buildIndex, ingest, type IngestCounts } from '../src/lib/feed/collect';
import { matchItem } from '../src/lib/feed/matchMp';
import { FEED_UA } from '../src/lib/feed/rss';
import { pageImage } from '../src/lib/feed/thumbnails';
import { finishRun, startRun, type FeedItemInput } from '../src/lib/feed/store';

const argOf = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

const metaContent = (html: string, prop: string): string | null => {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${prop}["']`, 'i');
  const m = html.match(re) ?? html.match(alt);
  return m ? decode(m[1]!) : null;
};

/** The headline an address carries: the last path segment with Bangla letters, hyphens read as spaces. */
export function headlineFromUrl(url: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  const segment = path.split('/').filter(Boolean).reverse().find((p) => /[ঀ-৿]/.test(p));
  if (!segment) return null;
  const text = segment.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length >= 8 ? text : null;
}

/** Every period an archive is filed under, newest first, from today back to `since`. */
function periods(every: 'day' | 'month', since: string): string[] {
  const out: string[] = [];
  const start = new Date(`${since}T00:00:00Z`);
  if (every === 'day') {
    for (let d = new Date(); d >= start; d = new Date(d.getTime() - 86_400_000)) out.push(d.toISOString().slice(0, 10));
  } else {
    const now = new Date();
    for (let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); d >= new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))) {
      out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}

async function get(url: string, timeoutMs: number): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': FEED_UA }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
    return { status: res.status, text: res.ok ? await res.text() : '' };
  } catch (e) {
    return { status: (e as Error).name === 'TimeoutError' ? -1 : -2, text: '' };
  }
}

async function main() {
  const since = argOf('since') ?? '2026-01-01';
  const only = argOf('only');
  const gap = Number(argOf('gap') ?? 8) * 1000;
  const dryRun = process.argv.includes('--dry-run');
  const sources = NEWS_SOURCES.filter((s) => s.archives?.length && (!only || s.key === only));
  if (!sources.length) throw new Error('no outlet with an archive matches');

  const index = await buildIndex();
  const run = dryRun ? null : await startRun('archive', 'terminal');
  const counts: IngestCounts = { found: 0, stored: 0, attached: 0, lowConfidence: 0, unmatched: 0 };
  const errors: { source: string; message: string }[] = [];
  const detail: Record<string, number> = {};
  let addresses = 0;
  let candidates = 0;

  for (const source of sources) {
    let lastAt = 0;
    const polite = async () => {
      const since = Date.now() - lastAt;
      if (since < gap) await wait(gap - since);
      lastAt = Date.now();
    };
    for (const archive of source.archives!) {
      for (const period of periods(archive.every, since)) {
        await polite();
        const url = archive.url.replace('{d}', period);
        const page = await get(url, 60_000);
        if (page.status !== 200) {
          errors.push({ source: source.key, message: `${period}: HTTP ${page.status}` });
          console.log(`${source.key} ${period}: HTTP ${page.status}`);
          continue;
        }
        const entries = [...page.text.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((m) => {
          const block = m[1]!;
          return {
            url: decode(block.match(/<loc>([^<]+)<\/loc>/i)?.[1] ?? ''),
            lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1] ?? null,
          };
        }).filter((e) => /^https?:\/\//.test(e.url));
        addresses += entries.length;

        const matched = entries.filter((e) => {
          const title = headlineFromUrl(e.url);
          return title && matchItem(index, { title, summary: null }).length;
        });
        candidates += matched.length;

        const batch: FeedItemInput[] = [];
        for (const e of matched) {
          await polite();
          const article = await get(e.url, 20_000);
          const html = article.text.slice(0, 200_000);
          const title = html ? metaContent(html, 'og:title') ?? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') : '';
          const published = html ? metaContent(html, 'article:published_time') ?? metaContent(html, 'datePublished') : null;
          const publishedAt = [published, e.lastmod].map((v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null)).find(Boolean)
            ?? `${period}T12:00:00.000Z`;
          batch.push({
            type: 'news',
            // An article that would not open keeps the headline its address carries.
            title: title || headlineFromUrl(e.url)!,
            url: e.url,
            summary: html ? metaContent(html, 'og:description') : null,
            outletName: source.nameBn,
            outletId: source.key,
            thumbnailUrl: html ? pageImage(html, e.url) : null,
            publishedAt,
            source: 'rss',
          });
        }
        detail[source.key] = (detail[source.key] ?? 0) + batch.length;
        if (!dryRun && batch.length) await ingest(batch, index, counts, undefined, { onlyMatched: true });
        console.log(`${source.key} ${period}: ${entries.length} addresses, ${matched.length} name a member; linked so far ${counts.attached}`);
      }
    }
  }

  console.log(`\naddresses read   ${addresses}`);
  console.log(`name a member    ${candidates}`);
  console.log(`stored           ${counts.stored}${dryRun ? ' (dry run: nothing written)' : ''}`);
  console.log(`new links        ${counts.attached}  (${counts.lowConfidence} to review)`);
  if (errors.length) console.log(`periods missed   ${errors.length}`);
  if (run) {
    await finishRun(run, {
      status: 'ok', itemsFound: counts.found, itemsNew: counts.stored, itemsAttached: counts.attached,
      unmatched: counts.unmatched, lowConfidence: counts.lowConfidence, errors: errors.slice(0, 40), detail,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
