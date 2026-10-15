'use client';

/**
 * The 64 districts as a tile map, each in the colour of the party that holds
 * most of its seats (two colours split diagonally on a tie). A tap shows the
 * district's seats, who holds each and by how many votes. The layout is in
 * lib/districtTiles.ts.
 */
import { useState } from 'react';
import Link from 'next/link';

export interface MapSeat {
  no: number;
  seat: string;
  slug: string;
  member: { name: string; slug: string } | null;
  party: string | null;
  partyBn: string | null;
  color: string;
  votes: number | null;
  margin: number | null;
}

export interface MapDistrict {
  slug: string;
  name: string;
  tile: [number, number];
  seats: MapSeat[];
  /** Parties by seats held here, most first. */
  parties: { abbr: string; name: string; color: string; seats: number }[];
}

const BN = (n: number | string) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
const BN_GROUP = (n: number) => BN(n.toLocaleString('en-IN'));

/** Names too long for a tile. */
const SHORT: Record<string, string> = { chapainawabganj: 'চাঁপাই', brahmanbaria: 'বি.বাড়িয়া', moulvibazar: 'মৌলভীবাজার' };

/** Colours light enough that white text on them would not read. */
const LIGHT = new Set(['BJEI']);

function fill(d: MapDistrict): { background: string; color: string } {
  const [a, b] = d.parties;
  if (!a) return { background: 'var(--color-rulesoft)', color: 'var(--color-muted)' };
  const tie = b && b.seats === a.seats;
  return {
    background: tie ? `linear-gradient(135deg, ${a.color} 50%, ${b.color} 50%)` : a.color,
    color: LIGHT.has(a.abbr) && !tie ? 'var(--color-ink)' : '#ffffff',
  };
}

export default function DistrictMap({
  districts,
  columns,
  legend,
}: {
  districts: MapDistrict[];
  columns: number;
  legend: { abbr: string; name: string; color: string; districts: number }[];
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const rows = Math.max(...districts.map((d) => d.tile[1]));
  const current = districts.find((d) => d.slug === picked) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <div className="bg-surface border border-rule rounded-card shadow-card p-3 sm:p-5 flex flex-col gap-4">
        <div
          className="grid gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
          role="group"
          aria-label="জেলার টাইল-মানচিত্র"
        >
          {districts.map((d) => {
            const style = fill(d);
            const lead = d.parties[0];
            const label = `${d.name}: ${BN(d.seats.length)}টি আসন${lead ? `, বেশিরভাগ ${lead.name}` : ''}`;
            return (
              <button
                key={d.slug}
                type="button"
                aria-label={label}
                aria-pressed={picked === d.slug}
                title={label}
                onClick={() => {
                  setPicked(d.slug);
                  // On a phone the list sits under the map: bring it into view.
                  if (window.matchMedia('(max-width: 1023px)').matches) {
                    requestAnimationFrame(() => document.getElementById('district-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                  }
                }}
                className={`aspect-square rounded-md sm:rounded-lg flex items-center justify-center p-0.5 text-center leading-tight font-semibold text-[8.5px] sm:text-[11px] overflow-hidden transition-transform hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  picked === d.slug ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface z-10' : ''
                }`}
                style={{ ...style, gridColumn: d.tile[0], gridRow: d.tile[1] }}
              >
                <span className="line-clamp-2 break-all sm:break-normal">{SHORT[d.slug] ?? d.name}</span>
              </button>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-inksoft border-t border-rule pt-3">
          {legend.map((p) => (
            <li key={p.abbr} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
              {p.name} <span className="text-muted tnum">({BN(p.districts)} জেলা)</span>
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, var(--color-pbnp) 50%, var(--color-pjamaat) 50%)' }} aria-hidden="true" />
            সমান সমান
          </li>
        </ul>
      </div>

      <aside id="district-panel" className="bg-surface border border-rule rounded-card shadow-card p-5 flex flex-col gap-3 lg:sticky lg:top-24 scroll-mt-20" aria-live="polite">
        {current ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="display text-[20px] font-bold">{current.name}</h3>
              <Link href={`/jela/${current.slug}`} className="text-[13px] font-semibold text-brand hover:underline shrink-0">জেলার পাতা →</Link>
            </div>
            <p className="text-[13px] text-muted">
              {BN(current.seats.length)}টি আসন: {current.parties.map((p) => `${p.name} ${BN(p.seats)}`).join(', ') || 'ফল নেই'}
            </p>
            <ul className="flex flex-col divide-y divide-rulesoft">
              {current.seats.map((s) => (
                <li key={s.no} className="py-2.5 flex items-start gap-2.5">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <Link href={`/ason/${s.slug}`} className="text-[13px] font-bold text-brand hover:underline">{s.seat}</Link>
                    {s.member ? (
                      <Link href={`/mp/${s.member.slug}`} className="text-[15px] font-semibold leading-snug hover:text-brand">{s.member.name}</Link>
                    ) : (
                      <span className="text-[14px] text-muted">আসনটি এখন শূন্য</span>
                    )}
                    <span className="text-[12.5px] text-muted tnum">
                      {[s.partyBn, s.votes ? `${BN_GROUP(s.votes)} ভোট` : null, s.margin ? `ব্যবধান ${BN_GROUP(s.margin)}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-col gap-2 py-4">
            <h3 className="display text-[18px] font-bold">একটি জেলায় চাপ দিন</h3>
            <p className="text-[14px] text-inksoft leading-relaxed">
              জেলার রং সেখানে বেশিরভাগ আসন যে দলের। চাপ দিলে এখানে সেই জেলার প্রতিটি আসন, বর্তমান সংসদ সদস্য, প্রাপ্ত ভোট ও ব্যবধান দেখাবে।
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
