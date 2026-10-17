import { members, partyColor, type Party } from '@/lib/data';
import { partyShort, partyName } from '@/i18n/names';
import { getT } from '@/i18n/server';

/**
 * The House as the home page shows it (owner, 2026-10-17): the governing
 * party's share against the majority, one bar split into each party's
 * elected and reserved seats, then a row per party with its own small bar.
 * The four largest parties get a row each; the rest fold into "other
 * parties", which opens to name them. Colours are the site's party colours;
 * a reserved seat is its party's colour, paler.
 */
export default async function HouseComposition({ parties, total, majority }: { parties: Party[]; total: number; majority: number }) {
  const t = await getT();
  const seated = parties.filter((p) => p.seats > 0).sort((a, b) => b.seats - a.seats);
  const top = seated.slice(0, 4);
  const rest = seated.slice(4);
  const restSeats = rest.reduce((n, p) => n + p.seats, 0);

  // The governing party is the Prime Minister's.
  const pmParty = members.find((m) => m.offices.includes('pm'))?.party?.abbr;
  const lead = seated.find((p) => p.abbr === pmParty) ?? seated[0];
  const share = lead ? Math.round((lead.seats / total) * 100) : 0;
  const over = lead ? lead.seats - majority : 0;
  const majorityPct = (majority / total) * 100;
  const fg = (abbr: string) => (abbr === 'BJEI' ? 'var(--color-ink)' : '#fff');

  const segments = [
    ...top.flatMap((p) => [
      { key: `${p.abbr}-t`, abbr: p.abbr, seats: p.seatsTerritorial, pale: false },
      { key: `${p.abbr}-r`, abbr: p.abbr, seats: p.seatsReserved, pale: true },
    ]),
    ...(restSeats ? [{ key: 'other', abbr: 'other', seats: restSeats, pale: false }] : []),
  ].filter((s) => s.seats > 0);

  const split = (p: Party) =>
    p.seatsReserved
      ? t(`${t.n(p.seatsTerritorial)} + ${t.n(p.seatsReserved)} সংরক্ষিত`, `${p.seatsTerritorial} + ${p.seatsReserved} reserved`)
      : t(`${t.n(p.seatsTerritorial)} আসনভিত্তিক`, `${p.seatsTerritorial} elected`);

  return (
    <div className="flex flex-col">
      {lead && (
        <div className="flex items-center gap-3 rounded-[10px] bg-brandsoft px-3 py-2.5 mb-5">
          <span
            className="shrink-0 w-10 h-10 rounded-full grid place-items-center text-[13px] font-bold tnum"
            style={{ background: partyColor(lead.abbr), color: fg(lead.abbr) }}
          >
            {t.n(share)}%
          </span>
          <span className="flex flex-col leading-snug min-w-0">
            <span className="text-[14px] font-bold text-branddark">
              {t(
                `সরকারি দল ${partyShort(lead, 'bn')}: ${t.n(lead.seats)}টি আসন`,
                `Governing party ${partyShort(lead, 'en')}: ${lead.seats} seats`,
              )}
            </span>
            <span className="text-[12.5px] text-inksoft">
              {over > 0
                ? t(`সংখ্যাগরিষ্ঠতার (${t.n(majority)}) চেয়ে ${t.n(over)}টি বেশি`, `${over} more than a majority (${majority})`)
                : t(`সংখ্যাগরিষ্ঠতা ${t.n(majority)}`, `Majority ${majority}`)}
            </span>
          </span>
        </div>
      )}

      <div className="relative pt-5">
        <div
          className="absolute top-0 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap"
          style={{ left: `${majorityPct}%` }}
        >
          {t('সংখ্যাগরিষ্ঠতা', 'Majority')} {t.n(majority)}
        </div>
        <div
          className="absolute top-3.5 -bottom-1 border-l-[1.5px] border-dashed border-ink"
          style={{ left: `${majorityPct}%` }}
          aria-hidden="true"
        />
        <div
          className="bar-fill flex gap-0.5 h-[30px] rounded-md overflow-hidden"
          role="img"
          aria-label={seated.map((p) => `${partyShort(p, t.lang)} ${t.n(p.seats)}`).join(', ')}
        >
          {segments.map((s) => (
            <div
              key={s.key}
              className="flex items-center ps-2 text-[13px] font-bold tnum overflow-hidden"
              style={{
                flex: `${s.seats} 1 0`,
                background: partyColor(s.abbr === 'other' ? null : s.abbr),
                opacity: s.pale ? 0.5 : 1,
                color: fg(s.abbr),
              }}
            >
              {!s.pale && s.seats / total > 0.12 ? t.n(s.seats) : ''}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 mb-2 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-[2px]" style={{ background: partyColor('BNP') }} />
          {t('আসনভিত্তিক', 'Elected seats')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-[2px] opacity-50" style={{ background: partyColor('BNP') }} />
          {t('সংরক্ষিত নারী আসন', 'Reserved seats for women')}
        </span>
      </div>

      <ul className="flex flex-col">
        {top.map((p) => (
          <li key={p.abbr} className="grid grid-cols-[14px_minmax(0,1fr)_minmax(60px,110px)_36px] items-center gap-2.5 py-2 border-t border-rulesoft">
            <span aria-hidden="true" className="w-3 h-3 rounded-[3px]" style={{ background: partyColor(p.abbr) }} />
            <span className="flex flex-col min-w-0 leading-snug">
              <span className="text-[14px] font-medium truncate" title={partyName(p, t.lang)}>{partyShort(p, t.lang)}</span>
              <span className="text-[12px] text-muted tnum">{split(p)}</span>
            </span>
            <span aria-hidden="true" className="h-[7px] rounded bg-sunk overflow-hidden">
              <span className="block h-full rounded" style={{ width: `${(p.seats / total) * 100}%`, background: partyColor(p.abbr) }} />
            </span>
            <span className="text-[14px] font-bold tnum text-end">{t.n(p.seats)}</span>
          </li>
        ))}
        {rest.length > 0 && (
          <li className="border-t border-rulesoft">
            <details className="group">
              <summary className="grid grid-cols-[14px_minmax(0,1fr)_minmax(60px,110px)_36px] items-center gap-2.5 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="w-3 h-3 rounded-[3px]" style={{ background: partyColor(null) }} />
                <span className="text-[14px] font-medium">
                  {t(`অন্য ${t.n(rest.length)} দল`, `${rest.length} other parties`)}{' '}
                  <span className="text-[12px] font-semibold text-brand">
                    <span className="group-open:hidden">▾ {t('দেখুন', 'Show')}</span>
                    <span className="hidden group-open:inline">▴ {t('লুকান', 'Hide')}</span>
                  </span>
                </span>
                <span aria-hidden="true" className="h-[7px] rounded bg-sunk overflow-hidden">
                  <span className="block h-full rounded" style={{ width: `${(restSeats / total) * 100}%`, background: partyColor(null) }} />
                </span>
                <span className="text-[14px] font-bold tnum text-end">{t.n(restSeats)}</span>
              </summary>
              <p className="ps-6 pb-2 text-[12.5px] text-muted leading-relaxed">
                {rest.map((p) => `${partyShort(p, t.lang)} ${t.n(p.seats)}`).join(' · ')}
              </p>
            </details>
          </li>
        )}
      </ul>
    </div>
  );
}
