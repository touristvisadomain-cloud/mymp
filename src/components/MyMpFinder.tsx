'use client';

/**
 * "আমার এলাকার এমপি": a place name, or where the person stands, to the
 * member who represents it.
 *
 * A typed name is looked up in the constituencies' boundary text
 * (lib/findSeat.ts), in the browser. "আমার অবস্থান" asks the browser for the
 * position and OpenStreetMap's Nominatim for the names of that place (union,
 * upazila, district), then looks those up the same way. The position goes to
 * OpenStreetMap only, once, and is not kept by this site.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import MemberPhoto from './MemberPhoto';
import Icon from './Icon';
import { findSeats, placeNames, type FinderSeat, type SeatMatch } from '@/lib/findSeat';

const KIND_BN: Record<SeatMatch['kind'], string> = {
  seat: 'আসন',
  district: 'জেলা',
  upazila: 'উপজেলা',
  union: 'ইউনিয়ন',
  ward: 'সিটি ওয়ার্ড',
  place: 'এলাকা',
};

type Locate =
  | { state: 'idle' }
  | { state: 'busy' }
  | { state: 'found'; names: string[]; used: string | null }
  | { state: 'error'; message: string };

export default function MyMpFinder({ seats }: { seats: FinderSeat[] }) {
  const [query, setQuery] = useState('');
  const [locate, setLocate] = useState<Locate>({ state: 'idle' });
  const [located, setLocated] = useState<SeatMatch[] | null>(null);

  const typed = useMemo(() => (query.trim().length >= 2 ? findSeats(query, seats, 8) : []), [query, seats]);
  const results = query.trim() ? typed : located ?? [];

  async function useLocation() {
    if (!('geolocation' in navigator)) {
      setLocate({ state: 'error', message: 'এই ব্রাউজারে অবস্থান জানা যায় না। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।' });
      return;
    }
    setLocate({ state: 'busy' });
    setQuery('');
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
          const names = placeNames(json.address ?? {});
          if (json.address?.country_code && json.address.country_code !== 'bd') {
            setLocated([]);
            setLocate({ state: 'error', message: 'আপনার অবস্থান বাংলাদেশের বাইরে দেখাচ্ছে। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।' });
            return;
          }
          // The most precise name that matches a seat wins: a union before its upazila, an upazila before the district.
          for (const name of names) {
            const hits = findSeats(name, seats, 8);
            if (hits.length) {
              setLocated(hits);
              setLocate({ state: 'found', names, used: name });
              return;
            }
          }
          setLocated([]);
          setLocate({ state: 'found', names, used: null });
        } catch {
          setLocate({ state: 'error', message: 'অবস্থান থেকে জায়গার নাম পাওয়া যায়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।' });
        }
      },
      (err) => {
        setLocate({
          state: 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'অবস্থান দেওয়ার অনুমতি দেওয়া হয়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।'
              : 'অবস্থান পাওয়া যায়নি। উপজেলা বা ইউনিয়নের নাম লিখে খুঁজুন।',
        });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="bg-surface border border-rule rounded-card shadow-card p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5"
      >
        <label htmlFor="my-mp-place" className="sr-only">উপজেলা, ইউনিয়ন বা ওয়ার্ড</label>
        <input
          id="my-mp-place"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="উপজেলা, ইউনিয়ন বা ওয়ার্ড, যেমন: দৌলতখান"
          autoComplete="off"
          className="grow min-w-0 h-12 px-4 rounded-xl border border-rule bg-paper text-[16px] focus:outline-none focus:border-brand"
        />
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={useLocation}
            disabled={locate.state === 'busy'}
            className="h-12 px-4 rounded-xl border border-rule bg-surface font-semibold text-[14.5px] inline-flex items-center justify-center gap-2 hover:border-brand hover:text-brand disabled:opacity-60 grow sm:grow-0"
          >
            <Icon name="pin" size={17} />
            {locate.state === 'busy' ? 'খোঁজা হচ্ছে…' : 'আমার অবস্থান'}
          </button>
          <button
            type="submit"
            className="h-12 px-6 rounded-xl bg-brand text-white font-bold text-[15px] hover:bg-brand/90 grow sm:grow-0"
          >
            খুঁজুন
          </button>
        </div>
      </form>

      <p className="text-[12.5px] text-muted leading-relaxed">
        নির্বাচন কমিশনের আসনের সীমানা থেকে খোঁজা হয়। অবস্থান দিলে তা শুধু একবার OpenStreetMap-এ পাঠানো হয় জায়গার নাম জানতে, এই সাইট তা রাখে না।
      </p>

      {locate.state === 'error' && <p className="text-[14px] text-warn" role="status">{locate.message}</p>}
      {locate.state === 'found' && !query.trim() && (
        <p className="text-[14px] text-inksoft" role="status">
          আপনার অবস্থান: {locate.names.join(', ') || 'নাম পাওয়া যায়নি'}
          {locate.used ? `। "${locate.used}" অনুযায়ী আপনার আসন:` : '। এই নামে কোনো আসনের সীমানা মেলেনি, নাম লিখে খুঁজুন।'}
        </p>
      )}

      {query.trim().length >= 2 && !typed.length && (
        <p className="text-[14px] text-muted" role="status">
          “{query.trim()}” নামে কোনো আসনের সীমানা মেলেনি। বানান বদলে, বা উপজেলার নাম লিখে দেখুন।
        </p>
      )}

      {results.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-live="polite">
          {results.map((r) => (
            <li key={r.seat.no}>
              <Result match={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Result({ match }: { match: SeatMatch }) {
  const { seat, kind, clause, partial } = match;
  const m = seat.member;
  return (
    <div className="h-full bg-surface border border-rule rounded-card shadow-card p-4 flex gap-3.5">
      {m ? (
        <Link href={`/mp/${m.slug}`} className="shrink-0">
          <MemberPhoto src={m.photo} alt={m.name} initial={m.name.slice(0, 1)} size={64} />
        </Link>
      ) : (
        <span className="shrink-0 w-16 h-16 rounded-full bg-rulesoft" aria-hidden="true" />
      )}
      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap text-[13px]">
          <Link href={`/ason/${seat.slug}`} className="font-bold text-brand hover:underline">{seat.seat}</Link>
          <span className="text-muted">{KIND_BN[kind]} মিলেছে</span>
          {partial && <span className="px-2 py-0.5 rounded-full bg-warnsoft text-warn text-[11.5px] font-semibold">উপজেলার একাংশ</span>}
        </div>
        {m ? (
          <Link href={`/mp/${m.slug}`} className="display text-[17px] font-bold leading-snug hover:text-brand">{m.name}</Link>
        ) : (
          <span className="text-[15px] font-semibold text-muted">আসনটি এখন শূন্য</span>
        )}
        {m?.partyBn && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-inksoft">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} aria-hidden="true" />
            {m.partyBn}
          </span>
        )}
        {clause && <p className="text-[12.5px] text-muted leading-relaxed line-clamp-3">{clause}</p>}
      </div>
    </div>
  );
}
