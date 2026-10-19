/**
 * Each district's description from Wikipedia (data/district-wiki.json, built
 * by scripts/fetch-district-wiki.ts): the article's opening, and its naming,
 * history, geography, people, economy and culture in a few sentences each,
 * with lists of places to see, rivers and notable people, in the page's
 * language, with the article's link for the credit. CC BY-SA 4.0.
 */
import wiki from '../../data/district-wiki.json';
import type { Lang } from '@/i18n/core';

export type WikiKey = 'name' | 'history' | 'geography' | 'people' | 'economy' | 'culture' | 'places' | 'rivers' | 'notable';
export interface WikiSection { key: WikiKey; title: string; text?: string; items?: string[] }
export interface DistrictWiki { text: string; url: string; title: string; sections?: WikiSection[] }

const table = wiki as unknown as Record<string, { bn?: DistrictWiki; en?: DistrictWiki }>;

/** The district's description in `lang`; null when Wikipedia had none worth showing. */
export const districtWiki = (slug: string, lang: Lang): DistrictWiki | null => table[slug]?.[lang] ?? null;

/** The site's own heading for each kind of section, the same on every district's page. */
export const WIKI_HEADINGS: Record<WikiKey, [string, string]> = {
  name: ['নামকরণ', 'The name'],
  history: ['ইতিহাস', 'History'],
  geography: ['অবস্থান ও আয়তন', 'Geography'],
  people: ['জনসংখ্যা', 'People'],
  economy: ['অর্থনীতি', 'Economy'],
  culture: ['সংস্কৃতি ও ঐতিহ্য', 'Culture and heritage'],
  places: ['দর্শনীয় স্থান', 'Places to see'],
  rivers: ['নদ-নদী', 'Rivers'],
  notable: ['উল্লেখযোগ্য ব্যক্তিত্ব', 'Notable people'],
};
