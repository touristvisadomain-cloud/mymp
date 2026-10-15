/**
 * Where the visitor stands, as the names of places, then the seats that hold
 * them. The browser gives the position; OpenStreetMap's Nominatim gives the
 * union, upazila and district there, once, and this site keeps none of it.
 * Browser only.
 */
import { findSeats, placeNames, type FinderSeat, type SeatMatch } from './findSeat';

export type Located =
  | { ok: true; names: string[]; used: string | null; hits: SeatMatch[] }
  | { ok: false; message: string };

export function locatePlace(seats: FinderSeat[]): Promise<Located> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ ok: false, message: 'এই ব্রাউজারে অবস্থান জানা যায় না। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const url = new URL('https://nominatim.openstreetmap.org/reverse');
          url.searchParams.set('format', 'jsonv2');
          url.searchParams.set('lat', pos.coords.latitude.toFixed(5));
          url.searchParams.set('lon', pos.coords.longitude.toFixed(5));
          url.searchParams.set('zoom', '14');
          url.searchParams.set('addressdetails', '1');
          url.searchParams.set('accept-language', 'bn');
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as { address?: Record<string, string> };
          if (json.address?.country_code && json.address.country_code !== 'bd') {
            resolve({ ok: false, message: 'আপনার অবস্থান বাংলাদেশের বাইরে দেখাচ্ছে। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।' });
            return;
          }
          const names = placeNames(json.address ?? {});
          // The most precise name that matches a seat wins: a union before its upazila, an upazila before the district.
          for (const name of names) {
            const hits = findSeats(name, seats, 6);
            if (hits.length) {
              resolve({ ok: true, names, used: name, hits });
              return;
            }
          }
          resolve({ ok: true, names, used: null, hits: [] });
        } catch {
          resolve({ ok: false, message: 'অবস্থান থেকে জায়গার নাম পাওয়া যায়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।' });
        }
      },
      (err) =>
        resolve({
          ok: false,
          message:
            err.code === err.PERMISSION_DENIED
              ? 'অবস্থান দেওয়ার অনুমতি দেওয়া হয়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।'
              : 'অবস্থান পাওয়া যায়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।',
        }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  });
}
