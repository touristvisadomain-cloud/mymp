/**
 * The cabinet list as readers see it: who someone on the list is, in either
 * language, and what changed on the list and when. The মন্ত্রিসভা page and the
 * mobile app's cabinet screen read the same functions.
 */
import { posts, getMemberById, initial, type PostEntry } from '@/lib/data';
import { normalizeName } from '@/lib/posts/names';
import { adviserForPost, adviserName } from '@/lib/advisers';
import { inLang } from '@/i18n/content';
import { govPost, personName } from '@/i18n/names';
import type { Lang } from '@/i18n/core';

/** The list writes "জনাব" before most names; the site's names never carry it. */
export const plainName = (name: string) => name.replace(/^জনাব\s+/, '').trim();
export const firstLetter = (name: string) => (plainName(name).replace(/^(ড\.|ডাঃ|ডা\.|মোঃ|ব্রিগেডিয়ার জেনারেল \(অব:\))\s*/, '') || name).charAt(0);
/** The first letter of an English name, past its titles, for the photo's stand-in. */
export const initialEn = (name: string) =>
  (name.replace(/^((Brigadier General|Dr\.?|Md\.?|Mst\.?|Barrister|Advocate|Alhaj)\s+)+/i, '') || name).charAt(0).toUpperCase();

/**
 * Someone on the list in the page's language. A member's name comes from
 * the member record; anyone else's from their profile or the list's own
 * English. With neither, the English page gives the Bangla, marked as such.
 */
export function nameOf(r: Pick<PostEntry, 'memberId' | 'nameBn' | 'nameEn'>, lang: Lang): { name: string; nameLang?: 'bn'; initial: string } {
  const m = r.memberId ? getMemberById(r.memberId) : undefined;
  if (lang === 'bn') return { name: m?.nameBn ?? plainName(r.nameBn), initial: m ? initial(m) : firstLetter(r.nameBn) };
  if (m) {
    const en = personName(m, 'en');
    return /[ঀ-৿]/.test(en) ? { name: en, nameLang: 'bn', initial: initial(m) } : { name: en, initial: initialEn(en) };
  }
  const a = adviserForPost(r);
  const own = a ? adviserName(a, 'en') : r.nameEn ? { text: personName({ nameEn: r.nameEn }, 'en'), lang: 'en' as const } : null;
  if (own?.lang === 'en') return { name: own.text, initial: initialEn(own.text) };
  return { name: own?.text ?? plainName(r.nameBn), nameLang: 'bn', initial: firstLetter(r.nameBn) };
}

export interface Change { date: string; name: string; nameLang?: 'bn'; href: string | null; text: string; kind: 'start' | 'end' | 'change' }

/** The last changes in the cabinet, from the posts' own dates: a start, an end, or both on one day. */
export function changes(lang: Lang, limit = 20): Change[] {
  const byDay = new Map<string, { date: string; name: string; nameLang?: 'bn'; href: string | null; starts: PostEntry[]; ends: PostEntry[] }>();
  for (const r of posts.rows.filter((x) => x.type === 'government')) {
    const m = r.memberId ? getMemberById(r.memberId) : undefined;
    const person = r.memberId ?? normalizeName(r.nameBn);
    const add = (date: string, side: 'starts' | 'ends') => {
      const k = `${date}|${person}`;
      const who = nameOf(r, lang);
      const e = byDay.get(k) ?? { date, name: who.name, nameLang: who.nameLang, href: m ? `/mp/${m.slug}` : null, starts: [], ends: [] };
      e[side].push(r);
      byDay.set(k, e);
    };
    add(r.fromDate, 'starts');
    if (r.toDate) add(r.toDate, 'ends');
  }
  const label = (rows: PostEntry[]) => `${rows[0]!.title}${rows.some((r) => r.ministryBn) ? `, ${rows.map((r) => r.ministryBn).filter(Boolean).join(', ')}` : ''}`;
  /** In English: the post, and its ministries when every one of them has an English name. */
  const labelEn = (rows: PostEntry[]) => {
    const names = rows.map((r) => r.ministryBn).filter(Boolean).map((x) => inLang(x, 'en'));
    const post = govPost(rows[0]!.title, 'en');
    return names.length && names.every(Boolean) ? `${post}, ${names.join(', ')}` : post;
  };
  const textEn = (e: { starts: PostEntry[]; ends: PostEntry[] }) => {
    if (e.starts.length && e.ends.length) {
      const from = labelEn(e.ends);
      const to = labelEn(e.starts);
      return from === to ? `${to}: responsibilities changed` : `from ${from} to ${to}`;
    }
    return e.starts.length ? `${labelEn(e.starts)}: took office` : `${labelEn(e.ends)}: left office`;
  };
  return [...byDay.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((e) => ({
      date: e.date,
      name: e.name,
      nameLang: e.nameLang,
      href: e.href,
      kind: e.starts.length && e.ends.length ? 'change' : e.starts.length ? 'start' : 'end',
      text: lang === 'en'
        ? textEn(e)
        : e.starts.length && e.ends.length
          ? `${label(e.ends)} থেকে ${label(e.starts)}`
          : e.starts.length ? `${label(e.starts)}: দায়িত্ব পেলেন` : `${label(e.ends)}: দায়িত্ব শেষ`,
    }));
}
