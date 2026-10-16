/**
 * Cabinet members from outside parliament: the Prime Minister's advisers and
 * the technocrat ministers.
 *
 * Everyone else on the cabinet list has a member record, and their biography
 * lives there. An adviser appointed from outside parliament has none, so the
 * profile is kept here, in data/advisers.json, written from the sources it
 * cites. The posts come from the cabinet list like everyone else's; the file
 * holds only who the person is.
 */
import advisersJson from '../../data/advisers.json';
import { currentPosts, posts, type PostEntry } from './data';
import { normalizeName } from './posts/names';
import { english } from '@/i18n/content';
import { GOV_POST, titleCaseName } from '@/i18n/names';
import type { Lang } from '@/i18n/core';

export interface AdviserProfile {
  slug: string;
  /** The name exactly as the cabinet list writes it, which is how a post finds its profile. */
  postNameBn: string;
  nameBn: string;
  /** "প্রধানমন্ত্রীর উপদেষ্টা", or "পররাষ্ট্রমন্ত্রী" for a technocrat minister. */
  roleBn: string;
  rankBn: string | null;
  bioBn: string;
  professionBn: string | null;
  educationBn: string | null;
  birthPlaceBn: string | null;
  partyRoleBn: string | null;
  sources: string[];
  checkedOn: string;
}

const profiles = (advisersJson as { advisers: AdviserProfile[] }).advisers;
const byName = new Map(profiles.map((a) => [normalizeName(a.postNameBn), a]));

export const allAdvisers = () => profiles;
export const getAdviser = (slug: string) => profiles.find((a) => a.slug === slug);

/** The profile for a post held by someone outside parliament, if there is one. */
export const adviserForPost = (p: Pick<PostEntry, 'memberId' | 'nameBn'>) =>
  p.memberId ? undefined : byName.get(normalizeName(p.nameBn));

/** An adviser's current posts, with a photograph where the cabinet list carries one. */
export function adviserPosts(a: AdviserProfile) {
  const key = normalizeName(a.postNameBn);
  const rows = currentPosts('government').filter((r) => !r.memberId && normalizeName(r.nameBn) === key);
  return {
    rows,
    photoUrl: rows.find((r) => r.photoUrl)?.photoUrl ?? null,
    sourceUrl: rows.find((r) => r.sourceUrl)?.sourceUrl ?? null,
  };
}

/*
 * English for the profiles. data/advisers.json is written in Bangla only, so
 * every field goes through the translations (data/translations/en); a field
 * with no English yet is left off the English page, never shown in Bangla.
 */

/**
 * The name in the page's language, and the language it is actually in. The
 * profile has no English name of its own: the cabinet list's English (a post
 * row's nameEn) comes first, then a translation of the Bangla name. With
 * neither, the English page shows the Bangla name, marked lang="bn".
 */
export function adviserName(a: AdviserProfile, lang: Lang): { text: string; lang: Lang } {
  if (lang === 'bn') return { text: a.nameBn, lang: 'bn' };
  const key = normalizeName(a.postNameBn);
  const row = posts.rows.find((r) => r.nameEn && normalizeName(r.nameBn) === key);
  const en = titleCaseName(row?.nameEn) ?? english(a.nameBn);
  return en ? { text: en, lang: 'en' } : { text: a.nameBn, lang: 'bn' };
}

/**
 * The ranks the cabinet list and the profiles write, in English (the glossary's
 * "with the rank of a minister"). A fixed handful of words, so kept here;
 * anything else goes through the translations.
 */
const RANK_EN: Record<string, string> = {
  'মন্ত্রীর পদমর্যাদা': 'With the rank of a minister',
  'প্রতিমন্ত্রীর পদমর্যাদা': 'With the rank of a state minister',
  'মন্ত্রী পদমর্যাদা': 'With the rank of a minister',
  'প্রতিমন্ত্রী পদমর্যাদা': 'With the rank of a state minister',
  'টেকনোক্র্যাট মন্ত্রী': 'Technocrat minister',
  'টেকনোক্র্যাট প্রতিমন্ত্রী': 'Technocrat state minister',
};

/** A rank ("মন্ত্রীর পদমর্যাদা") in the page's language; null on an English page when it has no English. */
export function rankIn(bn: string | null | undefined, lang: Lang): string | null {
  if (!bn) return null;
  if (lang === 'bn') return bn;
  return RANK_EN[bn.trim()] ?? english(bn);
}

/**
 * The profile's role ("প্রধানমন্ত্রীর উপদেষ্টা", "পররাষ্ট্রমন্ত্রী") in the page's
 * language. Without an English for it, the English page names the post the
 * cabinet list gives (Minister, State Minister, Adviser), which is less
 * specific but never wrong.
 */
export function adviserRole(a: AdviserProfile, lang: Lang): string {
  if (lang === 'bn') return a.roleBn;
  const own = GOV_POST[a.roleBn.trim()] ?? english(a.roleBn);
  if (own) return own;
  const title = adviserPosts(a).rows[0]?.title;
  return (title && GOV_POST[title]) || 'Adviser';
}
