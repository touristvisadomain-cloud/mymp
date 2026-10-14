/**
 * `social:wikipedia`: sitting members' official website and social accounts,
 * as their own Wikipedia articles list them, for mymp.bd.
 *
 * The owner asked (2026-09-11) for official links to be filled in without an
 * editor typing each one. Facebook, X and the rest are never visited: they
 * are not crawled, and nothing here would get past their login walls. The
 * links come only from what Wikipedia's articles say, read through the raw
 * path its robots.txt allows:
 *
 * 1. each constituency article names its current member (infobox) and links
 *    the 2026 winner; the link is used only when that name is the sitting
 *    member's (or the seat is in config/results-reviewed.json), and the
 *    article it leads to names the member's own seat (a bare name can lead to
 *    a namesake: one 2026 box links "Abdus Salam", the physicist);
 * 2. the member's article (Bangla, then English) gives the links in its
 *    infobox "website" and its external-link templates ({{Official website}},
 *    {{Facebook}}, {{Twitter}}, {{YouTube}}, {{Instagram}} and their Bangla
 *    forms); a template with no value takes it from Wikidata, so the
 *    rendered article is read for the official website in that case only;
 * 3. a link must be a profile (not a post, group, video or share link), and
 *    when the two articles disagree on a network neither link is used.
 *
 * mymp.bd gets each link as a member override, never over a link an editor
 * saved, plus a `socialSource` override naming the article(s), which the
 * profile shows instead of "added by an editor".
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { and, eq, lte } from 'drizzle-orm';
import { schema } from '@sangsad/db';
import { mayFetch, politeGet } from '@sangsad/shared';
import type { Db } from './parliament-core';
import { enTitle, fetchPages, pageUrl, plain, reviewedSameWinner, sameName, templates, type WikiPage } from './results-wiki';

const { constituencies, memberTerms, members, parliaments } = schema;

export type SocialKey = 'facebook' | 'x' | 'youtube' | 'instagram' | 'website';
export type Links = Partial<Record<SocialKey, string>>;

const TEMPLATE_KEYS: [RegExp, SocialKey][] = [
  [/^(facebook|ফেসবুক)$/, 'facebook'],
  [/^(twitter|x|টুইটার|twitter handle)$/, 'x'],
  [/^(youtube|ইউটিউব)$/, 'youtube'],
  [/^(instagram|ইনস্টাগ্রাম)$/, 'instagram'],
  [/^(official website|official site|official|দাপ্তরিক ওয়েবসাইট|অফিসিয়াল ওয়েবসাইট)$/, 'website'],
];

const bare = (h: string) => h.toLowerCase().replace(/^(www|m|mobile|web)\./, '');
const onHost = (u: URL, hosts: string[]) => hosts.some((h) => bare(u.hostname) === h || bare(u.hostname).endsWith(`.${h}`));

/** A profile address for the network, https, or null for anything that is not one. */
export function profileUrl(key: SocialKey, raw: string): string | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  u.protocol = 'https:';
  u.hash = '';
  const path = u.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);
  switch (key) {
    case 'facebook':
      if (!onHost(u, ['facebook.com', 'fb.com'])) return null;
      if (parts[0] === 'profile.php' && /^\d+$/.test(u.searchParams.get('id') ?? '')) return `https://www.facebook.com/profile.php?id=${u.searchParams.get('id')}`;
      if (parts[0] === 'people' && parts.length >= 3) return `https://www.facebook.com/${parts.slice(0, 3).join('/')}`;
      if (parts.length !== 1 || /^(groups|events|posts|photo|photos|watch|share|sharer|story\.php|hashtag|search|pages|permalink\.php|login|home\.php)$/i.test(parts[0]!)) return null;
      return `https://www.facebook.com/${parts[0]}`;
    case 'x':
      if (!onHost(u, ['x.com', 'twitter.com'])) return null;
      if (parts.length !== 1 || /^(home|search|hashtag|intent|share|i)$/i.test(parts[0]!)) return null;
      return `https://x.com/${parts[0]!.replace(/^@/, '')}`;
    case 'youtube':
      if (!onHost(u, ['youtube.com'])) return null;
      if (parts.length === 1 && parts[0]!.startsWith('@')) return `https://www.youtube.com/${parts[0]}`;
      if (parts.length === 2 && /^(channel|c|user)$/.test(parts[0]!)) return `https://www.youtube.com/${parts[0]}/${parts[1]}`;
      return null;
    case 'instagram':
      if (!onHost(u, ['instagram.com'])) return null;
      if (parts.length !== 1 || /^(p|reel|reels|explore|stories|accounts)$/i.test(parts[0]!)) return null;
      return `https://www.instagram.com/${parts[0]}`;
    case 'website':
      // A member's own site: not a social network, not Wikipedia or a news page about them.
      if (onHost(u, ['facebook.com', 'fb.com', 'x.com', 'twitter.com', 'youtube.com', 'instagram.com', 'wikipedia.org', 'wikidata.org'])) return null;
      return `${u.origin}${path}${u.search}`;
  }
}

/** The address a social template points at, from its parameters; '' when the template has none (Wikidata supplies it). */
function templateTarget(key: SocialKey, params: Record<string, string>): string {
  const p = (k: string) => plain(params[k] ?? '').trim();
  const first = p('1') || p('id') || p('name') || p('url');
  switch (key) {
    case 'facebook':
      return first && !/^https?:/i.test(first) ? `https://www.facebook.com/${first}` : first;
    case 'x':
      return first && !/^https?:/i.test(first) ? `https://x.com/${first.replace(/^@/, '')}` : first;
    case 'instagram':
      return first && !/^https?:/i.test(first) ? `https://www.instagram.com/${first.replace(/^@/, '')}` : first;
    case 'youtube': {
      if (p('channel')) return `https://www.youtube.com/channel/${p('channel')}`;
      if (p('handle') || p('h')) return `https://www.youtube.com/@${(p('handle') || p('h')).replace(/^@/, '')}`;
      if (p('c')) return `https://www.youtube.com/c/${p('c')}`;
      if (p('user') || p('u')) return `https://www.youtube.com/user/${p('user') || p('u')}`;
      if (/^UC[\w-]{22}$/.test(first)) return `https://www.youtube.com/channel/${first}`;
      if (first.startsWith('@')) return `https://www.youtube.com/${first}`;
      return /^https?:/i.test(first) ? first : '';
    }
    case 'website':
      return first;
  }
}

/** The first URL in an infobox value: {{URL|…}}, [http… label] or a bare address. */
function urlIn(value: string): string {
  const tpl = templates(value).find((t) => /^(url|ইউআরএল)$/.test(t.name));
  if (tpl) return (tpl.params['1'] ?? '').trim();
  return value.match(/https?:\/\/[^\s\]|<}]+/)?.[0] ?? (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(value.trim()) ? value.trim() : '');
}

/** Links an article gives, and which networks it names without a value (from Wikidata). */
export function linksIn(wikitext: string): { links: Links; fromWikidata: SocialKey[] } {
  const links: Links = {};
  const fromWikidata: SocialKey[] = [];
  for (const t of templates(wikitext)) {
    if (/^(infobox|তথ্যছক)/.test(t.name)) {
      const site = t.params.website ?? t.params['ওয়েবসাইট'];
      const url = site ? profileUrl('website', urlIn(site)) : null;
      if (url && !links.website) links.website = url;
      continue;
    }
    const key = TEMPLATE_KEYS.find(([re]) => re.test(t.name.replace(/_/g, ' ')))?.[1];
    if (!key) continue;
    const target = templateTarget(key, t.params);
    if (!target) {
      fromWikidata.push(key);
      continue;
    }
    const url = profileUrl(key, target);
    if (url && !links[key]) links[key] = url;
  }
  return { links, fromWikidata };
}

/** The official website as the rendered article shows it (for a template filled from Wikidata). */
export function officialSiteInHtml(html: string): string | null {
  const m = html.match(/class="official-website"[\s\S]{0,300}?href="([^"]+)"/);
  return m ? profileUrl('website', m[1]!.replace(/&amp;/g, '&')) : null;
}

/** Older English spellings Wikipedia still uses in titles and text. */
const DISTRICT_ALIASES: Record<string, string[]> = {
  bogura: ['bogra'],
  chattogram: ['chittagong'],
  cumilla: ['comilla'],
  jashore: ['jessore'],
  barishal: ['barisal'],
  jhalokati: ['jhalokathi'],
  chapainawabganj: ['chapai nawabganj', 'nawabganj'],
  'chapai nawabganj': ['chapainawabganj', 'nawabganj'],
  netrokona: ['netrakona'],
  moulvibazar: ['maulvibazar'],
  kishoreganj: ['kishorganj'],
};
const BN = '০১২৩৪৫৬৭৮৯';
const unify = (s: string) =>
  s
    .normalize('NFC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether an article names this seat: "ঢাকা-১৭", "Dhaka-17", "Bogra 6", "Shariatpur 2 constituency". */
export function mentionsSeat(wikitext: string, seatBn: string, seatEn: string): boolean {
  const text = unify(wikitext);
  const bn = unify(seatBn).match(/^(.*?)[\s-]*(\d+)$/);
  if (bn && new RegExp(`${escapeRe(bn[1]!.trim())}[\\s-]?${bn[2]}(?!\\d)`).test(text)) return true;
  const en = unify(enTitle(seatEn)).match(/^(.*?)[\s-]*(\d+)$/);
  if (!en) return false;
  const district = en[1]!.trim().toLowerCase();
  const names = [district, ...(DISTRICT_ALIASES[district] ?? [])].map((d) => escapeRe(d).replace(/\\?\s+/g, '\\s?'));
  return new RegExp(`(${names.join('|')})[\\s-]?${en[2]}(?!\\d)`, 'i').test(text);
}

const LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const linksOf = (value: string) => [...value.matchAll(LINK)].map((m) => ({ target: m[1]!.trim(), label: (m[2] ?? m[1]!).trim() }));

/** Articles a constituency page names as its member: the infobox's current member and the 2026 winners. */
export function memberLinks(wikitext: string): { target: string; label: string }[] {
  const out: { target: string; label: string }[] = [];
  for (const t of templates(wikitext)) {
    if (/^(infobox|তথ্যছক)/.test(t.name)) {
      for (const k of ['members', 'member', 'mp', 'সদস্য']) if (t.params[k]) out.push(...linksOf(t.params[k]!));
    }
  }
  const starts = [...wikitext.matchAll(/\{\{\s*Election box begin[^}]*?(2026|২০২৬|ত্রয়োদশ)/gi)].map((m) => m.index!);
  for (const start of starts) {
    const block = wikitext.slice(start, start + 6000);
    const cut = block.slice(12).search(/\{\{\s*Election box (begin|end)/i);
    for (const t of templates(cut > 0 ? block.slice(0, cut + 12) : block)) {
      if (/^election box winning candidate/.test(t.name) || /^election box candidate/.test(t.name)) {
        out.push(...linksOf(t.params.candidate ?? ''));
        if (/^election box winning/.test(t.name)) break;
      }
    }
  }
  return out;
}

/**
 * Sitting territorial members and the Wikipedia articles that are theirs
 * (Bangla and English): linked from their constituency article under their
 * name, and naming their seat. Shared by the social and biography jobs.
 */
export async function memberArticles(db: Db) {
  const [parl] = await db.select({ id: parliaments.id }).from(parliaments).where(eq(parliaments.number, 13));
  if (!parl) throw new Error('parliament 13 not seeded');
  const rows = await db
    .select({
      seatNo: constituencies.number,
      seatBn: constituencies.nameBn,
      seatEn: constituencies.nameEn,
      id: members.sourceExternalId,
      nameBn: members.nameBn,
      nameEn: members.nameEn,
      dateOfBirth: members.dateOfBirth,
      professionBn: members.professionBn,
      endDate: memberTerms.endDate,
    })
    .from(memberTerms)
    .innerJoin(members, eq(members.id, memberTerms.memberId))
    .innerJoin(constituencies, eq(constituencies.id, memberTerms.constituencyId))
    .where(and(eq(memberTerms.parliamentId, parl.id), eq(memberTerms.role, 'MP'), lte(constituencies.number, 300)));
  const today = new Date().toISOString().slice(0, 10);
  // A term that has ended (a resignation) no longer speaks for the seat.
  const sitting = rows.filter((r) => r.id && (!r.endDate || String(r.endDate) >= today));
  const reviewed = reviewedSameWinner();

  const [bnSeats, enSeats] = await Promise.all([
    fetchPages('bn.wikipedia.org', [...new Set(sitting.map((r) => r.seatBn))]),
    fetchPages('en.wikipedia.org', [...new Set(sitting.map((r) => enTitle(r.seatEn)))]),
  ]);

  // Which article is each member's, per language.
  const articleOf = new Map<string, { bn?: string; en?: string }>();
  for (const m of sitting) {
    const pick = (page: WikiPage | undefined) =>
      page ? memberLinks(page.wikitext).find((l) => sameName(l.label, m.nameBn, m.nameEn) || sameName(l.target, m.nameBn, m.nameEn) || reviewed.has(m.seatNo))?.target : undefined;
    articleOf.set(m.id!, { bn: pick(bnSeats.get(m.seatBn)), en: pick(enSeats.get(enTitle(m.seatEn))) });
  }
  const bnTitles = [...new Set([...articleOf.values()].map((a) => a.bn).filter(Boolean) as string[])];
  const enTitles = [...new Set([...articleOf.values()].map((a) => a.en).filter(Boolean) as string[])];
  process.stdout.write(`  member articles found: ${bnTitles.length} Bangla, ${enTitles.length} English\n`);
  const [bnArticles, enArticles] = await Promise.all([
    fetchPages('bn.wikipedia.org', bnTitles, 'members'),
    fetchPages('en.wikipedia.org', enTitles, 'members'),
  ]);
  // An article that never names the member's seat is about someone else of that name.
  let namesakes = 0;
  for (const m of sitting) {
    const a = articleOf.get(m.id!)!;
    for (const [lang, articles] of [['bn', bnArticles], ['en', enArticles]] as const) {
      const title = a[lang];
      const page = title ? articles.get(title) : undefined;
      if (title && (!page || !mentionsSeat(page.wikitext, m.seatBn, m.seatEn))) {
        if (page) namesakes++;
        delete a[lang];
      }
    }
  }
  process.stdout.write(`  articles set aside because they never name the member's seat: ${namesakes}\n`);

  const reads = new Map<string, { page: WikiPage; host: string }[]>();
  for (const m of sitting) {
    const a = articleOf.get(m.id!)!;
    const list: { page: WikiPage; host: string }[] = [];
    if (a.bn && bnArticles.get(a.bn)) list.push({ page: bnArticles.get(a.bn)!, host: 'bn.wikipedia.org' });
    if (a.en && enArticles.get(a.en)) list.push({ page: enArticles.get(a.en)!, host: 'en.wikipedia.org' });
    reads.set(m.id!, list);
  }
  return { sitting, reads };
}

export async function runSocialWiki(db: Db): Promise<{ itemsFound: number; itemsNew: number }> {
  const { sitting, reads: readsOf } = await memberArticles(db);
  const found: { id: string; seat: string; name: string; links: Links; sources: string[]; conflicts: SocialKey[] }[] = [];
  for (const m of sitting) {
    const reads = readsOf.get(m.id!)!;
    const merged: Links = {};
    const conflicts = new Set<SocialKey>();
    const sources = new Set<string>();
    for (const { page, host } of reads) {
      const { links, fromWikidata } = linksIn(page.wikitext);
      if (fromWikidata.includes('website') && !links.website) {
        const url = `${pageUrl(host, page.title)}`;
        if ((await mayFetch(url)).ok) {
          const r = await politeGet(url, 'text/html');
          const site = r.status === 200 ? officialSiteInHtml(r.text) : null;
          if (site) links.website = site;
        }
      }
      for (const [k, v] of Object.entries(links) as [SocialKey, string][]) {
        if (merged[k] && merged[k]!.toLowerCase() !== v.toLowerCase()) conflicts.add(k);
        else if (!merged[k]) {
          merged[k] = v;
          sources.add(pageUrl(host, page.title));
        }
      }
    }
    for (const k of conflicts) delete merged[k];
    if (Object.keys(merged).length || conflicts.size) found.push({ id: m.id!, seat: m.seatBn, name: m.nameBn, links: merged, sources: [...sources], conflicts: [...conflicts] });
  }

  const day = new Date().toISOString().slice(0, 10);
  const withLinks = found.filter((f) => Object.keys(f.links).length);
  const byNetwork = (k: SocialKey) => withLinks.filter((f) => f.links[k]).length;
  const summary = {
    members: sitting.length,
    withArticle: [...readsOf.values()].filter((r) => r.length).length,
    withAnyLink: withLinks.length,
    facebook: byNetwork('facebook'),
    x: byNetwork('x'),
    youtube: byNetwork('youtube'),
    instagram: byNetwork('instagram'),
    website: byNetwork('website'),
    conflicts: found.filter((f) => f.conflicts.length).length,
  };
  const report = resolve(import.meta.dirname, `../../../docs/reports/social-wikipedia-${day}.json`);
  writeFileSync(report, JSON.stringify({ generatedAt: new Date().toISOString(), ...summary, items: found }, null, 1));
  process.stdout.write(`  social: ${JSON.stringify(summary)}; report ${report}\n`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    process.stdout.write('  not written to mymp.bd (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)\n');
    return { itemsFound: sitting.length, itemsNew: 0 };
  }
  const mymp = createClient(url, key, { auth: { persistSession: false } });
  const fields = ['facebook', 'x', 'youtube', 'instagram', 'website', 'socialSource'];
  // A page at a time: one request returns at most 1000 rows, and a missed row is an edit overwritten.
  const existing: { entity_id: string; field: string; updated_by: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await mymp.from('overrides').select('entity_id,field,updated_by')
      .eq('entity_type', 'member').in('field', fields).order('entity_id').order('field').range(from, from + 999);
    if (error) throw new Error(`mymp overrides read: ${error.message}`);
    existing.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  // An editor's saved link is never replaced; this job's own earlier rows are. A link is this job's
  // only while the member still carries its socialSource marker: saving links in the admin drops the
  // marker, and a link written by a script with no signed-in editor leaves updated_by empty.
  const marked = new Set(existing.filter((r) => r.field === 'socialSource' && !r.updated_by).map((r) => r.entity_id));
  const edited = new Set(existing.filter((r) => r.updated_by || (r.field !== 'socialSource' && !marked.has(r.entity_id))).map((r) => `${r.entity_id}|${r.field}`));
  let written = 0;
  for (const f of withLinks) {
    const upserts: { entity_type: string; entity_id: string; field: string; value: string; updated_by: null; updated_at: string }[] = (Object.entries(f.links) as [SocialKey, string][])
      .filter(([k]) => !edited.has(`${f.id}|${k}`))
      .map(([k, v]) => ({ entity_type: 'member', entity_id: f.id, field: k, value: v, updated_by: null, updated_at: new Date().toISOString() }));
    if (!upserts.length) continue;
    if (!edited.has(`${f.id}|socialSource`)) {
      upserts.push({ entity_type: 'member', entity_id: f.id, field: 'socialSource', value: f.sources.join(' '), updated_by: null, updated_at: new Date().toISOString() });
    }
    const { error: upsertError } = await mymp.from('overrides').upsert(upserts, { onConflict: 'entity_type,entity_id,field' });
    if (upsertError) throw new Error(`mymp overrides upsert: ${upsertError.message}`);
    written += upserts.length;
  }
  process.stdout.write(`  mymp.bd: ${written} override rows written (links plus their source); publish from the admin to show them\n`);
  return { itemsFound: sitting.length, itemsNew: withLinks.length };
}
