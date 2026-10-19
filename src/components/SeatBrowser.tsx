'use client';

import { useMemo, useState } from 'react';
import Link from '@/i18n/Link';
import { useT } from '@/i18n/client';
import PartyBadge from './PartyBadge';
import MemberPhoto from './MemberPhoto';

export interface SeatRowData {
  slug: string;
  name: string;
  /** The places the seat covers, shortened from the boundary text (Bangla pages only). */
  area: string | null;
  member: { name: string; slug: string; photo: string | null; initial: string; abbr: string | null; color: string; party: string } | null;
  /** The seat, member and district in both scripts, for the finder: "tarique" finds ঢাকা-১৭ on a Bangla page too. */
  keys: string;
}

export interface SeatDistrict {
  slug: string;
  name: string;
  seats: SeatRowData[];
}

export interface SeatDivision {
  id: string;
  name: string;
  districts: SeatDistrict[];
}

export interface PartyTotal {
  abbr: string | null;
  label: string;
  color: string | null;
  count: number;
}

const fold = (s: string) => s.toLowerCase().replace(/[\s\-–]+/g, ' ');

/**
 * The seat index's body: a bar of the house by party that doubles as a party
 * filter, a box that finds a seat by its name, its member or the places it
 * covers, and the seats under their divisions and districts, each with its
 * member's photo and party symbol.
 */
export default function SeatBrowser({ divisions, parties }: { divisions: SeatDivision[]; parties: PartyTotal[] }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [party, setParty] = useState<string | null>(null);
  const query = fold(q.trim());
  const total = parties.reduce((n, p) => n + p.count, 0);

  const shown = useMemo(() => {
    const keep = (s: SeatRowData) => {
      if (party && (party === 'vacant' ? s.member : s.member?.abbr !== party)) return false;
      if (!query) return true;
      return fold(`${s.keys} ${s.area ?? ''}`).includes(query);
    };
    return divisions
      .map((v) => ({ ...v, districts: v.districts.map((d) => ({ ...d, seats: d.seats.filter(keep) })).filter((d) => d.seats.length) }))
      .filter((v) => v.districts.length);
  }, [divisions, party, query]);
  const found = shown.reduce((n, v) => n + v.districts.reduce((m, d) => m + d.seats.length, 0), 0);

  return (
    <div className="pb-14">
      {/* The house by party: one bar, each party's share; a party in it filters the list. */}
      <div className="mt-8 bg-surface border border-rule rounded-card shadow-card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-[18px] sm:text-[20px]">{t('কোন দলের কতটি আসন', 'Seats by party')}</h2>
          <span className="text-[12.5px] text-muted">{t('দলে চাপলে শুধু সেই দলের আসন দেখাবে', 'Tap a party to see only its seats')}</span>
        </div>
        <div aria-hidden="true" className="mt-4 flex h-3.5 rounded-full overflow-hidden bg-sunk gap-[2px]">
          {parties.map((p) => (
            <span
              key={p.label}
              className={`h-full transition-opacity ${p.color ? '' : 'bg-rule'} ${party && party !== (p.abbr ?? 'vacant') ? 'opacity-25' : ''}`}
              style={{ width: `${(p.count / total) * 100}%`, ...(p.color ? { background: p.color } : {}) }}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {parties.map((p) => {
            const key = p.abbr ?? 'vacant';
            const on = party === key;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                onClick={() => setParty(on ? null : key)}
                className={`h-9 ps-2 pe-3 inline-flex items-center gap-2 rounded-full border text-[13.5px] font-semibold transition-colors ${on ? 'border-brand bg-brandsoft text-brand' : 'border-rule bg-surface text-inksoft hover:border-brand'}`}
              >
                {p.abbr && p.color ? (
                  <PartyBadge abbr={p.abbr} color={p.color} size={20} />
                ) : (
                  <span aria-hidden="true" className="w-5 h-5 rounded-full border-2 border-dashed border-muted" />
                )}
                {p.label}
                <span className="tnum font-bold text-ink">{t.n(p.count)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 py-3 border-y border-rulesoft flex flex-col lg:flex-row lg:items-center gap-3">
        <label className="relative shrink-0 lg:w-[340px]">
          <span className="sr-only">{t('আসন খুঁজুন', 'Find a seat')}</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('আসন, এমপি, জেলা বা উপজেলা', 'Seat, MP or district')}
            className="w-full h-11 ps-10 pe-3 rounded-[10px] border border-rule bg-surface text-[15px] outline-none focus:border-brand focus:ring-4 focus:ring-brandring placeholder:text-muted"
          />
        </label>
        <nav aria-label={t('বিভাগ', 'Divisions')} className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {divisions.map((v) => (
            <a
              key={v.id}
              href={`#${v.id}`}
              onClick={() => { setQ(''); setParty(null); }}
              className="shrink-0 h-9 px-3.5 inline-flex items-center rounded-full border border-rule bg-surface text-[13.5px] font-semibold text-inksoft hover:border-brand hover:text-brand transition-colors"
            >
              {v.name}
            </a>
          ))}
        </nav>
      </div>

      {(query || party) && (
        <p className="mt-4 text-[13.5px] text-inksoft">
          {found
            ? t(`${t.n(found)}টি আসন পাওয়া গেছে।`, `${found} ${found === 1 ? 'seat' : 'seats'} found.`)
            : t('কোনো আসন পাওয়া যায়নি। বাংলা বা ইংরেজি, দুইভাবেই লেখা যায়।', 'No seat found. You can type in Bangla or English.')}{' '}
          <button type="button" onClick={() => { setQ(''); setParty(null); }} className="font-semibold text-brand hover:underline">
            {t('সব দেখুন', 'Show all')}
          </button>
        </p>
      )}

      <div className="mt-8 flex flex-col gap-12">
        {shown.map((v) => (
          <section key={v.id} id={v.id} className="scroll-mt-24">
            <h2 className="display text-[22px] sm:text-[26px] flex items-center gap-2.5">
              <span aria-hidden="true" className="w-1.5 h-[0.85em] rounded-full bg-gradient-to-b from-logo to-brand shrink-0" />
              {t(`${v.name} বিভাগ`, `${v.name} Division`)}
            </h2>
            <div className="mt-5 flex flex-col gap-7">
              {v.districts.map((d) => (
                <div key={d.slug}>
                  <h3 className="flex items-baseline gap-2 mb-3">
                    <Link href={`/jela/${d.slug}`} className="display text-[17px] hover:text-brand transition-colors">{d.name}</Link>
                    <span className="text-[12.5px] text-muted tnum">{t(`${t.n(d.seats.length)}টি আসন`, `${d.seats.length} ${d.seats.length === 1 ? 'seat' : 'seats'}`)}</span>
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {d.seats.map((s) => (
                      <li key={s.slug}>
                        <Link
                          href={`/ason/${s.slug}`}
                          className="group h-full bg-surface border border-rule rounded-card shadow-card p-3.5 flex gap-3 hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
                          style={s.member ? { boxShadow: `inset 3px 0 0 ${s.member.color}` } : undefined}
                        >
                          {s.member ? (
                            <MemberPhoto src={s.member.photo} alt="" initial={s.member.initial} size={48} className="rounded-full object-cover bg-sunk shrink-0" />
                          ) : (
                            <span aria-hidden="true" className="w-12 h-12 shrink-0 rounded-full border-2 border-dashed border-warn/50 bg-warnsoft grid place-items-center text-warn text-[11px] font-bold">
                              {t('শূন্য', '—')}
                            </span>
                          )}
                          <span className="grow min-w-0 flex flex-col gap-0.5">
                            <span className="flex items-center justify-between gap-2">
                              <span className="display text-[15.5px] group-hover:text-brand transition-colors">{s.name}</span>
                              {s.member?.abbr && <PartyBadge abbr={s.member.abbr} color={s.member.color} size={22} />}
                            </span>
                            {s.member ? (
                              <span className="text-[13.5px] font-semibold text-inksoft truncate">{s.member.name}</span>
                            ) : (
                              <span className="text-[13.5px] font-semibold text-warn">{t('আসনটি এখন শূন্য', 'The seat is vacant')}</span>
                            )}
                            {s.area && <span className="text-[12px] text-muted leading-snug line-clamp-2">{s.area}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
