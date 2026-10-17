'use client';

/**
 * Who won where, on a map of the country (/nirbachon).
 *
 * - আসন ও প্রতীক: every seat is a marker at its place wearing its party's
 *   symbol, on Google Maps in Bangla (the base map with every town and road
 *   named) with the districts outlined. A tap on a marker draws the seat's
 *   own area (public/geo/<district>.json, solid where the seat holds a place
 *   whole, dashed where only part) and opens the member: photo, votes, lead,
 *   the runner-up. A name in the search box jumps to its seat; a party chip
 *   hides the others.
 * - জেলার রং: each district in the colour of the party holding most of its
 *   seats, two colours where it is a tie; a tap lists the district's seats.
 *
 * Without a Google key, or when Google refuses it, the same map is drawn as
 * plain SVG with the districts named by us. Outlines and seat points come
 * from public/geo/overview.json (scripts/build-district-geo.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/i18n/Link';
import MemberPhoto from './MemberPhoto';
import { useT } from '@/i18n/client';
import { plural } from '@/i18n/core';
import { BUILT_KEY, googleKey, loadGoogle, onAuthFailure, resolve } from '@/lib/googleMaps';
import { buildEntry, search, type Entry } from '@/lib/search';

/** A seat as the page gives it, its names and words already in the page's language. */
export interface PinSeat {
  no: number;
  seat: string;
  slug: string;
  district: string;
  districtName: string;
  member: { name: string; slug: string; photo: string | null; initial: string; profession: string | null } | null;
  party: string | null;
  /** The party's everyday short name ("বিএনপি" / "BNP"). */
  partyShort: string | null;
  partyFull: string | null;
  /** The party's colour token, "var(--color-pbnp)". */
  color: string;
  votes: number | null;
  margin: number | null;
  runnerUp: { name: string; party: string | null; votes: number } | null;
  /** The seat's, member's and district's names in the other language, for the search. */
  alt?: { seat: string; member: string | null; district: string; press?: string[] };
}

interface Overview {
  districts: { slug: string; name: string; center: [number, number]; polys: number[][][] }[];
  seats: Record<string, [number, number]>;
}
interface AreaFeature {
  properties: { name: string; kind: 'upazila' | 'city' | 'ward'; seats: Record<string, 'whole' | 'part'> };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}
interface Area { f: AreaFeature; name: string; part: 'whole' | 'part' }
interface Box { x: number; y: number; w: number; h: number }
type Mode = 'seats' | 'districts';

/** The SVG drawing: an equirectangular sheet of the country, 620 by 860 units. */
const W0 = 620;
const H0 = 860;
const K = 140;
const LON0 = 88;
const LAT0 = 26.7;
const COS = Math.cos((23.7 * Math.PI) / 180);
const px = (lon: number, lat: number): [number, number] => [(lon - LON0) * K * COS, (LAT0 - lat) * K];
const HOME: Box = { x: 0, y: 0, w: W0, h: H0 };
/** A marker's radius on screen, whatever the zoom. */
const R = 7;
/**
 * The first view: the whole country, as large as the box allows. Google's
 * road map zooms in whole steps, and a fit to the country's bounds rounds
 * down to one that leaves it small; a box at least this tall holds the
 * country at the next step (about 600 pixels north to south), so the view
 * is set by the box's size rather than fitted.
 */
function showCountry(map: google.maps.Map, box: HTMLElement) {
  // The country's extent fitted to the box, so it fills a wide screen and a
  // phone alike instead of one fixed zoom; a little padding on a phone.
  map.fitBounds({ south: 20.6, west: 88.0, north: 26.65, east: 92.7 }, box.clientWidth < 520 ? 4 : 12);
}

/** Whether the MP card sits over the map (from sm up) or below it (a phone). */
const cardBesideMap = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;

/** The symbols in public/party, by party. A party without one wears its colour. */
const SYMBOL: Record<string, string> = {
  BNP: '/party/bnp.webp', BJEI: '/party/bjei.svg', NCP: '/party/ncp.svg', BKM: '/party/bkm.webp', IMB: '/party/imb.webp',
  GOP: '/party/gop.svg', KM: '/party/km.webp', JAGPA: '/party/jagpa.svg', PSM: '/party/psm.svg', BJP: '/party/bjp.webp',
};
const SHORT: Record<string, string> = { chapainawabganj: 'চাঁপাইনবাবগঞ্জ' };

const ringsOf = (g: AreaFeature['geometry']): number[][][][] => (g.type === 'Polygon' ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]));
const pathOf = (rings: number[][][]) =>
  rings.map((ring) => 'M' + ring.map(([lon, lat]) => px(lon!, lat!).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z').join('');
const fitBox = (pts: [number, number][]): Box => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = Math.max((x1 - x0) * 1.7, W0 / 40);
  const h = Math.max((y1 - y0) * 1.7, H0 / 40);
  const fw = Math.max(w, h / (H0 / W0));
  const fh = fw * (H0 / W0);
  return { x: (x0 + x1) / 2 - fw / 2, y: (y0 + y1) / 2 - fh / 2, w: fw, h: fh };
};
/** The outer rings of what the seat holds whole (or of everything, for a seat of parts), as lon/lat. */
const framePoints = (areas: Area[]): number[][] => {
  const whole = areas.filter((a) => a.part === 'whole');
  return (whole.length ? whole : areas).flatMap((a) => ringsOf(a.f.geometry).flatMap((poly) => poly[0]!));
};

/**
 * An area's name on the English page. The geo files name places in Bangla
 * only; a numbered ward reads "Ward 9", and a named place is left unnamed
 * rather than spelt out by hand.
 */
const areaNameEn = (p: AreaFeature['properties']): string => {
  const ward = /^ওয়ার্ড\s*([০-৯\d]+)$/.exec(p.name.trim());
  return ward ? `Ward ${ward[1]!.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))}` : '';
};

let overviewOnce: Promise<Overview> | null = null;
const loadOverview = () => (overviewOnce ??= fetch('/geo/overview.json').then((r) => r.json() as Promise<Overview>));
const areaFiles = new Map<string, Promise<AreaFeature[]>>();
const loadAreas = (district: string) => {
  let p = areaFiles.get(district);
  if (!p) {
    p = fetch(`/geo/${district}.json`).then((r) => (r.ok ? (r.json() as Promise<{ features: AreaFeature[] }>) : { features: [] })).then((j) => j.features);
    areaFiles.set(district, p);
  }
  return p;
};

/**
 * A marker's icon: the party's symbol in a white disc with a ring in the
 * party's colour, drawn once per party; a plain disc for a party without a
 * symbol, and until the symbol has loaded.
 */
const icons = new Map<string, Promise<string>>();
const discs = new Map<string, string>();
function discIcon(color: string, size: number): string {
  const key = `${color}|${size}`;
  const done = discs.get(key);
  if (done) return done;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  const url = c.toDataURL();
  discs.set(key, url);
  return url;
}
function symbolIcon(party: string, color: string, size: number): Promise<string> {
  let p = icons.get(party);
  if (!p) {
    p = new Promise((done) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d')!;
        g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); g.fillStyle = color; g.fill();
        g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
        g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2); g.clip();
        const s = Math.max(size / img.width, size / img.height) * 0.92;
        g.drawImage(img, (size - img.width * s) / 2, (size - img.height * s) / 2, img.width * s, img.height * s);
        g.restore();
        done(c.toDataURL());
      };
      img.onerror = () => done(discIcon(color, size));
      img.src = SYMBOL[party]!;
    });
    icons.set(party, p);
  }
  return p;
}

/**
 * A tied district's two halves, cut on the diagonal from its box's top left to
 * bottom right, as the drawn map's two-colour gradient: [top-left, bottom-right].
 * Each ring is clipped to a half-plane; where a ring is not convex the cut can
 * leave a zero-width seam, which does not show since the halves are not stroked.
 */
function tieHalves(rings: number[][][]): [number[][][], number[][][]] {
  const pts = rings.flat();
  const xs = pts.map((p) => p[0]!), ys = pts.map((p) => p[1]!);
  const x0 = Math.min(...xs), y1 = Math.max(...ys);
  const w = Math.max(...xs) - x0 || 1, h = y1 - Math.min(...ys) || 1;
  const u = (p: number[]) => (p[0]! - x0) / w + (y1 - p[1]!) / h - 1;
  const clip = (ring: number[][], keep: (v: number) => boolean) => {
    const out: number[][] = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!, q = ring[(i + 1) % ring.length]!;
      const up = u(p), uq = u(q);
      if (keep(up)) out.push(p);
      if (keep(up) !== keep(uq)) {
        const k = up / (up - uq);
        out.push([p[0]! + (q[0]! - p[0]!) * k, p[1]! + (q[1]! - p[1]!) * k]);
      }
    }
    return out.length >= 3 ? [...out, out[0]!] : null;
  };
  const half = (keep: (v: number) => boolean) => rings.map((r) => clip(r, keep)).filter((r): r is number[][] => !!r);
  return [half((v) => v < 0), half((v) => v >= 0)];
}

/**
 * `districtNames`: the districts' English names by slug, on the English page;
 * the Bangla page names them from public/geo/overview.json.
 */
export default function ElectionMap({ seats, districtNames }: { seats: PinSeat[]; districtNames?: Record<string, string> }) {
  const t = useT();
  /** A district's name on the map: the English page's own, or overview.json's Bangla (shortened where long). */
  const nameOf = (d: { slug: string; name: string }, short = false) => districtNames?.[d.slug] ?? (short ? SHORT[d.slug] ?? d.name : d.name);
  const [mode, setMode] = useState<Mode>('seats');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [vb, setVb] = useState<Box>(HOME);
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedDistrict, setPickedDistrict] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  /** The parties a chip has picked; only their seats show. Empty shows every seat. */
  const [only, setOnly] = useState<Set<string>>(new Set());
  const hidden = (party: string | null) => only.size > 0 && !only.has(party ?? '');
  const [q, setQ] = useState('');
  /** Google Maps when the site has a key and Google takes it; SVG otherwise. Null while asking. */
  const [useGoogle, setUseGoogle] = useState<boolean | null>(BUILT_KEY ? true : null);
  /** Counts up when the Google map is made, so the effects that dress it run. */
  const [gmReady, setGmReady] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const gmBox = useRef<HTMLDivElement>(null);
  const gm = useRef<{ map: google.maps.Map; districts: google.maps.Data; ties: google.maps.Data; areas: google.maps.Data; markers: Map<string, google.maps.Marker>; icons: Map<string, string> } | null>(null);
  const drag = useRef<{ x: number; y: number; vb: Box } | null>(null);
  const pinch = useRef<{ d: number; vb: Box } | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  /** The latest handlers, for Google's listeners, which are set once. */
  const live = useRef<{ mode: Mode; open: (s: PinSeat) => void; pickDistrict: (d: string) => void; close: () => void }>({ mode, open: () => {}, pickDistrict: () => {}, close: () => {} });

  useEffect(() => {
    let alive = true;
    loadOverview().then((o) => alive && setOverview(o)).catch(() => {});
    if (!BUILT_KEY) googleKey().then((k) => alive && setUseGoogle(!!k));
    const offAuth = onAuthFailure(() => { if (alive) setUseGoogle(false); });
    return () => { alive = false; offAuth(); };
  }, []);

  const bySlug = useMemo(() => new Map(seats.map((s) => [s.slug, s])), [seats]);
  const placed = useMemo(() => (overview ? seats.flatMap((s) => { const p = overview.seats[s.slug]; return p ? [{ s, lon: p[0], lat: p[1], xy: px(p[0], p[1]) }] : []; }) : []), [overview, seats]);
  // The outline paths are for the SVG map only; on Google's map the districts are a data layer.
  const districtPaths = useMemo(
    () => (overview ? overview.districts.map((d) => ({ ...d, path: useGoogle === false ? pathOf(d.polys) : '', at: px(d.center[0], d.center[1]) })) : []),
    [overview, useGoogle],
  );
  /** Each district's parties by seats held, most first. */
  const lead = useMemo(() => {
    const out = new Map<string, { abbr: string; name: string; color: string; seats: number }[]>();
    for (const s of seats) {
      if (!s.party) continue;
      const list = out.get(s.district) ?? [];
      const p = list.find((x) => x.abbr === s.party) ?? (list.push({ abbr: s.party, name: s.partyShort ?? s.party, color: s.color, seats: 0 }), list[list.length - 1]!);
      p.seats++;
      out.set(s.district, list);
    }
    for (const list of out.values()) list.sort((a, b) => b.seats - a.seats);
    return out;
  }, [seats]);
  const parties = useMemo(() => {
    const m = new Map<string, { abbr: string; name: string; color: string; n: number }>();
    for (const s of seats) if (s.party) { const p = m.get(s.party) ?? { abbr: s.party, name: s.partyShort ?? s.party, color: s.color, n: 0 }; p.n++; m.set(s.party, p); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [seats]);
  const current = picked ? bySlug.get(picked) ?? null : null;
  const k = vb.w / W0;
  const areaPaths = useMemo(() => areas.map((a) => ({ ...a, d: pathOf(ringsOf(a.f.geometry).map((poly) => poly[0]!)) })), [areas]);

  // --- SVG zoom and pan ---
  const zoomAt = (f: number, cx: number, cy: number, from: Box = vb) => {
    const nw = Math.min(W0 * 1.2, Math.max(W0 / 40, from.w / f));
    const r = nw / from.w;
    setVb({ x: cx - (cx - from.x) * r, y: cy - (cy - from.y) * r, w: nw, h: from.h * r });
  };
  const svgPoint = (clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    const t = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return [t.x, t.y];
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || useGoogle !== false) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [x, y] = svgPoint(e.clientX, e.clientY);
      setVb((from) => { const nw = Math.min(W0 * 1.2, Math.max(W0 / 40, from.w / (e.deltaY < 0 ? 1.25 : 0.8))); const r = nw / from.w; return { x: x - (x - from.x) * r, y: y - (y - from.y) * r, w: nw, h: from.h * r }; });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [useGoogle]);
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ptrs.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, vb };
    else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), vb };
      drag.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const scale = vb.w / e.currentTarget.clientWidth;
    if (pinch.current && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const [x, y] = svgPoint((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      zoomAt(d / pinch.current.d, x, y, pinch.current.vb);
      return;
    }
    if (drag.current) setVb({ ...drag.current.vb, x: drag.current.vb.x - (e.clientX - drag.current.x) * scale, y: drag.current.vb.y - (e.clientY - drag.current.y) * scale });
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (!ptrs.current.size) drag.current = null;
  };

  // --- picking ---
  const close = () => { setPicked(null); setPickedDistrict(null); setAreas([]); };
  const open = (s: PinSeat) => {
    setPicked(s.slug);
    setPickedDistrict(s.district);
    setQ('');
    loadAreas(s.district).then((fs) => {
      const mine: Area[] = fs.filter((f) => f.properties.seats[s.slug]).map((f) => ({ f, name: t.en ? areaNameEn(f.properties) : f.properties.name + (f.properties.kind === 'upazila' ? ' উপজেলা' : ''), part: f.properties.seats[s.slug]! }));
      setAreas(mine);
      const pts = framePoints(mine);
      if (pts.length) setVb(fitBox(pts.map(([lon, lat]) => px(lon!, lat!))));
    }).catch(() => {});
  };
  const pickDistrict = (slug: string) => { setPickedDistrict(slug); setPicked(null); setAreas([]); };
  const home = () => { setVb(HOME); close(); if (gm.current && gmBox.current) showCountry(gm.current.map, gmBox.current); };
  useEffect(() => { live.current = { mode, open, pickDistrict, close }; });
  // The search: the site search's matching (src/lib/search.ts), so a seat,
  // member or district is found in either script, with either digits and the
  // spellings readers use: "ঢাকা ১৭", "dhaka 17" and "tarique" find the same
  // seat. A district's own row opens the district.
  const finder = useMemo(() => {
    const index: Entry[] = [];
    const perDistrict = new Map<string, { s: PinSeat; n: number }>();
    for (const s of seats) {
      index.push(buildEntry(['seat', s.seat, s.alt?.seat || s.slug.replace(/-/g, ' '), `s:${s.slug}`, '']));
      if (s.member) index.push(buildEntry(['member', s.member.name, s.alt?.member ?? '', `s:${s.slug}`, '']));
      for (const name of s.alt?.press ?? []) index.push(buildEntry(['member', name, '', `s:${s.slug}`, '']));
      const d = perDistrict.get(s.district);
      perDistrict.set(s.district, { s: d?.s ?? s, n: (d?.n ?? 0) + 1 });
    }
    for (const [slug, { s, n }] of perDistrict) {
      index.push(buildEntry(['district', s.districtName, s.alt?.district || slug, `d:${slug}`, String(n)]));
    }
    return index;
  }, [seats]);
  const found = useMemo(() => {
    const v = q.trim();
    const out = { seats: [] as PinSeat[], districts: [] as { slug: string; name: string; n: number }[] };
    if (v.length < 2) return out;
    for (const e of search(finder, v, 20)) {
      if (e.url.startsWith('d:')) {
        if (out.districts.length < 2) out.districts.push({ slug: e.url.slice(2), name: e.bn, n: Number(e.sub) });
        continue;
      }
      const s = bySlug.get(e.url.slice(2));
      if (s && !out.seats.includes(s) && out.seats.length < 8) out.seats.push(s);
    }
    return out;
  }, [q, finder, bySlug]);
  const hits = found.seats;
  const openDistrict = (slug: string) => { setQ(''); setMode('seats'); pickDistrict(slug); };

  // --- Google Maps: the map once its box is there, then what each change needs ---
  const disposeGm = () => {
    const m = gm.current;
    if (!m) return;
    for (const mk of m.markers.values()) mk.setMap(null);
    m.districts.setMap(null);
    m.ties.setMap(null);
    m.areas.setMap(null);
    gm.current = null;
  };
  useEffect(() => {
    if (useGoogle !== true || !overview || !gmBox.current || gm.current) return;
    let cancelled = false;
    googleKey().then((k) => loadGoogle(k, t.lang)).then((g) => {
      if (cancelled || !gmBox.current) return;
      const map = new g.maps.Map(gmBox.current, {
        mapTypeControl: true,
        mapTypeControlOptions: { mapTypeIds: ['roadmap', 'hybrid'] },
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        clickableIcons: false,
        // Zoom between the steps, so the country can fill a phone's width as well as a wide screen.
        isFractionalZoomEnabled: true,
      });
      showCountry(map, gmBox.current);
      // A tied district's two colours, under the district outlines.
      const ties = new g.maps.Data({ map });
      const districts = new g.maps.Data({ map });
      districts.addGeoJson({
        type: 'FeatureCollection',
        features: overview.districts.map((d) => ({ type: 'Feature', properties: { slug: d.slug, name: d.name }, geometry: { type: 'MultiPolygon', coordinates: d.polys.map((ring) => [ring]) } })),
      });
      const pickFrom = (e: google.maps.Data.MouseEvent) => {
        if (live.current.mode === 'districts') live.current.pickDistrict(String(e.feature.getProperty('slug')));
        else live.current.close();
      };
      districts.addListener('click', pickFrom);
      ties.addListener('click', pickFrom);
      const areaLayer = new g.maps.Data({ map });
      map.addListener('click', () => live.current.close());
      gm.current = { map, districts, ties, areas: areaLayer, markers: new Map(), icons: new Map() };
      setGmReady((n) => n + 1);
    }).catch(() => setUseGoogle(false));
    return () => { cancelled = true; };
  }, [useGoogle, overview, t.lang]);
  useEffect(() => disposeGm, []);

  // Markers: one per seat, its party's symbol; hidden by a party chip or in the district view.
  // Built a few dozen at a time while the browser is idle, so the page stays responsive as
  // the 300 appear; the effects after this one change only what a tap or a chip changes.
  const shownNow = useRef<(party: string | null) => boolean>(() => true);
  useEffect(() => {
    shownNow.current = (party) => mode === 'seats' && (only.size === 0 || only.has(party ?? ''));
  });
  useEffect(() => {
    const m = gm.current;
    if (!m || !placed.length) return;
    let cancelled = false;
    const size = new google.maps.Size(26, 26);
    const anchor = new google.maps.Point(13, 13);
    const idle = (fn: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 16));
    let i = 0;
    const batch = () => {
      if (cancelled) return;
      for (const end = Math.min(i + 40, placed.length); i < end; i++) {
        const { s, lon, lat } = placed[i]!;
        if (m.markers.has(s.slug)) continue;
        const color = resolve(s.color);
        const mk = new google.maps.Marker({
          position: { lat, lng: lon },
          map: m.map,
          title: `${s.seat} · ${s.member?.name ?? t('শূন্য', 'Vacant')}${s.partyShort ? ` (${s.partyShort})` : ''}`,
          icon: { url: discIcon(color, 52), scaledSize: size, anchor },
          optimized: true,
          visible: shownNow.current(s.party),
        });
        mk.addListener('click', () => live.current.open(s));
        m.markers.set(s.slug, mk);
        if (s.party && SYMBOL[s.party]) symbolIcon(s.party, color, 52).then((url) => { const cur = mk.getIcon() as google.maps.Icon | null; mk.setIcon({ url, scaledSize: cur?.scaledSize ?? size, anchor: cur?.anchor ?? anchor }); });
      }
      if (i < placed.length) idle(batch);
    };
    batch();
    return () => { cancelled = true; };
  }, [gmReady, placed, t]);

  // A party chip or the district view: only the markers whose visibility changes.
  useEffect(() => {
    const m = gm.current;
    if (!m) return;
    for (const { s } of placed) {
      const mk = m.markers.get(s.slug);
      const shown = mode === 'seats' && (only.size === 0 || only.has(s.party ?? ''));
      if (mk && mk.getVisible() !== shown) mk.setVisible(shown);
    }
  }, [gmReady, placed, mode, only]);

  // The picked seat's marker grows; the one picked before shrinks back.
  const pickedBefore = useRef<string | null>(null);
  useEffect(() => {
    const m = gm.current;
    if (!m) return;
    const resize = (slug: string | null, on: boolean) => {
      const mk = slug ? m.markers.get(slug) : undefined;
      const icon = mk?.getIcon() as google.maps.Icon | null | undefined;
      if (!mk || !icon?.url) return;
      mk.setZIndex(on ? 1000 : 1);
      mk.setIcon({ ...icon, scaledSize: on ? new google.maps.Size(36, 36) : new google.maps.Size(26, 26), anchor: on ? new google.maps.Point(18, 18) : new google.maps.Point(13, 13) });
    };
    if (pickedBefore.current !== picked) resize(pickedBefore.current, false);
    resize(picked, true);
    pickedBefore.current = picked;
  }, [gmReady, picked]);

  // District outlines: faint under the seats; the lead party's colour in the district view.
  useEffect(() => {
    const m = gm.current;
    if (!m) return;
    m.districts.setStyle((f) => {
      const slug = String(f.getProperty('slug'));
      const [a, b] = lead.get(slug) ?? [];
      const on = pickedDistrict === slug;
      if (mode === 'districts') {
        // A tie's colours are the two halves on the layer below; the district itself is only its outline.
        const tie = a && b && a.seats === b.seats;
        return { fillColor: a ? resolve(a.color) : '#9a9a9a', fillOpacity: tie ? 0 : pickedDistrict && !on ? 0.3 : 0.55, strokeColor: on ? '#17201b' : '#ffffff', strokeWeight: on ? 3 : 1.2, zIndex: on ? 2 : 1, cursor: 'pointer' };
      }
      return { fillColor: '#1f7a4f', fillOpacity: on ? 0.08 : 0, strokeColor: on ? '#17201b' : '#5f6b64', strokeWeight: on ? 2 : 1, strokeOpacity: on ? 1 : 0.6, clickable: true };
    });
    m.ties.forEach((f) => m.ties.remove(f));
    if (mode !== 'districts' || !overview) return;
    for (const d of overview.districts) {
      const [a, b] = lead.get(d.slug) ?? [];
      if (!a || !b || a.seats !== b.seats) continue;
      tieHalves(d.polys).forEach((rings, i) => {
        if (rings.length) m.ties.addGeoJson({ type: 'Feature', properties: { slug: d.slug, color: resolve((i ? b : a).color) }, geometry: { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) } });
      });
    }
    m.ties.setStyle((f) => {
      const on = pickedDistrict === f.getProperty('slug');
      return { fillColor: String(f.getProperty('color')), fillOpacity: pickedDistrict && !on ? 0.3 : 0.55, strokeWeight: 0, cursor: 'pointer' };
    });
  }, [gmReady, mode, lead, pickedDistrict, overview]);

  // The picked seat's area, and the view to it.
  useEffect(() => {
    const m = gm.current;
    if (!m) return;
    m.areas.forEach((f) => m.areas.remove(f));
    if (!current || !areas.length) return;
    const color = resolve(current.color);
    m.areas.addGeoJson({ type: 'FeatureCollection', features: areas.map((a) => ({ type: 'Feature', properties: { part: a.part, name: a.name }, geometry: a.f.geometry })) });
    m.areas.setStyle((f) => (f.getProperty('part') === 'whole'
      ? { fillColor: color, fillOpacity: 0.28, strokeColor: color, strokeWeight: 3, clickable: false }
      : { fillColor: color, fillOpacity: 0.1, strokeColor: color, strokeWeight: 2, strokeOpacity: 0.7, clickable: false }));
    const b = new google.maps.LatLngBounds();
    for (const [lon, lat] of framePoints(areas)) b.extend({ lat: lat!, lng: lon! });
    // On a wide screen the card covers the map's left edge, so the area sits to its right;
    // on a phone the card is below the map and the area takes the whole box. A padding wider
    // than the box makes Google zoom out to the whole world.
    m.map.fitBounds(b, cardBesideMap() ? { top: 40, bottom: 40, left: 380, right: 40 } : 28);
  }, [gmReady, current, areas]);

  useEffect(() => {
    if ((current || pickedDistrict) && !cardBesideMap()) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [current, pickedDistrict]);

  const districtSeats = pickedDistrict ? seats.filter((s) => s.district === pickedDistrict).sort((a, b) => a.no - b.no) : [];
  const pickedPath = districtPaths.find((d) => d.slug === pickedDistrict);
  const districtName = pickedPath ? nameOf(pickedPath) : districtNames?.[pickedDistrict ?? ''] ?? pickedDistrict;

  const tab = (m: Mode, label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => { setMode(m); home(); }}
      aria-pressed={mode === m}
      className={`h-9 px-3.5 rounded-lg text-[13.5px] font-semibold transition-colors ${mode === m ? 'bg-brand text-white' : 'bg-surface border border-rule text-ink hover:border-brand'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {tab('seats', t('আসন ও প্রতীক', 'Seats and symbols'))}
        {tab('districts', t('জেলার রং', 'District colours'))}
        <div className="relative ms-auto w-full sm:w-[300px]">
          <label htmlFor="election-map-q" className="sr-only">{t('এমপি, আসন বা জেলা খুঁজুন', 'Find an MP, seat or district')}</label>
          <input
            id="election-map-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter takes the first row; Escape clears.
              if (e.key === 'Escape') setQ('');
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (found.districts[0]) openDistrict(found.districts[0].slug);
              else if (hits[0]) { setMode('seats'); open(hits[0]); }
            }}
            placeholder={t('এমপি, আসন বা জেলার নাম…', 'Name of an MP, seat or district…')}
            autoComplete="off"
            className="w-full h-10 px-3 rounded-[10px] border-[1.5px] border-rule bg-surface text-[14px] outline-none focus:border-brand"
          />
          {q.trim().length >= 2 && !hits.length && !found.districts.length && (
            <p className="absolute z-30 mt-1 w-full rounded-xl border border-rule bg-surface shadow-lg px-3 py-2.5 text-[13px] text-muted">
              {t(`“${q.trim()}” নামে কোনো আসন, এমপি বা জেলা পাওয়া যায়নি।`, `No seat, MP or district found for “${q.trim()}”.`)}
            </p>
          )}
          {(hits.length > 0 || found.districts.length > 0) && (
            <ul className="absolute z-30 mt-1 w-full rounded-xl border border-rule bg-surface shadow-lg py-1 max-h-[300px] overflow-y-auto" role="listbox">
              {found.districts.map((d) => (
                <li key={`d-${d.slug}`} role="option" aria-selected={false}>
                  <button type="button" onClick={() => openDistrict(d.slug)} className="w-full text-start px-3 py-2 flex justify-between gap-3 hover:bg-brandsoft">
                    <span className="font-bold text-[14px] text-brand truncate">{t(`${d.name} জেলা`, `${d.name} district`)}</span>
                    <span className="text-[12.5px] text-muted shrink-0">{t(`${t.n(d.n)}টি আসন`, `${d.n} ${plural(d.n, 'seat', 'seats')}`)}</span>
                  </button>
                </li>
              ))}
              {hits.map((s) => (
                <li key={s.slug} role="option" aria-selected={false}>
                  <button type="button" onClick={() => { setMode('seats'); open(s); }} className="w-full text-start px-3 py-2 flex justify-between gap-3 hover:bg-brandsoft">
                    <span className="font-semibold text-[14px] truncate">{s.member?.name ?? t('আসনটি শূন্য', 'Seat vacant')}</span>
                    <span className="text-[12.5px] text-muted shrink-0">{s.seat}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {mode === 'seats' && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('দল বেছে নিন', 'Choose parties')}>
          <button
            type="button"
            onClick={() => setOnly(new Set())}
            aria-pressed={only.size === 0}
            className={`inline-flex items-center h-8 px-3 rounded-full border text-[13px] font-semibold transition-colors ${only.size === 0 ? 'bg-ink text-surface border-ink' : 'bg-surface border-rule hover:border-ink'}`}
          >
            {t('সব দল', 'All parties')}
          </button>
          {parties.map((p) => {
            const on = only.has(p.abbr);
            return (
              <button
                key={p.abbr}
                type="button"
                // A tap shows only this party; more taps add parties; a tap on a picked one takes it away.
                onClick={() => setOnly((o) => { const n = new Set(o); if (n.has(p.abbr)) n.delete(p.abbr); else n.add(p.abbr); return n; })}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-[13px] transition-colors ${
                  on ? 'border-transparent text-white font-semibold' : only.size ? 'border-rule bg-surface opacity-55 hover:opacity-100' : 'border-rule bg-surface hover:border-ink'
                }`}
                style={on ? { background: p.color } : undefined}
              >
                <span className="w-3.5 h-3.5 rounded-full ring-2 ring-white/70" style={{ background: p.color }} aria-hidden="true" />
                {p.name} <span className={`tnum ${on ? 'text-white/85' : 'text-muted'}`}>{t.n(p.n)}</span>
              </button>
            );
          })}
          {only.size > 0 && (
            <span className="text-[12.5px] text-muted ms-1" aria-live="polite">
              {(() => {
                const n = seats.filter((s) => !hidden(s.party)).length;
                return t(`${t.n(n)}টি আসন দেখানো হচ্ছে`, `Showing ${n} ${plural(n, 'seat', 'seats')}`);
              })()}
            </span>
          )}
        </div>
      )}

      <div className="relative">
      <div className="relative bg-surface border border-rule rounded-card shadow-card overflow-hidden h-[520px] sm:h-[640px]" style={{ touchAction: useGoogle === false ? 'none' : undefined }}>
        {useGoogle !== false ? (
          <div ref={gmBox} className="w-full h-full" role="region" aria-label={mode === 'seats' ? t('বাংলাদেশের ৩০০ সংসদীয় আসন, দলের প্রতীকে', 'Bangladesh’s 300 parliamentary seats, by party symbol') : t('বাংলাদেশের ৬৪ জেলা, দলের রঙে', 'Bangladesh’s 64 districts, in party colours')} />
        ) : (
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={mode === 'seats' ? t('বাংলাদেশের ৩০০ সংসদীয় আসন, দলের প্রতীকে', 'Bangladesh’s 300 parliamentary seats, by party symbol') : t('বাংলাদেশের ৬৪ জেলা, দলের রঙে', 'Bangladesh’s 64 districts, in party colours')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => { if ((e.target as Element).closest('[data-district]') || e.target === e.currentTarget) { if (mode === 'seats') close(); } }}
        >
          <defs>
            {parties.filter((p) => SYMBOL[p.abbr]).map((p) => (
              <pattern key={p.abbr} id={`party-${p.abbr}`} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
                <rect width="1" height="1" fill="#ffffff" />
                <image href={SYMBOL[p.abbr]} width="1" height="1" preserveAspectRatio="xMidYMid slice" />
              </pattern>
            ))}
          </defs>
          <g>
            {districtPaths.map((d, i) => {
              const [a, b] = lead.get(d.slug) ?? [];
              const tie = a && b && a.seats === b.seats;
              const fill = mode === 'districts' ? (tie ? `url(#tie-${d.slug})` : a ? a.color : 'var(--color-rulesoft)') : i % 2 ? 'var(--color-rulesoft)' : 'var(--color-surface)';
              return (
                <g key={d.slug}>
                  {tie && mode === 'districts' && (
                    <linearGradient id={`tie-${d.slug}`} x1="0" y1="0" x2="1" y2="1"><stop offset="50%" stopColor={a.color} /><stop offset="50%" stopColor={b.color} /></linearGradient>
                  )}
                  <path
                    data-district={d.slug}
                    d={d.path}
                    fill={fill}
                    fillOpacity={mode === 'districts' ? (pickedDistrict && pickedDistrict !== d.slug ? 0.45 : 0.9) : 1}
                    stroke={pickedDistrict === d.slug ? 'var(--color-ink)' : 'var(--color-rule)'}
                    strokeWidth={pickedDistrict === d.slug ? 2 : 1.2}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: mode === 'districts' ? 'pointer' : undefined }}
                    onClick={(e) => { if (mode === 'districts') { e.stopPropagation(); pickDistrict(d.slug); } }}
                  >
                    <title>{mode === 'districts' && a ? `${nameOf(d)}: ${(lead.get(d.slug) ?? []).map((p) => `${p.name} ${t.n(p.seats)}`).join(', ')}` : nameOf(d)}</title>
                  </path>
                </g>
              );
            })}
          </g>
          <g>
            {areaPaths.map((a, i) => (
              <path key={i} d={a.d} fill={current?.color} fillOpacity={a.part === 'whole' ? 0.3 : 0.12} stroke={current?.color} strokeWidth={2.5} strokeDasharray={a.part === 'part' ? '6 4' : undefined} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none">
                <title>{t.en ? [a.name, a.part === 'whole' ? 'Wholly in this seat' : 'Partly in this seat'].filter(Boolean).join(' · ') : `${a.name} · ${a.part === 'whole' ? 'পুরোটা এই আসনে' : 'একাংশ এই আসনে'}`}</title>
              </path>
            ))}
          </g>
          <g style={{ pointerEvents: 'none' }}>
            {districtPaths.map((d) => (
              <text
                key={d.slug}
                transform={`translate(${d.at[0]},${d.at[1] + (mode === 'seats' ? 14 * k : 0)}) scale(${k})`}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={mode === 'districts' ? '#ffffff' : 'var(--color-muted)'}
                stroke={mode === 'districts' ? 'rgba(0,0,0,.35)' : 'var(--color-surface)'}
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
                className="seatmap-label"
              >
                {nameOf(d, true)}
              </text>
            ))}
          </g>
          {mode === 'seats' && (
            <g>
              {placed.map(({ s, xy }) => {
                const dim = hidden(s.party);
                const on = picked === s.slug;
                return (
                  <g key={s.slug} transform={`translate(${xy[0]},${xy[1]}) scale(${k})`} opacity={dim ? 0.15 : 1} style={{ pointerEvents: dim ? 'none' : undefined }}>
                    <circle
                      r={R}
                      fill={SYMBOL[s.party ?? ''] ? `url(#party-${s.party})` : s.color}
                      stroke={on ? 'var(--color-ink)' : '#ffffff'}
                      strokeWidth={on ? 3 : 2}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); open(s); }}
                    >
                      <title>{`${s.seat} · ${s.member?.name ?? t('শূন্য', 'Vacant')}${s.partyShort ? ` (${s.partyShort})` : ''}`}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
        )}
        {useGoogle === false && (
          <div className="absolute right-3 top-3 flex flex-col gap-1.5">
            <button type="button" onClick={() => zoomAt(1.5, vb.x + vb.w / 2, vb.y + vb.h / 2)} aria-label={t('বড় করুন', 'Zoom in')} title={t('বড় করুন', 'Zoom in')} className="w-9 h-9 rounded-[10px] border border-rule bg-surface text-ink text-[18px] shadow-card hover:border-brand">+</button>
            <button type="button" onClick={() => zoomAt(1 / 1.5, vb.x + vb.w / 2, vb.y + vb.h / 2)} aria-label={t('ছোট করুন', 'Zoom out')} title={t('ছোট করুন', 'Zoom out')} className="w-9 h-9 rounded-[10px] border border-rule bg-surface text-ink text-[18px] shadow-card hover:border-brand">−</button>
            <button type="button" onClick={home} aria-label={t('পুরো দেশ', 'Whole country')} title={t('পুরো দেশ', 'Whole country')} className="w-9 h-9 rounded-[10px] border border-rule bg-surface text-ink text-[18px] shadow-card hover:border-brand">⌂</button>
          </div>
        )}
        {useGoogle !== false && (
          <button type="button" onClick={home} aria-label={t('পুরো দেশ', 'Whole country')} title={t('পুরো দেশ', 'Whole country')} className="absolute right-3 bottom-24 w-9 h-9 rounded-[10px] border border-rule bg-surface text-ink text-[18px] shadow-card hover:border-brand">⌂</button>
        )}
        {!overview && <p className="absolute inset-0 grid place-items-center text-[14px] text-muted">{t('মানচিত্র আসছে…', 'Loading the map…')}</p>}
        {useGoogle === false && <p className="absolute left-3 bottom-3 text-[12px] text-muted bg-surface border border-rule rounded-full px-2.5 py-1">{t('স্ক্রল বা দুই আঙুলে zoom, টেনে সরান', 'Scroll or pinch to zoom, drag to move')}</p>}

      </div>
        {(current || (mode === 'districts' && pickedDistrict)) && (
          <aside ref={cardRef} className="relative mt-3 sm:mt-0 sm:absolute sm:left-3 sm:top-3 sm:w-[min(340px,calc(100%-24px))] sm:max-h-[calc(100%-24px)] sm:overflow-y-auto bg-surface border border-rule rounded-card shadow-lift p-4 z-10 scroll-mt-24" aria-live="polite">
            <button type="button" onClick={close} aria-label={t('বন্ধ করুন', 'Close')} className="absolute right-2.5 top-1.5 text-[22px] leading-none text-muted hover:text-ink">×</button>
            {current ? (
              <>
                <div className="flex items-center gap-3 pe-6">
                  {current.member ? (
                    <MemberPhoto src={current.member.photo} alt="" initial={current.member.initial} size={56} sizeClass="w-14 h-14" />
                  ) : (
                    <span className="w-14 h-14 rounded-full bg-rulesoft grid place-items-center text-muted text-[20px]" aria-hidden="true">—</span>
                  )}
                  <div className="min-w-0">
                    <h3 className="display text-[17px] font-bold leading-snug">{current.member?.name ?? t('আসনটি এখন শূন্য', 'This seat is vacant')}</h3>
                    <p className="text-[13px] text-muted">{current.seat} · {current.districtName}{t(' জেলা', ' district')}{current.member?.profession ? ` · ${current.member.profession}` : ''}</p>
                  </div>
                </div>
                {current.party && (
                  <span className="inline-flex items-center gap-1.5 mt-2.5 text-[13px] font-semibold rounded-full bg-brandsoft ps-1 pe-2.5 py-0.5">
                    <span className="w-5 h-5 rounded-full bg-center bg-cover" style={{ background: current.color, backgroundImage: SYMBOL[current.party] ? `url(${SYMBOL[current.party]})` : undefined }} aria-hidden="true" />
                    {current.partyFull ?? current.partyShort}
                  </span>
                )}
                {current.votes != null ? (
                  <dl className="grid grid-cols-2 gap-2.5 mt-3">
                    <div className="rounded-[10px] bg-paper px-2.5 py-2"><dt className="text-[11.5px] text-muted">{t('প্রাপ্ত ভোট', 'Votes received')}</dt><dd className="text-[16px] font-bold tnum">{t.group(current.votes)}</dd></div>
                    <div className="rounded-[10px] bg-paper px-2.5 py-2"><dt className="text-[11.5px] text-muted">{t('ব্যবধান', 'Margin')}</dt><dd className="text-[16px] font-bold tnum">{current.margin != null ? t.group(current.margin) : '—'}</dd></div>
                  </dl>
                ) : (
                  // A seat whose 2026 count is not in the results yet: said so, rather than two empty boxes.
                  <p className="mt-3 rounded-[10px] bg-paper px-3 py-2.5 text-[13px] text-inksoft leading-relaxed">
                    {t('এই আসনের ২০২৬ নির্বাচনের ভোটের হিসাব এখনো যুক্ত হয়নি।', 'The vote count for this seat in the 2026 election has not been added yet.')}
                  </p>
                )}
                {current.runnerUp && (
                  <p className="mt-2.5 text-[12.5px] text-muted">{t('নিকটতম: ', 'Runner-up: ')}{current.runnerUp.name}{current.runnerUp.party ? ` (${current.runnerUp.party})` : ''}, {t.group(current.runnerUp.votes)}{t(' ভোট', plural(current.runnerUp.votes, ' vote', ' votes'))}</p>
                )}
                <div className="flex gap-2 mt-3">
                  {current.member && <Link href={`/mp/${current.member.slug}`} className="flex-1 text-center h-9 leading-9 rounded-[9px] bg-brand text-white text-[13.5px] font-bold hover:bg-branddark">{t('প্রোফাইল', 'Profile')}</Link>}
                  <Link href={`/ason/${current.slug}`} className="flex-1 text-center h-9 leading-9 rounded-[9px] border-[1.5px] border-rule text-[13.5px] font-bold hover:border-brand">{t('আসনের পাতা', 'Seat page')}</Link>
                </div>
                {areas.some((a) => a.part === 'part') && <p className="mt-2.5 text-[11.5px] text-muted">{t('হালকা জায়গার একাংশ এই আসনে।', 'Only part of each lightly shaded area is in this seat.')}</p>}
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3 pe-6">
                  <h3 className="display text-[18px] font-bold">{districtName}</h3>
                  <Link href={`/jela/${pickedDistrict}`} className="text-[13px] font-semibold text-brand hover:underline shrink-0">{t('জেলার পাতা →', 'District page →')}</Link>
                </div>
                <p className="text-[13px] text-muted">{t.count(districtSeats.length, 'টি আসন', 'seat', 'seats')}: {(lead.get(pickedDistrict!) ?? []).map((p) => `${p.name} ${t.n(p.seats)}`).join(', ') || t('ফল নেই', 'no results')}</p>
                <ul className="mt-2 flex flex-col divide-y divide-rulesoft">
                  {districtSeats.map((s) => (
                    <li key={s.no} className="py-2 flex items-start gap-2.5">
                      <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
                      <div className="min-w-0 flex flex-col">
                        <button type="button" onClick={() => { setMode('seats'); open(s); }} className="text-start text-[13px] font-bold text-brand hover:underline">{s.seat}</button>
                        <span className="text-[14px] font-semibold leading-snug">{s.member?.name ?? <span className="text-muted font-normal">{t('আসনটি এখন শূন্য', 'This seat is vacant')}</span>}</span>
                        <span className="text-[12.5px] text-muted tnum">{[s.partyShort, s.votes ? t(`${t.group(s.votes)} ভোট`, `${t.group(s.votes)} ${plural(s.votes, 'vote', 'votes')}`) : null, s.margin ? t(`ব্যবধান ${t.group(s.margin)}`, `margin ${t.group(s.margin)}`) : null].filter(Boolean).join(' · ')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        )}
      </div>
      {t.en ? (
        <p className="text-[12.5px] text-muted leading-relaxed">
          District boundaries are their upazilas’ (OpenStreetMap) merged and cut at the coast; each seat’s area is worked out from the boundaries of its upazilas and wards, and is approximate. {mode === 'districts' ? 'Each district is in the colour of the party whose current Members of Parliament hold most of its seats; two colours mean a tie.' : 'Tap a symbol to see the seat’s area and its Member of Parliament.'}{useGoogle !== false ? ' Background map from Google Maps.' : ''}
        </p>
      ) : (
        <p className="text-[12.5px] text-muted leading-relaxed">
          জেলার সীমানা তার উপজেলাগুলোর (OpenStreetMap) সীমানা জুড়ে, উপকূলে কেটে; আসনের জায়গা তার উপজেলা ও ওয়ার্ডের সীমানা থেকে হিসাব করা, আনুমানিক। {mode === 'districts' ? 'রং সেই জেলার বেশিরভাগ আসন যে দলের বর্তমান সংসদ সদস্যদের; দুই রং মানে সমান সমান।' : 'প্রতীকে চাপ দিলে আসনের এলাকা ও সংসদ সদস্য।'}{useGoogle !== false ? ' পটভূমির মানচিত্র Google Maps-এর।' : ''}
        </p>
      )}
    </div>
  );
}
