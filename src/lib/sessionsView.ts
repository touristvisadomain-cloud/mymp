/**
 * The House's own publications (sessions, sittings, circulars, notices, the
 * presiding officers) in the reader's language. The source writes them in
 * Bangla, with English titles for some; these turn them into English the way
 * the sessions page shows them, and the mobile app's sessions screen reads
 * the same functions.
 */
import type { Officer, Sitting, Circular } from '@/lib/activity';
import { MONTHS_BN, MONTHS_EN, type T } from '@/i18n/core';
import { personName, titleCaseName } from '@/i18n/names';

/** The weekday of an ISO date, as the calendar in Dhaka has it. */
export const weekdayOf = (t: T, iso: string) => t.weekday(new Date(`${iso}T12:00:00+06:00`).getUTCDay());

export const latin = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

/** "দিনের কার্যসূচী: ১০-০৯-২০২৬" → "Order of the day: 10 September 2026", from the sitting's date (or the title's, when it has none). */
export function sittingTitleEn(t: T, o: Sitting): string {
  let iso = o.date;
  if (!iso) {
    const m = /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/.exec(latin(o.titleBn ?? ''));
    if (m) iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  }
  const date = t.date(iso);
  return date ? `Order of the day: ${date}` : 'Order of the day';
}

/** "পরিপত্র-১" → "Circular 1". */
export function circularTitleEn(c: Circular): string {
  const no = c.no ?? Number(/\d+/.exec(latin(c.titleBn ?? ''))?.[0] ?? NaN);
  return Number.isFinite(no) ? `Circular ${no}` : 'Circular';
}

/** A source's English title, cleaned of doubled spaces and spaces on the wrong side of brackets and commas; the words are left as they are. */
export const tidyEn = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/([A-Za-z.])\(/g, '$1 (')
    .replace(/\(\s+/g, '(')
    .replace(/\s+([,.;:)])/g, '$1')
    .trim();

/** An officer's English name: the source writes some after the title in capitals ("Mr. MIAH NURUDDIN AHMAD APU"). */
export function officerNameEn(o: Officer): string {
  const raw = tidyEn(o.nameEn);
  const m = /^((?:Mr|Mrs|Ms|Dr)\.\s+)(.+)$/.exec(raw);
  const nameEn = m && m[2] === m[2]!.toUpperCase() ? `${m[1]}${titleCaseName(m[2]!)}` : raw;
  return personName({ id: o.memberId ?? undefined, nameBn: o.nameBn, nameEn }, 'en');
}

/** "১২ মার্চ ২০২৬ -" → "from 12 March 2026"; null when the tenure cannot be read. */
export function tenureEn(bn: string | null): string | null {
  if (!bn) return null;
  const date = (s: string) => {
    const m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(latin(s.trim()));
    const month = m ? MONTHS_BN.indexOf(m[2]!) : -1;
    return m && month >= 0 ? `${Number(m[1])} ${MONTHS_EN[month]} ${m[3]}` : null;
  };
  const [from, to] = bn.split(/\s+-\s*/);
  const a = from ? date(from) : null;
  if (!a) return null;
  if (!to?.trim()) return `from ${a}`;
  const b = date(to);
  return b ? `${a} to ${b}` : null;
}
