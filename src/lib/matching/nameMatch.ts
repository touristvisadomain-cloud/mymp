/**
 * Deciding whether two Bangla names are the same person.
 *
 * The cabinet list and the parliament member list write one person in
 * different ways, so the posts sync has to compare names. The old scorer put
 * an edit distance over the whole string, which let the last word carry the
 * score: "ড. খলিলুর রহমান" came out as 75% of "মুহাম্মাদ আজীজুর রহমান", and
 * "মোঃ আমিনুল হক" as 89% of "মোঃ মমিনুল হক". রহমান, ইসলাম, হক, খান, আহমেদ and
 * উদ্দিন end a large share of the 349 members' names; sharing one says almost
 * nothing about who a person is, and a number like 89% reads as a confidence
 * this matcher has not earned.
 *
 * What is compared now is tokens, with honorifics, ranks and initial clusters
 * removed, each weighted by how rare it is among members (inverse document
 * frequency, built at build time into data/name-idf.json). A suggestion must
 * additionally clear three gates that a shared surname alone can never pass:
 *
 *   1. the first token must match (0.9), so a different given name ends it;
 *   2. at least two tokens must match;
 *   3. the weighted score must reach 0.92.
 *
 * Nothing here reads site data, so the sync, the admin and the tests share it.
 */

/** Spelling folds: the same sound written two ways compares as one. */
export function foldBangla(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[​-‍﻿]/g, '') // zero-width joiners and spaces
    .replace(/্/g, '') // hasanta: আব্দুল and আবদুল
    .replace(/়/g, '') // nukta: য় (NFC keeps it as য + ়) and য
    .replace(/ী/g, 'ি')
    .replace(/ূ/g, 'ু')
    .replace(/ণ/g, 'ন')
    .replace(/[ষশ]/g, 'স')
    .replace(/ৎ/g, 'ত')
    .replace(/ঁ/g, '') // chandrabindu
    .toLowerCase();
}

/** Titles, honorifics and ranks: how a name is written, not whose it is. */
export const HONORIFICS = new Set(
  [
    'মো', 'মোহাম্মদ', 'মোহাম্মাদ', 'মুহাম্মদ', 'মুহাম্মাদ', 'মুহম্মদ', 'মোহম্মদ', 'মোহাম্মেদ',
    'ডা', 'ডাক্তার', 'ড', 'ডক্টর', 'ব্যারিস্টার', 'ব্যারিষ্টার', 'অ্যাডভোকেট', 'এডভোকেট', 'অ্যাড',
    // The women's forms: "মোছাঃ", "মোসাম্মৎ", "মিসেস" are written before a name, never by the press.
    'মোছা', 'মোসা', 'মোছাম্মত', 'মোছাম্মাত', 'মোসাম্মত', 'মোসাম্মাত', 'মিসেস',
    'জনাব', 'বেগম', 'আলহাজ্ব', 'আলহাজ', 'আলহাজ্জ', 'অধ্যাপক', 'প্রফেসর', 'প্রকৌশলী', 'ইঞ্জিনিয়ার', 'মাননীয়',
    'ব্রিগেডিয়ার', 'জেনারেল', 'মেজর', 'কর্নেল', 'লে', 'লেফটেন্যান্ট', 'ক্যাপ্টেন', 'কমোডর', 'অ্যাডমিরাল', 'অব', 'অবঃ', 'অবসরপ্রাপ্ত',
  ].map(foldBangla),
);

/**
 * Letters read out as initials. "এ কে এম শামছুল ইসলাম" and
 * "এ টি এম আজহারুল ইসলাম" are two people, and their initials are the part
 * most often dropped or added by whoever typed the list, so scoring starts at
 * the first real name. The tokens stay in normalizeName, which keys aliases.
 */
export const INITIALS = new Set(
  ['এ', 'বি', 'সি', 'ডি', 'ই', 'এফ', 'জি', 'এইচ', 'আই', 'জে', 'কে', 'এল', 'এম', 'এন', 'ও', 'পি', 'কিউ', 'আর', 'এস', 'টি', 'ইউ', 'ভি', 'ডব্লিউ', 'ডব্লু', 'এক্স', 'ওয়াই', 'জেড']
    .map(foldBangla),
);

/** Gallantry titles written after some names. */
const GALLANTRY = /বীর\s*(উত্তম|বিক্রম|প্রতীক|শ্রেষ্ঠ)/g;

/**
 * The words of a name that say who it is. Parenthesised notes, gallantry
 * titles, honorifics and initials go; hyphens, dots, commas and the visarga of
 * "মোঃ" all separate words, so হারুন-অর-রশিদ is three tokens.
 */
export function nameTokens(raw: string): string[] {
  const tokens = foldBangla(
    raw
      .normalize('NFC')
      .replace(/\([^)]*\)/g, ' ') // (অব:), (নিজান)
      .replace(GALLANTRY, ' '),
  )
    .replace(/[ঃ.,:;'"‘’“”\-–—/|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !HONORIFICS.has(t));

  const named = tokens.filter((t) => !INITIALS.has(t));
  // A name that is nothing but initials keeps them; it is all it has.
  return named.length ? named : tokens;
}

/** 1 for the same word, 0 for nothing alike: 1 minus the edit distance over the longer length. */
export function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const x = [...a];
  const y = [...b];
  if (!x.length || !y.length) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[y.length]! / Math.max(x.length, y.length);
}

/** How many of the members' names carry each token. Built from the MP list. */
export interface IdfTable {
  /** How many names the table was built from. */
  names: number;
  /** token → how many of those names contain it. */
  df: Record<string, number>;
  builtAt?: string;
}

export function buildIdf(names: string[]): IdfTable {
  const df: Record<string, number> = {};
  for (const name of names) {
    for (const t of new Set(nameTokens(name))) df[t] = (df[t] ?? 0) + 1;
  }
  return { names: names.length, df };
}

/**
 * What one token is worth. A token no member carries is worth the most: it is
 * either a rare name or a misreading, and either way it is not evidence of a
 * match. A token half the House shares is worth almost nothing.
 */
export function idfWeight(table: IdfTable | null | undefined, token: string): number {
  const n = table?.names ?? 0;
  if (!n) return 1;
  const df = table!.df[token] ?? 0;
  return Math.max(0.05, Math.log((n + 1) / (df + 1)));
}

/** A token counts as the same word at this similarity. */
export const TOKEN_MATCH = 0.9;
/** The first token of both names has to match at least this well. */
export const FIRST_TOKEN_MIN = 0.9;
/** Fewer matching tokens than this is a coincidence, not a person. */
export const MIN_MATCHED_TOKENS = 2;
/** The weighted score a suggestion has to reach. */
export const SUGGEST_THRESHOLD = 0.92;

export interface NameScore {
  /** Weighted overlap, 0 to 1. */
  score: number;
  /** How well the two first tokens match. */
  first: number;
  /** How many tokens matched. */
  matched: number;
  /** True when all three gates are clear. */
  ok: boolean;
}

const NO_MATCH: NameScore = { score: 0, first: 0, matched: 0, ok: false };

/** Scores two names against each other, and says whether it is worth showing. */
export function compareNames(a: string, b: string, idf?: IdfTable | null): NameScore {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (!A.length || !B.length) return NO_MATCH;

  const w = (t: string) => idfWeight(idf, t);
  const used = new Set<number>();
  let matched = 0;
  let overlap = 0;
  for (const ta of A) {
    let bestJ = -1;
    let bestS = 0;
    B.forEach((tb, j) => {
      if (used.has(j)) return;
      const s = tokenSimilarity(ta, tb);
      if (s > bestS) { bestS = s; bestJ = j; }
    });
    if (bestJ >= 0 && bestS >= TOKEN_MATCH) {
      used.add(bestJ);
      matched++;
      overlap += bestS * (w(ta) + w(B[bestJ]!));
    }
  }
  const total = A.reduce((s, t) => s + w(t), 0) + B.reduce((s, t) => s + w(t), 0);
  const score = total > 0 ? Math.min(1, overlap / total) : 0;
  const first = tokenSimilarity(A[0]!, B[0]!);
  return {
    score,
    first,
    matched,
    ok: score >= SUGGEST_THRESHOLD && first >= FIRST_TOKEN_MIN && matched >= MIN_MATCHED_TOKENS,
  };
}

/**
 * What to tell an editor. A percentage invites arithmetic the matcher cannot
 * back, so a suggestion says how sure it is in words.
 */
export function matchStrength(score: number): 'সম্ভাব্য' | 'দুর্বল মিল' {
  return score >= 0.96 ? 'সম্ভাব্য' : 'দুর্বল মিল';
}

export interface RankedMatch {
  id: string;
  nameBn: string;
  score: number;
  strength: ReturnType<typeof matchStrength>;
}

/**
 * The members worth showing beside a listed name, best first. Only matches
 * that clear every gate are returned, so an empty list is the honest answer
 * and never a weak guess.
 */
export function rankMatches(
  source: string,
  people: { id: string; nameBn: string | null }[],
  idf?: IdfTable | null,
  limit = 3,
): RankedMatch[] {
  return people
    .map((p) => ({ p, s: compareNames(source, p.nameBn ?? '', idf) }))
    .filter(({ s }) => s.ok)
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, limit)
    .map(({ p, s }) => ({
      id: p.id,
      nameBn: p.nameBn ?? '',
      score: Math.round(s.score * 100) / 100,
      strength: matchStrength(s.score),
    }));
}
