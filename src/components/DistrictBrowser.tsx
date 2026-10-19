'use client';

import { useMemo, useState } from 'react';
import Link from '@/i18n/Link';
import { useT } from '@/i18n/client';

/** One party's share of a district's (or a division's) seats. */
export interface SeatShare {
  /** The party's short name in the page's language; "শূন্য" / "Vacant" for a seat no one holds. */
  label: string;
  /** The party colour; null for a vacant seat. */
  color: string | null;
  count: number;
}

export interface DistrictCard {
  slug: string;
  /** The name in the page's language, and the other script's underneath. */
  name: string;
  alt: string;
  altLang?: 'bn';
  seats: number;
  /** Each seat's holder's colour, in seat order: the strip under the name. */
  strip: (string | null)[];
  shares: SeatShare[];
  /** Words the filter matches: both names. */
  keys: string;
}

export interface DivisionGroup {
  id: string;
  name: string;
  seats: number;
  shares: SeatShare[];
  districts: DistrictCard[];
}

/** A row of seats as small bars, one per seat, in its holder's colour. */
function SeatStrip({ strip, tall = false }: { strip: (string | null)[]; tall?: boolean }) {
  return (
    <span aria-hidden="true" className={`flex gap-[3px] ${tall ? 'h-2' : 'h-1.5'}`}>
      {strip.map((c, i) => (
        <span key={i} className={`grow rounded-full ${c ? '' : 'bg-rule'}`} style={c ? { background: c } : undefined} />
      ))}
    </span>
  );
}

/** "● বিএনপি ৫ · ● জামায়াত ১" */
function Shares({ shares, max = 3, end = false }: { shares: SeatShare[]; max?: number; end?: boolean }) {
  const t = useT();
  const shown = shares.slice(0, max);
  const rest = shares.slice(max).reduce((n, s) => n + s.count, 0);
  return (
    <span className={`flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-inksoft ${end ? 'sm:justify-end' : ''}`}>
      {shown.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true" className={`w-2 h-2 rounded-full ${s.color ? '' : 'bg-rule'}`} style={s.color ? { background: s.color } : undefined} />
          {s.label} <span className="tnum font-semibold text-ink">{t.n(s.count)}</span>
        </span>
      ))}
      {rest > 0 && <span className="whitespace-nowrap text-muted">{t(`অন্যান্য ${t.n(rest)}`, `others ${rest}`)}</span>}
    </span>
  );
}

/**
 * The district index's body: the eight divisions, each with its districts as
 * cards, a strip of every seat in its holder's colour on each card, and a box
 * that narrows the list as a name is typed, in either script.
 */
export default function DistrictBrowser({ divisions }: { divisions: DivisionGroup[] }) {
  const t = useT();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const shown = useMemo(
    () =>
      divisions
        .map((d) => ({
          ...d,
          districts: !query || d.name.toLowerCase().includes(query) ? d.districts : d.districts.filter((x) => x.keys.includes(query)),
        }))
        .filter((d) => d.districts.length)
        // Narrowed by a name, a division counts only the districts shown.
        .map((d) => (query ? { ...d, seats: d.districts.reduce((n, x) => n + x.seats, 0) } : d)),
    [divisions, query],
  );
  const found = shown.reduce((n, d) => n + d.districts.length, 0);

  return (
    <div className="mt-8 pb-14">
      <div className="py-3 border-y border-rulesoft flex flex-col lg:flex-row lg:items-center gap-3">
        <label className="relative shrink-0 lg:w-[280px]">
          <span className="sr-only">{t('জেলা খুঁজুন', 'Find a district')}</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('জেলার নাম লিখুন', 'Type a district name')}
            className="w-full h-11 ps-10 pe-3 rounded-[10px] border border-rule bg-surface text-[15px] outline-none focus:border-brand focus:ring-4 focus:ring-brandring placeholder:text-muted"
          />
        </label>
        <nav aria-label={t('বিভাগ', 'Divisions')} className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {divisions.map((d) => (
            <a
              key={d.id}
              href={`#${d.id}`}
              onClick={() => setQ('')}
              className="shrink-0 h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface text-[13.5px] font-semibold text-inksoft hover:border-brand hover:text-brand transition-colors"
            >
              {d.name}
              <span className="tnum text-[12px] font-bold text-muted">{t.n(d.districts.length)}</span>
            </a>
          ))}
        </nav>
      </div>

      {found === 0 && (
        <p className="mt-10 text-center text-[15px] text-muted">
          {t('এই নামে কোনো জেলা পাওয়া যায়নি। বাংলা বা ইংরেজি, দুইভাবেই লেখা যায়।', 'No district has that name. You can type in Bangla or English.')}
        </p>
      )}

      <div className="flex flex-col gap-10 mt-8">
        {shown.map((d) => (
          <section key={d.id} id={d.id} aria-labelledby={`${d.id}-h`} className="scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <h2 id={`${d.id}-h`} className="display text-[22px] sm:text-[26px] flex items-center gap-2.5">
                  <span aria-hidden="true" className="w-1.5 h-[0.85em] rounded-full bg-gradient-to-b from-logo to-brand shrink-0" />
                  {t(`${d.name} বিভাগ`, `${d.name} Division`)}
                </h2>
                <span className="text-[13.5px] text-muted tnum">
                  {t(
                    `${t.n(d.districts.length)}টি জেলা · ${t.n(d.seats)}টি আসন`,
                    `${d.districts.length} ${d.districts.length === 1 ? 'district' : 'districts'} · ${d.seats} seats`,
                  )}
                </span>
              </div>
              {!query && (
                <div className="sm:max-w-[520px]">
                  <Shares shares={d.shares} max={5} end />
                </div>
              )}
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {d.districts.map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/jela/${x.slug}`}
                    className="group h-full bg-surface border border-rule rounded-card shadow-card p-4 flex flex-col gap-3 hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex flex-col gap-0.5">
                        <span className="display text-[17px] leading-snug group-hover:text-brand transition-colors">{x.name}</span>
                        <span lang={x.altLang} className="text-[12.5px] text-muted">{x.alt}</span>
                      </span>
                      <span className="shrink-0 flex flex-col items-end leading-none">
                        <span className="display tnum text-[24px] text-ink">{t.n(x.seats)}</span>
                        <span className="text-[11px] font-bold tracking-[0.5px] text-muted mt-1">{t('আসন', x.seats === 1 ? 'seat' : 'seats')}</span>
                      </span>
                    </span>
                    <SeatStrip strip={x.strip} />
                    <Shares shares={x.shares} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
