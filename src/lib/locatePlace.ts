/**
 * Where the visitor stands, as the names of places, then the seats that hold
 * them. The browser gives the position; OpenStreetMap's Nominatim gives the
 * union, upazila and district there, once, and this site keeps none of it.
 * Browser only.
 *
 * The seats are matched on the Bangla names, which is how the Election
 * Commission's boundary text writes them. An English page asks Nominatim for
 * the English names too, at the same time, only to show them.
 */
import { makeT, type Lang } from '@/i18n/core';
import { cleanPlaceName, findSeats, placeEntries, type FinderSeat, type SeatMatch } from './findSeat';

export type Located =
  /** `names` and `used` are in the page's language; `used` is null when no name matched a seat, or has no English. */
  | { ok: true; names: string[]; used: string | null; hits: SeatMatch[] }
  | { ok: false; message: string };

type Address = Record<string, string>;

async function reverse(lat: number, lon: number, language: Lang): Promise<{ address?: Address }> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', lat.toFixed(5));
  url.searchParams.set('lon', lon.toFixed(5));
  url.searchParams.set('zoom', '14');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', language);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as { address?: Address };
}

const BANGLA = /[ঀ-৿]/;

export function locatePlace(seats: FinderSeat[], lang: Lang = 'bn'): Promise<Located> {
  const t = makeT(lang);
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ ok: false, message: t('এই ব্রাউজারে অবস্থান জানা যায় না। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।', 'This browser cannot give your location. Type the name of an upazila or union to search.') });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const [json, jsonEn] = await Promise.all([
            reverse(latitude, longitude, 'bn'),
            // The English names are only for showing; without them the page still finds the seat.
            lang === 'en' ? reverse(latitude, longitude, 'en').catch(() => null) : Promise.resolve(null),
          ]);
          if (json.address?.country_code && json.address.country_code !== 'bd') {
            resolve({ ok: false, message: t('আপনার অবস্থান বাংলাদেশের বাইরে দেখাচ্ছে। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।', 'Your location shows as outside Bangladesh. Type the name of an upazila or union to search.') });
            return;
          }
          const entries = placeEntries(json.address ?? {});
          const names = entries.map((e) => e.name);
          // A name as the page shows it: the Bangla, or the English for the same address field (none if OpenStreetMap has no English).
          const shown = (e: { key: string; name: string }): string | null => {
            if (lang === 'bn') return e.name;
            const v = jsonEn?.address?.[e.key];
            const clean = v ? cleanPlaceName(v) : '';
            return clean && !BANGLA.test(clean) ? clean : null;
          };
          const shownNames = [...new Set(entries.map(shown).filter((n): n is string => !!n))];
          // The most precise name that matches a seat wins: a union before its upazila, an upazila before the district.
          for (const e of entries) {
            const hits = findSeats(e.name, seats, 6);
            if (hits.length) {
              resolve({ ok: true, names: lang === 'bn' ? names : shownNames, used: shown(e), hits });
              return;
            }
          }
          resolve({ ok: true, names: lang === 'bn' ? names : shownNames, used: null, hits: [] });
        } catch {
          resolve({ ok: false, message: t('অবস্থান থেকে জায়গার নাম পাওয়া যায়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।', 'No place name could be found for your location. Type the name of an upazila or union to search.') });
        }
      },
      (err) =>
        resolve({
          ok: false,
          message:
            err.code === err.PERMISSION_DENIED
              ? t('অবস্থান দেওয়ার অনুমতি দেওয়া হয়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।', 'Permission to use your location was not given. Type the name of an upazila or union to search.')
              : t('অবস্থান পাওয়া যায়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।', 'Your location could not be found. Type the name of an upazila or union to search.'),
        }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  });
}
