/**
 * Builds the constituency maps: one GeoJSON per district in public/geo/.
 *
 * The Election Commission describes each seat in words (lib/findSeat.ts reads
 * them clause by clause). Each clause is matched to the upazila boundaries
 * OpenStreetMap holds for the seat's district, and a city clause to the city
 * corporation's boundary from OCHA's administrative boundaries (OpenStreetMap
 * has no ward or city corporation polygons for Bangladesh). Wards and unions
 * have no public boundaries, so a seat that holds part of an upazila, or some
 * wards of a city, is drawn as the whole upazila or city, marked "part".
 *
 *   npx tsx scripts/build-seat-geo.ts <osm-upazilas.json> <city-corps.json> <ocha-admin3.json>
 *
 * osm-upazilas.json: Nominatim /lookup results (polygon_geojson, addressdetails,
 * accept-language=bn) for Bangladesh's admin_level=6 relations.
 * city-corps.json: OCHA COD-AB admin3 features whose name has "City Corporation".
 * ocha-admin3.json: all OCHA COD-AB admin3 features, for the upazilas
 * OpenStreetMap does not have (most made since 2014; see OCHA_FALLBACK).
 *
 * Boundaries: © OpenStreetMap contributors (ODbL); OCHA COD-AB (CC BY-IGO).
 */
import fs from 'node:fs';
import { seats, districtOf } from '../src/lib/data';
import { clausesOf, fold } from '../src/lib/findSeat';

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

const [osmPath, cityPath, ochaPath] = process.argv.slice(2);
if (!osmPath || !cityPath) throw new Error('usage: build-seat-geo.ts <osm-upazilas.json> <city-corps.json> [ocha-admin3.json]');
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

type Part = 'whole' | 'part';
interface Out {
  name: string;
  kind: 'upazila' | 'city';
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
    if (c.kind === 'ward' || isCity) {
      const en = DISTRICT_EN_ALIAS[d.en] ?? d.en;
      let city = cities.filter((x) => (DISTRICT_EN_ALIAS[x.properties.district_en] ?? x.properties.district_en) === en);
      if (city.length > 1) {
        const north = text.some((w) => w === fold('উত্তর'));
        city = city.filter((x) => (north ? /North/.test(x.properties.name_en) : /South/.test(x.properties.name_en)));
      }
      if (city[0]) {
        const cf = city[0];
        add(`city:${cf.properties.name_en}`, () => ({ name: CITY_BN[cf.properties.name_en] ?? cf.properties.name_en, kind: 'city', geometry: { type: cf.geometry.type, coordinates: round(cf.geometry.coordinates) } }), 'part');
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
    attribution: 'Upazilas © OpenStreetMap contributors (ODbL); city corporations: OCHA COD-AB (CC BY-IGO)',
    features: [...shapes.values()].map((o) => ({ type: 'Feature', properties: { name: o.name, kind: o.kind, seats: o.seats }, geometry: o.geometry })),
  };
  fs.writeFileSync(`public/geo/${slug}.json`, JSON.stringify(fc));
  files++;
}
console.log(`seats with a map: ${matchedSeats} of ${seats.filter((s) => !s.reserved).length}; district files: ${files}`);
console.log(report.length ? `to check (${report.length}):\n  ${report.join('\n  ')}` : 'every clause matched');
