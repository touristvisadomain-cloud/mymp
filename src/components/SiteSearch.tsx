'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildIndex, search, type Entry, type IndexRow } from '@/lib/search';
import { findSeats, toBangla, type FinderSeat, type SeatMatch } from '@/lib/findSeat';
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
  place: 'এলাকা',
};
const PLACE_LABEL_EN: Record<SeatMatch['kind'], string> = {
  seat: 'Seat',
  district: 'District',
  upazila: 'Upazila',
  union: 'Union',
  ward: 'City ward',
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
  group: 'place' | 'index';
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
      sub: [name ? seat : null, who?.party ? partyShort({ abbr: who.party }, 'en') : null, m.partial ? `Part of the ${m.kind === 'ward' ? 'city' : 'upazila'} is in this seat` : null].filter(Boolean).join(' · '),
      label: PLACE_LABEL_EN[m.kind],
      color: who?.color,
      group: 'place',
    };
  }
  return {
    key: `place-${m.seat.no}`,
    url: who ? `/mp/${who.slug}` : `/ason/${m.seat.slug}`,
    title: who?.name ?? `${m.seat.seat}: আসনটি এখন শূন্য`,
    sub: [m.seat.seat, who?.partyBn, m.partial ? `${m.kind === 'ward' ? 'সিটির' : 'উপজেলার'} একাংশ এই আসনে` : null].filter(Boolean).join(' · '),
    label: PLACE_LABEL[m.kind],
    color: who?.color,
    group: 'place',
  };
}

export default function SiteSearch({
  compact = false,
  autoFocus = false,
  withButton = false,
  placeholder,
  places,
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
}) {
  const t = useT();
  placeholder ??= t('আসন, জেলা, এমপি বা দলের নাম লিখুন', 'Type the name of a seat, district, MP or party');
  const router = useRouter();
  const listId = useId();
  const [index, setIndex] = useState<Entry[] | null>(null);
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
    if (!places || query.length < 2) return fromIndex;
    // A place the index does not know: an upazila, a union, a city ward. Seats
    // and districts by name are already in the index.
    const asBangla = toBangla(query, places.upazilaEn);
    const found = findSeats(asBangla, places.seats, 6).filter((m) => m.kind !== 'seat' && m.kind !== 'district');
    const seen = new Set(found.map((m) => (m.seat.member ? `/mp/${m.seat.member.slug}` : `/ason/${m.seat.slug}`)));
    return [...found.map((m) => placeItem(m, t)), ...fromIndex.filter((i) => !seen.has(i.url))].slice(0, 12);
  }, [index, q, places, located, t]);

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
  const hasPlaces = items.some((i) => i.group === 'place');

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">{t('খুঁজুন', 'Search')}</label>
      <div
        className={
          compact
            ? `flex items-center gap-2 h-10 w-[128px] sm:w-[260px] px-3 rounded-[10px] border border-rule bg-paper ${ring}`
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
          {located && !q.trim() && (
            <li className="px-4 py-2.5 text-[13px] text-inksoft border-b border-rulesoft" role="presentation">{located.note}</li>
          )}
          {items.length === 0 && !located && (
            <li className="px-4 py-3 text-[14px] text-muted">
              {index === null ? t('খোঁজা হচ্ছে…', 'Searching…') : t('কিছু পাওয়া যায়নি। বাংলা বা ইংরেজি, দুইভাবেই লেখা যায়।', 'Nothing found. You can type in Bangla or English.')}
            </li>
          )}
          {items.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === active}>
              {i === 0 && hasPlaces && (
                <span className="block px-4 pt-2 pb-1 text-[11.5px] font-bold tracking-[0.5px] text-brand">{t('আপনার এলাকার এমপি', 'The MP for your area')}</span>
              )}
              {i === firstIndex && hasPlaces && i > 0 && (
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
