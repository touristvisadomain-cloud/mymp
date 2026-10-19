/**
 * Each district's description from Wikipedia (data/district-wiki.json, built
 * by scripts/fetch-district-wiki.ts): the article's opening, in the page's
 * language, with the article's link for the credit. CC BY-SA 4.0.
 */
import wiki from '../../data/district-wiki.json';
import type { Lang } from '@/i18n/core';

interface Lead { text: string; url: string; title: string }
const table = wiki as Record<string, { bn?: Lead; en?: Lead }>;

/** The district's description in `lang`; null when Wikipedia had none worth showing. */
export const districtWiki = (slug: string, lang: Lang): Lead | null => table[slug]?.[lang] ?? null;
