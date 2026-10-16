'use client';

import { useState } from 'react';
import Icon from './Icon';
import { FEED_FROM } from '@/lib/feed/window';
import { useT } from '@/i18n/client';
import { makeT, type Lang } from '@/i18n/core';

const [MIN_Y, MIN_M] = FEED_FROM.split('-').map(Number) as [number, number];

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

const WEEKDAYS_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
/** "বুধবার, ১৫ অক্টোবর ২০২৬" / "Wednesday, 15 October 2026" for a yyyy-mm-dd day. */
export const dateLabel = (day: string, lang: Lang = 'bn') => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  if (lang === 'en') {
    const t = makeT('en');
    return `${t.weekday(date.getUTCDay())}, ${d ?? 1} ${t.month(m ?? 1)} ${y ?? 0}`;
  }
  return `${WEEKDAYS_BN[date.getUTCDay()]}, ${bn(d ?? 1)} ${MONTHS_BN[(m ?? 1) - 1]} ${bn(y ?? 0)}`;
};

const SELECT_CLS = 'h-9 rounded-full border border-rule bg-surface px-2.5 text-[13.5px] text-ink focus:border-brand focus:ring-4 focus:ring-brandring outline-none';

/** yyyy-mm-dd, n days later (or earlier), on the calendar. */
export const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
};
/** "১০ অক্টোবর" / "10 October", with the year only when it differs from the other end's. */
const shortDay = (day: string, withYear: boolean, lang: Lang = 'bn') => {
  const [y, m, d] = day.split('-').map(Number);
  if (lang === 'en') return `${d!} ${makeT('en').month(m!)}${withYear ? ` ${y!}` : ''}`;
  return `${bn(d!)} ${MONTHS_BN[m! - 1]}${withYear ? ` ${bn(y!)}` : ''}`;
};
/**
 * "বুধবার, ১৫ অক্টোবর ২০২৬" for one day, "১০ অক্টোবর থেকে ১৫ অক্টোবর ২০২৬" for a span;
 * in English "Wednesday, 15 October 2026" and "10 October to 15 October 2026".
 */
export const rangeLabel = (from: string, to: string, lang: Lang = 'bn') =>
  from === to
    ? dateLabel(from, lang)
    : lang === 'en'
      ? `${shortDay(from, from.slice(0, 4) !== to.slice(0, 4), lang)} to ${shortDay(to, true, lang)}`
      : `${shortDay(from, from.slice(0, 4) !== to.slice(0, 4))} থেকে ${shortDay(to, true)}`;

/** The span the address asks for: ?d=2026-10-15 or ?d=2026-10-10~2026-10-15, earlier end first. */
export function parseRange(raw: string): { from: string; to: string } | null {
  const [a, b = a] = raw.split('~');
  const ok = (x: string | undefined): x is string => !!x && /^\d{4}-\d{2}-\d{2}$/.test(x);
  if (!ok(a) || !ok(b)) return null;
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** One day, chosen in the page's language: day, month and year menus that stop at today. */
function DateSelect({ id, label, value, today, onChange }: { id: string; label: string; value: string; today: string; onChange: (day: string) => void }) {
  const t = useT();
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const years = Array.from({ length: ty - MIN_Y + 1 }, (_, i) => ty - i);
  // The months run from the window's first (December 2025) to today's.
  const firstMonth = y === MIN_Y ? MIN_M : 1;
  const lastMonth = y === ty ? tm : 12;
  const lastDay = y === ty && m === tm ? td : new Date(Date.UTC(y, m, 0)).getUTCDate();
  const set = (ny: number, nm: number, nd: number) => {
    const mm = Math.min(nm, ny === ty ? tm : 12);
    const max = ny === ty && mm === tm ? td : new Date(Date.UTC(ny, mm, 0)).getUTCDate();
    onChange(`${ny}-${String(mm).padStart(2, '0')}-${String(Math.min(nd, max)).padStart(2, '0')}`);
  };
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-[13px] font-semibold text-inksoft w-9">{label}</span>
      <label className="sr-only" htmlFor={`${id}-d`}>{label}: {t('দিন', 'day')}</label>
      <select id={`${id}-d`} value={d} onChange={(e) => set(y, m, Number(e.target.value))} className={SELECT_CLS}>
        {Array.from({ length: lastDay }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t.en ? n : bn(n)}</option>)}
      </select>
      <label className="sr-only" htmlFor={`${id}-m`}>{label}: {t('মাস', 'month')}</label>
      <select id={`${id}-m`} value={m} onChange={(e) => set(y, Number(e.target.value), d)} className={SELECT_CLS}>
        {Array.from({ length: lastMonth - firstMonth + 1 }, (_, i) => firstMonth + i).map((n) => <option key={n} value={n}>{t.en ? t.month(n) : MONTHS_BN[n - 1]}</option>)}
      </select>
      <label className="sr-only" htmlFor={`${id}-y`}>{label}: {t('বছর', 'year')}</label>
      <select id={`${id}-y`} value={y} onChange={(e) => set(Number(e.target.value), m, d)} className={SELECT_CLS}>
        {years.map((n) => <option key={n} value={n}>{t.en ? n : bn(n)}</option>)}
      </select>
    </span>
  );
}

const CHIP = 'h-9 px-3.5 rounded-full border text-[13.5px] font-semibold transition-colors';

/**
 * A day or a span of days, in the page's language. One tap for the usual ones (আজ, গতকাল,
 * গত ৭ দিন, এই মাস), or a start and an end picked from day, month and year
 * menus. The browser's own date box reads "dd-----yyyy" in English.
 */
export default function RangePicker({ range, today, onPick }: { range: { from: string; to: string } | null; today: string; onPick: (raw: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range?.from ?? addDays(today, -6));
  const [to, setTo] = useState(range?.to ?? today);
  const quick: [string, string, string][] = [
    [t('আজ', 'Today'), today, today],
    [t('গতকাল', 'Yesterday'), addDays(today, -1), addDays(today, -1)],
    [t('গত ৭ দিন', 'Last 7 days'), addDays(today, -6), today],
    [t('গত ৩০ দিন', 'Last 30 days'), addDays(today, -29), today],
    [t('এই মাস', 'This month'), `${today.slice(0, 7)}-01`, today],
  ];
  const pick = (a: string, b: string) => { onPick(a === b ? a : `${a}~${b}`); setOpen(false); };
  const isQuick = (a: string, b: string) => range?.from === a && range?.to === b;

  if (!open) {
    return range ? (
      <span className="flex items-center gap-1 h-9 ps-3 pe-1 rounded-full border border-brand bg-brandsoft text-brand text-[13.5px] font-semibold">
        <Icon name="calendar" size={15} />
        {quick.find(([, a, b]) => isQuick(a, b))?.[0] ?? rangeLabel(range.from, range.to, t.lang)}
        <button type="button" onClick={() => { setFrom(range.from); setTo(range.to); setOpen(true); }} className="h-7 px-2 rounded-full hover:bg-surface text-[12.5px]">{t('বদলান', 'Change')}</button>
        <button type="button" onClick={() => onPick('')} aria-label={t('তারিখ সরান', 'Clear the date')} className="h-7 w-7 rounded-full hover:bg-surface grid place-items-center">
          <Icon name="x" size={14} />
        </button>
      </span>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className={`${CHIP} border-rule hover:border-ink flex items-center gap-1.5`}>
        <Icon name="calendar" size={15} />
        {t('তারিখ দিয়ে খুঁজুন', 'Find by date')}
      </button>
    );
  }
  return (
    <div className="basis-full rounded-card border border-rule bg-surface p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {quick.map(([label, a, b]) => (
          <button key={label} type="button" onClick={() => pick(a, b)} className={`${CHIP} ${isQuick(a, b) ? 'border-brand bg-brandsoft text-brand' : 'border-rule hover:border-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-3 border-t border-rulesoft">
        <span className="text-[13px] text-muted">{t('অথবা নির্দিষ্ট সময়', 'Or a period of your choice')}</span>
        <DateSelect id="feed-from" label={t('থেকে', 'From')} value={from} today={today} onChange={setFrom} />
        <DateSelect id="feed-to" label={t('পর্যন্ত', 'To')} value={to} today={today} onChange={setTo} />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" onClick={() => (from <= to ? pick(from, to) : pick(to, from))} className="h-9 px-4 rounded-full bg-brand text-white text-[13.5px] font-semibold hover:bg-branddark">
            {t('দেখুন', 'Show')}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="h-9 px-3 rounded-full border border-rule text-[13px] hover:border-ink">{t('বাতিল', 'Cancel')}</button>
          <span className="text-[12.5px] text-muted">{rangeLabel(from <= to ? from : to, from <= to ? to : from, t.lang)}</span>
        </div>
      </div>
    </div>
  );
}
