/**
 * Which constituency a place is in, read from the constituencies' own
 * boundary text.
 *
 * The Election Commission describes each of the 300 seats by the upazilas,
 * unions and city wards it covers: "(ক) দোহার এবং (খ) নবাবগঞ্জ উপজেলা",
 * "সাভার উপজেলার নিম্নলিখিত ইউনিয়ন সমূহঃ (১) আমিনবাজার…", or an upazila
 * "নিম্নলিখিত ইউনিয়ন সমূহ ব্যতীত" (except) some of its unions. A search for a
 * place is a search of that text, clause by clause, so that a union listed as
 * an exception is not taken as part of the seat that excludes it.
 *
 * Pure: no site data and no server imports, so the home page's finder can run
 * it in the browser.
 */
import { foldBangla } from '@/lib/matching/nameMatch';

export interface FinderSeat {
  no: number;
  /** "ঢাকা-২" */
  seat: string;
  seatEn: string | null;
  slug: string;
  district: string;
  districtEn: string | null;
  boundary: string | null;
  /** `name` is the Bangla name; `nameEn`, given to English pages only, the English one. */
  member: { name: string; nameEn?: string; slug: string; party: string | null; partyBn: string | null; color: string; photo: string | null } | null;
}

export type MatchKind = 'seat' | 'district' | 'upazila' | 'union' | 'ward' | 'thana' | 'place';

export interface SeatMatch {
  seat: FinderSeat;
  kind: MatchKind;
  /** The clause of the boundary text that matched, as written, for showing why. */
  clause: string | null;
  /** True when the seat holds only part of the place (some unions, or all but some). */
  partial: boolean;
  score: number;
  /**
   * For a union or thana found through the place list rather than the
   * boundary text: where it is ("বাবরা হাচলা ইউনিয়ন, কালিয়া উপজেলা"), since
   * many unions share a name. `placeEn` on English pages.
   */
  place?: string;
  placeEn?: string;
  /** A listed union's upazila, to say how to tell apart unions that share a name. */
  upazila?: string;
  upazilaEn?: string;
}

/**
 * Places the boundary text does not name, for the finder (public/place-names.json,
 * built by scripts/build-place-names.ts):
 * - unions: [Bangla, English, upazila as the boundary text spells it, district,
 *   the upazila in English, and for a union since taken into a city
 *   corporation the slugs of the seats that share the city's wards]. The
 *   Election Commission names a union only where a seat holds part of an
 *   upazila; every other union is found through its upazila. Many unions share
 *   a name, so "<union> <upazila>" or "<union> <district>" narrows it.
 * - thanas: [Bangla, English, the seats' slugs, partial]. Placed by the
 *   station's position on the seat map, so `partial` says the thana may
 *   reach into a neighbouring seat.
 */
export interface PlaceNames {
  unions: [string, string, string, string, string?, string[]?][];
  thanas: [string, string, string[], boolean][];
  /** Where the names come from, and their licences. */
  source?: string;
}

const BN_DIGIT = (d: string) => '০১২৩৪৫৬৭৮৯'[Number(d)]!;

/** Words that say what kind of place a name is, which a person may or may not type. */
const KIND_WORDS = new Set(['উপজেলা', 'উপজেলার', 'ইউনিয়ন', 'ইউনিয়নের', 'জেলা', 'জেলার', 'থানা', 'থানার', 'পৌরসভা', 'পৌরসভার', 'upazila', 'union', 'district', 'thana'].map((w) => fold(w)));

/** Folded words: one spelling for the many, Latin digits as Bangla, punctuation as space. */
export function fold(s: string): string {
  // লক্ষ্মীপুর is written লক্ষীপুর in the boundary text.
  // ঙ and ং are one sound: the boundary text writes রাংগুনিয়া and টাংগাইল, other lists রাঙ্গুনিয়া and টাঙ্গাইল.
  return foldBangla(s.normalize('NFC').replace(/ক্ষ্ম/g, 'ক্ষ'))
    .replace(/ঙ/g, 'ং')
    .replace(/\d/g, BN_DIGIT)
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (s: string) => fold(s).split(' ').filter(Boolean);
const toLatin = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

/**
 * The ward numbers a city clause names: "ওয়ার্ড- ০৪,১৩,১৪, ও ১৬", "ওয়ার্ড ৭
 * থেকে ১২ পর্যন্ত", "১ হতে ১৮ নং ওয়ার্ড". A range runs from the number before
 * থেকে or হতে to the one after.
 */
export function wardNumbers(clause: string): number[] {
  const out = new Set<number>();
  const rest = toLatin(clause.normalize('NFC')).replace(/(\d+)\s*(?:থেকে|হতে)\s*(\d+)/g, (_, a: string, b: string) => {
    for (let n = Number(a); n <= Number(b) && n < Number(a) + 200; n++) out.add(n);
    return ' ';
  });
  for (const m of rest.matchAll(/\d+/g)) out.add(Number(m[0]));
  return [...out].sort((a, b) => a - b);
}

/** Does the folded word list `hay` contain `needle` as whole words? The last word may be half typed. */
function hasRun(hay: string[], needle: string[], prefixLast: boolean): boolean {
  if (!needle.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      const h = hay[i + j]!;
      const n = needle[j]!;
      const last = j === needle.length - 1;
      // A place name takes a case ending in the text: "সাভার উপজেলার", "কেরানিগঞ্জের".
      if (!(h === n || (last && (h.startsWith(n) && (prefixLast || h.length - n.length <= 2))))) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

interface Clause {
  text: string;
  /** The part naming places the seat holds. */
  holds: string[];
  /** Unions the clause names as exceptions: not in this seat. */
  except: string[];
  kind: 'upazila' | 'union' | 'ward';
  partial: boolean;
}

/** "(ক) …, (খ) …" into its clauses; a boundary with no markers is one clause. */
export function clausesOf(boundary: string): Clause[] {
  // "সুবর্ণচরএবং": the text sometimes runs a name into the এবং after it.
  const parts = boundary.replace(/(\S)এবং/g, '$1 এবং').split(/\([কখগঘঙচছজঝঞটঠ]\)/).map((p) => p.trim().replace(/^[,;।\s]+|[,;।\s]+$/g, '')).filter(Boolean);
  return parts.flatMap((text): Clause[] => {
    const isWard = words(text).some((w) => WARD_WORDS.has(w));
    if (/ব্যা?তীত/.test(text)) {
      // "নিম্নলিখিত ইউনিয়ন সমূহ ব্যতীত কেরানিগঞ্জ উপজেলাঃ(১) জিনজিরা, …"
      const [head, list = ''] = text.split(/[ঃ:]/, 2);
      const upazila = head!.replace(/.*ব্যা?তীত/, '');
      return [{ text, holds: [upazila], except: [list], kind: 'upazila' as const, partial: true }];
    }
    if (/নিম্নলিখিত/.test(text)) {
      // "সাভার উপজেলার নিম্নলিখিত ইউনিয়ন সমূহঃ (১) আমিনবাজার, …": only these unions.
      const [, list = ''] = text.split(/[ঃ:]/, 2);
      const head = text.split(/[ঃ:]/, 1)[0]!;
      // "পলাশ এবং নরসিংদী সদর উপজেলার নিম্নলিখিত …": a whole upazila, then the one the list belongs to.
      const m = /^(.+?)\s+এবং\s+(.+)$/.exec(head);
      if (m && !/নিম্নলিখিত/.test(m[1]!)) {
        return [
          { text: m[1]!, holds: [m[1]!], except: [], kind: 'upazila' as const, partial: false },
          { text, holds: [m[2]!, list], except: [], kind: 'union' as const, partial: true },
        ];
      }
      return [{ text, holds: [head, list], except: [], kind: 'union' as const, partial: true }];
    }
    // "সাভার উপজেলার কাউন্দিয়া ইউনিয়ন": named unions of an upazila, without the word নিম্নলিখিত.
    const genitive = text.search(/উপজেলার/);
    if (genitive > 0 && fold(text.slice(genitive)).includes(fold('ইউনিয়ন'))) {
      return [{ text, holds: [text.slice(0, genitive), text.slice(genitive)], except: [], kind: 'union' as const, partial: true }];
    }
    return [{ text, holds: [text], except: [], kind: isWard ? ('ward' as const) : ('upazila' as const), partial: false }];
  });
}

const WARD_WORDS = new Set(['ওয়ার্ড', 'ওয়ার্ড', 'ward'].map((w) => fold(w)));

const RANK: Record<MatchKind, number> = { seat: 100, district: 80, union: 70, ward: 65, upazila: 60, thana: 55, place: 40 };
/**
 * A union found through the place list ranks below an upazila and a city
 * thana of the same name: শিবপুর the upazila, and মিরপুর the Dhaka thana,
 * before the many unions called so.
 */
const LISTED_UNION = RANK.thana - 3;

/**
 * Seats that hold the place the person typed, best first. A seat that holds
 * the place whole ranks above one that holds a part of it.
 */
export function findSeats(query: string, seats: FinderSeat[], limit = 12, names?: PlaceNames): SeatMatch[] {
  // Whole words first; a half-typed last word only when nothing matches whole.
  const exact = searchSeats(query, seats, limit, false);
  // A union or thana the boundary text does not name, through the place list.
  const listed = names ? byPlaceName(query, seats, names) : [];
  const seen = new Set(exact.map((m) => m.seat.no));
  const both = [...exact, ...listed.filter((m) => !seen.has(m.seat.no) && (seen.add(m.seat.no), true))];
  if (both.length) return both.sort((a, b) => b.score - a.score || a.seat.no - b.seat.no).slice(0, limit);
  return searchSeats(query, seats, limit, true);
}

/** Folded words with the words that only name a kind of place dropped. */
const placeWords = (s: string) => words(s).filter((w) => !KIND_WORDS.has(w));

/** Whether a listed name (a union in a clause's list) is this union, past small spelling differences. */
function sameName(a: string, b: string): boolean {
  const x = fold(a).replace(/ /g, ''), y = fold(b).replace(/ /g, '');
  if (x === y) return true;
  return x.length >= 4 && y.length >= 4 && editDistance(x, y) <= 1;
}

/** The names in a clause's list: "(১) জিনজিরা, (২)আগানগর … ও(৫) শুভাট্যা". */
const KIND_IN_LIST = new RegExp(['উপজেলার?', 'ইউনিয়ন', 'সমূহ'].join('|').normalize('NFC'), 'g');
const listNames = (list: string) =>
  list
    .normalize('NFC')
    .replace(/\([০-৯\d]+\)/g, ',')
    .replace(KIND_IN_LIST, ',')
    .split(/[,;।ঃ:-]|\sও\s|\sএবং\s/)
    .map((x) => x.trim().replace(/^(?:ও|এবং)\s+|\s+(?:ও|এবং)$/g, '').trim())
    .filter((x) => x.length > 1);

/** hasRun, past one letter's difference in a longer word: the text writes রানিসংকাইল and রানিশংকাইল for one upazila. */
function nearRun(hay: string[], needle: string[]): boolean {
  if (hasRun(hay, needle, false)) return true;
  const near = (h: string, n: string) => h === n || (n.length >= 4 && editDistance(h, n) <= 1);
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((n, j) => near(hay[i + j]!, n))) return true;
  }
  return false;
}

/** Seats holding a union of `upazila` (as the boundary text spells it), read the way the text means it. */
export function seatsForUnion(name: string, upazila: string, district: string, seats: FinderSeat[]): FinderSeat[] {
  const up = placeWords(upazila);
  const out: FinderSeat[] = [];
  const inDistrict = (s: FinderSeat) => !district || sameName(s.district, district);
  for (const seat of seats) {
    if (!seat.boundary || !inDistrict(seat)) continue;
    for (const c of clausesOf(seat.boundary)) {
      if (c.kind === 'ward') continue;
      if (c.kind === 'union') {
        // Only the listed unions of the upazila.
        if (nearRun(placeWords(c.holds[0]!), up) && listNames(c.holds[1] ?? '').some((n) => sameName(n, name))) { out.push(seat); break; }
        continue;
      }
      if (c.partial) {
        // The upazila except the listed unions.
        if (nearRun(placeWords(c.holds[0]!), up) && !listNames(c.except[0] ?? '').some((n) => sameName(n, name))) { out.push(seat); break; }
        continue;
      }
      if (nearRun(placeWords(c.text), up)) { out.push(seat); break; }
    }
  }
  if (out.length) return out;
  // The hill districts are described whole ("রাংগামাটি পার্বত্য জেলা"), without
  // their upazilas: a clause that is the district and nothing else.
  const dw = placeWords(district).join(' ');
  const hill = fold('পার্বত্য');
  return seats.filter((s) => inDistrict(s) && s.boundary && clausesOf(s.boundary).some((c) => {
    const w = placeWords(c.text).filter((x) => x !== hill).join(' ');
    return !!dw && w === dw;
  }));
}

/** A district's English name, from the seats in it. */
const districtEn = (bn: string, seats: FinderSeat[]) => {
  const f = fold(bn);
  return seats.find((s) => fold(s.district) === f)?.districtEn ?? '';
};

/** The place list's names folded once, not on every keystroke. */
const prepared = new WeakMap<PlaceNames, { unions: string[][]; unionsEn: string[]; thanas: string[][]; thanasEn: string[] }>();
function prepare(names: PlaceNames) {
  let p = prepared.get(names);
  if (!p) {
    p = {
      unions: names.unions.map((r) => placeWords(r[0])),
      unionsEn: names.unions.map((r) => latin(r[1])),
      thanas: names.thanas.map((r) => placeWords(r[0])),
      thanasEn: names.thanas.map((r) => latin(r[1])),
    };
    prepared.set(names, p);
  }
  return p;
}

/** Unions and thanas from the place list whose name is the query. */
function byPlaceName(query: string, seats: FinderSeat[], names: PlaceNames): SeatMatch[] {
  const q = placeWords(query);
  if (!q.length || q.join('').length < 2) return [];
  const pre = prepare(names);
  const english = /[a-z]/i.test(query);
  const typedWords = query.toLowerCase().replace(/\b(union|thana|upazila|upazilla|police station|ps)\b/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
  const typed = typedWords.join('');
  const sameLatin = (a: string, key: string) => !!key && (key === a || (a.length >= 6 && editDistance(a, key) <= 1));
  // "kalatia" is কলাতিয়া, not also করটিয়া a letter away: a name a letter off counts only when none is exact.
  const exactLatin = english && [...pre.unionsEn, ...pre.thanasEn].includes(typed);
  const sameName = exactLatin ? (a: string, key: string) => !!key && key === a : sameLatin;
  /** The name, then perhaps words naming where it is: "চরপাতা দৌলতখান", "charpata bhola". */
  const isName = (w: string[], key: string, where: () => string[] = () => []) => {
    if (english) {
      if (sameName(typed, key)) return true;
      // The union's own words, then its upazila's or district's.
      for (let n = 1; n < typedWords.length; n++) {
        if (!sameName(typedWords.slice(0, n).join(''), key)) continue;
        const rest = typedWords.slice(n).join('');
        if (where().some((x) => sameLatin(rest, latin(x)) || (rest.length >= 4 && latin(x).startsWith(rest)))) return true;
      }
      return false;
    }
    if (q.length < w.length || !w.every((x, i) => x === q[i])) return false;
    if (q.length === w.length) return true;
    const rest = q.slice(w.length);
    return where().some((x) => nearRun(placeWords(x), rest) || hasRun(placeWords(x), rest, true));
  };
  const out: SeatMatch[] = [];
  const bySlug = new Map(seats.map((s) => [s.slug, s]));
  names.unions.forEach(([bn, en, upazila, district, upazilaEn, inCity], i) => {
    if (!isName(pre.unions[i]!, pre.unionsEn[i]!, () => (english ? [upazilaEn ?? '', districtEn(district, seats)] : [upazila, district]))) return;
    const named = { place: `${bn} ইউনিয়ন, ${upazila} উপজেলা`, placeEn: `${en} union, ${upazilaEn || upazila}`, upazila, upazilaEn: upazilaEn || undefined };
    if (inCity) {
      // Now city wards the text does not tie to the union: each seat that shares the city may hold it.
      for (const slug of inCity) {
        const seat = bySlug.get(slug);
        if (seat) out.push({ seat, kind: 'union', clause: null, partial: true, score: LISTED_UNION - 10, ...named });
      }
      return;
    }
    for (const seat of seatsForUnion(bn, upazila, district, seats)) {
      out.push({ seat, kind: 'union', clause: null, partial: false, score: LISTED_UNION, ...named });
    }
  });
  names.thanas.forEach(([bn, en, slugs, partial], i) => {
    if (!isName(pre.thanas[i]!, pre.thanasEn[i]!)) return;
    for (const slug of slugs) {
      const seat = bySlug.get(slug);
      // Every city thana is marked partial, so being partial costs it no rank.
      if (seat) out.push({ seat, kind: 'thana', clause: null, partial, score: RANK.thana, place: `${bn} থানা`, placeEn: `${en} thana` });
    }
  });
  // One line a seat: the same union name in two upazilas of one seat is one answer.
  const seen = new Set<number>();
  return out.filter((m) => !seen.has(m.seat.no) && (seen.add(m.seat.no), true));
}

function searchSeats(query: string, seats: FinderSeat[], limit: number, prefix: boolean): SeatMatch[] {
  const q = words(query).filter((w) => !KIND_WORDS.has(w));
  if (!q.length || q.join('').length < 2) return [];
  const out: SeatMatch[] = [];

  // "ঢাকা দক্ষিণ ওয়ার্ড ১৫": the number among a city clause's ward numbers, the other words in the clause.
  const wardAt = q.findIndex((w) => WARD_WORDS.has(w));
  if (wardAt >= 0) {
    const number = q.slice(wardAt + 1).find((w) => /^[০-৯]+$/.test(w));
    const city = q.filter((w, i) => i !== wardAt && w !== number);
    if (number) {
      const n = Number(toLatin(number));
      for (const seat of seats) {
        for (const c of seat.boundary ? clausesOf(seat.boundary) : []) {
          if (c.kind !== 'ward') continue;
          const cw = words(c.text);
          if (!wardNumbers(c.text).includes(n) || !city.every((w) => cw.some((h) => h.startsWith(w)))) continue;
          out.push({ seat, kind: 'ward', clause: c.text, partial: false, score: RANK.ward });
          break;
        }
      }
      return out.sort((a, b) => a.seat.no - b.seat.no).slice(0, limit);
    }
  }

  for (const seat of seats) {
    const seatWords = [...words(seat.seat), ...(seat.seatEn ? words(seat.seatEn) : [])];
    if (hasRun(seatWords, q, prefix) && q.some((w) => /[০-৯]/.test(w))) {
      out.push({ seat, kind: 'seat', clause: null, partial: false, score: RANK.seat });
      continue;
    }
    const districtWords = [...words(seat.district), ...(seat.districtEn ? words(seat.districtEn) : [])];
    if (hasRun(districtWords, q, prefix) && q.length <= 2) {
      out.push({ seat, kind: 'district', clause: null, partial: false, score: RANK.district });
      continue;
    }
    if (!seat.boundary) continue;
    for (const c of clausesOf(seat.boundary)) {
      if (c.except.some((e) => hasRun(words(e), q, false))) continue; // listed as not in this seat
      const hit = c.holds.findIndex((h) => hasRun(words(h), q, prefix));
      if (hit < 0) continue;
      // In a "these unions only" clause, a hit in the list is a union; in the head it is the upazila they belong to.
      const kind: MatchKind = c.kind === 'union' ? (hit === 1 ? 'union' : 'upazila') : c.kind;
      const partial = c.partial && kind !== 'union';
      out.push({ seat, kind, clause: c.text, partial, score: RANK[kind] - (partial ? 15 : 0) });
      break;
    }
  }
  return out.sort((a, b) => b.score - a.score || a.seat.no - b.seat.no).slice(0, limit);
}

/** The address fields that name a place, most precise first. */
const PLACE_KEYS = ['village', 'suburb', 'town', 'municipality', 'city_district', 'county', 'city', 'state_district'];

/** A place name without the word that only names its kind: "সাভার উপজেলা" is সাভার. */
export const cleanPlaceName = (v: string) =>
  v.replace(/\s*(উপজেলা|জেলা|ইউনিয়ন|থানা|পৌরসভা|সিটি কর্পোরেশন|Upazila|Union|District|Thana|Municipality|City Corporation)\s*$/i, '').trim();

/** placeNames, with the address field each name came from. */
export function placeEntries(address: Record<string, string | undefined>): { key: string; name: string }[] {
  const seen = new Set<string>();
  const out: { key: string; name: string }[] = [];
  for (const k of PLACE_KEYS) {
    const v = address[k];
    if (!v) continue;
    const clean = cleanPlaceName(v);
    const key = fold(clean);
    if (clean && !seen.has(key)) {
      seen.add(key);
      out.push({ key: k, name: clean });
    }
  }
  return out;
}

/**
 * The names an OpenStreetMap address gives for where someone stands, most
 * precise first: the union or town, the upazila, then the district. Words that
 * only name the kind of place are dropped ("সাভার উপজেলা" is সাভার).
 */
export function placeNames(address: Record<string, string | undefined>): string[] {
  return placeEntries(address).map((e) => e.name);
}

/* ---------------------------------------------------------------- English */

/** City and direction words a person may type in English, for a ward search. */
const EN_WORDS: Record<string, string> = {
  dhaka: 'ঢাকা', south: 'দক্ষিণ', north: 'উত্তর', dakshin: 'দক্ষিণ', uttar: 'উত্তর',
  chittagong: 'চট্টগ্রাম', chattogram: 'চট্টগ্রাম', ctg: 'চট্টগ্রাম', khulna: 'খুলনা', rajshahi: 'রাজশাহী',
  sylhet: 'সিলেট', barishal: 'বরিশাল', barisal: 'বরিশাল', rangpur: 'রংপুর', mymensingh: 'ময়মনসিংহ',
  gazipur: 'গাজীপুর', narayanganj: 'নারায়ণগঞ্জ', cumilla: 'কুমিল্লা', comilla: 'কুমিল্লা', city: 'সিটি',
  ward: 'ওয়ার্ড', no: '',
};
const EN_DROP = new Set(['upazila', 'upazilla', 'thana', 'union', 'district', 'zila', 'zilla', 'corporation', 'of', 'the']);

const latin = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length]!;
}

/**
 * A query typed in English, put in the Bangla the boundary text uses:
 * "Savar" → সাভার, "doulatkhan upazila" → দৌলতখান, "ward 15 dhaka south" →
 * ওয়ার্ড ১৫ ঢাকা দক্ষিণ. `upazilas` is [English, Bangla] pairs
 * (data/upazila-en.json, from OpenStreetMap). A query with no Latin letters
 * comes back as it is.
 */
export function toBangla(query: string, upazilas: [string, string][]): string {
  if (!/[a-z]/i.test(query)) return query;
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !EN_DROP.has(w));
  if (words.some((w) => w === 'ward' || w === 'wd')) {
    return words.map((w) => (w === 'wd' ? 'ওয়ার্ড' : /^\d+$/.test(w) ? w : EN_WORDS[w] ?? w)).join(' ');
  }
  const typed = words.join('');
  if (typed.length < 3) return query;
  let best: { bn: string; d: number } | null = null;
  for (const [en, bn] of upazilas) {
    const key = latin(en);
    if (key === typed) return bn;
    // Half typed, or a letter or two off: "doulatkhan" / "daulatkhan", "charfason".
    const d = key.startsWith(typed) && typed.length >= 4 ? 0.5 : editDistance(typed, key);
    const tol = key.length >= 8 ? 2 : 1;
    if (d <= tol && (!best || d < best.d)) best = { bn, d };
  }
  return best?.bn ?? query;
}
