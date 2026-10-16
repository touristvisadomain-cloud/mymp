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
import Link from 'next/link';
import MemberPhoto from './MemberPhoto';
import { BUILT_KEY, googleKey, loadGoogle, onAuthFailure, resolve } from '@/lib/googleMaps';

export interface PinSeat {
  no: number;
  seat: string;
  slug: string;
  district: string;
  districtBn: string;
  member: { name: string; slug: string; photo: string | null; initial: string; profession: string | null } | null;
  party: string | null;
  partyBn: string | null;
  partyFull: string | null;
  /** The party's colour token, "var(--color-pbnp)". */
  color: string;
  votes: number | null;
  margin: number | null;
  runnerUp: { name: string; party: string | null; votes: number } | null;
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
/** The country, for Google's first view. */
const COUNTRY = { south: 20.6, west: 88.0, north: 26.65, east: 92.7 };

/** The symbols in public/party, by party. A party without one wears its colour. */
const SYMBOL: Record<string, string> = {
  BNP: '/party/bnp.webp', BJEI: '/party/bjei.svg', NCP: '/party/ncp.svg', BKM: '/party/bkm.webp', IMB: '/party/imb.webp',
  GOP: '/party/gop.svg', KM: '/party/km.webp', JAGPA: '/party/jagpa.svg', PSM: '/party/psm.svg', BJP: '/party/bjp.webp',
};
const BN = (n: number | string) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
const GRP = (n: number) => BN(n.toLocaleString('en-IN'));
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
function discIcon(color: string, size: number): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  return c.toDataURL();
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

export default function ElectionMap({ seats }: { seats: PinSeat[] }) {
  const [mode, setMode] = useState<Mode>('seats');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [vb, setVb] = useState<Box>(HOME);
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedDistrict, setPickedDistrict] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  /** Google Maps when the site has a key and Google takes it; SVG otherwise. Null while asking. */
  const [useGoogle, setUseGoogle] = useState<boolean | null>(BUILT_KEY ? true : null);
  /** Counts up when the Google map is made, so the effects that dress it run. */
  const [gmReady, setGmReady] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const gmBox = useRef<HTMLDivElement>(null);
  const gm = useRef<{ map: google.maps.Map; districts: google.maps.Data; areas: google.maps.Data; markers: Map<string, google.maps.Marker>; icons: Map<string, string> } | null>(null);
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
  const districtPaths = useMemo(() => (overview ? overview.districts.map((d) => ({ ...d, path: pathOf(d.polys), at: px(d.center[0], d.center[1]) })) : []), [overview]);
  /** Each district's parties by seats held, most first. */
  const lead = useMemo(() => {
    const out = new Map<string, { abbr: string; name: string; color: string; seats: number }[]>();
    for (const s of seats) {
      if (!s.party) continue;
      const list = out.get(s.district) ?? [];
      const p = list.find((x) => x.abbr === s.party) ?? (list.push({ abbr: s.party, name: s.partyBn ?? s.party, color: s.color, seats: 0 }), list[list.length - 1]!);
      p.seats++;
      out.set(s.district, list);
    }
    for (const list of out.values()) list.sort((a, b) => b.seats - a.seats);
    return out;
  }, [seats]);
  const parties = useMemo(() => {
    const m = new Map<string, { abbr: string; name: string; color: string; n: number }>();
    for (const s of seats) if (s.party) { const p = m.get(s.party) ?? { abbr: s.party, name: s.partyBn ?? s.party, color: s.color, n: 0 }; p.n++; m.set(s.party, p); }
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
      const mine: Area[] = fs.filter((f) => f.properties.seats[s.slug]).map((f) => ({ f, name: f.properties.name + (f.properties.kind === 'upazila' ? ' উপজেলা' : ''), part: f.properties.seats[s.slug]! }));
      setAreas(mine);
      const pts = framePoints(mine);
      if (pts.length) setVb(fitBox(pts.map(([lon, lat]) => px(lon!, lat!))));
    }).catch(() => {});
  };
  const pickDistrict = (slug: string) => { setPickedDistrict(slug); setPicked(null); setAreas([]); };
  const home = () => { setVb(HOME); close(); gm.current?.map.fitBounds(COUNTRY, 12); };
  useEffect(() => { live.current = { mode, open, pickDistrict, close }; });
  const hits = useMemo(() => {
    const v = q.trim();
    if (v.length < 2) return [];
    return seats.filter((s) => s.seat.includes(v) || s.slug.includes(v.toLowerCase()) || s.member?.name.includes(v) || s.districtBn.includes(v)).slice(0, 8);
  }, [q, seats]);

  // --- Google Maps: the map once its box is there, then what each change needs ---
  const disposeGm = () => {
    const m = gm.current;
    if (!m) return;
    for (const mk of m.markers.values()) mk.setMap(null);
    m.districts.setMap(null);
    m.areas.setMap(null);
    gm.current = null;
  };
  useEffect(() => {
    if (useGoogle !== true || !overview || !gmBox.current || gm.current) return;
    let cancelled = false;
    googleKey().then(loadGoogle).then((g) => {
      if (cancelled || !gmBox.current) return;
      const map = new g.maps.Map(gmBox.current, {
        mapTypeControl: true,
        mapTypeControlOptions: { mapTypeIds: ['roadmap', 'hybrid'] },
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        clickableIcons: false,
      });
      map.fitBounds(COUNTRY, 12);
      const districts = new g.maps.Data({ map });
      districts.addGeoJson({
        type: 'FeatureCollection',
        features: overview.districts.map((d) => ({ type: 'Feature', properties: { slug: d.slug, name: d.name }, geometry: { type: 'MultiPolygon', coordinates: d.polys.map((ring) => [ring]) } })),
      });
      districts.addListener('click', (e: google.maps.Data.MouseEvent) => {
        if (live.current.mode === 'districts') live.current.pickDistrict(String(e.feature.getProperty('slug')));
        else live.current.close();
      });
      const areaLayer = new g.maps.Data({ map });
      map.addListener('click', () => live.current.close());
      gm.current = { map, districts, areas: areaLayer, markers: new Map(), icons: new Map() };
      setGmReady((n) => n + 1);
    }).catch(() => setUseGoogle(false));
    return () => { cancelled = true; };
  }, [useGoogle, overview]);
  useEffect(() => disposeGm, []);

  // Markers: one per seat, its party's symbol; hidden by a dimmed chip or in the district view.
  useEffect(() => {
    const m = gm.current;
    if (!m || !placed.length) return;
    for (const { s, lon, lat } of placed) {
      let mk = m.markers.get(s.slug);
      if (!mk) {
        const color = resolve(s.color);
        mk = new google.maps.Marker({ position: { lat, lng: lon }, map: m.map, title: `${s.seat} · ${s.member?.name ?? 'শূন্য'}${s.partyBn ? ` (${s.partyBn})` : ''}`, icon: { url: discIcon(color, 52), scaledSize: new google.maps.Size(26, 26), anchor: new google.maps.Point(13, 13) }, optimized: true });
        mk.addListener('click', () => live.current.open(s));
        m.markers.set(s.slug, mk);
        if (s.party && SYMBOL[s.party]) symbolIcon(s.party, color, 52).then((url) => mk!.setIcon({ url, scaledSize: new google.maps.Size(26, 26), anchor: new google.maps.Point(13, 13) }));
      }
      const shown = mode === 'seats' && !off.has(s.party ?? '');
      if (mk.getVisible() !== shown) mk.setVisible(shown);
      const on = picked === s.slug;
      mk.setZIndex(on ? 1000 : 1);
      const icon = mk.getIcon() as google.maps.Icon | null;
      if (icon?.url) mk.setIcon({ ...icon, scaledSize: on ? new google.maps.Size(36, 36) : new google.maps.Size(26, 26), anchor: on ? new google.maps.Point(18, 18) : new google.maps.Point(13, 13) });
    }
  }, [gmReady, placed, mode, off, picked]);

  // District outlines: faint under the seats; the lead party's colour in the district view.
  useEffect(() => {
    const m = gm.current;
    if (!m) return;
    m.districts.setStyle((f) => {
      const slug = String(f.getProperty('slug'));
      const [a, b] = lead.get(slug) ?? [];
      const on = pickedDistrict === slug;
      if (mode === 'districts') {
        const tie = a && b && a.seats === b.seats;
        return { fillColor: a ? resolve(tie ? b.color : a.color) : '#9a9a9a', fillOpacity: pickedDistrict && !on ? 0.3 : 0.55, strokeColor: on ? '#17201b' : tie ? resolve(a.color) : '#ffffff', strokeWeight: on ? 3 : tie ? 3 : 1.2, cursor: 'pointer' };
      }
      return { fillColor: '#1f7a4f', fillOpacity: on ? 0.08 : 0, strokeColor: on ? '#17201b' : '#5f6b64', strokeWeight: on ? 2 : 1, strokeOpacity: on ? 1 : 0.6, clickable: true };
    });
  }, [gmReady, mode, lead, pickedDistrict]);

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
    m.map.fitBounds(b, { top: 40, bottom: 40, left: 380, right: 40 });
  }, [gmReady, current, areas]);

  const districtSeats = pickedDistrict ? seats.filter((s) => s.district === pickedDistrict).sort((a, b) => a.no - b.no) : [];
  const districtName = districtPaths.find((d) => d.slug === pickedDistrict)?.name ?? pickedDistrict;

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
        {tab('seats', 'আসন ও প্রতীক')}
        {tab('districts', 'জেলার রং')}
        <div className="relative ms-auto w-full sm:w-[300px]">
          <label htmlFor="election-map-q" className="sr-only">এমপি, আসন বা জেলা খুঁজুন</label>
          <input
            id="election-map-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="এমপি, আসন বা জেলার নাম…"
            autoComplete="off"
            className="w-full h-10 px-3 rounded-[10px] border-[1.5px] border-rule bg-surface text-[14px] outline-none focus:border-brand"
          />
          {hits.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full rounded-xl border border-rule bg-surface shadow-lg py-1 max-h-[260px] overflow-y-auto" role="listbox">
              {hits.map((s) => (
                <li key={s.slug} role="option" aria-selected={false}>
                  <button type="button" onClick={() => { setMode('seats'); open(s); }} className="w-full text-start px-3 py-2 flex justify-between gap-3 hover:bg-brandsoft">
                    <span className="font-semibold text-[14px] truncate">{s.member?.name ?? 'আসনটি শূন্য'}</span>
                    <span className="text-[12.5px] text-muted shrink-0">{s.seat}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {mode === 'seats' && (
        <div className="flex flex-wrap gap-1.5">
          {parties.map((p) => (
            <button
              key={p.abbr}
              type="button"
              onClick={() => setOff((o) => { const n = new Set(o); if (n.has(p.abbr)) n.delete(p.abbr); else n.add(p.abbr); return n; })}
              aria-pressed={!off.has(p.abbr)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-rule bg-surface text-[13px] ${off.has(p.abbr) ? 'opacity-40' : ''}`}
            >
              <span className="w-3.5 h-3.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
              {p.name} <span className="text-muted tnum">{BN(p.n)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative bg-surface border border-rule rounded-card shadow-card overflow-hidden h-[520px] sm:h-[640px]" style={{ touchAction: useGoogle === false ? 'none' : undefined }}>
        {useGoogle !== false ? (
          <div ref={gmBox} className="w-full h-full" role="region" aria-label={mode === 'seats' ? 'বাংলাদেশের ৩০০ সংসদীয় আসন, দলের প্রতীকে' : 'বাংলাদেশের ৬৪ জেলা, দলের রঙে'} />
        ) : (
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={mode === 'seats' ? 'বাংলাদেশের ৩০০ সংসদীয় আসন, দলের প্রতীকে' : 'বাংলাদেশের ৬৪ জেলা, দলের রঙে'}
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
                    <title>{mode === 'districts' && a ? `${d.name}: ${(lead.get(d.slug) ?? []).map((p) => `${p.name} ${BN(p.seats)}`).join(', ')}` : d.name}</title>
                  </path>
                </g>
              );
            })}
          </g>
          <g>
            {areaPaths.map((a, i) => (
              <path key={i} d={a.d} fill={current?.color} fillOpacity={a.part === 'whole' ? 0.3 : 0.12} stroke={current?.color} strokeWidth={2.5} strokeDasharray={a.part === 'part' ? '6 4' : undefined} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none">
                <title>{`${a.name} · ${a.part === 'whole' ? 'পুরোটা এই আসনে' : 'একাংশ এই আসনে'}`}</title>
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
                {SHORT[d.slug] ?? d.name}
              </text>
            ))}
          </g>
          {mode === 'seats' && (
            <g>
              {placed.map(({ s, xy }) => {
                const dim = off.has(s.party ?? '');
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
                      <title>{`${s.seat} · ${s.member?.name ?? 'শূন্য'}${s.partyBn ? ` (${s.partyBn})` : ''}`}</title>
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
            <button type="button" onClick={() => zoomAt(1.5, vb.x + vb.w / 2, vb.y + vb.h / 2)} aria-label="বড় করুন" title="বড় করুন" className="w-9 h-9 rounded-[10px] border border-rule bg-surface text-ink text-[18px] shadow-card hover:border-brand">+</button>
            <button type="button" onClick={() => zoomAt(1 / 1.5, vb.x + vb.w / 2, vb.y + vb.h / 2)} aria-label="ছোট করুন" title="ছোট করুন" className="w-9 h-9 rounded-[10px] border border-rule bg-surface text-ink text-[18px] shadow-card hover:border-brand">−</button>
            <button type="button" onClick={home} aria-label="পুরো দেশ" title="পুরো দেশ" className="w-9 h-9 rounded-[10px] border border-rule bg-surface text-ink text-[18px] shadow-card hover:border-brand">⌂</button>
          </div>
        )}
        {useGoogle !== false && (
          <button type="button" onClick={home} aria-label="পুরো দেশ" title="পুরো দেশ" className="absolute right-3 bottom-24 w-9 h-9 rounded-[10px] border border-rule bg-surface text-ink text-[18px] shadow-card hover:border-brand">⌂</button>
        )}
        {!overview && <p className="absolute inset-0 grid place-items-center text-[14px] text-muted">মানচিত্র আসছে…</p>}
        {useGoogle === false && <p className="absolute left-3 bottom-3 text-[12px] text-muted bg-surface border border-rule rounded-full px-2.5 py-1">স্ক্রল বা দুই আঙুলে zoom, টেনে সরান</p>}

        {(current || (mode === 'districts' && pickedDistrict)) && (
          <aside className="absolute left-3 top-3 w-[min(340px,calc(100%-24px))] max-h-[calc(100%-24px)] overflow-y-auto bg-surface border border-rule rounded-card shadow-lift p-4 z-10" aria-live="polite">
            <button type="button" onClick={close} aria-label="বন্ধ করুন" className="absolute right-2.5 top-1.5 text-[22px] leading-none text-muted hover:text-ink">×</button>
            {current ? (
              <>
                <div className="flex items-center gap-3 pe-6">
                  {current.member ? (
                    <MemberPhoto src={current.member.photo} alt="" initial={current.member.initial} size={56} sizeClass="w-14 h-14" />
                  ) : (
                    <span className="w-14 h-14 rounded-full bg-rulesoft grid place-items-center text-muted text-[20px]" aria-hidden="true">—</span>
                  )}
                  <div className="min-w-0">
                    <h3 className="display text-[17px] font-bold leading-snug">{current.member?.name ?? 'আসনটি এখন শূন্য'}</h3>
                    <p className="text-[13px] text-muted">{current.seat} · {current.districtBn} জেলা{current.member?.profession ? ` · ${current.member.profession}` : ''}</p>
                  </div>
                </div>
                {current.party && (
                  <span className="inline-flex items-center gap-1.5 mt-2.5 text-[13px] font-semibold rounded-full bg-brandsoft ps-1 pe-2.5 py-0.5">
                    <span className="w-5 h-5 rounded-full bg-center bg-cover" style={{ background: current.color, backgroundImage: SYMBOL[current.party] ? `url(${SYMBOL[current.party]})` : undefined }} aria-hidden="true" />
                    {current.partyFull ?? current.partyBn}
                  </span>
                )}
                <dl className="grid grid-cols-2 gap-2.5 mt-3">
                  <div className="rounded-[10px] bg-paper px-2.5 py-2"><dt className="text-[11.5px] text-muted">প্রাপ্ত ভোট</dt><dd className="text-[16px] font-bold tnum">{current.votes != null ? GRP(current.votes) : '—'}</dd></div>
                  <div className="rounded-[10px] bg-paper px-2.5 py-2"><dt className="text-[11.5px] text-muted">ব্যবধান</dt><dd className="text-[16px] font-bold tnum">{current.margin != null ? GRP(current.margin) : '—'}</dd></div>
                </dl>
                {current.runnerUp && (
                  <p className="mt-2.5 text-[12.5px] text-muted">নিকটতম: {current.runnerUp.name}{current.runnerUp.party ? ` (${current.runnerUp.party})` : ''}, {GRP(current.runnerUp.votes)} ভোট</p>
                )}
                <div className="flex gap-2 mt-3">
                  {current.member && <Link href={`/mp/${current.member.slug}`} className="flex-1 text-center h-9 leading-9 rounded-[9px] bg-brand text-white text-[13.5px] font-bold hover:bg-branddark">প্রোফাইল</Link>}
                  <Link href={`/ason/${current.slug}`} className="flex-1 text-center h-9 leading-9 rounded-[9px] border-[1.5px] border-rule text-[13.5px] font-bold hover:border-brand">আসনের পাতা</Link>
                </div>
                {areas.some((a) => a.part === 'part') && <p className="mt-2.5 text-[11.5px] text-muted">হালকা জায়গার একাংশ এই আসনে।</p>}
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3 pe-6">
                  <h3 className="display text-[18px] font-bold">{districtName}</h3>
                  <Link href={`/jela/${pickedDistrict}`} className="text-[13px] font-semibold text-brand hover:underline shrink-0">জেলার পাতা →</Link>
                </div>
                <p className="text-[13px] text-muted">{BN(districtSeats.length)}টি আসন: {(lead.get(pickedDistrict!) ?? []).map((p) => `${p.name} ${BN(p.seats)}`).join(', ') || 'ফল নেই'}</p>
                <ul className="mt-2 flex flex-col divide-y divide-rulesoft">
                  {districtSeats.map((s) => (
                    <li key={s.no} className="py-2 flex items-start gap-2.5">
                      <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
                      <div className="min-w-0 flex flex-col">
                        <button type="button" onClick={() => { setMode('seats'); open(s); }} className="text-start text-[13px] font-bold text-brand hover:underline">{s.seat}</button>
                        <span className="text-[14px] font-semibold leading-snug">{s.member?.name ?? <span className="text-muted font-normal">আসনটি এখন শূন্য</span>}</span>
                        <span className="text-[12.5px] text-muted tnum">{[s.partyBn, s.votes ? `${GRP(s.votes)} ভোট` : null, s.margin ? `ব্যবধান ${GRP(s.margin)}` : null].filter(Boolean).join(' · ')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        )}
      </div>
      <p className="text-[12.5px] text-muted leading-relaxed">
        জেলার সীমানা OCHA-র মানচিত্রে; আসনের জায়গা তার উপজেলা ও ওয়ার্ডের সীমানা থেকে হিসাব করা, আনুমানিক। {mode === 'districts' ? 'রং সেই জেলার বেশিরভাগ আসন যে দলের বর্তমান সংসদ সদস্যদের; দুই রং মানে সমান সমান।' : 'প্রতীকে চাপ দিলে আসনের এলাকা ও সংসদ সদস্য।'}{useGoogle !== false ? ' পটভূমির মানচিত্র Google Maps-এর।' : ''}
      </p>
    </div>
  );
}
