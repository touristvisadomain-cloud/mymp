/**
 * `bio:wikipedia`: education, birthplace and, where parliament.gov.bd gives
 * none, profession of sitting members, from the infobox of their own
 * Wikipedia article, for mymp.bd.
 *
 * The owner chose this source on 2026-09-11 ("A"): the news outlets on the
 * list publish no structured biodata, and Dhaka Post's election pages
 * challenge bots. Only what the infobox states is taken, as it states it:
 *
 * - the article must be the member's (see memberArticles: linked from the
 *   constituency article under their name, naming their seat), and when it
 *   gives a birth year more than ten years from parliament.gov.bd's it is
 *   set aside as someone else (a few years apart is common for one person);
 * - Bangla first; the English article only where the Bangla one has nothing
 *   for that field. Institution names stay as written; English professions
 *   are translated only through the fixed table below, anything else is
 *   dropped rather than guessed;
 * - "politician" is not a profession here (every member is one), and a
 *   profession parliament.gov.bd already records is never replaced.
 *
 * Facts the owner asked for by hand, checked against a cited article, live in
 * config/bio-manual.json and are applied over the infobox on every run.
 *
 * mymp.bd gets each value as a member override, never over one an editor
 * saved, plus `bioFromWiki` (which fields) and `bioSource` (which articles),
 * so the profile can say where each fact came from.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toLatinDigits } from '@sangsad/shared';
import type { Db } from './parliament-core';
import { pageUrl, plain, splitParams, templates, type WikiPage } from './results-wiki';
import { memberArticles } from './social-wiki';

export type BioField = 'educationBn' | 'birthPlaceBn' | 'professionBn' | 'partyRoleBn' | 'ministryBn' | 'govPost';

const EDUCATION_KEYS = ['education', 'alma_mater', 'শিক্ষা', 'শিক্ষাগত_যোগ্যতা', 'প্রাক্তন_শিক্ষার্থী', 'মাতৃশিক্ষায়তন'];
const PROFESSION_KEYS = ['profession', 'occupation', 'পেশা'];
const BIRTHPLACE_KEYS = ['birth_place', 'জন্মস্থান', 'জন্ম_স্থান'];
const BIRTHDATE_KEYS = ['birth_date', 'জন্ম_তারিখ'];

const LIST_TEMPLATES = /^(ubl|ubil|unbulleted list|unbulleted_list|plainlist|plain list|flatlist|hlist|bulleted list|bulleted_list|br separated entries)$/;

/** Replaces each list template ({{ubl|a|b}}, {{plainlist|* a * b}}) with its items, one per line. */
function expandLists(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    if (value.slice(i, i + 2) !== '{{') {
      out += value[i];
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < value.length; j++) {
      if (value.slice(j, j + 2) === '{{') {
        depth++;
        j++;
      } else if (value.slice(j, j + 2) === '}}') {
        depth--;
        j++;
        if (depth === 0) break;
      }
    }
    const body = value.slice(i + 2, j - 1);
    const [head = '', ...rest] = splitParams(body);
    if (LIST_TEMPLATES.test(head.trim().toLowerCase())) {
      out += '\n' + rest.filter((p) => !/^\s*[a-z_]+\s*=/.test(p)).join('\n') + '\n';
    } else {
      out += value.slice(i, j + 1);
    }
    i = j;
  }
  return out;
}

/** Punctuation as it should read: "ভারত।, (বর্তমান" → "ভারত (বর্তমান", "তালুক,কাউনিয়া" → "তালুক, কাউনিয়া". */
export const tidy = (s: string) =>
  s
    .replace(/।\s*(?=[,(])/g, '')
    .replace(/,\s*\(/g, ' (')
    .replace(/,(?=\S)/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/[।,;:\s]+$/, '')
    .trim();

/** An infobox value as plain items: list templates, <br>, bullets and wide gaps split; links reduced to their label. */
export function items(value: string): string[] {
  return expandLists(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\[\[[^\]]*\]\]|[^\S\n]{3,}/g, (m) => (m.startsWith('[[') ? m : '\n'))
    .split('\n')
    .map((line) =>
      tidy(plain(line.replace(/^\s*[*#]+\s*/, '')).replace(/^[,;:\s]+/, '').replace(/^(ও|এবং|and)\s+/i, '')),
    )
    .filter((line) => line && !/^(n\/a|—|-|ও)$/i.test(line));
}

const uniq = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** English professions this job may translate; anything not here is dropped, never guessed. */
const PROFESSION_BN: [RegExp, string][] = [
  [/^(businessman|businessperson|business|businesswoman|trader|merchant)$/i, 'ব্যবসায়ী'],
  [/^(industrialist)$/i, 'শিল্পপতি'],
  [/^(entrepreneur)$/i, 'উদ্যোক্তা'],
  [/^(lawyer|advocate|attorney|supreme court advocate)$/i, 'আইনজীবী'],
  [/^(barrister)$/i, 'ব্যারিস্টার'],
  [/^(physician|doctor|medical doctor|surgeon)$/i, 'চিকিৎসক'],
  [/^(engineer)$/i, 'প্রকৌশলী'],
  [/^(teacher|school teacher)$/i, 'শিক্ষক'],
  [/^(professor|university professor)$/i, 'অধ্যাপক'],
  [/^(academic|educationist|educator)$/i, 'শিক্ষাবিদ'],
  [/^(journalist)$/i, 'সাংবাদিক'],
  [/^(farmer|agriculturist)$/i, 'কৃষিজীবী'],
  [/^(army officer|military officer|soldier)$/i, 'সামরিক কর্মকর্তা'],
  [/^(civil servant|bureaucrat|government official)$/i, 'সরকারি কর্মকর্তা'],
  [/^(economist)$/i, 'অর্থনীতিবিদ'],
  [/^(banker)$/i, 'ব্যাংকার'],
  [/^(writer|author)$/i, 'লেখক'],
  [/^(social worker)$/i, 'সমাজকর্মী'],
  [/^(islamic scholar|cleric|scholar of islam|alim)$/i, 'আলেম'],
  [/^(accountant|chartered accountant)$/i, 'হিসাববিদ'],
];

/** Offices and politics are not professions here: every member holds a seat. */
const POLITICIAN = /^(politician|political activist|member of parliament|mp|minister|রাজনীতিবিদ|রাজনীতিক|রাজনীতি|রাজনৈতিক কর্মী|সংসদ সদস্য|সাংসদ|এমপি|মন্ত্রী)$/i;

/** Profession items from one article, in Bangla, without "politician". */
export function professions(value: string, lang: 'bn' | 'en'): string[] {
  const parts = items(value)
    .flatMap((x) => x.split(/\s*[,،;/]\s*|\s+(?:ও|এবং|and)\s+/i))
    .map((x) => x.replace(/^[\s:–-]+|[\s:–-]+$/g, '').replace(/:.*$/, '').trim())
    .filter((x) => x && !POLITICIAN.test(x));
  if (lang === 'bn') return uniq(parts.filter((x) => x.length <= 30 && !/[A-Za-z]/.test(x)));
  return uniq(parts.map((x) => PROFESSION_BN.find(([re]) => re.test(x))?.[1]).filter(Boolean) as string[]);
}

/** A four-digit birth year from an infobox birth date, if it gives one. */
export function birthYear(value: string | undefined): number | null {
  if (!value) return null;
  const years = [...toLatinDigits(value).matchAll(/(?<!\d)(19[0-9]{2}|20[01][0-9])(?!\d)/g)].map((m) => Number(m[1]));
  return years.length ? years[0]! : null;
}

function infobox(wikitext: string): Record<string, string> | null {
  const t = templates(wikitext).find((x) => /^(infobox|তথ্যছক)/.test(x.name));
  if (!t) return null;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.params)) params[k.trim().toLowerCase().replace(/\s+/g, '_')] = v;
  return params;
}
/** The first of these parameters with a value; a value that is only a template ({{birth date|…}}) counts, a lone reference does not. */
const first = (p: Record<string, string>, keys: string[]) =>
  keys.map((k) => p[k]).find((v) => v && v.replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<!--[\s\S]*?-->/gi, '').trim());

export interface Bio {
  educationBn?: string;
  birthPlaceBn?: string;
  professionBn?: string;
  /** Only from config/bio-manual.json: a party office ("চেয়ারম্যান") and a government post, each checked against its source. */
  partyRoleBn?: string;
  ministryBn?: string;
  govPost?: string;
  from: Partial<Record<BioField, 'bn' | 'en'>>;
  sources: string[];
  setAside?: string;
}

/** What one member's articles say, Bangla first; null when neither says anything usable. */
export function bioFrom(reads: { page: WikiPage; host: string }[], officialDob: string | null, officialProfession: string | null): Bio {
  const bio: Bio = { from: {}, sources: [] };
  const officialYear = officialDob ? Number(String(officialDob).slice(0, 4)) : null;
  const used = new Set<string>();
  for (const { page, host } of reads) {
    const lang = host.startsWith('bn.') ? 'bn' : 'en';
    const p = infobox(page.wikitext);
    if (!p) continue;
    const year = birthYear(first(p, BIRTHDATE_KEYS));
    if (officialYear && year && Math.abs(year - officialYear) > 10) {
      bio.setAside = `${page.title}: birth year ${year}, parliament.gov.bd ${officialYear}`;
      continue;
    }
    const url = pageUrl(host, page.title);
    const edu = first(p, EDUCATION_KEYS) ? uniq(EDUCATION_KEYS.flatMap((k) => (p[k] ? items(p[k]!) : []))) : [];
    if (!bio.educationBn && edu.length) {
      bio.educationBn = edu.slice(0, 5).join('; ');
      bio.from.educationBn = lang;
      used.add(url);
    }
    const place = first(p, BIRTHPLACE_KEYS);
    const placeText = place ? tidy(items(place).join(', ')) : '';
    if (!bio.birthPlaceBn && placeText && placeText.length <= 140) {
      bio.birthPlaceBn = placeText;
      bio.from.birthPlaceBn = lang;
      used.add(url);
    }
    const job = first(p, PROFESSION_KEYS);
    const jobs = job ? uniq(PROFESSION_KEYS.flatMap((k) => (p[k] ? professions(p[k]!, lang) : []))) : [];
    if (!officialProfession && !bio.professionBn && jobs.length) {
      bio.professionBn = jobs.slice(0, 3).join(', ');
      bio.from.professionBn = lang;
      used.add(url);
    }
  }
  bio.sources = [...used];
  return bio;
}

const FIELDS: BioField[] = ['educationBn', 'birthPlaceBn', 'professionBn', 'partyRoleBn', 'ministryBn', 'govPost'];
/** The fields the profile's table marks as read from Wikipedia. */
const TABLE_FIELDS: BioField[] = ['educationBn', 'birthPlaceBn', 'professionBn'];

/** Hand-checked facts by member id: fields to set and the article they were checked against. */
type Manual = Partial<Record<BioField, string>> & { source: string };
function manualFacts(): Map<string, Manual> {
  const file = resolve(import.meta.dirname, '../../../config/bio-manual.json');
  const json = JSON.parse(readFileSync(file, 'utf8')) as { members: Record<string, Manual> };
  return new Map(Object.entries(json.members));
}

/** Applies a hand-checked entry over what the infobox gave: its fields win, and its article joins the sources. */
export function withManual(bio: Bio, manual: Manual | undefined): Bio {
  if (!manual) return bio;
  const out: Bio = { ...bio, from: { ...bio.from }, sources: [...bio.sources] };
  for (const k of FIELDS) {
    if (!manual[k]) continue;
    out[k] = manual[k];
    out.from[k] = manual.source.includes('//bn.') ? 'bn' : 'en';
  }
  if (!out.sources.includes(manual.source)) out.sources.unshift(manual.source);
  return out;
}

export async function runBioWiki(db: Db): Promise<{ itemsFound: number; itemsNew: number }> {
  const { sitting, reads } = await memberArticles(db);
  const manual = manualFacts();
  const found: ({ id: string; seat: string; name: string } & Bio)[] = [];
  for (const m of sitting) {
    const bio = withManual(bioFrom(reads.get(m.id!) ?? [], m.dateOfBirth ? String(m.dateOfBirth) : null, m.professionBn), manual.get(m.id!));
    if (bio.sources.length || bio.setAside) found.push({ id: m.id!, seat: m.seatBn, name: m.nameBn ?? m.nameEn ?? m.id!, ...bio });
  }

  const day = new Date().toISOString().slice(0, 10);
  const count = (f: BioField, lang?: 'bn' | 'en') => found.filter((x) => x[f] && (!lang || x.from[f] === lang)).length;
  const summary = {
    members: sitting.length,
    withArticle: [...reads.values()].filter((r) => r.length).length,
    education: count('educationBn'),
    educationFromEnglish: count('educationBn', 'en'),
    birthPlace: count('birthPlaceBn'),
    birthPlaceFromEnglish: count('birthPlaceBn', 'en'),
    professionWhereParliamentHasNone: count('professionBn'),
    setAsideForBirthYear: found.filter((x) => x.setAside).length,
  };
  const report = resolve(import.meta.dirname, `../../../docs/reports/bio-wikipedia-${day}.json`);
  writeFileSync(report, JSON.stringify({ generatedAt: new Date().toISOString(), ...summary, items: found }, null, 1));
  process.stdout.write(`  bio: ${JSON.stringify(summary)}; report ${report}\n`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    process.stdout.write('  not written to mymp.bd (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)\n');
    return { itemsFound: sitting.length, itemsNew: 0 };
  }
  const mymp = createClient(url, key, { auth: { persistSession: false } });
  const all = [...FIELDS, 'bioFromWiki', 'bioSource'];
  // A page at a time: one request returns at most 1000 rows, and a missed row is an edit overwritten.
  const existing: { entity_id: string; field: string; value: string | null; updated_by: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await mymp.from('overrides').select('entity_id,field,value,updated_by')
      .eq('entity_type', 'member').in('field', all).order('entity_id').order('field').range(from, from + 999);
    if (error) throw new Error(`mymp overrides read: ${error.message}`);
    existing.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  // A row is this job's only while the member's bioFromWiki still lists the field. A biography written
  // by a script or an editor drops the field from that list, and leaves updated_by empty when no
  // signed-in editor saved it: such a row is an edit, and is neither overwritten nor removed.
  const wikiListed = new Map(existing.filter((r) => r.field === 'bioFromWiki').map((r) => [r.entity_id, new Set((r.value ?? '').split(',').map((x) => x.trim()))]));
  const isOurs = (r: (typeof existing)[number]) =>
    !r.updated_by && ((FIELDS as readonly string[]).includes(r.field) ? !!wikiListed.get(r.entity_id)?.has(r.field) : true);
  const edited = new Set(existing.filter((r) => !isOurs(r)).map((r) => `${r.entity_id}|${r.field}`));
  const ours = new Set(existing.filter(isOurs).map((r) => `${r.entity_id}|${r.field}`));
  const now = new Date().toISOString();
  const upserts: { entity_type: string; entity_id: string; field: string; value: string; updated_by: null; updated_at: string }[] = [];
  const keep = new Set<string>();
  for (const f of found) {
    const fields = FIELDS.filter((k) => f[k] && !edited.has(`${f.id}|${k}`));
    if (!fields.length) continue;
    for (const k of fields) {
      upserts.push({ entity_type: 'member', entity_id: f.id, field: k, value: f[k]!, updated_by: null, updated_at: now });
      keep.add(`${f.id}|${k}`);
    }
    for (const [k, v] of [['bioFromWiki', fields.filter((x) => TABLE_FIELDS.includes(x)).join(',')], ['bioSource', f.sources.join(' ')]] as const) {
      if (edited.has(`${f.id}|${k}`)) continue;
      upserts.push({ entity_type: 'member', entity_id: f.id, field: k, value: v, updated_by: null, updated_at: now });
      keep.add(`${f.id}|${k}`);
    }
  }
  for (let i = 0; i < upserts.length; i += 200) {
    const { error: upsertError } = await mymp.from('overrides').upsert(upserts.slice(i, i + 200), { onConflict: 'entity_type,entity_id,field' });
    if (upsertError) throw new Error(`mymp overrides upsert: ${upsertError.message}`);
  }
  // This job's own earlier rows that no longer hold (the article changed, or parliament now records a profession).
  const stale = [...ours].filter((k) => !keep.has(k));
  for (const k of stale) {
    const [id, field] = k.split('|');
    await mymp.from('overrides').delete().match({ entity_type: 'member', entity_id: id, field }).is('updated_by', null);
  }
  process.stdout.write(`  mymp.bd: ${upserts.length} override rows written, ${stale.length} stale rows of this job removed; publish from the admin to show them\n`);
  return { itemsFound: sitting.length, itemsNew: found.filter((f) => f.sources.length).length };
}
