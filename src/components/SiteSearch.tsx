'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildIndex, matchTier, search, type Entry, type IndexRow } from '@/lib/search';
import type { CabinetRow } from '@/lib/cabinetSearch';
import { findSeats, toBangla, type FinderSeat, type PlaceNames, type SeatMatch } from '@/lib/findSeat';
import { locatePlace } from '@/lib/locatePlace';
import { useT } from '@/i18n/client';
import type { T } from '@/i18n/core';
import { partyShort, seatName } from '@/i18n/names';

const TYPE_LABEL: Record<string, string> = {
  seat: 'আসন',
  member: 'সংসদ সদস্য',
  party: 'দল',
  district: 'জেলা',
  division: 'বিভাগ',
};
const TYPE_LABEL_EN: Record<string, string> = {
  seat: 'Seat',
  member: 'MP',
  party: 'Party',
  district: 'District',
  division: 'Division',
};

const PLACE_LABEL: Record<SeatMatch['kind'], string> = {
  seat: 'আসন',
  district: 'জেলা',
  upazila: 'উপজেলা',
  union: 'ইউনিয়ন',
  ward: 'সিটি ওয়ার্ড',
  thana: 'থানা',
  place: 'এলাকা',
};
const PLACE_LABEL_EN: Record<SeatMatch['kind'], string> = {
  seat: 'Seat',
  district: 'District',
  upazila: 'Upazila',
  union: 'Union',
  ward: 'City ward',
  thana: 'Thana',
  place: 'Area',
};

const BANGLA = /[ঀ-৿]/;

/** The index is fetched once per visit and shared by every search box on the page. */
let cached: Promise<Entry[]> | null = null;
function loadIndex(): Promise<Entry[]> {
  if (!cached) {
    cached = fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: IndexRow[]) => buildIndex(rows))
      .catch(() => []);
  }
  return cached;
}

/**
 * Every union and the city thanas, for the home page's box only, fetched the
 * first time someone types there (public/place-names.json, built by
 * scripts/build-place-names.ts).
 */
let namesCached: Promise<PlaceNames | null> | null = null;
function loadPlaceNames(): Promise<PlaceNames | null> {
  if (!namesCached) {
    namesCached = fetch('/place-names.json')
      .then((r) => (r.ok ? (r.json() as Promise<PlaceNames>) : null))
      .catch(() => null);
  }
  return namesCached;
}

/** Why a seat may hold only part of the place. */
function partNote(m: SeatMatch, en: boolean): string | null {
  if (!m.partial) return null;
  if (m.kind === 'thana') return en ? 'The thana may reach into a neighbouring seat' : 'থানার কিছু এলাকা পাশের আসনেও থাকতে পারে';
  if (m.kind === 'union') return en ? 'Now in the city corporation, shared by these seats' : 'এখন সিটি কর্পোরেশনে, এই আসনগুলোতে ভাগ';
  if (m.kind === 'ward') return en ? 'Part of the city is in this seat' : 'সিটির একাংশ এই আসনে';
  return en ? 'Part of the upazila is in this seat' : 'উপজেলার একাংশ এই আসনে';
}

/** The box, not the bare input, shows keyboard focus; the input itself has no outline. */
const ring = 'focus-within:border-brand focus-within:ring-4 focus-within:ring-brandring';

/** One line in the results: a place's member, or an entry from the site's index. */
interface Item {
  key: string;
  url: string;
  title: string;
  sub: string | null;
  label: string;
  /** The party colour of a place's member, a dot before the name. */
  color?: string;
  /** The title is in Bangla on an English page (an entry the index has no English for). */
  bnTitle?: boolean;
  group: 'cabinet' | 'place' | 'index';
  /** A listed union: its name and upazila, to tell unions that share a name apart. */
  union?: { place: string; upazila: string };
}

function placeItem(m: SeatMatch, t: T): Item {
  const who = m.seat.member;
  if (t.en) {
    const seat = seatName({ nameBn: m.seat.seat, nameEn: m.seat.seatEn }, 'en');
    const name = who?.nameEn || null;
    return {
      key: `place-${m.seat.no}`,
      url: who ? `/mp/${who.slug}` : `/ason/${m.seat.slug}`,
      // A member without an English name (none today) is shown by the seat's name rather than in Bangla.
      title: who ? name ?? seat : `${seat}: the seat is now vacant`,
      sub: [m.placeEn ?? null, name ? seat : null, who?.party ? partyShort({ abbr: who.party }, 'en') : null, partNote(m, true)].filter(Boolean).join(' · '),
      label: PLACE_LABEL_EN[m.kind],
      color: who?.color,
      group: 'place',
      union: m.kind === 'union' && m.upazila ? { place: m.placeEn ?? '', upazila: m.upazilaEn ?? m.upazila } : undefined,
    };
  }
  return {
    key: `place-${m.seat.no}`,
    url: who ? `/mp/${who.slug}` : `/ason/${m.seat.slug}`,
    title: who?.name ?? `${m.seat.seat}: আসনটি এখন শূন্য`,
    sub: [m.place ?? null, m.seat.seat, who?.partyBn, partNote(m, false)].filter(Boolean).join(' · '),
    label: PLACE_LABEL[m.kind],
    color: who?.color,
    group: 'place',
    union: m.kind === 'union' && m.upazila ? { place: m.place ?? '', upazila: m.upazila } : undefined,
  };
}

export default function SiteSearch({
  compact = false,
  autoFocus = false,
  withButton = false,
  placeholder,
  places,
  cabinet,
}: {
  compact?: boolean;
  autoFocus?: boolean;
  /** A "খুঁজুন" button inside the box that opens the highlighted result. */
  withButton?: boolean;
  placeholder?: string;
  /**
   * Find a member by the place they represent (upazila, union, city ward, in
   * Bangla or English) and by where the visitor stands. The home page's box.
   */
  places?: { seats: FinderSeat[]; upazilaEn: [string, string][] };
  /**
   * Find a minister by the post: "ICT", "তথ্য", "Prime Minister",
   * "prodhan montri" (src/lib/cabinetSearch.ts). The home page's box.
   */
  cabinet?: CabinetRow[];
}) {
  const t = useT();
  placeholder ??= t('আসন, জেলা, এমপি বা দলের নাম লিখুন', 'Type the name of a seat, district, MP or party');
  const router = useRouter();
  const listId = useId();
  const [index, setIndex] = useState<Entry[] | null>(null);
  const [names, setNames] = useState<PlaceNames | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [located, setLocated] = useState<{ note: string; hits: SeatMatch[] } | null>(null);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadIndex().then((idx) => alive && setIndex(idx));
    return () => { alive = false; };
  }, []);

  // The union and thana list is only for the box that finds places, and only once someone types.
  const typing = !!places && q.trim().length > 0;
  useEffect(() => {
    if (!typing || names) return;
    let alive = true;
    loadPlaceNames().then((n) => alive && setNames(n));
    return () => { alive = false; };
  }, [typing, names]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const items = useMemo<Item[]>(() => {
    const query = q.trim();
    if (!query) return located ? located.hits.map((m) => placeItem(m, t)) : [];
    const fromIndex: Item[] = index
      ? search(index, query, 8).map((h): Item =>
          t.en
            ? { key: h.url, url: h.url, title: h.en || h.bn, bnTitle: !h.en, sub: h.subEn, label: TYPE_LABEL_EN[h.type] ?? '', group: 'index' }
            : { key: h.url, url: h.url, title: h.bn || h.en, sub: h.sub ?? null, label: TYPE_LABEL[h.type] ?? '', group: 'index' },
        )
      : [];
    // A minister by the post's name or what people call it: only the best fit,
    // so "prime" is the Prime Minister and not also primary education.
    const tiers = cabinet && query.length >= 2 ? cabinet.map((r) => matchTier(query, r.texts)) : [];
    const bestTier = Math.max(0, ...tiers);
    const fromCabinet: Item[] = bestTier > 0
      ? cabinet!
          .filter((_, i) => tiers[i] === bestTier)
          .slice(0, 6)
          .map((r) => ({ key: `cabinet-${r.url}`, url: r.url, title: r.name, bnTitle: t.en && BANGLA.test(r.name), sub: r.post, label: t('মন্ত্রিসভা', 'Cabinet'), color: r.color, group: 'cabinet' }))
      : [];
    const cabinetUrls = new Set(fromCabinet.map((i) => i.url));
    if (!places || query.length < 2) return [...fromCabinet, ...fromIndex.filter((i) => !cabinetUrls.has(i.url))];
    // A place the index does not know: an upazila, a union, a thana, a city
    // ward. Seats and districts by name are already in the index.
    // An English name that is exactly a union's or thana's stays as typed,
    // rather than becoming an upazila a letter away ("Rampur", not Raipura).
    const key = (s: string) => s.toLowerCase().replace(/\b(union|thana|upazila|upazilla)\b/g, '').replace(/[^a-z0-9]+/g, '');
    const typedKey = key(query);
    const upazilaExactly = !!typedKey && places.upazilaEn.some(([en]) => key(en) === typedKey);
    const listedExactly = !!names && !!typedKey && !upazilaExactly && [...names.unions, ...names.thanas].some((r) => key(r[1]) === typedKey);
    const asBangla = listedExactly ? query : toBangla(query, places.upazilaEn);
    const byName = findSeats(asBangla, places.seats, 8, names ?? undefined);
    // A union or thana typed in English is looked up by its English name too:
    // toBangla knows only the upazilas, and may turn it into a near one.
    const asTyped = names && asBangla !== query && !upazilaExactly ? findSeats(query, places.seats, 8, names).filter((m) => m.kind === 'union' || m.kind === 'thana') : [];
    const nos = new Set(byName.map((m) => m.seat.no));
    const found = [...byName, ...asTyped.filter((m) => !nos.has(m.seat.no) && (nos.add(m.seat.no), true))]
      .filter((m) => m.kind !== 'seat' && m.kind !== 'district')
      .sort((a, b) => b.score - a.score || a.seat.no - b.seat.no)
      .slice(0, 8);
    const seen = new Set(found.map((m) => (m.seat.member ? `/mp/${m.seat.member.slug}` : `/ason/${m.seat.slug}`)));
    const fromPlaces = found.map((m) => placeItem(m, t)).filter((i) => !cabinetUrls.has(i.url));
    return [...fromCabinet, ...fromPlaces, ...fromIndex.filter((i) => !seen.has(i.url) && !cabinetUrls.has(i.url))].slice(0, 12);
  }, [index, q, places, located, t, names, cabinet]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    setQ('');
    setLocated(null);
    router.push(t.href(item.url));
  }

  /** The button: an empty box gets the cursor, no match shows the "nothing found" line. */
  function submit() {
    if (!q.trim() && !located) { inputRef.current?.focus(); return; }
    if (items.length) go(items[active] ?? items[0]);
    else setOpen(true);
  }

  async function useLocation() {
    if (!places) return;
    setLocating(true);
    setQ('');
    setActive(0);
    const r = await locatePlace(places.seats, t.lang);
    setLocating(false);
    setLocated(
      r.ok
        ? {
            note: t.en
              ? r.hits.length
                ? `Your location: ${r.names.join(', ') || 'no name in English'}. Your seat${r.used ? `, going by "${r.used}"` : ''} (your location went to OpenStreetMap only to find the place's name; this site has not kept it):`
                : `Your location: ${r.names.join(', ') || 'no name found'}. No seat's boundary matched this name; type a name to search.`
              : r.used
                ? `আপনার অবস্থান: ${r.names.join(', ')}। "${r.used}" অনুযায়ী আপনার আসন (অবস্থান শুধু জায়গার নাম জানতে OpenStreetMap-এ গেছে, এই সাইট রাখেনি):`
                : `আপনার অবস্থান: ${r.names.join(', ') || 'নাম পাওয়া যায়নি'}। এই নামে কোনো আসনের সীমানা মেলেনি, নাম লিখে খুঁজুন।`,
            hits: r.hits,
          }
        : { note: r.message, hits: [] },
    );
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  const showResults = open && (q.trim().length > 0 || !!located);
  const firstIndex = items.findIndex((i) => i.group === 'index');
  const firstPlace = items.findIndex((i) => i.group === 'place');
  const firstCabinet = items.findIndex((i) => i.group === 'cabinet');
  // Many unions share a name: with two or more of them found, say how to pick one, by an upazila among them.
  const unionsFound = items.filter((i) => i.union);
  const sharedName = q.trim() && new Set(unionsFound.map((i) => i.union!.place)).size >= 2
    ? `${q.trim().replace(/\s*(ইউনিয়ন|union)\s*$/i, '')} ${unionsFound[0]!.union!.upazila}`
    : null;

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">{t('খুঁজুন', 'Search')}</label>
      <div
        className={
          compact
            ? `flex items-center gap-2 h-10 w-[128px] sm:w-[260px] lg:w-[150px] xl:w-[260px] px-3 rounded-[10px] border border-rule bg-paper ${ring}`
            : `flex items-center gap-3 h-14 sm:h-[62px] ps-4 sm:ps-5 ${withButton ? 'pe-2 sm:pe-2.5' : 'pe-4 sm:pe-5'} rounded-[14px] border-[1.5px] border-ink bg-surface ${ring}`
        }
      >
        <svg width={compact ? 16 : 20} height={compact ? 16 : 20} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-muted shrink-0" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); setLocated(null); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={compact ? t('খুঁজুন…', 'Search…') : placeholder}
          className={`grow min-w-0 w-full bg-transparent outline-none text-ellipsis placeholder:text-muted ${compact ? 'text-[14px]' : 'text-[16px] sm:text-[18px]'}`}
        />
        {places && !compact && (
          <button
            type="button"
            onClick={useLocation}
            disabled={locating}
            aria-label={t('আমার অবস্থান থেকে আমার এমপি খুঁজুন', 'Find my MP from my location')}
            title={t('আমার অবস্থান', 'My location')}
            className="shrink-0 h-10 sm:h-11 px-2.5 sm:px-3.5 rounded-[10px] border border-rule bg-surface text-ink inline-flex items-center gap-1.5 text-[14px] font-semibold hover:border-brand hover:text-brand disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <span className="hidden sm:inline">{locating ? t('খোঁজা হচ্ছে…', 'Searching…') : t('আমার অবস্থান', 'My location')}</span>
          </button>
        )}
        {withButton && !compact && (
          <button
            type="button"
            onClick={submit}
            className="shrink-0 h-10 sm:h-11 px-4 sm:px-5 rounded-[10px] bg-brand text-white text-[15px] sm:text-[16px] font-bold hover:bg-branddark transition-colors"
          >
            {t('খুঁজুন', 'Search')}
          </button>
        )}
      </div>

      {showResults && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-2 end-0 w-full min-w-[300px] max-h-[420px] overflow-y-auto rounded-xl border border-rule bg-surface shadow-lg py-1"
        >
          {sharedName && (
            <li className="px-4 py-2.5 text-[13px] text-inksoft border-b border-rulesoft" role="presentation">
              {t(`এই নামে কয়েকটি ইউনিয়ন আছে। নিজেরটি খুঁজতে সাথে উপজেলা বা জেলার নাম লিখুন, যেমন "${sharedName}"।`, `Several unions have this name. Add the upazila or district to find yours, for example "${sharedName}".`)}
            </li>
          )}
          {located && !q.trim() && (
            <li className="px-4 py-2.5 text-[13px] text-inksoft border-b border-rulesoft" role="presentation">{located.note}</li>
          )}
          {items.length === 0 && !located && (
            <li className="px-4 py-3 text-[14px] text-muted">
              {index === null
                ? t('খোঁজা হচ্ছে…', 'Searching…')
                : places
                  ? t('কিছু পাওয়া যায়নি। গ্রাম বা মহল্লার নামে খোঁজা যায় না: ইউনিয়ন, উপজেলা বা থানার নাম লিখুন। বাংলা বা ইংরেজি, দুইভাবেই লেখা যায়।', 'Nothing found. Villages and neighbourhoods are not searchable: type the union, upazila or thana instead, in Bangla or English.')
                  : t('কিছু পাওয়া যায়নি। বাংলা বা ইংরেজি, দুইভাবেই লেখা যায়।', 'Nothing found. You can type in Bangla or English.')}
            </li>
          )}
          {items.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === active}>
              {i === firstCabinet && (
                <span className="block px-4 pt-2 pb-1 text-[11.5px] font-bold tracking-[0.5px] text-brand">{t('মন্ত্রিসভা', 'Cabinet')}</span>
              )}
              {i === firstPlace && (
                <span className={`block px-4 pt-2 pb-1 text-[11.5px] font-bold tracking-[0.5px] text-brand ${i > 0 ? 'border-t border-rulesoft' : ''}`}>{t('আপনার এলাকার এমপি', 'The MP for your area')}</span>
              )}
              {i === firstIndex && i > 0 && (
                <span className="block px-4 pt-2.5 pb-1 text-[11.5px] font-bold tracking-[0.5px] text-muted border-t border-rulesoft">{t('আরও ফল', 'More results')}</span>
              )}
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={`w-full text-start px-4 py-2.5 flex items-baseline gap-3 ${i === active ? 'bg-brandsoft' : ''}`}
              >
                <span className="grow min-w-0">
                  <span className="display flex items-center gap-2 text-[15px] font-bold">
                    {h.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: h.color }} aria-hidden="true" />}
                    <span className="truncate" lang={h.bnTitle || (t.en && BANGLA.test(h.title)) ? 'bn' : undefined}>{h.title}</span>
                  </span>
                  {h.sub && <span className="block text-[12.5px] text-muted truncate">{h.sub}</span>}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-muted">{h.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
