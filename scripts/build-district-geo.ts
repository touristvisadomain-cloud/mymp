/**
 * Builds public/geo/overview.json for the seat map on /nirbachon: the 64
 * districts' outlines, simplified, with their Bangla names and centres, and a
 * point for each of the 300 seats (the area-weighted centre of what
 * public/geo/<district>.json draws for the seat, a place held whole counting
 * four times one held in part). Run after build-seat-geo.ts.
 *
 *   npx tsx scripts/build-district-geo.ts <ocha-admin2.json>
 *
 * ocha-admin2.json: OCHA COD-AB bgd_admin2.geojson (CC BY-IGO).
 */
import fs from 'node:fs';
import { seats, districtOf } from '../src/lib/data';

const [adm2Path] = process.argv.slice(2);
if (!adm2Path) throw new Error('usage: build-district-geo.ts <ocha-admin2.json>');

type Ring = number[][];
interface Adm2 { properties: { adm2_name: string; center_lat: number; center_lon: number }; geometry: { type: string; coordinates: unknown } }
const ringsOf = (g: { type: string; coordinates: unknown }): Ring[][] => (g.type === 'Polygon' ? [g.coordinates as Ring[]] : (g.coordinates as Ring[][]));

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
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** OCHA's spellings that differ from our slugs. */
const ALIAS: Record<string, string> = { jhalokati: 'jhalokathi', joypurhat: 'jaipurhat', netrakona: 'netrokona', gopalganj: 'gopalgonj', lakshmipur: 'laxmipur', chapainababganj: 'chapainawabganj', moulvibazar: 'maulvibazar' };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

const bySlug = new Map<string, string>();
for (const s of seats) { const d = districtOf(s); if (d) bySlug.set(d.slug, d.bn); }

const adm2 = (JSON.parse(fs.readFileSync(adm2Path, 'utf8')) as { features: Adm2[] }).features;
const districts: { slug: string; name: string; center: [number, number]; polys: Ring[] }[] = [];
for (const f of adm2) {
  const key = norm(f.properties.adm2_name);
  const slug = [...bySlug.keys()].find((s) => norm(s) === (ALIAS[key] ?? key));
  if (!slug) { console.warn(`no district for ${f.properties.adm2_name}`); continue; }
  const polys = ringsOf(f.geometry).map((poly) => simplify(poly[0]!, 0.004).map(([lon, lat]) => [r3(lon!), r3(lat!)])).filter((ring) => ring.length >= 4);
  districts.push({ slug, name: bySlug.get(slug)!, center: [r3(f.properties.center_lon), r3(f.properties.center_lat)], polys });
}
districts.sort((a, b) => a.slug.localeCompare(b.slug));

// A seat's point: the centre of its drawn places, weighted by area.
const acc = new Map<string, { x: number; y: number; w: number }>();
for (const file of fs.readdirSync('public/geo')) {
  if (file === 'overview.json' || !file.endsWith('.json')) continue;
  const fc = JSON.parse(fs.readFileSync(`public/geo/${file}`, 'utf8')) as { features: { properties: { seats: Record<string, string> }; geometry: { type: string; coordinates: unknown } }[] };
  for (const ft of fc.features) {
    let a = 0, cx = 0, cy = 0;
    for (const poly of ringsOf(ft.geometry)) {
      const ring = poly[0]!;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const k = ring[j]![0]! * ring[i]![1]! - ring[i]![0]! * ring[j]![1]!;
        a += k; cx += (ring[j]![0]! + ring[i]![0]!) * k; cy += (ring[j]![1]! + ring[i]![1]!) * k;
      }
    }
    if (!a) continue;
    const area = Math.abs(a) / 2;
    for (const [slug, part] of Object.entries(ft.properties.seats)) {
      const w = area * (part === 'whole' ? 1 : 0.25);
      const o = acc.get(slug) ?? { x: 0, y: 0, w: 0 };
      o.x += (cx / (3 * a)) * w; o.y += (cy / (3 * a)) * w; o.w += w;
      acc.set(slug, o);
    }
  }
}
const points: Record<string, [number, number]> = {};
for (const [slug, o] of [...acc].sort(([a], [b]) => a.localeCompare(b))) points[slug] = [r3(o.x / o.w), r3(o.y / o.w)];
const missing = seats.filter((s) => !s.reserved && !points[s.slug]).map((s) => s.slug);
if (missing.length) console.warn(`no point for ${missing.join(', ')}`);

fs.writeFileSync('public/geo/overview.json', JSON.stringify({ attribution: 'Districts: OCHA COD-AB (CC BY-IGO)', districts, seats: points }));
console.log(`districts: ${districts.length}; seats placed: ${Object.keys(points).length}`);
