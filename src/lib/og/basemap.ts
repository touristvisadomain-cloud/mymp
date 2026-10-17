/**
 * A real map behind a share card: OpenStreetMap's own tiles (roads, rivers,
 * place names) stitched to the card's size around a point, with a projection
 * to draw a seat's outline on top in the same place. (CARTO's free tiles
 * began asking for a key in 2026.)
 *
 * Web Mercator, 256px tiles. A card is drawn once and cached for a day, and
 * every tile is kept in memory once fetched, so the cards ask OpenStreetMap
 * for little, as its tile policy wants. The card must carry the attribution,
 * BASEMAP_CREDIT.
 */

const TILE = 256;
export const BASEMAP_CREDIT = '© OpenStreetMap contributors';

/** Tiles already fetched, oldest first; a few thousand cover every seat. */
const CACHE = new Map<string, string>();
const CACHE_MAX = 4000;

/** World pixel of a point at a zoom level. */
export function worldPx(lon: number, lat: number, z: number): [number, number] {
  const n = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

/**
 * The zoom (up to `max`, and not a whole number) at which a [lon, lat] box
 * just fits in w x h pixels: basemap() draws the next whole zoom's tiles
 * scaled down to it, so a box fills its space rather than the step below.
 */
export function fitZoom(box: [number, number, number, number], w: number, h: number, max = 14): number {
  const [x0, y1] = worldPx(box[0], box[1], 0);
  const [x1, y0] = worldPx(box[2], box[3], 0);
  const z = Math.log2(Math.min(w / Math.max(x1 - x0, 1e-9), h / Math.max(y1 - y0, 1e-9)));
  return Math.max(3, Math.min(max, z));
}

export interface Basemap {
  tiles: { src: string; left: number; top: number; size: number }[];
  /** A [lon, lat] point in the card's pixels. */
  project: (lon: number, lat: number) => [number, number];
}

async function tile(z: number, x: number, y: number): Promise<string | null> {
  const key = `${z}/${x}/${y}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  try {
    const r = await fetch(`https://tile.openstreetmap.org/${key}.png`, {
      headers: { 'User-Agent': 'mymp.bd share cards (mymp.bangladesh@gmail.com)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const src = `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
    if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value!);
    CACHE.set(key, src);
    return src;
  } catch {
    return null;
  }
}

/**
 * The tiles covering a width x height card at zoom z, with the point
 * [lon, lat] at card pixel (atX, atY).
 */
export async function basemap(lon: number, lat: number, zoom: number, width: number, height: number, atX = width / 2, atY = height / 2): Promise<Basemap> {
  // The next whole zoom's tiles, drawn at `scale` of their size.
  const z = Math.ceil(zoom - 1e-9);
  const scale = 2 ** (zoom - z);
  const size = TILE * scale;
  const [wx, wy] = worldPx(lon, lat, z);
  const ox = wx * scale - atX;
  const oy = wy * scale - atY;
  const max = 2 ** z;
  const jobs: Promise<{ src: string; left: number; top: number; size: number } | null>[] = [];
  for (let ty = Math.floor(oy / size); ty * size < oy + height; ty++) {
    if (ty < 0 || ty >= max) continue;
    for (let tx = Math.floor(ox / size); tx * size < ox + width; tx++) {
      const wrapped = ((tx % max) + max) % max;
      // Each tile a pixel larger than its place, so no hairline shows between them.
      jobs.push(tile(z, wrapped, ty).then((src) => (src ? { src, left: Math.floor(tx * size - ox), top: Math.floor(ty * size - oy), size: Math.ceil(size) + 1 } : null)));
    }
  }
  const tiles = (await Promise.all(jobs)).filter((t): t is NonNullable<typeof t> => !!t);
  return {
    tiles,
    project: (lo, la) => {
      const [x, y] = worldPx(lo, la, z);
      return [x * scale - ox, y * scale - oy];
    },
  };
}
