'use client';

import { Fragment, useSyncExternalStore } from 'react';
import { agoBn, dateTimeBn, timeBn } from '@/lib/whenBn';
import { useLang } from '@/i18n/client';

/*
 * When a story was published: the date and time, "১২ সেপ্টেম্বর ২০২৬, দুপুর
 * ২:৪৭", and while it is recent how long ago, "· ৩ ঘণ্টা আগে" (the owner
 * asked for the date and time on every story, 2026-10-17). `withDate={false}`
 * keeps the old short form, "৩ ঘণ্টা আগে, সকাল ১০:২৬". The page is
 * prerendered, so the server writes only the fixed part and the browser adds
 * "আগে", then keeps it current. English pages read "12 September 2026,
 * 2:47 pm · 3 hours ago".
 */
const subscribe = (tick: () => void) => {
  const id = window.setInterval(tick, 60_000);
  return () => window.clearInterval(id);
};
// One value per minute, so React re-renders only when the minute changes.
const minuteNow = () => Math.floor(Date.now() / 60_000);

export default function When({ iso, withDate = true, className = '' }: { iso: string; withDate?: boolean; className?: string }) {
  const lang = useLang();
  const minute = useSyncExternalStore(subscribe, minuteNow, () => 0);
  const ago = minute ? agoBn(iso, minute * 60_000, lang) : null;
  const time = timeBn(iso, lang);
  const full = dateTimeBn(iso, lang);

  // Pieces that never break inside; a narrow card breaks between them.
  let parts: string[];
  if (withDate) parts = [...full.split(/(?<=,) /), ...(ago ? [`· ${ago}`] : [])];
  else if (ago) parts = time ? [`${ago},`, time] : [ago];
  else parts = time ? [time] : [];

  if (!parts.length) return null;
  return (
    <time dateTime={iso} title={full} className={`tnum ${className}`}>
      {/* The space between pieces sits outside them, where a line may break. */}
      {parts.map((x, i) => (
        <Fragment key={i}>
          {i ? ' ' : null}
          <span className="whitespace-nowrap">{x}</span>
        </Fragment>
      ))}
    </time>
  );
}
