/**
 * Cuts a newer upazila out of the older one OpenStreetMap still draws around it.
 *
 * Many upazilas were carved out of older ones (তিতাস out of দাউদকান্দি,
 * দক্ষিণ সুরমা out of সিলেট সদর, কর্ণফুলী out of পটিয়া…), and OpenStreetMap
 * often keeps the older one's outline from before the split. Where the two
 * belong to different seats, the map drew one seat across part of the other.
 * Where two upazilas of a district overlap by more than 5% of the smaller,
 * the smaller is taken out of the larger.
 *
 * build-seat-geo.ts does this before it writes; on its own it redoes the
 * files already in public/geo (then run build-district-geo's seat points):
 *
 *   npx tsx scripts/carve-upazilas.ts
 */
import fs from 'node:fs';
import polygonClipping, { type MultiPolygon } from 'polygon-clipping';

interface Feature { properties: { name: string; kind: string }; geometry: { type: string; coordinates: unknown } }

const multi = (g: Feature['geometry']): MultiPolygon => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as MultiPolygon;
const ringArea = (r: number[][]) => { let a = 0; for (let k = 0, j = r.length - 1; k < r.length; j = k++) a += r[j]![0]! * r[k]![1]! - r[k]![0]! * r[j]![1]!; return Math.abs(a) / 2; };
const area = (m: MultiPolygon) => m.reduce((s, p) => s + p.reduce((t, r, i) => t + (i ? -1 : 1) * ringArea(r as number[][]), 0), 0);
const r4 = (m: MultiPolygon) => m.map((p) => p.map((r) => r.map(([x, y]) => [Math.round(x! * 1e4) / 1e4, Math.round(y! * 1e4) / 1e4]))) as MultiPolygon;

/** The district's upazilas with each one that sits inside another cut out of it; the names of the cuts, "larger − smaller". */
export function carve<F extends Feature>(features: F[]): string[] {
  const ups = features.filter((f) => f.properties.kind === 'upazila');
  const cuts: string[] = [];
  for (let i = 0; i < ups.length; i++) {
    for (let j = i + 1; j < ups.length; j++) {
      const a = ups[i]!, b = ups[j]!;
      const [big, small] = area(multi(a.geometry)) >= area(multi(b.geometry)) ? [a, b] : [b, a];
      try {
        const shared = area(polygonClipping.intersection(multi(big.geometry), multi(small.geometry)));
        if (shared <= 0.05 * area(multi(small.geometry))) continue;
        big.geometry = { type: 'MultiPolygon', coordinates: r4(polygonClipping.difference(multi(big.geometry), multi(small.geometry))) };
        cuts.push(`${big.properties.name} − ${small.properties.name}`);
      } catch {
        // polygon-clipping gives up on some rings that touch themselves: that pair is left as it is.
        cuts.push(`${big.properties.name} / ${small.properties.name} NOT CHECKED`);
      }
    }
  }
  return cuts;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/carve-upazilas.ts')) {
  for (const file of fs.readdirSync('public/geo').filter((f) => f.endsWith('.json') && f !== 'overview.json')) {
    const fc = JSON.parse(fs.readFileSync(`public/geo/${file}`, 'utf8')) as { features: Feature[] };
    const cuts = carve(fc.features);
    if (!cuts.length) continue;
    fs.writeFileSync(`public/geo/${file}`, JSON.stringify(fc));
    console.log(`${file}: ${cuts.join(', ')}`);
  }
}
