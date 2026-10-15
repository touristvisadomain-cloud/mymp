/**
 * Which members a headline is about.
 *
 * The rule that matters: a shared surname is not a mention. রহমান, ইসলাম and
 * হক end dozens of the 349 names, so a name only counts when every word of a
 * stored variant appears together, in order, with at least two words in it.
 * That is the same first-token rule the cabinet matcher uses, applied to
 * running text instead of to a list entry.
 *
 * Everything else is context, and context alone is never enough to name a
 * person: a seat, a district, a party or an office title adds to a name, or
 * leaves the item below the floor.
 *
 *   name variant in the headline        60
 *   name variant in the summary only    35
 *   the member's own seat               25
 *   the member's own district           10
 *   the member's own party               5
 *   an office title the member holds    30
 *   a namesake's job or place          −30  (cricketer, actor, foreign PM…)
 *
 * 60 and over attaches. 40 to 59 attaches and waits for a reviewer. Below 40
 * is dropped. When one member is named and another only picked up context
 * points on the same item, the second is dropped: an article that says
 * "প্রধানমন্ত্রী" while naming somebody else is not about the Prime Minister.
 * An office followed by কার্যালয় or দপ্তর is the institution, not the person:
 * a copper theft at প্রধানমন্ত্রীর কার্যালয় is not the Prime Minister's news.
 */
import { foldBangla, nameTokens, HONORIFICS, INITIALS } from '@/lib/matching/nameMatch';
import { SPELLING_FOLD, CASE_SUFFIXES, NEGATIVE_CONTEXT, NAMESAKE_TITLES, POST_WORDS } from '../../../config/feed-matching';

export const AUTO_SCORE = 60;
export const REVIEW_SCORE = 40;

export const POINTS = {
  nameInTitle: 60,
  nameInSummary: 35,
  seat: 25,
  district: 10,
  party: 5,
  post: 30,
  soleOffice: 30,
  negative: -30,
} as const;

export interface FeedMp {
  id: string;
  nameBn: string | null;
  nameEn: string | null;
  /** "ঠাকুরগাঁও-৩" */
  seatBn: string | null;
  seatEn: string | null;
  districtBn: string | null;
  districtEn: string | null;
  partyBn: string | null;
  partyAbbr: string | null;
  /** Office titles the member holds now: প্রধানমন্ত্রী, স্পিকার, চিফ হুইপ… */
  posts: string[];
  /** A national party office as headlines write it: "জামায়াত আমির", "বিএনপি চেয়ারম্যান". */
  partyOffices?: string[];
  /** The ministries they hold, as the cabinet list writes them. */
  ministries: string[];
  /** Extra spellings from mp_name_variants; the official name is added here. */
  variants: { variant: string; weight: number }[];
}

export interface Signal { signal: string; points: number; detail?: string }

export interface MpMatch {
  mpId: string;
  score: number;
  lowConfidence: boolean;
  named: boolean;
  /** The spelling that matched, so two members with one name can be told apart. */
  nameLabel: string | null;
  signals: Signal[];
}

/** One comparable word: folded, and with surname spellings brought together. */
export function feedToken(raw: string): string {
  const t = foldBangla(raw);
  return SPELLING_FOLD[t] ?? t;
}

/** The words of a piece of running text, in order, ready to compare. */
export function textTokens(raw: string): string[] {
  return foldBangla(raw)
    // Marks are kept: Bangla vowel signs are part of the word. Everything else,
    // the hyphen of ঠাকুরগাঁও-৩ included, separates words.
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => SPELLING_FOLD[t] ?? t);
}

/**
 * The words of running text, with where a sentence break falls: after word i
 * when breaks[i] is true. A comma, colon, bar or দাঁড়ি ends one name and lets
 * the next begin; a hyphen does not ("আল-হুথি" is one name running on).
 */
export function textTokensWithBreaks(raw: string): { tokens: string[]; breaks: boolean[] } {
  const tokens: string[] = [];
  const breaks: boolean[] = [];
  for (const chunk of foldBangla(raw).split(/[,;:|।!?"“”‘’()\[\]{}]+/u)) {
    const words = textTokens(chunk);
    if (!words.length) continue;
    if (breaks.length) breaks[breaks.length - 1] = true;
    for (const w of words) {
      tokens.push(w);
      breaks.push(false);
    }
  }
  return { tokens, breaks };
}

/**
 * Words that carry a name on into a longer one, as in Arabic names: "আব্দুল
 * মালিক আল-হুথি" is not the member আব্দুল মালিক.
 */
/** Words a summary may open with before the member's name: "জাতীয় সংসদের স্পিকার …", "বিএনপি চেয়ারম্যান …". */
const SUBJECT_LEAD_WORDS = new Set(['জাতীয়', 'সংসদের', 'সংসদ', 'সদস্য', 'আসনের', 'মাননীয়', 'চেয়ারম্যান', 'মহাসচিব', 'আমির', 'আমীর', 'সভাপতি', 'সাধারণ', 'সম্পাদক', 'নেতা', 'দলের', 'সরকারের', 'বাংলাদেশের', 'বর্তমান', 'ও', 'এবং']);

/** The verbs that make the name just before them the one speaking or acting. */
const SPEECH_WORDS = new Set(['বলেছেন', 'বলেন', 'বললেন', 'বলেছে', 'জানিয়েছেন', 'জানান', 'জানালেন', 'মন্তব্য', 'আহ্বান', 'দাবি', 'অভিযোগ', 'নির্দেশ', 'নির্দেশনা', 'উদ্বোধন', 'said', 'says']);

const NAME_PARTICLES = new Set(['আল', 'এল', 'বিন', 'ইবনে', 'ইবন', 'al', 'el', 'bin', 'ibn', 'ben', 'abu']);

/** The words of a name: honorifics, initials and gallantry titles are not part of it. */
export function variantTokens(raw: string): string[] {
  return nameTokens(raw).map((t) => SPELLING_FOLD[t] ?? t);
}

const SUFFIXES = new Set(CASE_SUFFIXES.map((s) => foldBangla(s)));

/** The last word of a name may carry a case ending: খানের, রহমানকে, আহমদও. */
function wordEq(inText: string, inName: string, last: boolean): boolean {
  if (inText === inName) return true;
  if (!last || !inText.startsWith(inName)) return false;
  const tail = inText.slice(inName.length);
  return SUFFIXES.has(tail);
}

/** Where a name's words appear together, in order. */
function findRun(tokens: string[], name: string[]): number {
  if (name.length < 2) return -1; // one word is never a mention
  for (let i = 0; i + name.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < name.length; j++) {
      if (!wordEq(tokens[i + j]!, name[j]!, j === name.length - 1)) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

/** A phrase split once, at index time, so a match does not re-split it per item. */
function phraseTokens(phrase: string | null | undefined): string[] {
  if (!phrase) return [];
  return textTokens(phrase).filter((t) => !HONORIFICS.has(t) && !INITIALS.has(t));
}

/** Does this phrase (a seat, a party, an office) appear as whole words? */
function hasTokens(tokens: string[], p: string[]): boolean {
  if (!p.length) return false;
  if (p.length === 1) return tokens.some((t) => wordEq(t, p[0]!, true));
  return findRun(tokens, p) >= 0;
}

/** The words that mean a namesake, split once for the whole process. */
const NEGATIVE_TOKENS = NEGATIVE_CONTEXT.map((word) => ({ word, tokens: phraseTokens(word) }));
const NAMESAKE_TITLE_TOKENS = NAMESAKE_TITLES.map((word) => phraseTokens(word)).filter((t) => t.length);

export interface FeedIndexEntry {
  mp: FeedMp;
  names: { tokens: string[]; weight: number; label: string }[];
  /** Seat, district, party and office, split once instead of once per headline. */
  phrases: {
    seat: string[][];
    district: string[][];
    party: string[][];
    posts: { word: string; tokens: string[] }[];
    ministries: { word: string; tokens: string[] }[];
  };
  /**
   * Every word that could give this member a point. A headline containing none
   * of them cannot score above zero, so the member is not examined at all —
   * which is what makes a run over five thousand sitemap headlines finish
   * inside a serverless minute.
   */
  triggers: Set<string>;
}

export interface FeedIndex {
  entries: FeedIndexEntry[];
  /** Which members a word could possibly name, for the prefilter above. */
  byTrigger: Map<string, FeedIndexEntry[]>;
  /**
   * Every word that appears in some member's name. A match with one of these
   * immediately in front of it is part of a longer name, so
   * "মনোয়ার হোসেন চৌধুরী" is not a mention of "আলতাফ হোসেন চৌধুরী".
   */
  nameWords: Set<string>;
  /**
   * Offices exactly one member holds (প্রধানমন্ত্রী, স্পিকার, চিফ হুইপ, জামায়াত
   * আমির). A headline that calls someone by one of these and leaves the name
   * out ("…উদ্যোগ নেওয়া হবে: প্রধানমন্ত্রী") is about that member.
   */
  soleOffices: Set<string>;
}

export function buildFeedIndex(mps: FeedMp[]): FeedIndex {
  const entries = mps.map((mp) => {
    const seen = new Set<string>();
    const names: FeedIndexEntry['names'] = [];
    const add = (raw: string | null | undefined, weight: number) => {
      if (!raw) return;
      const tokens = variantTokens(raw);
      if (tokens.length < 2) return; // a single word names nobody
      const key = tokens.join(' ');
      if (seen.has(key)) return;
      seen.add(key);
      names.push({ tokens, weight, label: key });
    };
    add(mp.nameBn, 1);
    add(mp.nameEn, 1);
    for (const v of mp.variants) add(v.variant, v.weight);

    const some = (raw: string | null | undefined) => {
      const t = phraseTokens(raw);
      return t.length ? [t] : [];
    };
    const phrases = {
      seat: [...some(mp.seatBn), ...some(mp.seatEn)],
      district: [...some(mp.districtBn), ...some(mp.districtEn)],
      party: [...some(mp.partyBn), ...some(mp.partyAbbr)],
      posts: [
        ...POST_WORDS.filter((w) => mp.posts.some((post) => w.matches(post, null))).map((w) => w.word),
        ...(mp.partyOffices ?? []),
      ].map((word) => ({ word, tokens: phraseTokens(word) })),
      ministries: mp.ministries
        .map((m) => ministryWord(m))
        .filter((w): w is string => Boolean(w))
        .map((w) => ({ word: w, tokens: phraseTokens(w) })),
    };
    const triggers = new Set<string>();
    for (const n of names) for (const t of n.tokens) triggers.add(t);
    for (const group of [phrases.seat, phrases.district, phrases.party]) for (const t of group.flat()) triggers.add(t);
    for (const w of [...phrases.posts, ...phrases.ministries]) for (const t of w.tokens) triggers.add(t);
    return { mp, names, phrases, triggers };
  });
  const nameWords = new Set<string>();
  for (const e of entries) for (const n of e.names) for (const t of n.tokens) if (!HONORIFICS.has(t) && !INITIALS.has(t)) nameWords.add(t);
  const byTrigger = new Map<string, FeedIndexEntry[]>();
  for (const e of entries) for (const t of e.triggers) byTrigger.set(t, [...(byTrigger.get(t) ?? []), e]);
  const holders = new Map<string, Set<string>>();
  for (const e of entries) for (const p of [...e.phrases.posts, ...e.phrases.ministries]) holders.set(p.word, (holders.get(p.word) ?? new Set()).add(e.mp.id));
  const soleOffices = new Set([...holders].filter(([, ids]) => ids.size === 1).map(([word]) => word));
  return { entries, nameWords, byTrigger, soleOffices };
}

export interface FeedItemText {
  title: string;
  summary?: string | null;
}

/**
 * Every member an item is about. Items nobody is named in come back empty:
 * a political story that names a party and no person belongs to nobody.
 */
/** Words that make an office a lesser one: ডেপুটি স্পিকার, উপ-প্রধানমন্ত্রী. */
const DEPUTY_WORDS = new Set(['ডেপুটি', 'উপ', 'সহকারী', 'deputy'].map((w) => foldBangla(w)));

/** Words that turn an office into a building or a department: প্রধানমন্ত্রীর কার্যালয়. */
const INSTITUTION_WORDS = ['কার্যালয়', 'দপ্তর', 'সচিবালয়'].map((w) => foldBangla(w));

/**
 * Does an office title appear as the person holding it, somewhere in the text?
 * "প্রধানমন্ত্রী বলেছেন" does; "প্রধানমন্ত্রীর কার্যালয়ের তার চুরি" does not.
 */
/** A sole office in a headline, unless another country owns it: "ভারতের প্রধানমন্ত্রী", "পাকিস্তানের স্পিকার". */
function ownOfficeIn(tokens: string[], office: string[]): boolean {
  if (!personalOffice(tokens, office)) return false;
  for (let i = 0; i + office.length <= tokens.length; i++) {
    if (!office.every((w, j) => wordEq(tokens[i + j]!, w, j === office.length - 1))) continue;
    const prev = tokens[i - 1];
    if (prev && FOREIGN_OWNERS.some((c) => prev.startsWith(c))) return false;
  }
  return true;
}

/** Countries whose prime minister, speaker or president a headline may name by office. */
const FOREIGN_OWNERS = ['ভারত', 'পাকিস্তান', 'যুক্তরাজ্য', 'ব্রিটিশ', 'ব্রিটেন', 'যুক্তরাষ্ট্র', 'মার্কিন', 'চীন', 'জাপান', 'মালয়েশিয়া', 'সিঙ্গাপুর', 'শ্রীলঙ্কা', 'নেপাল', 'ভুটান', 'মিয়ানমার', 'থাইল্যান্ড', 'কানাডা', 'অস্ট্রেলিয়া', 'ইসরায়েল', 'ইসরাইল', 'ইতালি', 'ফ্রান্স', 'জার্মান', 'রাশিয়া', 'তুরস্ক', 'সৌদি', 'ইরান', 'ইরাক', 'কাতার', 'ভিয়েতনাম', 'কোরিয়া', 'নিউজিল্যান্ড', 'স্পেন', 'পর্তুগাল', 'গ্রিস', 'ইউক্রেন', 'লেবানন', 'মিসর', 'মিশর', 'কম্বোডিয়া', 'লাওস', 'ফিলিস্তিন', 'বিদেশি', 'সাবেক', 'তৎকালীন', 'প্রয়াত'].map((w) => foldBangla(w));

function personalOffice(tokens: string[], office: string[]): boolean {
  if (!office.length) return false;
  for (let i = 0; i + office.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < office.length; j++) {
      if (!wordEq(tokens[i + j]!, office[j]!, j === office.length - 1)) { ok = false; break; }
    }
    if (!ok) continue;
    const next = tokens[i + office.length];
    if (next && INSTITUTION_WORDS.some((w) => next.startsWith(w))) continue;
    // "ডেপুটি স্পিকার" is somebody else's office, not the speaker's.
    const prev = tokens[i - 1];
    if (prev && DEPUTY_WORDS.has(prev)) continue;
    return true;
  }
  return false;
}

export interface MatchOptions {
  /**
   * The rules added in 2026-09: a name running on through "আল-" or "বিন", a
   * longer name of another member at the same place, a namesake's title right
   * before the name, and an office that names an institution. Off only for
   * scripts/feed-prune.ts, to tell which old links those rules alone reject.
   */
  longerNames?: boolean;
}

export function matchItem(index: FeedIndex, item: FeedItemText, opts: MatchOptions = {}): MpMatch[] {
  const longerNames = opts.longerNames ?? true;
  const title = textTokensWithBreaks(item.title);
  const summary = textTokensWithBreaks(item.summary ?? '');
  const titleTokens = title.tokens;
  const summaryTokens = summary.tokens;
  const allTokens = [...titleTokens, ...summaryTokens];
  // The summary's first sentence says what the story is about; a name further
  // down ("…পরে প্রধানমন্ত্রী শোক জানান") is somebody mentioned, not the subject.
  // Its words are the opening run of the summary's own tokens.
  // An English sentence ends at ". " before a capital; "মো. " and "ড. " are not ends.
  const lead = (item.summary ?? '').split(/[।!?]|\.\s+(?=[A-Z])/u)[0] ?? '';
  const leadLength = textTokensWithBreaks(lead).tokens.length;
  const headTokens = [...titleTokens, ...summaryTokens.slice(0, leadLength)];
  const negative = NEGATIVE_TOKENS.filter((w) => hasTokens(allTokens, w.tokens)).map((w) => w.word);

  // Only members whose name, seat, district, party or office actually appears
  // are examined. A case ending is allowed for on the way in, because
  // "রহমানকে" is how a headline writes রহমান.
  const candidates = new Set<FeedIndexEntry>();
  for (const t of allTokens) {
    for (const e of index.byTrigger.get(t) ?? []) candidates.add(e);
    for (const suffix of SUFFIXES) {
      if (t.length > suffix.length && t.endsWith(suffix)) {
        for (const e of index.byTrigger.get(t.slice(0, -suffix.length)) ?? []) candidates.add(e);
      }
    }
  }

  /**
   * A name with another name word right before it is somebody else's longer
   * name ("মনোয়ার হোসেন চৌধুরী" is not "হোসেন চৌধুরী"), and so is one that runs
   * on through an Arabic name particle ("আব্দুল মালিক আল-হুথি"). A word after
   * the name is usually the member's own nickname ("শহিদুল ইসলাম বাবুল"), so it
   * only counts against the match when it completes another member's name;
   * that is settled below, once every member has been looked for.
   */
  const standsAlone = (text: { tokens: string[]; breaks: boolean[] }, at: number, length: number) => {
    const { tokens, breaks } = text;
    if (longerNames) {
      // "সাবেক মুখ্য সচিব ড. আবুল কালাম আজাদ": a namesake's description right
      // before the name, honorifics between allowed.
      let start = at;
      while (start > 0 && (HONORIFICS.has(tokens[start - 1]!) || INITIALS.has(tokens[start - 1]!))) start--;
      for (const t of NAMESAKE_TITLE_TOKENS) {
        if (start < t.length) continue;
        if (t.every((w, k) => tokens[start - t.length + k] === w)) return false;
      }
    }
    if (at > 0 && !breaks[at - 1]) {
      const prev = tokens[at - 1]!;
      if (index.nameWords.has(prev) && !HONORIFICS.has(prev) && !INITIALS.has(prev)) return false;
    }
    const end = at + length - 1;
    if (end + 1 < tokens.length && !breaks[end]) {
      const next = tokens[end + 1]!;
      if (longerNames && NAME_PARTICLES.has(next)) return false;
    }
    return true;
  };

  const found: MpMatch[] = [];
  const spans = new Map<MpMatch, { inTitle: boolean; at: number; end: number }>();
  /** Members the headline is about: named in it, or named in the summary and called by their office in it. */
  const subjects = new Set<MpMatch>();
  for (const entry of candidates) {
    const { mp } = entry;
    const signals: Signal[] = [];
    let score = 0;
    let named = false;

    // A headline that carries the member's own office, seat or district
    // ("…ডেকেছেন প্রধানমন্ত্রী", "…: স্বরাষ্ট্রমন্ত্রী", "ব্রাহ্মণবাড়িয়ায় এমপির…")
    // is about them even when the summary names them only further down.
    const { phrases } = entry;
    const inHeadline = (p: { tokens: string[] }) => (longerNames ? personalOffice(titleTokens, p.tokens) : hasTokens(titleTokens, p.tokens));
    const officeInHeadline = phrases.posts.some(inHeadline) || phrases.ministries.some(inHeadline);
    // Called by an office only they hold, and not another country's ("ভারতের প্রধানমন্ত্রী").
    const soleOffice = [...phrases.posts, ...phrases.ministries].find((p) => index.soleOffices.has(p.word) && ownOfficeIn(titleTokens, p.tokens));
    const soleOfficeInHeadline = !!soleOffice;
    const headlinePointsAtThem =
      officeInHeadline || phrases.seat.some((p) => hasTokens(titleTokens, p)) || phrases.district.some((p) => hasTokens(titleTokens, p));

    // With nothing in the headline pointing at them, the summary must open
    // with the member, as the subject ("প্রধানমন্ত্রী তারেক রহমান বলেছেন"), or
    // name their own seat in that first sentence. "এমন পরিস্থিতিতে
    // প্রধানমন্ত্রী … নির্দেশনায়" is a story about someone else.
    const ownWords = new Set([...[...phrases.posts, ...phrases.ministries].flatMap((p) => p.tokens), ...phrases.party.flat()]);
    const opensWith = (at: number) => summaryTokens.slice(0, at).every((t) => HONORIFICS.has(t) || INITIALS.has(t) || ownWords.has(t) || SUBJECT_LEAD_WORDS.has(t));
    // Bangla news often puts the speaker last: "…বলে মন্তব্য করেছেন প্রধানমন্ত্রী
    // তারেক রহমান।", or names them right before the verb: "…তারেক রহমান বলেছেন".
    const speaks = (at: number, length: number) => {
      const after = at + length;
      return after >= leadLength || SPEECH_WORDS.has(summaryTokens[after] ?? '') || SPEECH_WORDS.has(summaryTokens[after + 1] ?? '');
    };
    const leadNamesSeat = phrases.seat.some((p) => hasTokens(summaryTokens.slice(0, leadLength), p));

    let best: { weight: number; label: string; inTitle: boolean; at: number; length: number } | null = null;
    for (const n of entry.names) {
      const atTitle = findRun(titleTokens, n.tokens);
      const atSummary = findRun(summaryTokens, n.tokens);
      const inTitle = atTitle >= 0 && standsAlone(title, atTitle, n.tokens.length);
      const inSummary =
        !inTitle && atSummary >= 0 &&
        (headlinePointsAtThem || (atSummary < leadLength && (opensWith(atSummary) || speaks(atSummary, n.tokens.length) || leadNamesSeat))) &&
        standsAlone(summary, atSummary, n.tokens.length);
      if (!inTitle && !inSummary) continue;
      if (!best || (inTitle && !best.inTitle) || (inTitle === best.inTitle && n.weight > best.weight)) {
        best = { weight: n.weight, label: n.label, inTitle, at: inTitle ? atTitle : atSummary, length: n.tokens.length };
      }
    }
    if (best) {
      named = true;
      const points = Math.round((best.inTitle ? POINTS.nameInTitle : POINTS.nameInSummary) * best.weight);
      score += points;
      signals.push({ signal: best.inTitle ? 'name-in-title' : 'name-in-summary', points, detail: best.label });
    } else if (soleOfficeInHeadline) {
      // The office stands for the name; with the office's own points it reaches the floor.
      named = true;
      score += POINTS.soleOffice;
      signals.push({ signal: 'sole-office-in-title', points: POINTS.soleOffice, detail: soleOffice?.word ?? '' });
    }

    if (phrases.seat.some((p) => hasTokens(allTokens, p))) {
      score += POINTS.seat;
      signals.push({ signal: 'seat', points: POINTS.seat, detail: mp.seatBn ?? mp.seatEn ?? '' });
    } else if (phrases.district.some((p) => hasTokens(allTokens, p))) {
      score += POINTS.district;
      signals.push({ signal: 'district', points: POINTS.district, detail: mp.districtBn ?? '' });
    }

    if (phrases.party.some((p) => hasTokens(allTokens, p))) {
      score += POINTS.party;
      signals.push({ signal: 'party', points: POINTS.party, detail: mp.partyBn ?? mp.partyAbbr ?? '' });
    }

    // An office counts where the subject is: the headline or the first sentence.
    const officeHere = (w: { tokens: string[] }) => longerNames ? personalOffice(headTokens, w.tokens) : hasTokens(headTokens, w.tokens);
    const office = phrases.posts.find(officeHere) ?? phrases.ministries.find(officeHere);
    if (office) {
      score += POINTS.post;
      signals.push({ signal: 'post', points: POINTS.post, detail: office.word });
    }

    if (named && negative.length) {
      score += POINTS.negative;
      signals.push({ signal: 'namesake-context', points: POINTS.negative, detail: negative.join(', ') });
    }

    if (score >= REVIEW_SCORE) {
      found.push({ mpId: mp.id, score, lowConfidence: score < AUTO_SCORE, named, nameLabel: best?.label ?? null, signals });
      if (best) spans.set(found[found.length - 1]!, { inTitle: best.inTitle, at: best.at, end: best.at + best.length });
      // Named in the summary but called by their office in the headline: also a subject.
      if ((best && (best.inTitle || officeInHeadline)) || (!best && soleOfficeInHeadline)) subjects.add(found[found.length - 1]!);
    }
  }

  // An item that names one member is not about another member the same words
  // happen to describe, and one that names nobody is nobody's.
  // An item that names one member is not about another member the same words
  // happen to describe. Context-only matches drop out as soon as anyone is named.
  // A story that names no member belongs to none: an office and a district
  // ("প্রধানমন্ত্রীর নির্দেশে … উত্তরায়") add up to the review floor and nothing more.
  let kept = found.filter((f) => f.named);

  // The story belongs to whoever the headline names. A member the summary
  // also mentions (the prime minister whose adviser came home, the leader who
  // sent condolences) is not given someone else's story.
  if (kept.some((f) => subjects.has(f))) kept = kept.filter((f) => subjects.has(f));

  // Where one member's name sits inside a longer name of another member at the
  // same place, the text names the longer one: "রফিকুল ইসলাম হিলালী" is
  // হিলালী, not কাজী রফিকুল ইসলাম, and "নুরুল ইসলাম মনি" is the chief whip.
  kept = kept.filter((f) => {
    const a = spans.get(f);
    if (!a || !longerNames) return true;
    return !kept.some((g) => {
      const b = spans.get(g);
      return g !== f && b !== undefined && b.inTitle === a.inTitle && b.at <= a.at && b.end >= a.end && b.end - b.at > a.end - a.at;
    });
  });

  // Two sitting members are called শফিকুর রহমান. When a headline writes that
  // name and nothing else separates them, the higher score wins; a tie goes to
  // a reviewer rather than onto both pages.
  const byName = new Map<string, MpMatch[]>();
  for (const f of kept) if (f.nameLabel) byName.set(f.nameLabel, [...(byName.get(f.nameLabel) ?? []), f]);
  const dropped = new Set<MpMatch>();
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const top = Math.max(...group.map((g) => g.score));
    const leaders = group.filter((g) => g.score === top);
    for (const g of group) if (g.score < top) dropped.add(g);
    if (leaders.length > 1) for (const g of leaders) g.lowConfidence = true;
  }
  kept = kept.filter((f) => !dropped.has(f));
  return kept.sort((a, b) => b.score - a.score);
}

/**
 * The word a ministry is called in a headline: "পররাষ্ট্র মন্ত্রণালয়" is
 * written "পররাষ্ট্রমন্ত্রী" when it is the person speaking.
 */
export function ministryWord(ministryBn: string | null | undefined): string | null {
  if (!ministryBn) return null;
  const head = ministryBn.replace(/\s*(মন্ত্রণালয়|বিভাগ).*$/, '').trim();
  if (!head || head.includes(' ')) return null; // "স্থানীয় সরকার, পল্লী উন্নয়ন…" has no one-word title
  return `${head}মন্ত্রী`;
}
