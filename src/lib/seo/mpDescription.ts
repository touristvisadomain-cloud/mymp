/**
 * The title and description every member's page uses for search results and
 * link previews, and as the first paragraph of the page itself, in full
 * Bangla sentences built from the member's record:
 *
 *   তারেক রহমান ঢাকা-১৭ আসন থেকে নির্বাচিত ত্রয়োদশ জাতীয় সংসদের সদস্য এবং
 *   বাংলাদেশ জাতীয়তাবাদী দলের চেয়ারম্যান। এই পাতায় তাঁর পরিচিতি … রয়েছে।
 *
 * The party role and a government post come only from sourced fields
 * (partyRoleBn, ministryBn and govPost: an editor's entry or a hand-checked
 * fact in the engine); without them the sentence says only what the record
 * holds. The description is held to 160 characters by dropping items from the
 * second sentence, never by cutting the first or breaking a word.
 */
import type { Member } from '@/lib/data';
import { dateBn } from '@/lib/data';
import { makeT, type Lang } from '@/i18n/core';
import { inLang } from '@/i18n/content';
import { partyName, partyShort, personName, seatName } from '@/i18n/names';

/** The full Bangla name of each party in the database, and its genitive as a sentence needs it. */
export const PARTY_BN: Record<string, { name: string; of: string }> = {
  BNP: { name: 'বাংলাদেশ জাতীয়তাবাদী দল', of: 'বাংলাদেশ জাতীয়তাবাদী দলের' },
  BJEI: { name: 'বাংলাদেশ জামায়াতে ইসলামী', of: 'বাংলাদেশ জামায়াতে ইসলামীর' },
  NCP: { name: 'জাতীয় নাগরিক পার্টি', of: 'জাতীয় নাগরিক পার্টির' },
  BKM: { name: 'বাংলাদেশ খেলাফত মজলিস', of: 'বাংলাদেশ খেলাফত মজলিসের' },
  IMB: { name: 'ইসলামী আন্দোলন বাংলাদেশ', of: 'ইসলামী আন্দোলন বাংলাদেশের' },
  GOP: { name: 'গণঅধিকার পরিষদ', of: 'গণঅধিকার পরিষদের' },
  BJP: { name: 'বাংলাদেশ জাতীয় পার্টি', of: 'বাংলাদেশ জাতীয় পার্টির' },
  KM: { name: 'খেলাফত মজলিস', of: 'খেলাফত মজলিসের' },
  PSM: { name: 'গণসংহতি আন্দোলন', of: 'গণসংহতি আন্দোলনের' },
  JAGPA: { name: 'জাতীয় গণতান্ত্রিক পার্টি', of: 'জাতীয় গণতান্ত্রিক পার্টির' },
};
const INDEPENDENT = new Set(['Ind', 'IND']);

/** Bangla genitive for a name not in the table: -র after a vowel sound, -এর (as ের) after a consonant. */
export function genitiveBn(s: string): string {
  const last = s.slice(-1);
  if (/[া-ৌৗঅ-ঔ]/.test(last)) return `${s}র`;
  if (/[ক-হড়ঢ়য়ৎং়]/.test(last)) return `${s}ের`;
  return `${s}-এর`;
}

/** A party's full name and genitive: from the table, else the source's name without its abbreviation. */
export function partyBn(party: Member['party']): { name: string; of: string } | null {
  if (!party) return null;
  const known = PARTY_BN[party.abbr];
  if (known) return known;
  const name = (party.nameBn ?? party.nameEn ?? party.abbr)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/-[^\s-]+$/, '')
    .trim();
  return { name, of: genitiveBn(name) };
}

export const isIndependent = (m: Pick<Member, 'party'>) => !!m.party && (INDEPENDENT.has(m.party.abbr) || m.party.nameBn === 'স্বতন্ত্র');

const GOV_POST_BN: Record<string, string> = {
  minister: 'মন্ত্রী',
  'state-minister': 'প্রতিমন্ত্রী',
  'state minister': 'প্রতিমন্ত্রী',
  'deputy-minister': 'উপমন্ত্রী',
  'deputy minister': 'উপমন্ত্রী',
  মন্ত্রী: 'মন্ত্রী',
  প্রতিমন্ত্রী: 'প্রতিমন্ত্রী',
  উপমন্ত্রী: 'উপমন্ত্রী',
};

type SeoMember = Pick<Member, 'nameBn' | 'nameEn' | 'party' | 'seat' | 'resignedOn'> & {
  id?: string;
  gender?: string | null;
  partyRoleBn?: string | null;
  ministryBn?: string | null;
  govPost?: string | null;
};

/** "ঢাকা-১৭", or "সংরক্ষিত নারী আসন (মহিলা আসন-১)" for a reserved seat: the site's term, with the source's name of the seat. */
export function constituencyBn(m: SeoMember): string | null {
  if (!m.seat) return null;
  const seat = m.seat.nameBn ?? m.seat.nameEn;
  return m.seat.reserved ? `সংরক্ষিত নারী আসন (${seat})` : seat;
}

/** "Dhaka-17", or "reserved seat for women (Women's Seat-1)": the English of constituencyBn. */
export function constituencyEn(m: SeoMember): string | null {
  if (!m.seat) return null;
  const seat = seatName(m.seat, 'en');
  return m.seat.reserved ? `reserved seat for women (${seat})` : seat;
}

/* ---------------- English ---------------- */

/** The member's name in English, with the source's capitals and garbles fixed (src/i18n/names.ts). */
const nameEn = (m: SeoMember) => personName({ id: m.id, nameBn: m.nameBn, nameEn: m.nameEn }, 'en');

/** "his" / "her", from the source's gender field. */
export const possessiveEn = (gender: string | null | undefined) => (gender === 'Female' ? 'her' : gender === 'Male' ? 'his' : 'their');

/** A party's English name without the abbreviation in brackets, as a sentence needs it: "Bangladesh Nationalist Party". */
export function partyEnBare(party: Member['party']): string | null {
  if (!party) return null;
  return partyName(party, 'en').replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
}

/** "the Bangladesh Nationalist Party", but "Bangladesh Jamaat-e-Islami": English puts "the" before a name that ends in a common noun. */
export const withThe = (name: string) =>
  /\b(Party|League|Front|Federation|Forum|Council|Alliance|Opposition|Movement)$/.test(name) ? `the ${name}` : name;

const aOrAn = (word: string) => (/^[AEIOU]/i.test(word) ? 'an' : 'a');

const GOV_POST_EN: Record<string, string> = {
  minister: 'Minister',
  'state-minister': 'State Minister',
  'state minister': 'State Minister',
  'deputy-minister': 'Deputy Minister',
  'deputy minister': 'Deputy Minister',
  মন্ত্রী: 'Minister',
  প্রতিমন্ত্রী: 'State Minister',
  উপমন্ত্রী: 'Deputy Minister',
};

/** The party post in English when its translation is on file; null otherwise, and the sentence then leaves it out. */
function partyRoleEn(m: SeoMember): string | null {
  const bn = m.partyRoleBn?.trim();
  return bn ? inLang(bn, 'en')?.trim() || null : null;
}

/**
 * `{name} | ঢাকা-১৭ আসনের এমপি | আমার এমপি`
 *
 * Search Console (28 days to 21 September 2026) shows people looking a member
 * up by name and by "<seat> আসনের এমপি"; the title says both, in their words.
 * A member who has resigned keeps the plain seat name, since "এমপি" would be
 * untrue. In English: `{name} | MP for Dhaka-17 | My MP`.
 */
export function mpTitle(m: SeoMember, lang: Lang = 'bn'): string {
  if (lang === 'en') {
    const where = constituencyEn(m);
    const role = !where || m.resignedOn ? where : m.seat?.reserved ? `Member of Parliament, ${where}` : `MP for ${where}`;
    return [nameEn(m), role, 'My MP'].filter(Boolean).join(' | ');
  }
  const where = constituencyBn(m);
  const role = !where || m.resignedOn ? where : m.seat?.reserved ? `${where}ের সংসদ সদস্য` : `${where} আসনের এমপি`;
  return [m.nameBn ?? m.nameEn, role, 'আমার এমপি'].filter(Boolean).join(' | ');
}

/**
 * Sentence 1 in English: the same facts, in English order.
 *   "Forhad Hossain Azad is a member of the 13th Parliament elected from
 *    Panchagarh-2, Rural Development Affairs Secretary of the Bangladesh
 *    Nationalist Party and currently State Minister in the Ministry of Water
 *    Resources."
 * A party post or ministry with no English on file yet is left out; the post
 * itself (State Minister) is still said.
 */
function mpSentence1En(m: SeoMember): string {
  const t = makeT('en');
  const name = nameEn(m);
  const where = constituencyEn(m);
  const elected = where ? ` elected from ${m.seat?.reserved ? `a ${where}` : where}` : '';
  if (m.resignedOn) {
    return `${name} was a member of the 13th Parliament${elected} and resigned on ${t.date(m.resignedOn)}.`;
  }
  const party = isIndependent(m) ? null : partyEnBare(m.party);
  const role = party ? partyRoleEn(m) : null;
  const who = isIndependent(m) ? 'an independent member' : party && !role ? `${aOrAn(party)} ${party} member` : 'a member';
  const parts: string[] = [];
  if (party && role) {
    const names = [party, partyShort(m.party, 'en'), m.party?.abbr].filter(Boolean) as string[];
    // A post that already names its party ("Ameer, Nilphamari District, Bangladesh Jamaat-e-Islami") is not followed by the party again.
    parts.push(names.some((n) => role.includes(n)) ? role : `${role} of ${withThe(party)}`);
  }
  const post = m.govPost ? GOV_POST_EN[m.govPost.trim().toLowerCase()] ?? GOV_POST_EN[m.govPost.trim()] : undefined;
  if (m.ministryBn?.trim() && post) {
    const ministry = inLang(m.ministryBn.trim(), 'en')?.trim().replace(/^the\s+/i, '');
    parts.push(ministry ? `currently ${post} in the ${ministry}` : `currently ${aOrAn(post)} ${post}`);
  }
  const tail = parts.length === 0 ? '' : parts.length === 1 ? ` and ${parts[0]}` : `, ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${name} is ${who} of the 13th Parliament${elected}${tail}.`;
}

/** Sentence 1: who the member is, the party, and a government post when one is on record. */
export function mpSentence1(m: SeoMember, lang: Lang = 'bn'): string {
  if (lang === 'en') return mpSentence1En(m);
  const name = m.nameBn ?? m.nameEn ?? '';
  const where = constituencyBn(m);
  const from = where ? `${where}${m.seat?.reserved ? '' : ' আসন'} থেকে ` : '';
  if (m.resignedOn) {
    return `${name} ${from}নির্বাচিত ত্রয়োদশ জাতীয় সংসদের সদস্য ছিলেন এবং ${dateBn(m.resignedOn)} তারিখে পদত্যাগ করেন।`;
  }
  const parts: string[] = [];
  const party = partyBn(m.party);
  if (isIndependent(m)) parts.push('স্বতন্ত্র সংসদ সদস্য');
  else if (party) parts.push(`${party.of} ${m.partyRoleBn?.trim() || 'সংসদ সদস্য'}`);
  const post = m.govPost ? GOV_POST_BN[m.govPost.trim().toLowerCase()] ?? GOV_POST_BN[m.govPost.trim()] : undefined;
  if (m.ministryBn?.trim() && post) parts.push(`বর্তমানে ${genitiveBn(m.ministryBn.trim())} ${post}`);
  const tail = parts.length === 0 ? '' : parts.length === 1 ? ` এবং ${parts[0]}` : `, ${parts.slice(0, -1).join(', ')} এবং ${parts[parts.length - 1]}`;
  return `${name} ${from}নির্বাচিত ত্রয়োদশ জাতীয় সংসদের সদস্য${tail}।`;
}

/** Items of sentence 2 in order, and the order they are dropped in when the description is too long. */
const ITEMS = ['পরিচিতি', 'নির্বাচনী ফলাফল', 'আগের মেয়াদ', 'সংসদীয় কমিটি', 'যোগাযোগের'];
const DROP_ORDER = ['নির্বাচনী ফলাফল', 'আগের মেয়াদ', 'সংসদীয় কমিটি'];
export const DESCRIPTION_MAX = 160;

/** The same items in English, by their Bangla. */
const ITEMS_EN: Record<string, string> = {
  পরিচিতি: 'profile',
  'নির্বাচনী ফলাফল': 'election result',
  'আগের মেয়াদ': 'earlier terms',
  'সংসদীয় কমিটি': 'parliamentary committees',
  যোগাযোগের: 'contact details',
};

const sentence2 = (items: string[]) =>
  `এই পাতায় তাঁর ${items.length > 1 ? `${items.slice(0, -1).join(', ')} ও ${items[items.length - 1]}` : items[0]} তথ্য রয়েছে।`;

/** "This page gives his profile, election result, earlier terms, parliamentary committees and contact details." */
const sentence2En = (items: string[], gender: string | null | undefined) => {
  const en = items.map((i) => ITEMS_EN[i] ?? i);
  return `This page gives ${possessiveEn(gender)} ${en.length > 1 ? `${en.slice(0, -1).join(', ')} and ${en[en.length - 1]}` : en[0]}.`;
};

/**
 * Characters as a reader sees them: grapheme clusters, so a conjunct with its
 * vowel sign counts once ("ত্রয়ো" is 3, not 7). The owner's own example
 * description is 131 by this count and 204 in code points.
 */
const graphemes = new Intl.Segmenter('bn', { granularity: 'grapheme' });
export const charCount = (s: string) => [...graphemes.segment(s)].length;

/** The description: sentence 1 whole, then as much of sentence 2 as fits in 160 characters. */
export function mpDescription(m: SeoMember, lang: Lang = 'bn'): string {
  const first = mpSentence1(m, lang);
  const second = (items: string[]) => (lang === 'en' ? sentence2En(items, m.gender) : sentence2(items));
  let items = [...ITEMS];
  const fits = (s: string) => charCount(s) <= DESCRIPTION_MAX;
  let text = `${first} ${second(items)}`;
  for (const drop of DROP_ORDER) {
    if (fits(text)) break;
    items = items.filter((i) => i !== drop);
    text = `${first} ${second(items)}`;
  }
  // Sentence 1 is never cut; when even the shortest second sentence will not fit, it stands alone.
  return fits(text) ? text : first;
}
