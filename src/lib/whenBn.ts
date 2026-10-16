/**
 * When a story was published, in Bangla, the way the header clock writes the
 * time: "সকাল ১০:২৬", "১৫ অক্টোবর ২০২৬, সকাল ১০:২৬", "৩ ঘণ্টা আগে". Always the
 * Bangladesh clock, wherever the page is built or read. In English (pass
 * `'en'`): "10:26 am", "15 October 2026, 10:26 am", "3 hours ago".
 */
import { MONTHS_EN, plural, type Lang } from '@/i18n/core';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (v: string | number) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

/** The newspapers' parts of the day: রাত until four, ভোর to six, সকাল to noon, দুপুর to three, বিকেল to five, সন্ধ্যা to seven, then রাত. */
function partOfDay(hour: number): string {
  if (hour < 4) return 'রাত';
  if (hour < 6) return 'ভোর';
  if (hour < 12) return 'সকাল';
  if (hour < 15) return 'দুপুর';
  if (hour < 17) return 'বিকেল';
  if (hour < 19) return 'সন্ধ্যা';
  return 'রাত';
}

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

function dhakaParts(iso: string): { y: number; m: number; d: number; hour: number; minute: string } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const p = Object.fromEntries(PARTS.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  // Intl writes midnight as "24" in some engines.
  const hour = Number(p.hour) % 24;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hour, minute: p.minute ?? '00' };
}

/** True when the value carries a clock time; a bare "2026-09-10" from the old snapshot does not. */
export const hasClock = (iso: string) => /T\d\d:\d\d/.test(iso);

/** "সকাল ১০:২৬" / "10:26 am". Null for a date with no clock. */
export function timeBn(iso: string, lang: Lang = 'bn'): string | null {
  if (!hasClock(iso)) return null;
  const p = dhakaParts(iso);
  if (!p) return null;
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  if (lang === 'en') return `${hour12}:${p.minute} ${p.hour < 12 ? 'am' : 'pm'}`;
  return `${partOfDay(p.hour)} ${bn(hour12)}:${bn(p.minute)}`;
}

/** "১৫ অক্টোবর ২০২৬, সকাল ১০:২৬" / "15 October 2026, 10:26 am", or just the date when there is no clock. */
export function dateTimeBn(iso: string, lang: Lang = 'bn'): string {
  const p = dhakaParts(iso);
  if (!p) return iso;
  const date = lang === 'en' ? `${p.d} ${MONTHS_EN[p.m - 1]} ${p.y}` : `${bn(p.d)} ${MONTHS[p.m - 1]} ${bn(p.y)}`;
  const time = timeBn(iso, lang);
  return time ? `${date}, ${time}` : date;
}

/**
 * "এইমাত্র", "৫ মিনিট আগে", "৩ ঘণ্টা আগে", "গতকাল", "৩ দিন আগে" within a week
 * ("just now", "5 minutes ago", "3 hours ago", "yesterday", "3 days ago");
 * null for anything older, where the date says it better.
 */
export function agoBn(iso: string, now = Date.now(), lang: Lang = 'bn'): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.round((now - t) / 60_000);
  // A date still ahead of us (a notice filed under the day it takes effect) is a date, not "just now".
  if (mins < -10) return null;
  const en = lang === 'en';
  if (mins < 1) return en ? 'just now' : 'এইমাত্র';
  if (mins < 60) return en ? `${mins} ${plural(mins, 'minute', 'minutes')} ago` : `${bn(mins)} মিনিট আগে`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return en ? `${hours} ${plural(hours, 'hour', 'hours')} ago` : `${bn(hours)} ঘণ্টা আগে`;
  const days = Math.floor(hours / 24);
  if (days === 1) return en ? 'yesterday' : 'গতকাল';
  if (days < 7) return en ? `${days} days ago` : `${bn(days)} দিন আগে`;
  return null;
}
