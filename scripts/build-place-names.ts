/**
 * The place finder's list of places the boundary text does not name
 * (public/place-names.json, read by src/lib/findSeat.ts's PlaceNames):
 *
 * - every union, with its upazila and district. The Election Commission's
 *   boundary text names a union only where a seat holds part of an upazila;
 *   the finder finds every other union through its upazila, read the way the
 *   text means it. From github.com/nuhil/bangladesh-geocode (MIT): 4,540
 *   unions in Bangla and English, each with its upazila.
 * - the metropolitan thanas (Dhaka, Chattogram, Khulna, Rajshahi, Sylhet,
 *   Gazipur, Narayanganj), which the text never names: it counts city wards.
 *   Rural thanas share their upazila's name, which the finder already finds.
 *   Each is placed on the seat map (public/geo/<district>.json) by
 *   OpenStreetMap's points for it (ODbL): its police station, the
 *   neighbourhoods named for it, or a Nominatim answer. A thana may reach past
 *   the ward its point stands in, so every thana is marked partial.
 *
 *   npx tsx scripts/build-place-names.ts <geocode dir> [police.json] [places.json …]
 *
 * <geocode dir> holds the repository's unions.json, upazilas.json and
 * districts.json. police.json is an Overpass answer for
 *   area["ISO3166-1"="BD"][admin_level=2]->.bd; nwr["amenity"="police"](area.bd); out center tags;
 * and each places.json one for place=suburb|neighbourhood|quarter|locality in
 * the cities' boxes (or the same shape built from Nominatim answers).
 * Every union must reach a seat: the script lists any that does not and stops.
 */
import fs from 'node:fs';
import path from 'node:path';
import { clausesOf, fold, seatsForUnion, type FinderSeat, type PlaceNames } from '../src/lib/findSeat';
import { finderSeats } from '../src/lib/finderSeats';

const [dir, policeFile, ...placeFiles] = process.argv.slice(2);
if (!dir) throw new Error('usage: npx tsx scripts/build-place-names.ts <geocode dir> [police.json] [places.json …]');

const rows = (f: string) => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return ((Array.isArray(j) ? j.find((x) => x && x.data)?.data : j.data) ?? []) as Record<string, string>[];
};

/**
 * Upazilas the geocode list spells or names differently from the boundary
 * text. ঙ/ং and ী/ি need no entry: the finder folds them.
 */
const UPAZILA_AS_IN_TEXT: Record<string, string> = {
  'সন্দ্বীপ': 'সন্দীপ',
  'মীরসরাই': 'মীরশ্বরাই',
  'বিয়ানীবাজার': 'বিয়ানী বাজার',
  'কোটচাঁদপুর': 'কোর্টচাদপুর',
  'রাণীশংকৈল': 'রানিশংকাইল',
  'জিয়ানগর': 'ইন্দুরকানী', // renamed
  'বোরহান উদ্দিন': 'বোরহানউদ্দিন',
  'দক্ষিণ সুনামগঞ্জ': 'শান্তিগঞ্জ', // renamed
  'বেলাবো': 'বেলাব',
  'সাদুল্লাপুর': 'সাদুল্যাপুর',
};

const asInText = new Map(Object.entries(UPAZILA_AS_IN_TEXT).map(([k, v]) => [fold(k), v]));
const seats: FinderSeat[] = finderSeats();
const districts = new Map(rows('districts.json').map((d) => [d.id, d]));
const upazilas = new Map(rows('upazilas.json').map((u) => [u.id, u]));

const unions: PlaceNames['unions'] = [];
const unresolved: string[] = [];
const cityUnions: string[] = [];
const sameDistrict = (a: string, b: string) => fold(a) === fold(b);
for (const u of rows('unions.json')) {
  const up = upazilas.get(u.upazilla_id);
  if (!up) continue;
  const district = districts.get(up.district_id)?.bn_name ?? '';
  const upazila = asInText.get(fold(up.bn_name)) ?? up.bn_name;
  const bn = u.bn_name.replace(/\s*ইউনিয়ন\s*$/, '').trim();
  const en = u.name.replace(/\s*union\s*$/i, '').trim();
  const upazilaEn = up.name.trim();
  if (seatsForUnion(bn, upazila, district, seats).length) { unions.push([bn, en, upazila, district, upazilaEn]); continue; }
  // Taken into a city corporation since the list was made (গাছা, কোনাবাড়ী, পূবাইল of
  // Gazipur Sadar): the seats that share the district's city wards.
  const inCity = seats.filter((s) => sameDistrict(s.district, district) && s.boundary && clausesOf(s.boundary).some((c) => c.kind === 'ward')).map((s) => s.slug);
  if (inCity.length) { unions.push([bn, en, upazila, district, upazilaEn, inCity]); cityUnions.push(`${bn} (${upazila}): ${inCity.join(', ')}`); continue; }
  unresolved.push(`${bn} (${upazila}, ${district})`);
}
console.log(`unions: ${unions.length}, now in a city corporation: ${cityUnions.length}, reaching no seat: ${unresolved.length}`);
if (cityUnions.length) console.log('  ' + cityUnions.join('\n  '));
if (unresolved.length) console.log('  ' + unresolved.slice(0, 60).join('\n  '));

/* ---------------------------------------------------------------- thanas */

/**
 * The metropolitan police's thanas, which the boundary text never names (it
 * counts city wards). Each is placed by OpenStreetMap's points for it: its
 * police station, or the neighbourhood it is named after ("মিরপুর ১", "মিরপুর ২"
 * all count for মিরপুর). The key is the city's district as the seats spell it.
 */
const METRO_THANAS: Record<string, [string, string][]> = {
  'ঢাকা': [
    ['রমনা', 'Ramna'], ['ধানমন্ডি', 'Dhanmondi'], ['শাহবাগ', 'Shahbagh'], ['নিউমার্কেট', 'New Market'], ['লালবাগ', 'Lalbagh'],
    ['হাজারীবাগ', 'Hazaribagh'], ['কোতোয়ালী', 'Kotwali'], ['সূত্রাপুর', 'Sutrapur'], ['চকবাজার', 'Chawkbazar'], ['বংশাল', 'Bangshal'],
    ['ওয়ারী', 'Wari'], ['গেন্ডারিয়া', 'Gendaria'], ['শ্যামপুর', 'Shyampur'], ['কদমতলী', 'Kadamtali'], ['যাত্রাবাড়ী', 'Jatrabari'],
    ['ডেমরা', 'Demra'], ['সবুজবাগ', 'Sabujbagh'], ['মুগদা', 'Mugda'], ['খিলগাঁও', 'Khilgaon'], ['রামপুরা', 'Rampura'],
    ['শাহজাহানপুর', 'Shahjahanpur'], ['মতিঝিল', 'Motijheel'], ['পল্টন', 'Paltan'], ['হাতিরঝিল', 'Hatirjheel'], ['তেজগাঁও', 'Tejgaon'],
    ['তেজগাঁও শিল্পাঞ্চল', 'Tejgaon Industrial Area'], ['শেরেবাংলা নগর', 'Sher-e-Bangla Nagar'], ['কলাবাগান', 'Kalabagan'],
    ['মোহাম্মদপুর', 'Mohammadpur'], ['আদাবর', 'Adabor'], ['মিরপুর', 'Mirpur'], ['পল্লবী', 'Pallabi'], ['কাফরুল', 'Kafrul'],
    ['শাহ আলী', 'Shah Ali'], ['রূপনগর', 'Rupnagar'], ['দারুস সালাম', 'Darus Salam'], ['ভাষানটেক', 'Bhashantek'],
    ['ক্যান্টনমেন্ট', 'Cantonment'], ['গুলশান', 'Gulshan'], ['বনানী', 'Banani'], ['বাড্ডা', 'Badda'], ['ভাটারা', 'Vatara'],
    ['খিলক্ষেত', 'Khilkhet'], ['উত্তরা পশ্চিম', 'Uttara West'], ['উত্তরা', 'Uttara'],
    ['বিমানবন্দর', 'Airport'], ['তুরাগ', 'Turag'], ['উত্তরখান', 'Uttarkhan'], ['দক্ষিণখান', 'Dakshinkhan'], ['কামরাঙ্গীরচর', 'Kamrangirchar'],
    ['বসুন্ধরা', 'Bashundhara'],
  ],
  'চট্টগ্রাম': [
    ['কোতোয়ালী', 'Kotwali'], ['পাঁচলাইশ', 'Panchlaish'], ['চান্দগাঁও', 'Chandgaon'], ['বায়েজিদ বোস্তামী', 'Bayazid Bostami'],
    ['খুলশী', 'Khulshi'], ['ডবলমুরিং', 'Double Mooring'], ['পাহাড়তলী', 'Pahartali'], ['হালিশহর', 'Halishahar'], ['আকবরশাহ', 'Akbarshah'],
    ['বন্দর', 'Bandar'], ['ইপিজেড', 'EPZ'], ['পতেঙ্গা', 'Patenga'], ['চকবাজার', 'Chawkbazar'], ['বাকলিয়া', 'Bakalia'], ['সদরঘাট', 'Sadarghat'],
  ],
  'খুলনা': [
    ['খুলনা সদর', 'Khulna Sadar'], ['সোনাডাঙ্গা', 'Sonadanga'], ['খালিশপুর', 'Khalishpur'], ['দৌলতপুর', 'Daulatpur'],
    ['খানজাহান আলী', 'Khan Jahan Ali'], ['আড়ংঘাটা', 'Arongghata'], ['হরিণটানা', 'Horintana'], ['লবণচরা', 'Labanchara'],
  ],
  'রাজশাহী': [
    ['বোয়ালিয়া', 'Boalia'], ['রাজপাড়া', 'Rajpara'], ['মতিহার', 'Motihar'], ['শাহ মখদুম', 'Shah Makhdum'], ['চন্দ্রিমা', 'Chandrima'],
    ['কাশিয়াডাঙ্গা', 'Kashiadanga'], ['কাটাখালী', 'Katakhali'], ['দামকুড়া', 'Damkura'], ['বেলপুকুর', 'Belpukur'], ['কর্ণহার', 'Karnahar'],
  ],
  'সিলেট': [
    ['কোতোয়ালী', 'Kotwali'], ['জালালাবাদ', 'Jalalabad'], ['দক্ষিণ সুরমা', 'South Surma'], ['শাহপরাণ', 'Shah Paran'], ['মোগলাবাজার', 'Moglabazar'],
  ],
  'গাজীপুর': [
    ['জয়দেবপুর', 'Joydebpur'], ['টঙ্গী', 'Tongi'],
  ],
  'নারায়ণগঞ্জ': [['ফতুল্লা', 'Fatullah'], ['সিদ্ধিরগঞ্জ', 'Siddhirganj']],
};

/** Stations that are not a thana's own: highway, railway, tourist and river police, outposts, camps, offices. */
const NOT_A_THANA = /highway|high way|hwy|outpost|fari|camp|investigation|tourist|railway|traffic|\bbox\b|range|headquarter|\bsp\b|office|training|river|naval|marine|industrial|airport|special|detective|\bcid\b|\bpbi\b|\brab\b|admin building|academy|university|szmch|residential|central|হাইওয়ে|ফাঁড়ি|ক্যাম্প/i;
const latinKey = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/,.*$/, ' ').replace(/\b(model|thana|police station|police|station|ps|complex|upazila)\b/g, ' ').replace(/[^a-z]/g, '');
const banglaOnly = (s: string) => s.replace(/\(.*?\)/g, ' ').replace(/[A-Za-z]+/g, ' ').replace(/(মডেল|থানা|পুলিশ|স্টেশন|ষ্টেশন|কমপ্লেক্স|এরিয়া|আদর্শ)/g, ' ').replace(/\s+/g, ' ').trim();

type Ring = [number, number][];
interface Area { kind: string; seats: Record<string, 'whole' | 'part'>; rings: Ring[][] }
const areas: Area[] = [];
for (const f of fs.readdirSync('public/geo').filter((x) => x.endsWith('.json') && x !== 'overview.json')) {
  const g = JSON.parse(fs.readFileSync(path.join('public/geo', f), 'utf8'));
  for (const ft of g.features ?? []) {
    const geom = ft.geometry;
    const polys: Ring[][] = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    areas.push({ kind: ft.properties.kind, seats: ft.properties.seats ?? {}, rings: polys });
  }
}
const inRing = (p: [number, number], r: Ring) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]!, [xj, yj] = r[j]!;
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inArea = (p: [number, number], a: Area) => a.rings.some((poly) => inRing(p, poly[0]!) && !poly.slice(1).some((h) => inRing(p, h)));
/** The most precise area a point stands in: a ward over its city, a city over an upazila. */
const areaAt = (lon: number, lat: number) => {
  const where = areas.filter((a) => inArea([lon, lat], a));
  return where.find((a) => a.kind === 'ward') ?? where.find((a) => a.kind === 'city') ?? where[0];
};

interface Point { bn: string; en: string; lon: number; lat: number; station: boolean }
const points: Point[] = [];
const osm = (file: string | undefined, station: boolean) => {
  if (!file || !fs.existsSync(file)) return;
  for (const x of JSON.parse(fs.readFileSync(file, 'utf8')).elements as { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[]) {
    const t = x.tags ?? {};
    const name = t.name ?? '';
    if (station && (!/thana|police station|থানা/i.test(`${name} ${t['name:bn'] ?? ''}`) || NOT_A_THANA.test(`${name} ${t['name:bn'] ?? ''}`))) continue;
    const lat = x.lat ?? x.center?.lat, lon = x.lon ?? x.center?.lon;
    if (lat == null || lon == null) continue;
    points.push({ bn: banglaOnly(t['name:bn'] ?? name), en: latinKey(t['name:en'] ?? (/[a-z]/i.test(name) ? name : '')), lon, lat, station });
  }
};
osm(policeFile, true);
for (const f of placeFiles) osm(f, false);

const districtOfSlug = new Map(seats.map((s) => [s.slug, fold(s.district)]));
const thanas: PlaceNames['thanas'] = [];
const notFound: string[] = [];
for (const [city, list] of Object.entries(METRO_THANAS)) {
  for (const [bn, en] of list) {
    const b = fold(bn), e = latinKey(en);
    // A station named for the thana, else the neighbourhoods named for it ("মিরপুর ১").
    const named = (p: Point) => fold(p.bn) === b || (!!p.en && p.en === e) || (!p.station && fold(p.bn).startsWith(b + ' ') && /^[০-৯\s]+$/.test(fold(p.bn).slice(b.length)));
    const inCity = (p: Point) => {
      const a = areaAt(p.lon, p.lat);
      return a && Object.keys(a.seats).some((s) => districtOfSlug.get(s) === fold(city)) ? a : undefined;
    };
    const found = points.filter(named).map((p) => ({ p, a: inCity(p) })).filter((x) => x.a);
    // With a station, the neighbourhoods near it too (মিরপুর ১, ২, ৭, ১৩ around Mirpur's station),
    // not a namesake across the city.
    const stations = found.filter((x) => x.p.station);
    const km = (p: Point, q: Point) => Math.hypot((p.lat - q.lat) * 111, (p.lon - q.lon) * 102);
    // Without one, the largest cluster of namesakes.
    const hub = stations.length ? stations : [found.reduce((best, x) => {
      const n = (y: typeof x) => found.filter((z) => km(z.p, y.p) < 3).length;
      return n(x) > n(best) ? x : best;
    }, found[0]!)].filter(Boolean);
    const use = found.filter((x) => x.p.station || hub.some((h) => km(x.p, h.p) < 3));
    const slugs = [...new Set(use.flatMap((x) => Object.keys(x.a!.seats)))];
    if (!slugs.length) { notFound.push(`${bn} (${city})`); continue; }
    thanas.push([bn, en, slugs, true]);
  }
}
console.log(`metropolitan thanas: ${thanas.length} placed; not found: ${notFound.length ? notFound.join(', ') : 'none'}`);

const out: PlaceNames = {
  unions,
  thanas,
  source: 'Unions: github.com/nuhil/bangladesh-geocode (MIT). Thanas placed by points from OpenStreetMap, © OpenStreetMap contributors (ODbL). Seats: the Election Commission’s boundary text.',
};
fs.writeFileSync('public/place-names.json', JSON.stringify(out));
console.log(`public/place-names.json: ${(fs.statSync('public/place-names.json').size / 1024).toFixed(0)} KB`);
if (unresolved.length) process.exitCode = 1;
