'use client';

import { useSyncExternalStore } from 'react';
import { agoBn, dateTimeBn, timeBn } from '@/lib/whenBn';

/*
 * When a story was published: "৩ ঘণ্টা আগে, সকাল ১০:২৬" while it is recent,
 * "১২ সেপ্টেম্বর ২০২৬, দুপুর ২:৪৭" once it is older than a week. The page is
 * prerendered, so the server writes only the fixed part and the browser adds
 * "আগে", then keeps it current; the full date and time sit in the title.
 */
const subscribe = (tick: () => void) => {
  const id = window.setInterval(tick, 60_000);
  return () => window.clearInterval(id);
};
// One value per minute, so React re-renders only when the minute changes.
const minuteNow = () => Math.floor(Date.now() / 60_000);

export default function When({ iso, withDate = true, className = '' }: { iso: string; withDate?: boolean; className?: string }) {
  const minute = useSyncExternalStore(subscribe, minuteNow, () => 0);
  const ago = minute ? agoBn(iso, minute * 60_000) : null;
  const time = timeBn(iso);
  const full = dateTimeBn(iso);

  let text: string;
  if (ago) text = time ? `${ago}, ${time}` : ago;
  else if (withDate) text = full;
  else text = time ?? '';

  if (!text) return null;
  return (
    <time dateTime={iso} title={full} className={`tnum whitespace-nowrap ${className}`}>
      {text}
    </time>
  );
}
