/**
 * Bilingual search for MY MP.
 *
 * A reader types Bengali or English and gets the same result. No transliteration
 * guessing is needed for names, seats or parties, because parliament.gov.bd supplies
 * both scripts for every one of them; we simply index both and fold the spellings
 * that real Bangladeshi text varies on.
 *
 * The published index ships raw names only (about 15 KB gzipped for the whole
 * country). Normalising all of it in the browser costs roughly 8 ms once on load,
 * which is half the payload of shipping precomputed keys.
 *
 * Verified against all 349 sitting members on 9 September 2026.
 */

export type EntryType = 'seat' | 'member' | 'party' | 'district' | 'division';

/**
 * One row as published in search-index.json: [type, bengali, english, url,
 * Bangla subtitle, English subtitle]. The English name is the one English
 * pages show. Indexes written before the English pages have no sixth column.
 */
export type IndexRow =
  | [EntryType, string, string, string, string]
  | [EntryType, string, string, string, string, string];

export interface Entry {
  type: EntryType;
  bn: string;
  en: string;
  url: string;
  sub: string;
  /** The subtitle in English; null when the index has none (an older index's member rows). */
  subEn: string | null;
  /** normalised match keys, built in the browser */
  keys: string[];
}

/** An older index's subtitles that are a single word, in English; anything else it wrote has no English. */
const SUB_EN: Record<string, string> = { 'আসন': 'Seat', 'সংরক্ষিত আসন': 'Reserved seat', 'দল': 'Party', 'জেলা': 'District' };

const BN_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

/** Bengali letters and marks that readers routinely swap when typing a name. */
const BN_FOLD: [RegExp, string][] = [
  [/[‌‍]/g, ''],                       // zero-width joiners: invisible, break every match
  [/ঢ়/g, 'ড়'],
  [/য়/g, 'য'],
  [/[ীি]/g, 'ি'],                                 // long and short vowels fold together
  [/[ূু]/g, 'ু'],
  [/ণ/g, 'ন'],
  [/[ষশ]/g, 'স'],
  [/ঁ/g, ''],                                     // chandrabindu
  [/মোহাম্মদ|মুহাম্মদ|মোঃ|মো\./g, 'মো'],              // "Md." is written at least four ways
  [/ঃ/g, ''],                                     // visarga, decorative in abbreviations
  [/জামায়?াত/g, 'জামাত'],                  // the party is typed both ways (the nukta is folded away above, hence optional)
  // Conjuncts are written both ways: আব্দুল and আবদুল, মাহ্‌মুদ and মাহমুদ, লুৎফর and
  // লুতফর. So the hasanta goes (after the "Md." rule, which spells মোহাম্মদ with one)
  // and khanda ta, which is ত with a hasanta, becomes ত.
  [/্/g, ''],
  [/ৎ/g, 'ত'],
  [/[।,\-–—()'"/]/g, ' '],
];

/** English spellings of the same Bangladeshi place or sound. */
const EN_FOLD: [RegExp, string][] = [
  [/\b(chittagong|chattagram)\b/g, 'chattogram'],
  [/\bbarisal\b/g, 'barishal'],
  [/\bbogra\b/g, 'bogura'],
  [/\bcomilla\b/g, 'cumilla'],
  [/\bjessore\b/g, 'jashore'],
  [/\b(maulvibazar|moulavibazar)\b/g, 'moulvibazar'],
  [/\b(laxmipur|lakhsmipur)\b/g, 'lakshmipur'],
  [/\bkhagrachhari\b/g, 'khagrachari'],
  [/\bjaipurhat\b/g, 'joypurhat'],
  [/\b(nababganj)\b/g, 'nawabganj'],
  [/\b(mohammad|muhammad|mohammed|md|mohd)\b/g, 'md'],
  [/\b(barrister|advocate|dr|prof|alhaj|alhajj|begum|engr|engineer)\b/g, ' '],
  [/ph/g, 'f'],
  [/[zj]/g, 'j'],
  [/v/g, 'b'],
  [/w/g, 'o'],
  [/kh/g, 'k'], [/gh/g, 'g'], [/th/g, 't'], [/dh/g, 'd'], [/bh/g, 'b'], [/ch/g, 'c'],
  [/([a-z])\1+/g, '$1'],                          // rahmaan -> rahman
  [/[aeiou]+/g, 'a'],                             // vowels are the least reliable part of a transliteration
];

export function normalise(raw: string): string {
  if (!raw) return '';
  let s = String(raw).normalize('NFC').toLowerCase();
  for (const [re, to] of BN_FOLD) s = s.replace(re, to);
  s = s.replace(/[০-৯]/g, (d) => BN_DIGITS[d] ?? d);
  // Apply the English rules only to Latin runs, so Bengali text is left alone.
  s = s.replace(/[a-z]+/g, (word) => {
    let w = ` ${word} `;
    for (const [re, to] of EN_FOLD) w = w.replace(re, to);
    return w.trim();
  });
  // Keep combining marks (\p{M}): Bangla vowel signs are marks, and turning them into
  // spaces split "তারেক" into "ত র ক", whose one-letter pieces match almost any name.
  return s.replace(/[^\p{L}\p{M}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Every key also gets a separator-free twin. That is what lets "বিএনপি" find the
 * official "বাংলাদেশ জাতীয়তাবাদী দল (বি.এন.পি)" and "cox's bazar" find the API's
 * own unspaced "Cox'sBazar-1".
 */
export function buildEntry(row: IndexRow): Entry {
  const [type, bn, en, url, sub] = row;
  const subEn = row.length > 5 ? row[5] || null : SUB_EN[sub] ?? null;
  // A party is also found by its abbreviation, which is its address ("bjei", "gop"):
  // the English name shown no longer carries it.
  const abbr = type === 'party' ? url.split('/').pop() ?? '' : '';
  const base = [bn, en, abbr].filter(Boolean).map(normalise).filter(Boolean);
  const compact = base.map((k) => k.replace(/ /g, '')).filter(Boolean);
  return { type, bn, en, url, sub, subEn, keys: [...new Set([...base, ...compact])] };
}

export function buildIndex(rows: IndexRow[]): Entry[] {
  return rows.map(buildEntry);
}

function score(entry: Entry, q: string, words: string[]): number {
  let best = 0;
  for (const key of entry.keys) {
    if (key === q) return 100;
    if (key.startsWith(q)) { best = Math.max(best, 80); continue; }
    // Every query word must appear, so "rahman dhaka" narrows rather than widens.
    if (words.length && words.every((w) => key.includes(w))) {
      best = Math.max(best, key.includes(q) ? 60 : 45);
    }
  }
  return best;
}

/** Edit distance between two words (Levenshtein), on the normalised letters and signs. */
function edits(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length]!;
}

/** How far a word may be from a key word and still count: one slip in a short word, two in a longer one. */
const allowed = (len: number) => (len >= 6 ? 2 : len >= 4 ? 1 : 0);

/**
 * When nothing matches as typed: every query word must be within a slip or
 * two of some word of a key ("তারিক" for "তারেক", "রহমন" for "রহমান"). Scores
 * below the exact tiers, and runs only when the exact search found nothing.
 */
function fuzzyScore(entry: Entry, words: string[]): number {
  if (!words.length || words.some((w) => [...w].length < 4)) return 0;
  let best = 0;
  for (const key of entry.keys) {
    const ks = key.split(' ');
    let sum = 0;
    let ok = true;
    for (const w of words) {
      let closest = 1;
      for (const k of ks) {
        const len = Math.max([...w].length, [...k].length);
        const d = edits(w, k);
        if (d <= allowed(len)) closest = Math.min(closest, d / len);
      }
      if (closest === 1) { ok = false; break; }
      sum += 1 - closest;
    }
    if (ok) best = Math.max(best, 20 + (sum / words.length) * 20);
  }
  return best;
}

const TYPE_RANK: Record<EntryType, number> = {
  seat: 3, member: 2, party: 1, district: 1, division: 0,
};

export function search(index: Entry[], raw: string, limit = 8): Entry[] {
  const typed = normalise(raw);
  if (!typed) return [];

  const run = (q: string) => {
    const words = q.split(' ').filter(Boolean);
    return index
      .map((e) => ({ e, s: score(e, q, words) }))
      .filter((r) => r.s > 0);
  };

  // Try as typed; if nothing lands, try the separator-free form of the query too.
  let hits = run(typed);
  if (!hits.length) hits = run(typed.replace(/ /g, ''));
  // Still nothing: a misspelling, most likely. Near misses, word by word.
  if (!hits.length) {
    const words = typed.split(' ').filter(Boolean);
    hits = index.map((e) => ({ e, s: fuzzyScore(e, words) })).filter((r) => r.s > 0);
  }

  return hits
    .sort((a, b) =>
      (b.s - a.s) ||
      (TYPE_RANK[b.e.type] - TYPE_RANK[a.e.type]) ||
      (a.e.keys[0]?.length ?? 0) - (b.e.keys[0]?.length ?? 0))
    .slice(0, limit)
    .map((r) => r.e);
}

function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * How well a query fits a short list of texts, the site search's way, as a
 * tier, so a page can show only the best ones:
 *   4  the whole query is one of the texts, past spelling ("Primie Minister"
 *      is "Prime Minister", "ict" is "ICT")
 *   3  every query word starts a word as typed ("prime", "তথ্য")
 *   2  ... once both are folded ("totto" and "Tottho")
 *   1  ... with one slipped key in a longer English word ("profhan")
 *   0  no fit
 * Only the start of a word, and an English word under five letters only as
 * typed: folded spellings are short ("zzzz" folds to "j", "rail" to "ral",
 * the start of "religious") and would match almost anything. And folding
 * makes "prime" look like "primary", which is why the tiers exist: a page
 * that shows only its best tier gives "prime" the Prime Minister alone.
 * The cabinet page uses it for names, seats, ministries, ranks and their
 * shortcuts (config/ministry-aliases.ts).
 */
export function matchTier(query: string, texts: string[]): number {
  const raw = query.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length >= 2);
  if (!raw.length) return 0;
  const whole = normalise(query);
  const wholeCompact = whole.replace(/ /g, '');
  const isShortLatin = (w: string) => /^[a-z0-9]+$/.test(w) && w.length < 5;
  if (whole && !isShortLatin(wholeCompact) || wholeCompact.length >= 2) {
    if (texts.some((t) => { const n = normalise(t); return n === whole || n.replace(/ /g, '') === wholeCompact; })) return 4;
  }
  const textWords = texts.flatMap((t) => t.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u)).filter(Boolean);
  const foldedWords = textWords.map(normalise).filter(Boolean);
  const tierOf = (w: string): number => {
    if (textWords.some((x) => x.startsWith(w))) return 3;
    if (isShortLatin(w)) return 0;
    const f = normalise(w);
    if (f.length >= 2 && foldedWords.some((x) => x.startsWith(f))) return 2;
    // One slipped key in a longer English word: "primie" for "prime",
    // "profhan" for "prodhan". Against the start of a word as long as the
    // query, or the whole word.
    if (/^[a-z]{5,}$/.test(w) && textWords.some((x) => /^[a-z]+$/.test(x) && (withinOne(w, x.slice(0, w.length)) || withinOne(w, x)))) return 1;
    return 0;
  };
  const tier = Math.min(...raw.map(tierOf));
  if (tier > 0) return tier;
  // "আই সি টি" for "আইসিটি": the whole query without spaces starts a text without spaces.
  return wholeCompact.length >= 3 && !isShortLatin(wholeCompact) && texts.some((t) => normalise(t).replace(/ /g, '').startsWith(wholeCompact)) ? 2 : 0;
}

/** Whether a query fits a short list of texts at all (matchTier above 0). */
export function foldedMatch(query: string, texts: string[]): boolean {
  return matchTier(query, texts) > 0;
}
