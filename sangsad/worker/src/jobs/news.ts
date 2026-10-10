/**
 * `news`: read every active source's feed or news sitemap, keep new items as
 * link-only articles, match them to sitting members, and hand the matches to
 * mymp.bd's news table.
 *
 * What is kept: headline, link, time, and the feed's own summary cut to 160
 * characters for the matcher. Never the article text, never an image.
 * One request per second per host and robots.txt are enforced by politeGet.
 *
 * Matches ≥ 0.85 go to mymp.bd as published (editors can unpublish or reject
 * them in the admin); 0.50–0.85 go as drafts for an editor. NEWS_AUTO_PUBLISH=false
 * sends everything as drafts. Without NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY the matches stay in this database only.
 */
import { createClient } from '@supabase/supabase-js';
import { and, eq, gte, inArray, ne } from 'drizzle-orm';
import Parser from 'rss-parser';
import { schema } from '@sangsad/db';
import { mayFetch, politeGet } from '@sangsad/shared';
import { buildIndex, matchArticle, type MatchMember } from '../matcher/match';
import type { Db } from './parliament-core';
import { parseNewsSitemap, readSources, type SourceConfig } from './sources-inspect';

const { articleMembers, articles, constituencies, districts, memberAliases, memberTerms, members, parliaments, sources } = schema;

const MAX_AGE_DAYS = 7;
const SUMMARY_MAX = 160;
const CURRENT_PARLIAMENT = 13;
const parser = new Parser({ timeout: 20000 });

export interface FeedItem {
  url: string;
  title: string;
  summary: string | null;
  publishedAt: Date | null;
}

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|igshid|mc_cid|mc_eid|ref|ref_src|cmpid|ocid)$/i;

/** One URL per story: no tracking parameters, no fragment, lower-case host. */
export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return null;
  }
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Headlines worth showing. Some feeds carry photo captions titled "Caption"
 * and news-agency slugs such as "JS-17 PM-GAS-POWER-TWO-LAST-DHAKA"; a
 * reader cannot tell what either is about, so they are never kept.
 */
export function usableTitle(title: string): boolean {
  const t = clean(title);
  if ([...t].length < 12) return false;
  if (/^(caption|photo|photos|video|videos|live|ছবি|ভিডিও|লাইভ)$/i.test(t)) return false;
  if (/^[A-Z0-9\-:/ ]+$/.test(t) && /[A-Z]{2,}-[A-Z0-9]/.test(t)) return false;
  return true;
}

async function readSource(s: SourceConfig): Promise<FeedItem[]> {
  const out: FeedItem[] = [];
  const scope = new URL(s.homepage);
  const prefix = scope.pathname.replace(/\/$/, '') ? `${scope.origin}${scope.pathname.replace(/\/$/, '')}/` : null;
  for (const url of s.rss_urls) {
    const allowed = await mayFetch(url);
    if (!allowed.ok) throw new Error(allowed.why);
    const r = await politeGet(url, 'application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.5');
    if (r.challenged) throw new Error('bot challenge');
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const feed = await parser.parseString(r.text);
    for (const i of feed.items) {
      const link = i.link ? canonicalUrl(i.link) : null;
      const title = clean(i.title);
      if (!link || !usableTitle(title)) continue;
      const ms = Date.parse(i.isoDate ?? i.pubDate ?? '');
      out.push({ url: link, title, summary: clean(i.contentSnippet).slice(0, SUMMARY_MAX) || null, publishedAt: Number.isNaN(ms) ? null : new Date(ms) });
    }
  }
  for (const url of s.news_sitemap_urls ?? []) {
    const allowed = await mayFetch(url);
    if (!allowed.ok) throw new Error(allowed.why);
    const r = await politeGet(url, 'application/xml,text/xml;q=0.9,*/*;q=0.5');
    if (r.challenged) throw new Error('bot challenge');
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    for (const i of parseNewsSitemap(r.text)) {
      const link = canonicalUrl(i.url);
      if (!link || (prefix && !link.startsWith(prefix)) || !usableTitle(i.title)) continue;
      out.push({ url: link, title: clean(i.title), summary: null, publishedAt: i.publishedAt ? new Date(i.publishedAt) : null });
    }
  }
  return out;
}

export async function loadMatchMembers(db: Db, parliamentNumber = CURRENT_PARLIAMENT): Promise<MatchMember[]> {
  const [parl] = await db.select({ id: parliaments.id }).from(parliaments).where(eq(parliaments.number, parliamentNumber));
  if (!parl) return [];
  const rows = await db
    .select({
      id: members.id,
      externalId: members.sourceExternalId,
      nameBn: members.nameBn,
      nameEn: members.nameEn,
      seatBn: memberTerms.seatLabelBn,
      seatEn: memberTerms.seatLabelEn,
      districtBn: districts.nameBn,
      districtEn: districts.nameEn,
    })
    .from(members)
    .innerJoin(memberTerms, and(eq(memberTerms.memberId, members.id), eq(memberTerms.parliamentId, parl.id), eq(memberTerms.role, 'MP')))
    .leftJoin(constituencies, eq(constituencies.id, memberTerms.constituencyId))
    .leftJoin(districts, eq(districts.id, constituencies.districtId));
  const ids = rows.map((r) => r.id);
  const roleRows = ids.length
    ? await db
        .select({ memberId: memberTerms.memberId, role: memberTerms.role })
        .from(memberTerms)
        .where(and(eq(memberTerms.parliamentId, parl.id), ne(memberTerms.role, 'MP'), inArray(memberTerms.memberId, ids)))
    : [];
  const aliasRows = ids.length
    ? await db.select({ memberId: memberAliases.memberId, alias: memberAliases.alias, language: memberAliases.language }).from(memberAliases).where(inArray(memberAliases.memberId, ids))
    : [];
  return rows
    .filter((r) => r.externalId)
    .map((r) => ({
      id: r.id,
      externalId: r.externalId!,
      nameBn: r.nameBn,
      nameEn: r.nameEn,
      seatBn: r.seatBn,
      seatEn: r.seatEn,
      districtBn: r.districtBn,
      districtEn: r.districtEn,
      roles: roleRows.filter((x) => x.memberId === r.id).map((x) => x.role),
      aliases: aliasRows.filter((x) => x.memberId === r.id).map((x) => ({ alias: x.alias, language: x.language })),
    }));
}

async function upsertSources(db: Db, list: SourceConfig[]) {
  for (const s of list) {
    const values = {
      id: s.id,
      nameBn: s.name_bn,
      nameEn: s.name_en,
      type: s.type,
      homepage: s.homepage,
      rssUrls: [...s.rss_urls, ...(s.news_sitemap_urls ?? [])],
      youtubeChannelId: s.youtube_channel_id,
      language: s.language,
      status: s.status,
      notes: s.notes,
    };
    await db.insert(sources).values(values).onConflictDoUpdate({ target: sources.id, set: values });
  }
}

/** The day a story ran, as Dhaka reckons it. */
const dhakaDate = (d: Date) => new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10);

interface Delivery {
  title: string;
  url: string;
  sourceName: string;
  publishedAt: Date;
  externalId: string;
  status: 'auto' | 'pending';
}

async function deliverToMymp(items: Delivery[]): Promise<{ published: number; drafts: number; skipped: number } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !items.length) return url && key ? { published: 0, drafts: 0, skipped: 0 } : null;
  const autoPublish = process.env.NEWS_AUTO_PUBLISH !== 'false';
  const mymp = createClient(url, key, { auth: { persistSession: false } });
  let published = 0;
  let drafts = 0;
  let skipped = 0;
  // Small batches: the existence check puts every URL into the request's query string.
  for (let i = 0; i < items.length; i += 20) {
    const batch = items.slice(i, i + 20);
    const { data: existing, error: readError } = await mymp
      .from('news_posts')
      .select('source_url,member_id')
      .in('source_url', [...new Set(batch.map((b) => b.url))]);
    if (readError) throw new Error(`mymp news_posts read: ${readError.message}`);
    const have = new Set((existing ?? []).map((e) => `${e.source_url}|${e.member_id}`));
    const rows = batch
      .filter((b) => !have.has(`${b.url}|${b.externalId}`))
      .map((b) => ({
        title_bn: b.title,
        source_name: b.sourceName,
        source_url: b.url,
        published_on: dhakaDate(b.publishedAt),
        excerpt_bn: null,
        member_id: b.externalId,
        seat_slug: null,
        status: b.status === 'auto' && autoPublish ? 'published' : 'draft',
      }));
    skipped += batch.length - rows.length;
    if (!rows.length) continue;
    const { error } = await mymp.from('news_posts').insert(rows);
    if (error) throw new Error(`mymp news_posts insert: ${error.message}`);
    published += rows.filter((r) => r.status === 'published').length;
    drafts += rows.filter((r) => r.status === 'draft').length;
  }
  return { published, drafts, skipped };
}

interface StoredArticle {
  id: number;
  url: string;
  sourceId: string;
  title: string;
  summary: string | null;
  publishedAt: Date;
}

/** Matches articles to members, records every match here, and (unless told not to) hands them to mymp.bd. */
async function matchAndDeliver(db: Db, list: StoredArticle[], sourceList: SourceConfig[], deliver = true) {
  const index = buildIndex(await loadMatchMembers(db));
  const sourceName = new Map(sourceList.map((s) => [s.id, s.name_bn]));
  const deliveries: Delivery[] = [];
  let auto = 0;
  let pending = 0;
  for (const a of list) {
    if (!usableTitle(a.title)) continue;
    for (const m of matchArticle(index, a.title, a.summary)) {
      await db
        .insert(articleMembers)
        .values({ articleId: a.id, memberId: m.memberId, confidence: m.confidence.toFixed(3), matchReason: m.reason, status: m.status })
        .onConflictDoNothing();
      if (m.status === 'auto') auto++;
      else pending++;
      deliveries.push({ title: a.title, url: a.url, sourceName: sourceName.get(a.sourceId) ?? a.sourceId, publishedAt: a.publishedAt, externalId: m.externalId, status: m.status });
    }
  }
  const delivered = deliver ? await deliverToMymp(deliveries) : null;
  return { auto, pending, delivered };
}

const DELIVERY_WINDOW_HOURS = 48;

/**
 * Every automatic or pending match on a headline fetched in the last 48 hours,
 * ready for mymp.bd. Delivering this window on every run (mymp.bd skips what
 * it already has) means a run without the mymp secrets, or a failed delivery,
 * loses nothing: the next good run catches up.
 */
async function recentDeliveries(db: Db, sourceList: SourceConfig[]): Promise<Delivery[]> {
  const since = new Date(Date.now() - DELIVERY_WINDOW_HOURS * 3600e3);
  const sourceName = new Map(sourceList.map((x) => [x.id, x.name_bn]));
  const rows = await db
    .select({
      title: articles.title,
      url: articles.url,
      sourceId: articles.sourceId,
      publishedAt: articles.publishedAt,
      fetchedAt: articles.fetchedAt,
      externalId: members.sourceExternalId,
      status: articleMembers.status,
    })
    .from(articleMembers)
    .innerJoin(articles, eq(articles.id, articleMembers.articleId))
    .innerJoin(members, eq(members.id, articleMembers.memberId))
    .where(and(gte(articles.fetchedAt, since), inArray(articleMembers.status, ['auto', 'pending'])));
  return rows
    .filter((r) => r.externalId && usableTitle(r.title))
    .map((r) => ({
      title: r.title,
      url: r.url,
      sourceName: sourceName.get(r.sourceId) ?? r.sourceId,
      publishedAt: r.publishedAt ?? r.fetchedAt,
      externalId: r.externalId!,
      status: r.status === 'auto' ? ('auto' as const) : ('pending' as const),
    }));
}

/**
 * `news:rematch`: run the current matcher again over the last week's stored
 * articles. Matches an editor has approved or rejected are left alone; the
 * rest are replaced. Deliveries to mymp.bd skip anything already there.
 */
export async function runNewsRematch(db: Db): Promise<{ itemsFound: number; itemsNew: number }> {
  const { sources: list } = readSources();
  const since = new Date(Date.now() - MAX_AGE_DAYS * 864e5);
  const recent = await db
    .select({ id: articles.id, url: articles.url, sourceId: articles.sourceId, title: articles.title, summary: articles.summaryShort, publishedAt: articles.publishedAt })
    .from(articles)
    .where(gte(articles.publishedAt, since));
  const ids = recent.map((a) => a.id);
  for (let i = 0; i < ids.length; i += 500) {
    await db.delete(articleMembers).where(and(inArray(articleMembers.articleId, ids.slice(i, i + 500)), inArray(articleMembers.status, ['auto', 'pending'])));
  }
  const { auto, pending, delivered } = await matchAndDeliver(
    db,
    recent.map((a) => ({ ...a, publishedAt: a.publishedAt ?? new Date() })),
    list,
  );
  process.stdout.write(`  rematched ${recent.length} articles: ${auto} automatic, ${pending} for review\n`);
  process.stdout.write(
    delivered
      ? `  mymp.bd news: ${delivered.published} published, ${delivered.drafts} drafts, ${delivered.skipped} already there\n`
      : '  mymp.bd news: not delivered (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)\n',
  );
  return { itemsFound: recent.length, itemsNew: auto + pending };
}

export async function runNews(db: Db): Promise<{ itemsFound: number; itemsNew: number }> {
  const { sources: list } = readSources();
  await upsertSources(db, list);
  const active = list.filter((s) => s.status === 'active');
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;

  // Different hosts in parallel; politeGet keeps each host at one request per second.
  const fetched = new Map<string, FeedItem[]>();
  const queue = [...active];
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        try {
          const items = (await readSource(s)).filter((i) => !i.publishedAt || i.publishedAt.getTime() >= cutoff);
          fetched.set(s.id, items);
          await db.update(sources).set({ lastSuccessAt: new Date(), consecutiveFailures: 0 }).where(eq(sources.id, s.id));
        } catch (err) {
          process.stdout.write(`  ${s.id}: failed (${(err as Error).message.slice(0, 80)})\n`);
          const [row] = await db.select({ n: sources.consecutiveFailures }).from(sources).where(eq(sources.id, s.id));
          await db.update(sources).set({ consecutiveFailures: (row?.n ?? 0) + 1 }).where(eq(sources.id, s.id));
        }
      }
    }),
  );

  // Keep each story once; the first outlet to list a URL owns it.
  const fresh: { sourceId: string; item: FeedItem }[] = [];
  const seen = new Set<string>();
  for (const [sourceId, items] of fetched) {
    for (const item of items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      fresh.push({ sourceId, item });
    }
  }
  const now = new Date();
  const inserted: { id: number; url: string }[] = [];
  for (let i = 0; i < fresh.length; i += 200) {
    const batch = fresh.slice(i, i + 200).map(({ sourceId, item }) => ({
      sourceId,
      url: item.url,
      title: item.title,
      summaryShort: item.summary,
      publishedAt: item.publishedAt ?? now,
      language: list.find((s) => s.id === sourceId)?.language ?? null,
    }));
    inserted.push(...(await db.insert(articles).values(batch).onConflictDoNothing({ target: articles.url }).returning({ id: articles.id, url: articles.url })));
  }

  const byUrl = new Map(fresh.map((f) => [f.item.url, f]));
  const toMatch = inserted.flatMap((a) => {
    const f = byUrl.get(a.url);
    return f ? [{ id: a.id, url: a.url, sourceId: f.sourceId, title: f.item.title, summary: f.item.summary, publishedAt: f.item.publishedAt ?? now }] : [];
  });
  const { auto, pending } = await matchAndDeliver(db, toMatch, list, false);
  const delivered = await deliverToMymp(await recentDeliveries(db, list));

  const itemsSeen = [...fetched.values()].reduce((n, l) => n + l.length, 0);
  process.stdout.write(`  sources read ${fetched.size} of ${active.length}; items in the last ${MAX_AGE_DAYS} days ${itemsSeen}; new articles ${inserted.length}\n`);
  process.stdout.write(`  matches: ${auto} automatic, ${pending} for review\n`);
  process.stdout.write(
    delivered
      ? `  mymp.bd news: ${delivered.published} published, ${delivered.drafts} drafts, ${delivered.skipped} already there\n`
      : '  mymp.bd news: not delivered (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)\n',
  );
  return { itemsFound: itemsSeen, itemsNew: inserted.length };
}
