/**
 * Redraws the districts in public/geo/overview.json from the seat map's own
 * areas: each district's outline is the union of the upazilas, city
 * corporations and wards in public/geo/<district>.json, simplified.
 *
 * The outlines were OCHA's admin2 (scripts/build-district-geo.ts), simplified
 * to 400 m, while a picked seat or district is outlined from the per-district
 * files, which come from OpenStreetMap; on the election map the two did not
 * sit on each other and the coast and the border looked cut. From one source
 * every layer lines up. Names, centres and seat points are kept as they are.
 *
 * OpenStreetMap's coastal upazilas run out into the Bay to the maritime
 * limits, so each district is cut to the land: the outlines the file had
 * before (OCHA's, which stop at the coast), all 64 merged into one country.
 * The file is read from git, so the cut is the same however often this runs.
 *
 *   npx tsx scripts/build-district-outlines.ts [git-ref]   (default: the commit before this script, 60f467a)
 *
 * Run after build-seat-geo.ts and build-district-geo.ts.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';

const GEO = 'public/geo';
const OVERVIEW = `${GEO}/overview.json`;
/** About 150 m, a third of what it was: finer than the map shows a whole district. */
const TOLERANCE = 0.0015;

type Ring = [number, number][];

function simplify(ring: Ring, tol: number): Ring {
  if (ring.length < 5) return ring;
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = ring[a]!, [bx, by] = ring[b]!;
    const len = Math.hypot(bx - ax, by - ay);
    let far = -1, dist = tol;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = ring[i]!;
      const d = len ? Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / len : Math.hypot(x - ax, y - ay);
      if (d > dist) { dist = d; far = i; }
    }
    if (far >= 0) { keep[far] = true; stack.push([a, far], [far, b]); }
  }
  return ring.filter((_, i) => keep[i]);
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

interface Overview { attribution: string; districts: { slug: string; name: string; center: number[]; polys: number[][][] }[]; seats: Record<string, number[]> }
const overview = JSON.parse(fs.readFileSync(OVERVIEW, 'utf8')) as Overview;

// The land: OCHA's district outlines as they were in git, merged into the country.
const ref = process.argv[2] ?? '60f467a';
const ocha = JSON.parse(execFileSync('git', ['show', `${ref}:${OVERVIEW}`], { encoding: 'utf8', maxBuffer: 64 << 20 })) as Overview;
const landParts = ocha.districts.flatMap((d) => d.polys.map((ring) => [ring as Ring] as Polygon));
const land = polygonClipping.union(landParts[0]!, ...landParts.slice(1));

let points = 0;
for (const d of overview.districts) {
  const file = `${GEO}/${d.slug}.json`;
  if (!fs.existsSync(file)) {
    console.warn(`  ${d.slug}: no ${file}, outline kept`);
    continue;
  }
  const { features } = JSON.parse(fs.readFileSync(file, 'utf8')) as { features: { geometry: { type: string; coordinates: unknown } }[] };
  const parts: Polygon[] = [];
  for (const f of features) {
    if (f.geometry.type === 'Polygon') parts.push(f.geometry.coordinates as Polygon);
    else for (const p of f.geometry.coordinates as MultiPolygon) parts.push(p);
  }
  if (!parts.length) continue;
  const union = polygonClipping.intersection(polygonClipping.union(parts[0]!, ...parts.slice(1)), land);
  // Outer rings only, as before; the islands of a coastal district stay as their own polygons.
  const polys = union
    .map((poly) => simplify(poly[0] as Ring, TOLERANCE).map(([x, y]) => [r3(x), r3(y)]))
    .filter((ring) => ring.length >= 4);
  d.polys = polys;
  points += polys.reduce((n, r) => n + r.length, 0);
}

overview.attribution = 'Districts: the seat map\'s upazilas (OpenStreetMap contributors, ODbL), city corporations (OCHA COD-AB, CC BY-IGO) and city wards (geoBoundaries, CC BY 3.0 IGO), merged';
fs.writeFileSync(OVERVIEW, JSON.stringify(overview));
console.log(`${overview.districts.length} districts, ${points} points, ${(fs.statSync(OVERVIEW).size / 1024).toFixed(0)} KB`);
