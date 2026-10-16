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
 * An editor can also write the English in the admin (bioEn, boundaryEn,
 * educationEn...: the field's name with En for Bn). The sync puts it on the
 * record, and it wins over the file for that record's Bangla.
 *
 * Server only: the files are large, and client components get the English
 * they need as props.
 */
import bios from '../../data/translations/en/bios.json';
import boundaries from '../../data/translations/en/boundaries.json';
import fields from '../../data/translations/en/fields.json';
import notes from '../../data/translations/en/notes.json';
import type { Lang } from './core';
import { allMembers, seats, parties } from '@/lib/data';

/** The key a text is stored under: the same text whatever its spacing or Unicode form. */
export const keyOf = (s: string) => s.normalize('NFC').replace(/[‌‍]/g, '').replace(/\s+/g, ' ').trim();

const TABLE = new Map<string, string>();
for (const file of [fields, notes, boundaries, bios] as Record<string, string>[]) {
  for (const [bn, en] of Object.entries(file)) if (en) TABLE.set(keyOf(bn), en);
}

/** Editors' English (overrides saved in the admin), for the Bangla on the same record. */
const EDITED: [rows: object[], fields: string[]][] = [
  [allMembers, ['bioBn', 'summaryBn', 'educationBn', 'birthPlaceBn', 'professionBn', 'partyRoleBn', 'ministryBn']],
  [allMembers.map((m) => m.seat).filter(Boolean) as object[], ['boundaryBn']],
  [seats, ['boundaryBn']],
  [parties, ['summaryBn', 'originBn', 'founderBn', 'symbolBn', 'leaderTitleBn', 'leaderNameBn', 'secretaryTitleBn', 'secretaryNameBn', 'headquartersBn']],
];
for (const [rows, keys] of EDITED) {
  for (const row of rows as Record<string, unknown>[]) {
    for (const k of keys) {
      const bn = row[k];
      const en = row[k.replace(/Bn$/, 'En')];
      if (typeof bn === 'string' && bn && typeof en === 'string' && en.trim()) TABLE.set(keyOf(bn), en.trim());
    }
  }
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

/**
 * A record with each Bangla field's English beside it (bioBn → bioEn), from
 * the editor's override or the translation files: what the admin's editor
 * shows as the current English, so an editor corrects the text the English
 * page shows rather than starting from an empty box.
 */
export function withEnglish<R extends object>(row: R, bnKeys: string[]): R & Record<string, string | null> {
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const k of bnKeys) {
    const enKey = k.replace(/Bn$/, 'En');
    const own = out[enKey];
    if (typeof own === 'string' && own.trim()) continue;
    const bn = out[k];
    out[enKey] = typeof bn === 'string' ? english(bn) : null;
  }
  return out as R & Record<string, string | null>;
}
