/**
 * Builds the constituency maps: one GeoJSON per district in public/geo/.
 *
 * The Election Commission describes each seat in words (lib/findSeat.ts reads
 * them clause by clause). Each clause is matched to the upazila boundaries
 * OpenStreetMap holds for the seat's district, and a city clause to the city
 * corporation's boundary from OCHA's administrative boundaries (OpenStreetMap
 * has no ward or city corporation polygons for Bangladesh), and a ward clause
 * to the wards' own outlines where geoBoundaries has them (the 2011 census
 * wards: Dhaka, Chattogram, Khulna, Sylhet, Rajshahi, Barishal). Unions, and
 * the wards of the newer city corporations, have no public boundaries, so a
 * seat that holds part of an upazila, or such wards, is drawn as the whole
 * upazila or city, marked "part".
 *
 *   npx tsx scripts/build-seat-geo.ts <osm-upazilas.json> <city-corps.json> <ocha-admin3.json> <geoboundaries-adm4.json>
 *
 * osm-upazilas.json: Nominatim /lookup results (polygon_geojson, addressdetails,
 * accept-language=bn) for Bangladesh's admin_level=6 relations.
 * city-corps.json: OCHA COD-AB admin3 features whose name has "City Corporation".
 * ocha-admin3.json: all OCHA COD-AB admin3 features, for the upazilas
 * OpenStreetMap does not have (most made since 2014; see OCHA_FALLBACK).
 * geoboundaries-adm4.json: geoBoundaries BGD ADM4 (unions and city wards, from
 * BBS/OCHA's 2015 boundaries): github.com/wmgeolab/geoBoundaries, gbOpen/BGD/ADM4.
 *
 * Boundaries: © OpenStreetMap contributors (ODbL); OCHA COD-AB (CC BY-IGO);
 * geoBoundaries (CC BY 3.0 IGO).
 */
import fs from 'node:fs';
import { seats, districtOf } from '../src/lib/data';
import { clausesOf, fold, wardNumbers } from '../src/lib/findSeat';

interface OsmPlace {
  name: string;
  display_name: string;
  address: Record<string, string>;
  geojson: { type: string; coordinates: unknown };
}
interface CityFeature {
  properties: { name_en: string; district_en: string };
  geometry: { type: string; coordinates: unknown };
}
interface Adm4Feature {
  properties: { shapeName: string };
  geometry: { type: string; coordinates: unknown };
}

const [osmPath, cityPath, ochaPath, wardsPath] = process.argv.slice(2);
if (!osmPath || !cityPath) throw new Error('usage: build-seat-geo.ts <osm-upazilas.json> <city-corps.json> [ocha-admin3.json] [geoboundaries-adm4.json]');
const osm = JSON.parse(fs.readFileSync(osmPath, 'utf8')) as OsmPlace[];
const cities = (JSON.parse(fs.readFileSync(cityPath, 'utf8')) as { features: CityFeature[] }).features;

// "সুবর্ণচরএবং": এবং run into the name.
const words = (s: string) => fold(s.replace(/এবং/g, ' এবং ').replace(/ং/g, 'ঙ')).split(' ').filter(Boolean);
/** Edit distance, for one-letter spelling slips (সন্দীপ / সন্দ্বীপ, মীরশ্বরাই / মীরসরাই). */
function distance(a: string, b: string): number {
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
 * Where an upazila's name runs in the clause's words: the words joined, so
 * "ওসমানী নগর" is ওসমানীনগর; a case ending allowed; a slip of a letter
 * forgiven in a longer name. Returns [position, words used] or null.
 */
function runAt(hay: string[], needle: string[]): [number, number] | null {
  const key = needle.join('');
  const tol = key.length >= 9 ? 2 : key.length >= 5 ? 1 : 0;
  for (let i = 0; i < hay.length; i++) {
    for (let span = 1; span <= 3 && i + span <= hay.length; span++) {
      const cand = hay.slice(i, i + span).join('');
      if (cand === key || (cand.startsWith(key) && cand.length - key.length <= 2) || (tol && Math.abs(cand.length - key.length) <= tol && distance(cand, key) <= tol)) return [i, span];
    }
  }
  return null;
}
const round = (c: unknown): unknown => (Array.isArray(c) && typeof c[0] === 'number' ? [Math.round((c[0] as number) * 1e4) / 1e4, Math.round((c[1] as number) * 1e4) / 1e4] : (c as unknown[]).map(round));

/** The district an OSM place sits in, as our districts are named: "ভোলা জেলা" → ভোলা. */
const districtKey = (s: string) => fold(s.replace(/\s*(পার্বত্য\s*)?জেলা$/, ''));
const upazilaBase = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*(উপজেলা|থানা)$/, '').trim();

/** The few upazilas OpenStreetMap names only in English. */
const EN_NAMES: Record<string, string> = {
  Kalmakanda: 'কলমাকান্দা', Purbadhala: 'পূর্বধলা', 'Netrokona Sadar': 'নেত্রকোনা সদর', Barhatta: 'বারহাট্টা', Nikli: 'নিকলী', 'Tarakanda Upazila': 'তারাকান্দা', Tarakanda: 'তারাকান্দা',
};

const byDistrict = new Map<string, { name: string; base: string[]; geometry: OsmPlace['geojson'] }[]>();
for (const p of osm) {
  if (!/Polygon/.test(p.geojson.type)) continue;
  // Cox's Bazar's upazilas carry their district under "city".
  const d = p.address.state_district ?? (/জেলা$/.test(p.address.city ?? '') ? p.address.city : undefined) ?? p.address.county;
  if (!d) continue;
  const name = upazilaBase(EN_NAMES[upazilaBase(p.name)] ?? p.name);
  const list = byDistrict.get(districtKey(d)) ?? [];
  list.push({ name, base: words(name), geometry: p.geojson });
  byDistrict.set(districtKey(d), list);
}

/** Our district names fold differently in a few places from OSM's. */
const DISTRICT_ALIAS: Record<string, string> = { [fold('বান্দরবন')]: fold('বান্দরবান') };

/**
 * Upazilas OpenStreetMap has no boundary for, taken from OCHA by their
 * English name: [Bangla name as the Commission writes it, OCHA name, district slug].
 */
const OCHA_FALLBACK: [string, string, string][] = [
  ['মুজিবনগর', 'Mujibnagar', 'meherpur'], ['দুমকি', 'Dumki', 'patuakhali'], ['তিতাস', 'Titas', 'cumilla'], ['মেঘনা', 'Meghna', 'cumilla'],
  ['আশুগঞ্জ', 'Ashuganj', 'brahmanbaria'], ['বিজয়নগর', 'Bijoynagar', 'brahmanbaria'], ['জুড়ী', 'Juri', 'maulvibazar'], ['ফুলগাজী', 'Fulgazi', 'feni'],
  ['কবিরহাট', 'Kabirhat', 'noakhali'], ['সোনাইমুড়ী', 'Sonaimuri', 'noakhali'], ['দক্ষিণ সুরমা', 'Dakkhin Surma', 'sylhet'], ['ওসমানী নগর', 'Osmaninagar', 'sylhet'],
  ['কালুখালী', 'Kalukhali', 'rajbari'], ['ধনবাড়ী', 'Dhanbari', 'tangail'], ['কুষ্টিয়া সদর', 'Kushtia Sadar', 'kushtia'], ['শায়েস্তাগঞ্জ', 'Shayestaganj', 'habiganj'],
  ['সালথা', 'Saltha', 'faridpur'], ['লালমাই', 'Lalmai', 'cumilla'], ['কুমিল্লা সদর দক্ষিণ', 'Sadar Dakkhin', 'cumilla'], ['কর্ণফুলী', 'Karnaphuli', 'chattogram'],
  ['ঈদগাঁও', 'Eidgaon', 'coxs-bazar'], ['ডাসার', 'Dasar', 'madaripur'], ['মধ্যনগর', 'Madhyanagar', 'sunamganj'], ['শান্তিগঞ্জ', 'Shantiganj', 'sunamganj'],
  ['চাঁপাইনবাবগঞ্জ সদর', 'Chapainawabganj Sadar', 'chapainawabganj'], ['নলডাঙ্গা', 'Naldanga', 'natore'],
];
if (ochaPath) {
  const ocha = (JSON.parse(fs.readFileSync(ochaPath, 'utf8')) as { features: CityFeature[] }).features;
  const bnOf = new Map(seats.map((x) => [districtOf(x)?.slug, districtOf(x)?.bn] as const));
  for (const [bn, en, slug] of OCHA_FALLBACK) {
    const f = ocha.find((x) => x.properties.name_en === en);
    const dbn = bnOf.get(slug);
    if (!f || !dbn) { console.warn(`fallback missing: ${bn} (${en})`); continue; }
    const key = fold(dbn);
    const list = byDistrict.get(key) ?? [];
    if (!list.some((u) => u.base.join('') === words(bn).join(''))) list.push({ name: bn, base: words(bn), geometry: f.geometry as OsmPlace['geojson'] });
    byDistrict.set(key, list);
  }
}
const districtUpazilas = (bn: string) => byDistrict.get(fold(bn)) ?? byDistrict.get(DISTRICT_ALIAS[fold(bn)] ?? '') ?? [];

const CITY_BN: Record<string, string> = {
  'Dhaka North City Corporation': 'ঢাকা উত্তর সিটি কর্পোরেশন',
  'Dhaka South City Corporation': 'ঢাকা দক্ষিণ সিটি কর্পোরেশন',
  'Chattogram City Corporation': 'চট্টগ্রাম সিটি কর্পোরেশন',
  'Khulna City Corporation': 'খুলনা সিটি কর্পোরেশন',
  'Rajshahi City Corporation': 'রাজশাহী সিটি কর্পোরেশন',
  'Sylhet City Corporation': 'সিলেট সিটি কর্পোরেশন',
  'Barishal City Corporation': 'বরিশাল সিটি কর্পোরেশন',
  'Rangpur City Corporation': 'রংপুর সিটি কর্পোরেশন',
  'Mymensingh City Corporation': 'ময়মনসিংহ সিটি কর্পোরেশন',
  'Gazipur City Corporation': 'গাজীপুর সিটি কর্পোরেশন',
  'Narayanganj City Corporation': 'নারায়ণগঞ্জ সিটি কর্পোরেশন',
  'Cumilla City Corporation': 'কুমিল্লা সিটি কর্পোরেশন',
};
const DISTRICT_EN_ALIAS: Record<string, string> = { Chittagong: 'Chattogram', Comilla: 'Cumilla', Barisal: 'Barishal' };

/** A ward of a city corporation, or an annexed union or the cantonment, with the ward numbers it answers to. */
interface Ward {
  name: string;
  wards: number[];
  cantonment?: boolean;
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
}
type Ring = number[][];
const ringsOf = (g: { type: string; coordinates: unknown }): Ring[][] => (g.type === 'Polygon' ? [g.coordinates as Ring[]] : (g.coordinates as Ring[][]));
function inRing(p: number[], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > p[1]! !== yj! > p[1]! && p[0]! < ((xj! - xi!) * (p[1]! - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}
const inside = (p: number[], g: { type: string; coordinates: unknown }) => ringsOf(g).some((poly) => inRing(p, poly[0]!) && !poly.slice(1).some((h) => inRing(p, h)));
/** The area-weighted centre of a shape's outer rings. */
function centroid(g: { type: string; coordinates: unknown }): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (const poly of ringsOf(g)) {
    const r = poly[0]!;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const k = r[j]![0]! * r[i]![1]! - r[i]![0]! * r[j]![1]!;
      a += k;
      cx += (r[j]![0]! + r[i]![0]!) * k;
      cy += (r[j]![1]! + r[i]![1]!) * k;
    }
  }
  return [cx / (3 * a), cy / (3 * a)];
}
/** Douglas–Peucker: the ring without the points that bend it by less than `tol` degrees. */
function simplify(ring: Ring, tol: number): Ring {
  if (ring.length < 5) return ring;
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = ring[a]!, [bx, by] = ring[b]!;
    const len = Math.hypot(bx! - ax!, by! - ay!);
    let far = -1, dist = tol;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = ring[i]!;
      const d = len ? Math.abs((bx! - ax!) * (ay! - y!) - (ax! - x!) * (by! - ay!)) / len : Math.hypot(x! - ax!, y! - ay!);
      if (d > dist) { dist = d; far = i; }
    }
    if (far >= 0) { keep[far] = true; stack.push([a, far], [far, b]); }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

const DN = 'Dhaka North City Corporation';
const DS = 'Dhaka South City Corporation';
/**
 * The unions Dhaka's two city corporations took in in 2016–17, drawn as the
 * wards they became. The gazette gave each union two to four wards, and the
 * Commission's seats never split a union, so a union carries its group's
 * numbers: [geoBoundaries name, Bangla name, city, first ward, last ward].
 * Sultanganj is Kamrangirchar's third ward (55 and 56 are the old 91 and 92).
 */
const ANNEXED: [string, string, string, number, number][] = [
  ['Badda', 'বাড্ডা', DN, 37, 42], ['Bhatara', 'ভাটারা', DN, 37, 42], ['Satarkul', 'সাতারকুল', DN, 37, 42], ['Beraid', 'বেরাইদ', DN, 37, 42],
  ['Dumni', 'ডুমনি', DN, 43, 54], ['Uttar Khan', 'উত্তরখান', DN, 43, 54], ['Dakshinkhan', 'দক্ষিণখান', DN, 43, 54], ['Harirampur', 'হরিরামপুর', DN, 43, 54],
  ['Sultanganj', 'সুলতানগঞ্জ', DS, 57, 57], ['Shyampur', 'শ্যামপুর', DS, 58, 59], ['Dhania', 'দনিয়া', DS, 60, 61],
  ['Matuail', 'মাতুয়াইল', DS, 62, 70], ['Saralia', 'সারুলিয়া', DS, 62, 70], ['Demra', 'ডেমরা', DS, 62, 70],
  ['Manda', 'মান্ডা', DS, 71, 75], ['Dakshingaon', 'দক্ষিণগাঁও', DS, 71, 75], ['Nasirabad', 'নাসিরাবাদ', DS, 71, 75],
];
const BN_NUM = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);

/** Each city corporation's wards, by its OCHA name; an ADM4 shape whose centre lies in the city is the city's. */
const wardsByCity = new Map<string, Ward[]>();
if (wardsPath) {
  const adm4 = (JSON.parse(fs.readFileSync(wardsPath, 'utf8')) as { features: Adm4Feature[] }).features;
  const pieces = new Map<string, Map<string, { name: string; wards: number[]; cantonment?: boolean; polys: Ring[][] }>>();
  for (const f of adm4) {
    if (!/Polygon/.test(f.geometry.type)) continue;
    const c = centroid(f.geometry);
    const city = cities.find((x) => inside(c, x.geometry));
    if (!city) continue;
    const label = f.properties.shapeName;
    const base = label.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
    const numbered = /^Ward No-(\d+)/.exec(label);
    let piece: { key: string; name: string; wards: number[]; cantonment?: boolean } | null = null;
    if (/rest\. area/i.test(label) && city.properties.name_en === DN) piece = { key: 'camp', name: 'ঢাকা সেনানিবাস', wards: [], cantonment: true };
    else if (numbered) piece = { key: `w${Number(numbered[1])}`, name: '', wards: [Number(numbered[1])] };
    else {
      const a = ANNEXED.find((x) => x[0].toLowerCase() === base && x[2] === city.properties.name_en);
      if (a) piece = { key: `u:${a[0]}`, name: a[1], wards: Array.from({ length: a[4] - a[3] + 1 }, (_, i) => a[3] + i) };
    }
    if (!piece) continue;
    const list = pieces.get(city.properties.name_en) ?? new Map();
    const p = list.get(piece.key) ?? { name: piece.name, wards: piece.wards, cantonment: piece.cantonment, polys: [] };
    // A ward in parts ("Ward No-14 (part)") is one shape.
    p.polys.push(...ringsOf(f.geometry));
    list.set(piece.key, p);
    pieces.set(city.properties.name_en, list);
  }
  for (const [cityEn, list] of pieces) {
    // geoBoundaries numbers Dhaka's wards as the undivided city did (1–92, the
    // 2011 census). The 2011 split numbered each side afresh in the old order,
    // so a side's n-th old ward is its ward n: Dhaka South's ward 1 was 24,
    // Dhaka North's 24 was 37 (checked by place: old 24 is Khilgaon, 37
    // Tejgaon, 91 Kamrangirchar).
    const renumber = new Map<number, number>();
    if (cityEn === DN || cityEn === DS) {
      const old = [...list.values()].filter((p) => !p.name && !p.cantonment).map((p) => p.wards[0]!).sort((a, b) => a - b);
      const expect = cityEn === DN ? 36 : 56;
      if (old.length !== expect) console.warn(`${cityEn}: ${old.length} old wards, expected ${expect}`);
      old.forEach((n, i) => renumber.set(n, i + 1));
    }
    const out: Ward[] = [];
    for (const p of list.values()) {
      const wards = p.name ? p.wards : p.wards.map((n) => renumber.get(n) ?? n);
      out.push({
        name: p.name || `ওয়ার্ড ${wards.map(BN_NUM).join(', ')}`,
        wards,
        cantonment: p.cantonment,
        geometry: { type: 'MultiPolygon', coordinates: round(p.polys.map((poly) => poly.map((r) => simplify(r, 0.00005)))) as number[][][][] },
      });
    }
    out.sort((a, b) => (a.wards[0] ?? 999) - (b.wards[0] ?? 999));
    wardsByCity.set(cityEn, out);
  }
  console.log(`wards: ${[...wardsByCity].map(([c, w]) => `${c.replace(' City Corporation', '')} ${w.length}`).join(', ')}`);
}

type Part = 'whole' | 'part';
interface Out {
  name: string;
  kind: 'upazila' | 'city' | 'ward';
  /** A ward's city, in Bangla. */
  city?: string;
  geometry: unknown;
  seats: Record<string, Part>;
}
const perDistrict = new Map<string, Map<string, Out>>();
const report: string[] = [];
let matchedSeats = 0;

for (const seat of seats) {
  if (seat.reserved || !seat.boundaryBn) continue;
  const d = districtOf(seat);
  if (!d) continue;
  const ups = districtUpazilas(d.bn);
  const shapes = perDistrict.get(d.slug) ?? new Map<string, Out>();
  perDistrict.set(d.slug, shapes);
  const add = (key: string, make: () => Omit<Out, 'seats'>, part: Part) => {
    const o = shapes.get(key) ?? { ...make(), seats: {} };
    // A seat that holds an upazila whole wins over a clause that names part of it.
    if (o.seats[seat.slug] !== 'whole') o.seats[seat.slug] = part;
    shapes.set(key, o);
  };
  let found = 0;

  for (const c of clausesOf(seat.boundaryBn)) {
    const text = words(c.text);
    const isCity = text.some((w) => w.startsWith(fold('কর্পোরেশন')) || w.startsWith(fold('করপোরেশন')));
    const isCantonment = text.some((w) => w === fold('ক্যান্টনমেন্ট') || w === fold('সেনানিবাস'));
    if (c.kind === 'ward' || isCity || isCantonment) {
      const en = DISTRICT_EN_ALIAS[d.en] ?? d.en;
      let city = cities.filter((x) => (DISTRICT_EN_ALIAS[x.properties.district_en] ?? x.properties.district_en) === en);
      // "(খ) ঢাকা ক্যান্টনমেন্ট এলাকা": the cantonment, where its outline is known, in whichever of the district's cities holds it.
      if (isCantonment) {
        for (const cf of city) {
          const camp = (wardsByCity.get(cf.properties.name_en) ?? []).find((w) => w.cantonment);
          if (!camp) continue;
          add(`ward:${cf.properties.name_en}:${camp.name}`, () => ({ name: camp.name, kind: 'ward', city: CITY_BN[cf.properties.name_en] ?? cf.properties.name_en, geometry: camp.geometry }), 'whole');
          found++;
          break;
        }
        continue;
      }
      if (city.length > 1) {
        const north = text.some((w) => w === fold('উত্তর'));
        city = city.filter((x) => (north ? /North/.test(x.properties.name_en) : /South/.test(x.properties.name_en)));
      }
      if (city[0]) {
        const cf = city[0];
        const cityBn = CITY_BN[cf.properties.name_en] ?? cf.properties.name_en;
        const addCity = (part: Part) => add(`city:${cf.properties.name_en}`, () => ({ name: cityBn, kind: 'city', geometry: { type: cf.geometry.type, coordinates: round(cf.geometry.coordinates) } }), part);
        const addWard = (w: Ward, part: Part) => add(`ward:${cf.properties.name_en}:${w.name}`, () => ({ name: w.name, kind: 'ward', city: cityBn, geometry: w.geometry }), part);
        const cityWards = wardsByCity.get(cf.properties.name_en) ?? [];
        // Wards by number, each with its own outline; a number without one falls back to the pale whole city.
        const nums = c.kind === 'ward' && !c.partial ? wardNumbers(c.text) : [];
        if (nums.length) {
          const covered = new Set<number>();
          for (const w of cityWards) {
            const held = w.wards.filter((n) => nums.includes(n));
            if (!held.length) continue;
            addWard(w, held.length === w.wards.length ? 'whole' : 'part');
            for (const n of held) covered.add(n);
            found++;
          }
          const missing = nums.filter((n) => !covered.has(n));
          if (missing.length) {
            addCity('part');
            found++;
            if (cityWards.length) report.push(`${seat.nameBn}: no outline for ${cityBn} ward ${missing.join(', ')}`);
          }
          continue;
        }
        // The city whole ("রাজশাহী সিটি কর্পোরেশনের এলাকা সমূহ"), or all of it but some wards.
        addCity(c.partial ? 'part' : 'whole');
        found++;
        continue;
      }
    }
    // Upazilas named in the part of the clause that says what the seat holds.
    const head = words(c.holds[0] ?? c.text);
    // "খাগড়াছড়ি পার্বত্য জেলা": the whole district, every upazila in it.
    if (text.some((w) => w === fold('জেলা')) && runAt(text, words(d.bn))) {
      for (const u of ups) add(`up:${u.name}`, () => ({ name: u.name, kind: 'upazila', geometry: { type: u.geometry.type, coordinates: round(u.geometry.coordinates) } }), 'whole');
      found += ups.length;
      continue;
    }
    const hits = ups
      .map((u) => ({ u, m: runAt(head, u.base) }))
      .filter((h): h is { u: (typeof ups)[number]; m: [number, number] } => !!h.m)
      .map((h) => ({ u: h.u, at: h.m[0], len: h.m[1] }))
      // "নরসিংদী" inside "নরসিংদী সদর": the longer name at the same place wins.
      .filter((h, _, all) => !all.some((o) => o !== h && o.at <= h.at && o.at + o.len >= h.at + h.len && (o.len > h.len || o.u.base.join('').length > h.u.base.join('').length)))
      .sort((a, b) => a.at - b.at);
    hits.forEach((h, i) => {
      // In "পলাশ এবং নরসিংদী সদর উপজেলার নিম্নলিখিত…", only the last is partial.
      const part: Part = c.partial && i === hits.length - 1 ? 'part' : 'whole';
      add(`up:${h.u.name}`, () => ({ name: h.u.name, kind: 'upazila', geometry: { type: h.u.geometry.type, coordinates: round(h.u.geometry.coordinates) } }), part);
      found++;
    });
    if (!hits.length && !(c.kind === 'ward' || isCity)) report.push(`${seat.nameBn}: no upazila in "${c.text.slice(0, 70)}"`);
  }
  if (found) matchedSeats++;
  else report.push(`${seat.nameBn}: NOTHING MATCHED (${ups.length} upazilas known in ${d.bn})`);
}

fs.mkdirSync('public/geo', { recursive: true });
let files = 0;
for (const [slug, shapes] of perDistrict) {
  if (!shapes.size) continue;
  const fc = {
    type: 'FeatureCollection',
    attribution: 'Upazilas © OpenStreetMap contributors (ODbL); city corporations: OCHA COD-AB (CC BY-IGO); city wards: geoBoundaries, from BBS/OCHA 2015 (CC BY 3.0 IGO)',
    features: [...shapes.values()].map((o) => ({ type: 'Feature', properties: { name: o.name, kind: o.kind, ...(o.city ? { city: o.city } : {}), seats: o.seats }, geometry: o.geometry })),
  };
  fs.writeFileSync(`public/geo/${slug}.json`, JSON.stringify(fc));
  files++;
}
console.log(`seats with a map: ${matchedSeats} of ${seats.filter((s) => !s.reserved).length}; district files: ${files}`);
console.log(report.length ? `to check (${report.length}):\n  ${report.join('\n  ')}` : 'every clause matched');
