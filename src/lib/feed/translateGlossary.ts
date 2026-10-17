/**
 * The names the translator keeps as the site spells them: every member's
 * official Bangla name with the site's English for it, and every general seat
 * ("ঢাকা-১৭" → "Dhaka-17"). Built from the site's own data, the same way the
 * feed's matcher reads a member's name, so a name the matcher finds in a
 * headline is the name kept here.
 *
 * Only the official name: a popular name the press uses instead (হাসনাত
 * আবদুল্লাহ for মোঃ আবুল হাসনাত) is left for Google, because writing the
 * official English in its place would change what the outlet wrote.
 */
import { allMembers, seats } from '@/lib/data';
import { personName, seatName } from '@/i18n/names';
import { buildFeedIndex, textTokens, type FeedMp } from './matchMp';
import type { Glossary, GlossaryEntry } from './translate';

/** Titles the English name may open with; the Bangla before the name keeps its own, which Google translates. */
const LEADING_TITLES = /^(?:(?:Md|Mohd|Dr|Prof|Engr|Adv|Mr|Mrs|Ms|Col|Lt|Maj|Brig|Gen|Capt)\.?|Mohammad|Mohammed|Muhammad|Mohammod|Advocate|Barrister|Alhaj|Alhajj|Begum|Professor|Engineer|Major|Colonel|General)\s+/i;

export function englishWithoutTitles(en: string): string {
  let s = en.trim();
  for (let i = 0; i < 4; i++) {
    const next = s.replace(LEADING_TITLES, '');
    // A name is never cut down to one word.
    if (next === s || next.split(/\s+/).length < 2) break;
    s = next;
  }
  return s;
}

let cached: Glossary | null = null;

export function siteGlossary(): Glossary {
  if (cached) return cached;
  const mps: FeedMp[] = allMembers.map((m) => ({
    id: m.id, nameBn: m.nameBn, nameEn: null, seatBn: null, seatEn: null, districtBn: null, districtEn: null,
    partyBn: null, partyAbbr: null, posts: [], ministries: [], variants: [],
  }));
  const index = buildFeedIndex(mps);
  const byKey = new Map<string, Set<string>>();
  const tokensOf = new Map<string, string[]>();
  for (const e of index.entries) {
    const name = e.names[0];
    const member = allMembers.find((m) => m.id === e.mp.id);
    const en = member ? personName(member, 'en') : '';
    if (!name || !en || /[ঀ-৿]/.test(en)) continue;
    const key = name.tokens.join(' ');
    byKey.set(key, (byKey.get(key) ?? new Set()).add(englishWithoutTitles(en)));
    tokensOf.set(key, name.tokens);
  }
  const entries: GlossaryEntry[] = [];
  // Two members written the same way in Bangla and differently in English:
  // which one a headline means is not ours to guess, so neither is kept.
  for (const [key, ens] of byKey) if (ens.size === 1) entries.push({ tokens: tokensOf.get(key)!, en: [...ens][0]!, kind: 'member' });

  for (const s of seats) {
    if (s.reserved || !s.nameBn) continue;
    const tokens = textTokens(s.nameBn);
    const en = seatName(s, 'en');
    if (tokens.length >= 2 && en && !/[ঀ-৿]/.test(en)) entries.push({ tokens, en, kind: 'seat' });
  }
  cached = { entries, nameWords: index.nameWords };
  return cached;
}
