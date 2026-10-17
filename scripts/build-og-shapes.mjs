#!/usr/bin/env node
/**
 * The seat map's areas, small enough for the share cards to draw: every
 * upazila, city ward or part of one in public/geo/<district>.json, with the
 * seats it belongs to, its outline simplified (Douglas–Peucker, about 250 m: under a pixel on a card)
 * and rounded to three decimals. The 3.3 MB of district files become one file
 * the card routes import (src/lib/og/seatShapes.json).
 *
 *   node scripts/build-og-shapes.mjs
 *
 * Run it again when public/geo changes (scripts/build-district-geo.ts).
 */
import fs from 'node:fs';
import path from 'node:path';

const GEO = 'public/geo';
const OUT = 'src/lib/og/seatShapes.json';
const TOLERANCE = 0.0025;

const sqSegDist = ([px, py], [ax, ay], [bx, by]) => {
  let x = ax, y = ay, dx = bx - ax, dy = by - ay;
  if (dx || dy) {
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = bx; y = by; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = px - x; dy = py - y;
  return dx * dx + dy * dy;
};

function simplify(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = sqSegDist(points[i], points[a], points[b]);
      if (d > max) { max = d; at = i; }
    }
    if (max > tol2) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (n) => Math.round(n * 1000) / 1000;

const areas = [];
let attribution = '';
for (const file of fs.readdirSync(GEO).filter((f) => f.endsWith('.json') && f !== 'overview.json').sort()) {
  const district = file.replace(/\.json$/, '');
  const geo = JSON.parse(fs.readFileSync(path.join(GEO, file), 'utf8'));
  attribution ||= geo.attribution ?? '';
  const { features } = geo;
  for (const f of features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = [];
    for (const poly of polys) {
      for (const ring of poly) {
        const r = simplify(ring, TOLERANCE).map(([x, y]) => [round(x), round(y)]);
        if (r.length >= 4) rings.push(r);
      }
    }
    if (!rings.length) continue;
    // "w" for a place wholly in the seat, "p" for one shared with another.
    const seats = Object.fromEntries(Object.entries(f.properties.seats ?? {}).map(([s, part]) => [s, part === 'whole' ? 'w' : 'p']));
    areas.push({ d: district, s: seats, r: rings });
  }
}

fs.writeFileSync(OUT, JSON.stringify({ attribution, areas }));
console.log(`${areas.length} areas, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB → ${OUT}`);
