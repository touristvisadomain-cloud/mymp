'use client';

/**
 * Constituencies on a street map, every village, market, road and river
 * named.
 *
 * - On a member's or a seat's page (`seat`): the seat's upazilas and city
 *   wards are filled in the party's colour, solid where the seat holds the
 *   whole place and pale where it holds only some unions, or wards without an
 *   outline of their own; the district's other places are outlined and named
 *   with their seats.
 * - On a district's page (`colors` for every seat): each upazila in the colour
 *   of the party holding its seat; a tap opens the seat's page.
 *
 * The base map is Google Maps, in Bangla, when NEXT_PUBLIC_GOOGLE_MAPS_KEY is
 * set (owner, 2026-10-15), and OpenStreetMap otherwise or when Google refuses
 * the key, so the page never shows an empty box. The map starts only when it
 * scrolls into view (or, with `startOnClick`, when asked), because Google
 * counts every map it draws.
 *
 * Boundaries: public/geo/<district>.json, built by scripts/build-seat-geo.ts
 * from OpenStreetMap's upazilas (ODbL), OCHA's city corporations (CC BY-IGO)
 * and geoBoundaries' city wards (CC BY 3.0 IGO).
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import 'leaflet/dist/leaflet.css';

type Part = 'whole' | 'part';
interface Feature {
  type: 'Feature';
  properties: { name: string; kind: 'upazila' | 'city' | 'ward'; city?: string; seats: Record<string, Part> };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}
interface Look {
  fill: string;
  fillOpacity: number;
  stroke: string;
  weight: number;
  dashed: boolean;
}

/** What either base map does for the frame around it. */
interface Engine {
  showHere(lat: number, lng: number): void;
  resize(): void;
  destroy(): void;
}

/** Baked in at build when the build had it; otherwise asked of the running site (api/maps-key). */
const BUILT_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
let keyAsked: Promise<string> | null = null;
function googleKey(): Promise<string> {
  if (BUILT_KEY) return Promise.resolve(BUILT_KEY);
  keyAsked ??= fetch('/api/maps-key')
    .then((r) => (r.ok ? (r.json() as Promise<{ key?: string }>) : { key: '' }))
    .then((j) => j.key ?? '')
    .catch(() => '');
  return keyAsked;
}
const GREY = '#6b7570';
const BN = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);

/** Is [lng, lat] inside a polygon ring? Ray casting, enough for an upazila. */
function inRing(pt: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > pt[1] !== yj! > pt[1] && pt[0] < ((xj! - xi!) * (pt[1] - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}
const polygonsOf = (f: Feature) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]));
function inFeature(pt: [number, number], f: Feature): boolean {
  return polygonsOf(f).some((rings) => inRing(pt, rings[0]!) && !rings.slice(1).some((hole) => inRing(pt, hole)));
}
const cityShort = (s: string) => s.replace(/ সিটি কর্পোরেশন$/, ' সিটি');
const placeName = (f: Feature) =>
  f.properties.kind === 'city' ? f.properties.name : f.properties.kind === 'ward' ? `${f.properties.name} (${cityShort(f.properties.city ?? '')})` : `${f.properties.name} উপজেলা`;
/** One feature's key: a ward's name repeats across a district's two cities. */
const keyOf = (kind: string, city: string | undefined, name: string) => `${kind}:${city ?? ''}:${name}`;
/** The places a seat holds, one city's wards and annexed unions gathered into one line. */
function placeList(fs: Feature[]): string[] {
  const out: string[] = [];
  const byCity = new Map<string, { nums: string[]; names: string[] }>();
  for (const f of fs) {
    if (f.properties.kind !== 'ward') { out.push(placeName(f)); continue; }
    const city = cityShort(f.properties.city ?? '');
    const c = byCity.get(city) ?? { nums: [], names: [] };
    if (f.properties.name.startsWith('ওয়ার্ড ')) c.nums.push(f.properties.name.slice('ওয়ার্ড '.length));
    else c.names.push(f.properties.name);
    byCity.set(city, c);
  }
  const lines = [...byCity].map(([city, c]) => `${city}র ${[c.nums.length ? `ওয়ার্ড ${c.nums.join(', ')}` : '', ...c.names].filter(Boolean).join(', ')}`);
  return [...lines, ...out];
}
/** Wards are small: their names show only from street level. */
const labelZoomOf = (f: Feature, base: number) => (f.properties.kind === 'ward' ? Math.max(base, 12) : base);

/**
 * Where a place's Bangla name sits: the centroid of its largest polygon, or
 * the middle of its outline when the centroid falls outside (a bent coast).
 */
function labelPoint(f: Feature): [number, number] {
  let best: number[][] = [];
  let bestArea = -1;
  for (const rings of polygonsOf(f)) {
    const ring = rings[0]!;
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j]![0]! * ring[i]![1]! - ring[i]![0]! * ring[j]![1]!;
    if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = ring; }
  }
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const k = best[j]![0]! * best[i]![1]! - best[i]![0]! * best[j]![1]!;
    a += k;
    cx += (best[j]![0]! + best[i]![0]!) * k;
    cy += (best[j]![1]! + best[i]![1]!) * k;
  }
  const c: [number, number] = a ? [cx / (3 * a), cy / (3 * a)] : [best[0]![0]!, best[0]![1]!];
  if (inRing(c, best)) return c;
  const mid = best[Math.floor(best.length / 2)]!;
  return [(best[0]![0]! + mid[0]!) / 2, (best[0]![1]! + mid[1]!) / 2];
}
/** The name written on the map: our own, in Bangla, whatever language the base map is in. */
const shortName = (f: Feature) => cityShort(f.properties.name);

/** The Maps JavaScript API, loaded once per page, in Bangla. */
let googleLoading: Promise<typeof google> | null = null;
function loadGoogle(key: string): Promise<typeof google> {
  if (typeof google !== 'undefined' && google.maps) return Promise.resolve(google);
  googleLoading ??= new Promise((resolve, reject) => {
    const cb = '__mympMapsReady';
    (window as unknown as Record<string, () => void>)[cb] = () => resolve(google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=bn&region=BD&v=weekly&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error('Google Maps could not be loaded'));
    document.head.appendChild(s);
  });
  return googleLoading;
}

interface Drawing {
  features: Feature[];
  /** The features the map opens on. */
  focus: Feature[];
  look: (f: Feature) => Look;
  label: (f: Feature) => string;
  onClick?: (f: Feature) => void;
  onHover: (text: string | null) => void;
  /** The zoom from which the Bangla place names show. */
  labelZoom: number;
}

async function startGoogle(el: HTMLElement, d: Drawing, key: string): Promise<Engine> {
  const g = await loadGoogle(key);
  const map = new g.maps.Map(el, {
    mapTypeControl: true,
    mapTypeControlOptions: { mapTypeIds: ['roadmap', 'hybrid'] },
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative',
  });
  const byName = new Map(d.features.map((f) => [keyOf(f.properties.kind, f.properties.city, f.properties.name), f]));
  const own = (gf: google.maps.Data.Feature) => byName.get(keyOf(String(gf.getProperty('kind')), gf.getProperty('city') as string | undefined, String(gf.getProperty('name'))))!;
  map.data.addGeoJson({ type: 'FeatureCollection', features: d.features });
  map.data.setStyle((gf) => {
    const l = d.look(own(gf));
    // The data layer draws no dashes: a part is told apart by its paler fill and thinner line.
    return { fillColor: l.fill, fillOpacity: l.fillOpacity, strokeColor: l.stroke, strokeWeight: l.weight, strokeOpacity: l.dashed ? 0.7 : 1, cursor: d.onClick ? 'pointer' : undefined };
  });
  map.data.addListener('mouseover', (e: google.maps.Data.MouseEvent) => d.onHover(d.label(own(e.feature))));
  map.data.addListener('mouseout', () => d.onHover(null));
  if (d.onClick) map.data.addListener('click', (e: google.maps.Data.MouseEvent) => d.onClick!(own(e.feature)));
  const bounds = new g.maps.LatLngBounds();
  for (const f of d.focus) for (const rings of polygonsOf(f)) for (const [lng, lat] of rings[0]!) bounds.extend({ lat: lat!, lng: lng! });
  map.fitBounds(bounds, 18);
  // Google fits to the box it sees at the start; once drawn, and while the
  // box settles in the first seconds, fit again so the district fills it.
  g.maps.event.addListenerOnce(map, 'idle', () => map.fitBounds(bounds, 18));
  const ro = new ResizeObserver(() => {
    if (el.clientWidth > 0) map.fitBounds(bounds, 18);
  });
  ro.observe(el);
  setTimeout(() => ro.disconnect(), 4000);
  // Every upazila and city named in Bangla on top of Google's own labels.
  const labels = d.features.map((f) => {
    const [lng, lat] = labelPoint(f);
    const marker = new g.maps.Marker({
      position: { lat, lng },
      map,
      clickable: false,
      icon: { path: g.maps.SymbolPath.CIRCLE, scale: 0 },
      label: { text: shortName(f), className: 'seatmap-label', color: '#17201b', fontSize: '13px', fontWeight: '700' },
      zIndex: 1000,
    });
    return { marker, zoom: labelZoomOf(f, d.labelZoom) };
  });
  // Far out, a district's names run into one another: they show from the zoom where they fit.
  const showLabels = () => {
    const z = map.getZoom() ?? 0;
    for (const l of labels) l.marker.setVisible(z >= l.zoom);
  };
  map.addListener('zoom_changed', showLabels);
  showLabels();
  let here: google.maps.Marker | null = null;
  return {
    showHere(lat, lng) {
      here?.setMap(null);
      here = new g.maps.Marker({
        position: { lat, lng },
        map,
        title: 'আপনি এখানে',
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 },
      });
      map.panTo({ lat, lng });
      if ((map.getZoom() ?? 0) < 12) map.setZoom(12);
    },
    resize() {
      map.fitBounds(bounds, 18);
    },
    destroy() {
      ro.disconnect();
      here?.setMap(null);
      for (const l of labels) l.marker.setMap(null);
    },
  };
}

async function startLeaflet(el: HTMLElement, d: Drawing): Promise<Engine> {
  const L = (await import('leaflet')).default;
  const m = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(m);
  const layer = L.geoJSON({ type: 'FeatureCollection', features: d.features } as never, {
    style: (f) => {
      const l = d.look(f as unknown as Feature);
      return { color: l.stroke, weight: l.weight, fillColor: l.fill, fillOpacity: l.fillOpacity, dashArray: l.dashed ? '6 5' : undefined };
    },
    onEachFeature: (f, lyr) => {
      lyr.bindTooltip(d.label(f as unknown as Feature), { sticky: true });
      if (d.onClick) lyr.on('click', () => d.onClick!(f as unknown as Feature));
    },
  }).addTo(m);
  void layer;
  const labels = d.features.map((f) => {
    const [lng, lat] = labelPoint(f);
    const marker = L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: 'seatmap-label seatmap-label-osm', html: shortName(f), iconSize: undefined }) });
    return { marker, zoom: labelZoomOf(f, d.labelZoom) };
  });
  const showLabels = () => {
    const z = m.getZoom();
    for (const l of labels) {
      if (z >= l.zoom) l.marker.addTo(m);
      else l.marker.remove();
    }
  };
  m.on('zoomend', showLabels);
  const focus = L.geoJSON({ type: 'FeatureCollection', features: d.focus } as never);
  const bounds = focus.getBounds();
  // The box may still be laid out when the map starts: fit again once it has a size.
  const fit = () => {
    m.invalidateSize();
    m.fitBounds(bounds, { padding: [18, 18] });
  };
  fit();
  showLabels();
  const ro = new ResizeObserver(() => {
    if (el.clientWidth > 0) fit();
  });
  ro.observe(el);
  setTimeout(() => ro.disconnect(), 4000);
  // A click on the map, once, lets the wheel zoom it; until then the page scrolls past it.
  m.once('focus', () => m.scrollWheelZoom.enable());
  let here: ReturnType<typeof L.circleMarker> | null = null;
  return {
    showHere(lat, lng) {
      here?.remove();
      here = L.circleMarker([lat, lng], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(m);
      m.setView([lat, lng], Math.max(m.getZoom(), 12));
    },
    resize() {
      setTimeout(fit, 60);
    },
    destroy() {
      ro.disconnect();
      m.remove();
    },
  };
}

/** A CSS custom property's value, for map libraries that take colours as text. */
function resolve(color: string): string {
  const v = color.match(/^var\((--[^)]+)\)$/)?.[1];
  return (v && getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || color;
}

export default function SeatMap({
  geoUrl,
  seat,
  colors,
  seatNames,
  title,
  note,
  startOnClick = false,
}: {
  geoUrl: string;
  /** A seat's own map: its slug and the party colour it is drawn in. */
  seat?: { slug: string; color: string };
  /** A district's map: every seat's colour by slug. */
  colors?: Record<string, string>;
  /** Every seat in the district, by slug, for the labels. */
  seatNames: Record<string, string>;
  /** Shown in the bar above the map. */
  title: string;
  /** The Election Commission's words, shown when the seat holds only part of a place. */
  note?: string | null;
  /** Draw the map only when asked (the district page), not when it scrolls into view. */
  startOnClick?: boolean;
}) {
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const features = useRef<Feature[]>([]);
  const [wanted, setWanted] = useState(false);
  const [big, setBig] = useState(false);
  const [where, setWhere] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ whole: string[]; part: string[] }>({ whole: [], part: [] });
  const [failed, setFailed] = useState(false);
  const [usingGoogle, setUsingGoogle] = useState(!!BUILT_KEY);

  // Start when the map comes into view, a screen early, unless it waits for a tap.
  useEffect(() => {
    if (startOnClick || wanted || !frame.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setWanted(true);
        io.disconnect();
      }
    }, { rootMargin: '600px 0px' });
    io.observe(frame.current);
    return () => io.disconnect();
  }, [startOnClick, wanted]);

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(geoUrl);
      const fc = (await res.json()) as { features: Feature[] };
      if (cancelled || !box.current) return;
      features.current = fc.features;
      const names = (f: Feature) => Object.keys(f.properties.seats).map((s) => seatNames[s] ?? s).join(', ');
      let drawing: Drawing;
      if (seat) {
        const color = resolve(seat.color);
        const mine = fc.features.filter((f) => f.properties.seats[seat.slug]);
        const whole = mine.filter((f) => f.properties.seats[seat.slug] === 'whole');
        setSummary({
          whole: placeList(whole),
          part: placeList(mine.filter((f) => f.properties.seats[seat.slug] === 'part')),
        });
        drawing = {
          features: fc.features,
          // The map opens on what the seat holds whole: Dhaka-14's six wards,
          // not the whole of Savar for the two unions it holds there, which
          // would leave the wards a speck. A seat of parts alone opens on them.
          focus: whole.length ? whole : mine.length ? mine : fc.features,
          look: (f) => {
            const p = f.properties.seats[seat.slug];
            if (p === 'whole') return { fill: color, fillOpacity: 0.16, stroke: color, weight: 3.5, dashed: false };
            if (p === 'part') return { fill: color, fillOpacity: 0.07, stroke: color, weight: 2.5, dashed: true };
            return { fill: GREY, fillOpacity: 0.03, stroke: GREY, weight: 1.2, dashed: true };
          },
          label: (f) => {
            const p = f.properties.seats[seat.slug];
            return `${placeName(f)} · ${p === 'whole' ? 'পুরোটা এই আসনে' : p === 'part' ? 'একাংশ এই আসনে' : names(f)}`;
          },
          onHover: setHover,
          labelZoom: 8,
        };
      } else {
        const tone = Object.fromEntries(Object.entries(colors ?? {}).map(([k, v]) => [k, resolve(v)]));
        drawing = {
          features: fc.features,
          focus: fc.features,
          look: (f) => {
            const first = Object.keys(f.properties.seats)[0];
            const c = (first && tone[first]) || GREY;
            const shared = Object.keys(f.properties.seats).length > 1;
            return { fill: c, fillOpacity: shared ? 0.12 : 0.22, stroke: c, weight: 2, dashed: shared };
          },
          label: (f) => `${placeName(f)} · ${names(f)}`,
          onClick: (f) => {
            const only = Object.keys(f.properties.seats);
            if (only.length === 1) router.push(`/ason/${only[0]}`);
          },
          onHover: setHover,
          labelZoom: 10,
        };
      }
      // A key Google refuses loads the script and then greys the map; Google calls this instead of failing.
      const fallBack = async () => {
        if (cancelled || !box.current) return;
        engine.current?.destroy();
        box.current.replaceChildren();
        setFailed(true);
        engine.current = await startLeaflet(box.current, drawing);
      };
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => void fallBack();
      try {
        const key = await googleKey();
        if (cancelled || !box.current) return;
        setUsingGoogle(!!key);
        engine.current = key ? await startGoogle(box.current, drawing, key) : await startLeaflet(box.current, drawing);
      } catch {
        await fallBack();
      }
      if (cancelled) engine.current?.destroy();
    })();
    return () => {
      cancelled = true;
      engine.current?.destroy();
      engine.current = null;
    };
  }, [wanted, geoUrl, seat, colors, seatNames, router]);

  // The map's box changes size when it goes full screen.
  useEffect(() => {
    engine.current?.resize();
    document.documentElement.style.overflow = big ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [big]);

  function locate() {
    if (!('geolocation' in navigator)) {
      setWhere('এই ব্রাউজারে অবস্থান জানা যায় না।');
      return;
    }
    setWhere('অবস্থান খোঁজা হচ্ছে…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        // A ward before the city that holds it, where a district has both.
        const hits = features.current.filter((f) => inFeature(pt, f));
        const inside = hits.find((f) => f.properties.kind === 'ward') ?? hits[0];
        engine.current?.showHere(pt[1], pt[0]);
        if (!inside) return setWhere('আপনি এই জেলার বাইরে আছেন।');
        const p = seat ? inside.properties.seats[seat.slug] : undefined;
        const others = Object.keys(inside.properties.seats).map((s) => seatNames[s] ?? s).join(', ');
        setWhere(
          p === 'whole'
            ? `আপনি ${placeName(inside)}, এই আসনের ভেতরে।`
            : p === 'part'
              ? `আপনি ${placeName(inside)}। এর একাংশ এই আসনে; নিচের ইউনিয়ন বা ওয়ার্ডের তালিকা মিলিয়ে দেখুন।`
              : `আপনি ${placeName(inside)}, ${others} আসনে।`,
        );
      },
      () => setWhere('অবস্থান পাওয়া যায়নি বা অনুমতি দেওয়া হয়নি।'),
      { timeout: 15000, maximumAge: 600000 },
    );
  }

  const source = usingGoogle && !failed ? 'Google Maps' : 'OpenStreetMap';
  const places = [...summary.whole, ...summary.part.map((p) => `${p}-এর একাংশ`)];

  return (
    <div
      ref={frame}
      data-seatmap
      className={big ? 'fixed inset-0 z-[60] bg-paper flex flex-col' : 'relative flex flex-col bg-surface border border-rule rounded-card shadow-card overflow-hidden'}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule bg-surface">
        <div className="min-w-0 flex items-center gap-2.5 text-[14px]">
          {seat && <span className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ background: seat.color, opacity: 0.85 }} aria-hidden="true" />}
          <span className="font-bold shrink-0">{title}</span>
          <span className="text-muted truncate">{hover ?? places.join(', ')}</span>
        </div>
        {wanted && (
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={() => setBig((b) => !b)} className="h-9 px-3 rounded-lg bg-brand text-white text-[13px] font-semibold hover:bg-brand/90">
              {big ? 'বন্ধ করুন' : 'বড় করে দেখুন'}
            </button>
          </div>
        )}
      </div>
      <style>{`.seatmap-label{font-family:var(--font-body),'Noto Sans Bengali',sans-serif;font-weight:700;font-size:13px;color:#17201b;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 2px #fff;background:none;border:0;}.seatmap-label-osm{transform:translate(-50%,-50%);}`}</style>
      {/* The base map adds its own classes to its box, so only the wrapper's size changes. */}
      <div className={big ? 'relative grow min-h-0' : 'relative h-[420px] sm:h-[480px] bg-sunk'}>
        <div ref={box} className="h-full w-full" role="region" aria-label={`${title} মানচিত্র`} />
        {wanted && (
          // Where Google Maps keeps its own "my location": on the map, top right, clear of the map-type buttons.
          <button
            type="button"
            onClick={locate}
            className="absolute right-3 top-3 z-10 h-10 ps-1.5 pe-3.5 rounded-full bg-surface text-ink shadow-[0_1px_4px_rgba(0,0,0,0.3)] inline-flex items-center gap-2 text-[13.5px] font-semibold hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="w-7 h-7 rounded-full bg-brandsoft text-brand grid place-items-center" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="7" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </span>
            {seat ? 'আমি কি এই আসনে?' : 'আমার আসন কোনটি?'}
          </button>
        )}
        {!wanted && (
          <div className="absolute inset-0 grid place-items-center">
            <button
              type="button"
              onClick={() => setWanted(true)}
              className="h-11 px-5 rounded-xl bg-brand text-white font-bold text-[14.5px] shadow-card hover:bg-brand/90"
            >
              ম্যাপ দেখুন
            </button>
          </div>
        )}
      </div>
      {where && <p className="px-4 py-2.5 text-[13.5px] border-t border-rule bg-surface" role="status">{where}</p>}
      {seat && summary.part.length > 0 && note && (
        <p className="px-4 py-2.5 text-[13px] text-inksoft border-t border-rule bg-surface leading-relaxed">
          <span className="font-semibold">নির্বাচন কমিশনের বর্ণনা:</span> {note}
          <span className="block text-[12px] text-muted pt-1">ইউনিয়নের, আর নতুন সিটি কর্পোরেশনগুলোর ওয়ার্ডের, আলাদা সীমানা প্রকাশিত নেই; সেখানে হালকা রঙে পুরো উপজেলা বা সিটি দেখানো হয়েছে।</span>
        </p>
      )}
      <p className="px-4 py-2.5 text-[12px] text-muted border-t border-rule bg-surface leading-relaxed">
        সীমানা নির্বাচন কমিশনের আসনের বর্ণনা থেকে; উপজেলা OpenStreetMap, সিটি কর্পোরেশন OCHA আর সিটি ওয়ার্ড geoBoundaries (BBS, ২০১৫)-এর মানচিত্রে; আনুমানিক। পটভূমির মানচিত্র {source}-এর।
        {colors && ` ${BN(Object.keys(colors).length)}টি আসন; এলাকায় চাপ দিলে সেই আসনের পাতা।`}
      </p>
    </div>
  );
}
