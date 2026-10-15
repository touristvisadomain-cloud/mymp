'use client';

/**
 * A member's constituency on a street map: every village, market, road and
 * river named, as on Google Maps, from OpenStreetMap, which in Bangladesh is
 * mostly labelled in Bangla. The seat's upazilas are filled in the party's
 * colour; the district's other upazilas are outlined, named with their seat.
 *
 * Boundaries are OpenStreetMap's upazila polygons (public/geo/<district>.json,
 * ODbL), matched to seats by the Election Commission's boundary text.
 * Preview: only Bhola so far.
 */
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from 'leaflet';

interface Feature {
  type: 'Feature';
  properties: { name: string; seat: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

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
function inFeature(pt: [number, number], f: Feature): boolean {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
  return polys.some((rings) => inRing(pt, rings[0]!) && !rings.slice(1).some((hole) => inRing(pt, hole)));
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
  const map = useRef<LeafletMap | null>(null);
  const features = useRef<Feature[]>([]);
  const [big, setBig] = useState(false);
  const [where, setWhere] = useState<string | null>(null);
  const [upazilas, setUpazilas] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let seatLayer: LeafletGeoJSON | null = null;
    void seatLayer;
    (async () => {
      const L = (await import('leaflet')).default;
      const res = await fetch(geoUrl);
      const fc = (await res.json()) as { features: Feature[] };
      if (cancelled || !box.current) return;
      features.current = fc.features;
      const resolved = getComputedStyle(document.documentElement).getPropertyValue(color.replace(/^var\((--[^)]+)\)$/, '$1')).trim() || color;

      const m = L.map(box.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
      map.current = m;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      }).addTo(m);

      // The district's other upazilas: an outline and their seat on hover.
      L.geoJSON(fc.features.filter((f) => f.properties.seat !== seatSlug) as never, {
        style: { color: '#6b7570', weight: 1.5, dashArray: '5 5', fillOpacity: 0.04, fillColor: '#6b7570' },
        onEachFeature: (f, layer) => {
          const p = (f as unknown as Feature).properties;
          layer.bindTooltip(`${p.name} উপজেলা · ${seatNames[p.seat] ?? p.seat}`, { sticky: true });
        },
      }).addTo(m);

      seatLayer = L.geoJSON(fc.features.filter((f) => f.properties.seat === seatSlug) as never, {
        style: { color: resolved, weight: 3.5, fillColor: resolved, fillOpacity: 0.14 },
        onEachFeature: (f, layer) => {
          const p = (f as unknown as Feature).properties;
          layer.bindTooltip(`${p.name} উপজেলা · ${seatName}`, { sticky: true });
        },
      }).addTo(m);
      setUpazilas(fc.features.filter((f) => f.properties.seat === seatSlug).map((f) => f.properties.name));
      const bounds = seatLayer.getBounds();
      // The box may still be laid out when the map starts: fit again once it has a size.
      const fit = () => {
        m.invalidateSize();
        m.fitBounds(bounds, { padding: [18, 18] });
      };
      fit();
      const ro = new ResizeObserver(() => {
        if (box.current && box.current.clientWidth > 0) fit();
      });
      ro.observe(box.current);
      setTimeout(() => ro.disconnect(), 4000);
      // A click on the map, once, lets the wheel zoom it; until then the page scrolls past it.
      m.once('focus', () => m.scrollWheelZoom.enable());
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [geoUrl, seatSlug, seatName, color, seatNames]);

  // The map's box changes size when it goes full screen.
  useEffect(() => {
    const t = setTimeout(() => map.current?.invalidateSize(), 60);
    document.documentElement.style.overflow = big ? 'hidden' : '';
    return () => clearTimeout(t);
  }, [big]);

  function locate() {
    if (!('geolocation' in navigator)) {
      setWhere('এই ব্রাউজারে অবস্থান জানা যায় না।');
      return;
    }
    setWhere('অবস্থান খোঁজা হচ্ছে…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const L = (await import('leaflet')).default;
        const pt: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const here = features.current.find((f) => inFeature(pt, f));
        L.circleMarker([pt[1], pt[0]], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map.current!);
        map.current?.setView([pt[1], pt[0]], Math.max(map.current.getZoom(), 12));
        setWhere(
          !here
            ? 'আপনি এই জেলার বাইরে আছেন।'
            : here.properties.seat === seatSlug
              ? `আপনি ${here.properties.name} উপজেলায়, এই আসনের ভেতরে।`
              : `আপনি ${here.properties.name} উপজেলায়, ${seatNames[here.properties.seat] ?? 'অন্য'} আসনে।`,
        );
      },
      () => setWhere('অবস্থান পাওয়া যায়নি বা অনুমতি দেওয়া হয়নি।'),
      { timeout: 15000, maximumAge: 600000 },
    );
  }

  return (
    <div
      className={
        big
          ? 'fixed inset-0 z-[60] bg-paper flex flex-col'
          : 'relative flex flex-col bg-surface border border-rule rounded-card shadow-card overflow-hidden'
      }
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule bg-surface">
        <div className="min-w-0 flex items-center gap-2.5 text-[14px]">
          <span className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ background: color, opacity: 0.85 }} aria-hidden="true" />
          <span className="font-bold">{seatName}</span>
          {upazilas.length > 0 && <span className="text-muted truncate">{upazilas.join(' ও ')} উপজেলা</span>}
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
      {/* Leaflet adds its own classes to the map's box, so only the wrapper's size changes. */}
      <div className={big ? 'grow min-h-0' : 'h-[420px] sm:h-[480px]'}>
        <div ref={box} className="h-full w-full" role="region" aria-label={`${seatName} আসনের মানচিত্র`} />
      </div>
      {where && <p className="px-4 py-2.5 text-[13.5px] border-t border-rule bg-surface" role="status">{where}</p>}
      <p className="px-4 py-2.5 text-[12px] text-muted border-t border-rule bg-surface leading-relaxed">
        সীমানা OpenStreetMap-এর উপজেলা মানচিত্র ও নির্বাচন কমিশনের আসনের বর্ণনা মিলিয়ে, আনুমানিক। গ্রাম, বাজার ও রাস্তার নাম OpenStreetMap থেকে।
      </p>
    </div>
  );
}
