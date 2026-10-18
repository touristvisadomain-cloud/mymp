/**
 * The cabinet as the home page's search box needs it: who holds which post,
 * and the words people type for the post ("ICT", "তথ্য", "Prime Minister",
 * "prodhan montri"). The site's index knows members by name only, so without
 * this "ICT" found nothing on the home page though the cabinet page found the
 * minister. Small: one row a person, sent with the home page.
 */
import { currentPosts, getMemberById, partyColor } from '@/lib/data';
import { normalizeName } from '@/lib/posts/names';
import { ministryAliases, rankAliases } from '../../config/ministry-aliases';
import { adviserForPost } from '@/lib/advisers';
import { nameOf } from '@/lib/cabinet';
import { inLang } from '@/i18n/content';
import { govPost } from '@/i18n/names';
import type { Lang } from '@/i18n/core';

export interface CabinetRow {
  /** The person's name in the page's language. */
  name: string;
  /** Their page: a member's profile, or an adviser's own. */
  url: string;
  /** "মন্ত্রী · ডাক, টেলিযোগাযোগ ও তথ্যপ্রযুক্তি মন্ত্রণালয়", in the page's language. */
  post: string;
  /** The party colour of a member, a dot before the name. */
  color?: string;
  /** What the query is matched against: the rank and the ministries, each with what people call it. Never the name, which the index has. */
  texts: string[];
}

export function cabinetSearchRows(lang: Lang): CabinetRow[] {
  const people = new Map<string, CabinetRow & { ministries: string[] }>();
  for (const r of currentPosts('government')) {
    const m = r.memberId ? getMemberById(r.memberId) : undefined;
    const adviser = adviserForPost(r);
    const url = m ? `/mp/${m.slug}` : adviser ? `/ministers/${adviser.slug}` : null;
    if (!url) continue;
    const key = `${r.title}|${r.memberId ?? normalizeName(r.nameBn)}`;
    let p = people.get(key);
    if (!p) {
      p = {
        name: nameOf(r, lang).name,
        url,
        post: '',
        color: m?.party ? partyColor(m.party.abbr) : undefined,
        texts: [r.title, govPost(r.title, 'en'), ...rankAliases(r.title)],
        ministries: [],
      };
      people.set(key, p);
    }
    if (r.ministryBn) {
      const name = inLang(r.ministryBn, lang) ?? r.ministryBn;
      p.ministries.push(name);
      p.texts.push(r.ministryBn, inLang(r.ministryBn, 'en') ?? '', ...ministryAliases(r.ministryBn));
    }
    p.post = [lang === 'en' ? govPost(r.title, 'en') : r.title, p.ministries.join(', ')].filter(Boolean).join(' · ');
  }
  return [...people.values()].map((p) => ({ name: p.name, url: p.url, post: p.post, color: p.color, texts: [...new Set(p.texts.filter(Boolean))] }));
}
