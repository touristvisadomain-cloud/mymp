'use client';

/**
 * A member's constituency on a street map, every village, market, road and
 * river named. The seat's upazilas are filled in the party's colour; the
 * district's other upazilas are outlined and named with their seat.
 *
 * The base map is Google Maps, in Bangla, when NEXT_PUBLIC_GOOGLE_MAPS_KEY is
 * set (owner, 2026-10-15), and OpenStreetMap otherwise, so the page never
 * shows an empty box for want of a key.
 *
 * Boundaries are OpenStreetMap's upazila polygons (public/geo/<district>.json,
 * ODbL), matched to seats by the Election Commission's boundary text.
 */
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface Feature {
  type: 'Feature';
  properties: { name: string; seat: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

/** What either base map does for the frame around it. */
interface Engine {
  showHere(lat: number, lng: number): void;
  resize(): void;
  destroy(): void;
}

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

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

async function startGoogle(el: HTMLElement, fc: { features: Feature[] }, seatSlug: string, color: string, label: (f: Feature) => string, onHover: (t: string | null) => void): Promise<Engine> {
  const g = await loadGoogle(GOOGLE_KEY);
  const map = new g.maps.Map(el, {
    mapTypeControl: true,
    mapTypeControlOptions: { mapTypeIds: ['roadmap', 'hybrid'] },
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative',
    clickableIcons: true,
  });
  map.data.addGeoJson(fc);
  map.data.setStyle((f) =>
    f.getProperty('seat') === seatSlug
      ? { fillColor: color, fillOpacity: 0.14, strokeColor: color, strokeWeight: 3.5, clickable: true }
      : { fillColor: '#6b7570', fillOpacity: 0.04, strokeColor: '#6b7570', strokeWeight: 1.5, clickable: true },
  );
  map.data.addListener('mouseover', (e: google.maps.Data.MouseEvent) =>
    onHover(label({ properties: { name: String(e.feature.getProperty('name')), seat: String(e.feature.getProperty('seat')) } } as Feature)),
  );
  map.data.addListener('mouseout', () => onHover(null));
  const bounds = new g.maps.LatLngBounds();
  for (const f of fc.features.filter((x) => x.properties.seat === seatSlug)) {
    for (const rings of polygonsOf(f)) for (const [lng, lat] of rings[0]!) bounds.extend({ lat: lat!, lng: lng! });
  }
  map.fitBounds(bounds, 18);
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
      here?.setMap(null);
    },
  };
}

async function startLeaflet(el: HTMLElement, fc: { features: Feature[] }, seatSlug: string, color: string, label: (f: Feature) => string): Promise<Engine> {
  const L = (await import('leaflet')).default;
  const m = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(m);
  L.geoJSON(fc.features.filter((f) => f.properties.seat !== seatSlug) as never, {
    style: { color: '#6b7570', weight: 1.5, dashArray: '5 5', fillOpacity: 0.04, fillColor: '#6b7570' },
    onEachFeature: (f, layer) => layer.bindTooltip(label(f as unknown as Feature), { sticky: true }),
  }).addTo(m);
  const seatLayer = L.geoJSON(fc.features.filter((f) => f.properties.seat === seatSlug) as never, {
    style: { color, weight: 3.5, fillColor: color, fillOpacity: 0.14 },
    onEachFeature: (f, layer) => layer.bindTooltip(label(f as unknown as Feature), { sticky: true }),
  }).addTo(m);
  const bounds = seatLayer.getBounds();
  // The box may still be laid out when the map starts: fit again once it has a size.
  const fit = () => {
    m.invalidateSize();
    m.fitBounds(bounds, { padding: [18, 18] });
  };
  fit();
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

export default function SeatMap({
  geoUrl,
  seatSlug,
  seatName,
  color,
  seatNames,
}: {
  geoUrl: string;
  seatSlug: string;
  seatName: string;
  color: string;
  /** Other seats' names by slug, for the neighbours' labels. */
  seatNames: Record<string, string>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const features = useRef<Feature[]>([]);
  const [big, setBig] = useState(false);
  const [where, setWhere] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [upazilas, setUpazilas] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(geoUrl);
      const fc = (await res.json()) as { features: Feature[] };
      if (cancelled || !box.current) return;
      features.current = fc.features;
      setUpazilas(fc.features.filter((f) => f.properties.seat === seatSlug).map((f) => f.properties.name));
      const resolved = getComputedStyle(document.documentElement).getPropertyValue(color.replace(/^var\((--[^)]+)\)$/, '$1')).trim() || color;
      const label = (f: Feature) => `${f.properties.name} উপজেলা · ${f.properties.seat === seatSlug ? seatName : seatNames[f.properties.seat] ?? f.properties.seat}`;
      // A key Google refuses loads the script and then greys the map; Google calls this instead of failing.
      const fallBack = async () => {
        if (cancelled || !box.current) return;
        engine.current?.destroy();
        box.current.replaceChildren();
        setFailed(true);
        engine.current = await startLeaflet(box.current, fc, seatSlug, resolved, label);
      };
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => void fallBack();
      try {
        engine.current = GOOGLE_KEY
          ? await startGoogle(box.current, fc, seatSlug, resolved, label, setHover)
          : await startLeaflet(box.current, fc, seatSlug, resolved, label);
      } catch {
        // A blocked script: the free map instead of an empty box.
        await fallBack();
      }
      if (cancelled) engine.current?.destroy();
    })();
    return () => {
      cancelled = true;
      engine.current?.destroy();
      engine.current = null;
    };
  }, [geoUrl, seatSlug, seatName, color, seatNames]);

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
        const inside = features.current.find((f) => inFeature(pt, f));
        engine.current?.showHere(pt[1], pt[0]);
        setWhere(
          !inside
            ? 'আপনি এই জেলার বাইরে আছেন।'
            : inside.properties.seat === seatSlug
              ? `আপনি ${inside.properties.name} উপজেলায়, এই আসনের ভেতরে।`
              : `আপনি ${inside.properties.name} উপজেলায়, ${seatNames[inside.properties.seat] ?? 'অন্য'} আসনে।`,
        );
      },
      () => setWhere('অবস্থান পাওয়া যায়নি বা অনুমতি দেওয়া হয়নি।'),
      { timeout: 15000, maximumAge: 600000 },
    );
  }

  const source = GOOGLE_KEY && !failed ? 'Google Maps' : 'OpenStreetMap';

  return (
    <div className={big ? 'fixed inset-0 z-[60] bg-paper flex flex-col' : 'relative flex flex-col bg-surface border border-rule rounded-card shadow-card overflow-hidden'}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule bg-surface">
        <div className="min-w-0 flex items-center gap-2.5 text-[14px]">
          <span className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ background: color, opacity: 0.85 }} aria-hidden="true" />
          <span className="font-bold">{seatName}</span>
          <span className="text-muted truncate">{hover ?? (upazilas.length ? `${upazilas.join(' ও ')} উপজেলা` : '')}</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={locate} className="h-9 px-3 rounded-lg border border-rule text-[13px] font-semibold hover:border-brand hover:text-brand">
            আমি কোথায়
          </button>
          <button type="button" onClick={() => setBig((b) => !b)} className="h-9 px-3 rounded-lg bg-brand text-white text-[13px] font-semibold hover:bg-brand/90">
            {big ? 'বন্ধ করুন' : 'বড় করে দেখুন'}
          </button>
        </div>
      </div>
      {/* The base map adds its own classes to its box, so only the wrapper's size changes. */}
      <div className={big ? 'grow min-h-0' : 'h-[420px] sm:h-[480px]'}>
        <div ref={box} className="h-full w-full" role="region" aria-label={`${seatName} আসনের মানচিত্র`} />
      </div>
      {where && <p className="px-4 py-2.5 text-[13.5px] border-t border-rule bg-surface" role="status">{where}</p>}
      <p className="px-4 py-2.5 text-[12px] text-muted border-t border-rule bg-surface leading-relaxed">
        সীমানা OpenStreetMap-এর উপজেলা মানচিত্র ও নির্বাচন কমিশনের আসনের বর্ণনা মিলিয়ে, আনুমানিক। পটভূমির মানচিত্র {source}-এর।
      </p>
    </div>
  );
}
