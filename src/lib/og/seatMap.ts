/**
 * The seat map drawn for a share card: the areas of src/lib/og/seatShapes.json
 * (every upazila, city ward or part of one, with the seats it belongs to) as
 * an SVG data URL a card can show as an image. The election card colours the
 * whole country seat by seat; a member's card draws their district with their
 * seat picked out.
 */
import shapes from './seatShapes.json';

export interface Area {
  /** The district's slug. */
  d: string;
  /** The seats the area belongs to: "w" wholly, "p" in part. */
  s: Record<string, 'w' | 'p'>;
  /** Outer rings and holes, [lon, lat]. */
  r: number[][][];
}

export const AREAS = (shapes as unknown as { areas: Area[] }).areas;

/** The first seat an area belongs to, the one whose colour it takes. */
export const seatOf = (a: Area): string | null => Object.keys(a.s)[0] ?? null;

export type Box = [minX: number, minY: number, maxX: number, maxY: number];

/** The extent of some areas, [lon, lat] corners. */
export function boxOf(areas: Area[]): Box {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const a of areas) for (const ring of a.r) for (const [x, y] of ring) {
    if (x! < minX) minX = x!;
    if (x! > maxX) maxX = x!;
    if (y! < minY) minY = y!;
    if (y! > maxY) maxY = y!;
  }
  return [minX, minY, maxX, maxY];
}

/** Whether two extents overlap. */
export const overlaps = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/**
 * The areas as an SVG data URL of size x size, fitted to `frame` (their own
 * extent by default; what falls outside is cut off) with the longitude
 * shortened by the cosine of the latitude, so the shapes keep their
 * proportions. `fill` gives each area's colour.
 */
export function mapImage(
  areas: Area[],
  size: number,
  fill: (a: Area) => string,
  { stroke = '#ffffff', strokeWidth = 0.8, frame }: { stroke?: string; strokeWidth?: number; frame?: Box } = {},
): string {
  const [minX, minY, maxX, maxY] = frame ?? boxOf(areas);
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = (maxX - minX) * k;
  const h = maxY - minY;
  const pad = 6;
  const scale = (size - 2 * pad) / Math.max(w, h);
  const ox = (size - w * scale) / 2;
  const oy = (size - h * scale) / 2;
  const pt = ([x, y]: number[]) => `${(ox + (x! - minX) * k * scale).toFixed(1)},${(oy + (maxY - y!) * scale).toFixed(1)}`;
  const paths = areas
    .map((a) => `<path d="${a.r.map((ring) => `M${ring.map(pt).join('L')}Z`).join('')}" fill="${fill(a)}" fill-rule="evenodd"/>`)
    .join('');
  // The borders drawn over every fill at once, so a shared edge is one line.
  const borders = areas.map((a) => a.r.map((ring) => `M${ring.map(pt).join('L')}Z`).join('')).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `${paths}<path d="${borders}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
