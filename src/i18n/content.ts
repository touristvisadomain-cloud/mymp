/**
 * English for text the sources write only in Bangla: members' biographies,
 * the Election Commission's seat boundaries, professions, schools,
 * birthplaces, party posts, ministries, and the notes beside election results.
 *
 * Each translation is stored against the exact Bangla it was made from
 * (data/translations/en/*.json, "Bangla text": "English text"). When the
 * Bangla changes (an editor rewrites a biography), the old English no longer
 * matches and is not shown: an English page never shows a translation of
 * text the Bangla page no longer says. `npm run i18n:check` lists what is
 * missing.
 *
 * Server only: the files are large, and client components get the English
 * they need as props.
 */
import bios from '../../data/translations/en/bios.json';
import boundaries from '../../data/translations/en/boundaries.json';
import fields from '../../data/translations/en/fields.json';
import notes from '../../data/translations/en/notes.json';
import type { Lang } from './core';

/** The key a text is stored under: the same text whatever its spacing or Unicode form. */
export const keyOf = (s: string) => s.normalize('NFC').replace(/[‌‍]/g, '').replace(/\s+/g, ' ').trim();

const TABLE = new Map<string, string>();
for (const file of [fields, notes, boundaries, bios] as Record<string, string>[]) {
  for (const [bn, en] of Object.entries(file)) if (en) TABLE.set(keyOf(bn), en);
}

/** The English of a Bangla source text, or null when there is none yet. */
export function english(bn: string | null | undefined): string | null {
  if (!bn) return null;
  return TABLE.get(keyOf(bn)) ?? null;
}

/**
 * A source text in the page's language: the Bangla as it is, or its English.
 * Null on an English page when no translation exists, so the page can leave
 * the field out rather than show Bangla in its place.
 */
export function inLang(bn: string | null | undefined, lang: Lang): string | null {
  if (!bn) return null;
  return lang === 'en' ? english(bn) : bn;
}

/** A source text in the page's language, and whether it is a translation (English pages say so). */
export function translated(bn: string | null | undefined, lang: Lang): { text: string; translated: boolean } | null {
  if (!bn) return null;
  if (lang === 'bn') return { text: bn, translated: false };
  const en = english(bn);
  return en ? { text: en, translated: true } : null;
}
