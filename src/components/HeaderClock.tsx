'use client';

import { useSyncExternalStore } from 'react';
import { useLang } from '@/i18n/client';
import { MONTHS_EN, WEEKDAYS_EN } from '@/i18n/core';

/*
 * Today's date and time in Bangladesh, in Bangla, as the owner asked
 * (2026-09-12): "শনিবার, ১২ সেপ্টেম্বর ২০২৬, দুপুর ২:৪৭". The site is
 * prerendered, so the server renders nothing here and the browser fills it in,
 * then keeps it current.
 *
 * Bangla names the part of the day instead of writing AM or PM, and the
 * boundaries are the ones the newspapers use: রাত until four, ভোর to six,
 * সকাল to noon, দুপুর to three, বিকেল to five, সন্ধ্যা to seven, then রাত.
 */
const DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);

function partOfDay(hour: number): string {
  if (hour < 4) return 'রাত';
  if (hour < 6) return 'ভোর';
  if (hour < 12) return 'সকাল';
  if (hour < 15) return 'দুপুর';
  if (hour < 17) return 'বিকেল';
  if (hour < 19) return 'সন্ধ্যা';
  return 'রাত';
}

/** The parts of "now" in Dhaka, whatever the reader's own clock says. */
const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const subscribe = (tick: () => void) => {
  const id = window.setInterval(tick, 10_000);
  return () => window.clearInterval(id);
};

// The same string for every call within a minute, so React re-renders only when the minute changes.
const now = () => {
  const parts = Object.fromEntries(PARTS.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const weekday = DAYS[WEEKDAY_INDEX[parts.weekday ?? 'Sun'] ?? 0]!;
  const month = MONTHS[Number(parts.month) - 1] ?? '';
  const hour24 = Number(parts.hour);
  // Midnight and noon read as ১২টা in Bangla, never ০টা.
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${weekday}, ${bn(parts.day ?? '')} ${month} ${bn(parts.year ?? '')}, ${partOfDay(hour24)} ${bn(hour12)}:${bn(parts.minute ?? '')}`;
};

/** The same in English: "Saturday, 12 September 2026, 2:47 pm". */
const nowEn = () => {
  const parts = Object.fromEntries(PARTS.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const weekday = WEEKDAYS_EN[WEEKDAY_INDEX[parts.weekday ?? 'Sun'] ?? 0]!;
  const month = MONTHS_EN[Number(parts.month) - 1] ?? '';
  const hour24 = Number(parts.hour) % 24;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${weekday}, ${parts.day ?? ''} ${month} ${parts.year ?? ''}, ${hour12}:${parts.minute ?? ''} ${hour24 < 12 ? 'am' : 'pm'}`;
};

export default function HeaderClock() {
  const en = useLang() === 'en';
  const text = useSyncExternalStore(subscribe, en ? nowEn : now, () => '');
  return (
    <span className="tnum" aria-label={text ? (en ? `Now in Bangladesh: ${text}` : `বাংলাদেশে এখন ${text}`) : undefined}>
      {text}
    </span>
  );
}
