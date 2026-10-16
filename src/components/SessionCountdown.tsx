'use client';

/**
 * The latest session, told by the clock (/odhibeshon): before it starts, the
 * days, hours, minutes and seconds left to its first day; while it sits,
 * which day of it this is; after, how long since its last sitting.
 *
 * The page is built ahead of time, so the server draws only the frame and
 * the numbers come in the browser, from the visitor's own clock against
 * Dhaka's calendar (UTC+6). The source gives the start date, not the hour
 * the House meets, so the count runs to the start of that day.
 */
import { useEffect, useState } from 'react';
import Icon from './Icon';

const BN = (n: number | string) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
const pad = (n: number) => BN(String(n).padStart(2, '0'));
/** Midnight in Dhaka on an ISO date. */
const dhakaDay = (iso: string) => Date.parse(`${iso}T00:00:00+06:00`);
const DAY = 86_400_000;
/** A session the source has not closed counts as over this long after its last sitting. */
const QUIET_DAYS = 10;

type State =
  | { kind: 'before'; d: number; h: number; m: number; s: number }
  | { kind: 'sitting'; day: number }
  | { kind: 'after'; days: number };

function stateAt(now: number, start: string, end: string | null, lastSitting: string | null): State {
  const t0 = dhakaDay(start);
  if (now < t0) {
    let left = Math.floor((t0 - now) / 1000);
    const d = Math.floor(left / 86400); left -= d * 86400;
    const h = Math.floor(left / 3600); left -= h * 3600;
    const m = Math.floor(left / 60);
    return { kind: 'before', d, h, m, s: left - m * 60 };
  }
  const closed = end ? now >= dhakaDay(end) + DAY : lastSitting ? now >= dhakaDay(lastSitting) + QUIET_DAYS * DAY : false;
  if (closed) return { kind: 'after', days: Math.floor((now - dhakaDay(lastSitting ?? end ?? start)) / DAY) };
  return { kind: 'sitting', day: Math.floor((now - t0) / DAY) + 1 };
}

export default function SessionCountdown({
  label,
  start,
  startBn,
  weekdayBn,
  end,
  lastSitting,
  sittings,
  circular,
}: {
  /** "চতুর্থ অধিবেশন" */
  label: string;
  /** ISO date the session starts. */
  start: string;
  /** "৯ নভেম্বর ২০২৬" */
  startBn: string;
  /** "রবিবার" */
  weekdayBn: string;
  end: string | null;
  lastSitting: string | null;
  sittings: number;
  /** The session's first circular, which carries the hour it meets. */
  circular: { title: string; url: string } | null;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // The clock starts in the browser; the first tick is immediate.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  const st = now === null ? null : stateAt(now, start, end, lastSitting);

  const eyebrow = st?.kind === 'sitting' ? 'অধিবেশন চলছে' : st?.kind === 'after' ? 'সর্বশেষ অধিবেশন' : 'আসন্ন অধিবেশন';
  const units: [string, number | null][] = st?.kind === 'before'
    ? [['দিন', st.d], ['ঘণ্টা', st.h], ['মিনিট', st.m], ['সেকেন্ড', st.s]]
    : [['দিন', null], ['ঘণ্টা', null], ['মিনিট', null], ['সেকেন্ড', null]];

  return (
    <section
      aria-label="অধিবেশনের সময়"
      className="relative overflow-hidden rounded-card bg-branddark text-white shadow-lift"
    >
      <div aria-hidden="true" className="absolute -right-24 -top-24 w-[340px] h-[340px] rounded-full bg-white/5" />
      <div aria-hidden="true" className="absolute -right-6 -bottom-32 w-[260px] h-[260px] rounded-full bg-white/5" />
      <div className="relative px-5 sm:px-8 py-6 sm:py-7 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center">
        <div className="flex flex-col gap-2 min-w-0">
          <span className="inline-flex items-center gap-2 text-[12.5px] font-bold tracking-[0.6px] text-white/75">
            <span className={`w-2 h-2 rounded-full ${st?.kind === 'sitting' ? 'bg-live animate-pulse' : 'bg-white/60'}`} aria-hidden="true" />
            {eyebrow}
          </span>
          <h2 className="display text-[28px] sm:text-[34px] font-bold leading-tight">{label}</h2>
          <p className="text-[15px] text-white/85">
            শুরু {weekdayBn}, {startBn}
            {sittings > 0 && <> · {BN(sittings)}টি বৈঠক হয়েছে</>}
          </p>
          {circular && (
            <a
              href={circular.url}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start mt-1 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white/12 hover:bg-white/20 text-[13.5px] font-semibold transition-colors"
            >
              {circular.title}: বৈঠকের সময় ও সূচি
              <Icon name="external" size={13} />
            </a>
          )}
        </div>

        {st?.kind === 'sitting' ? (
          <div className="flex items-baseline gap-3 lg:justify-end">
            <span className="display text-[64px] sm:text-[76px] font-bold leading-none tnum">{BN(st.day)}</span>
            <span className="text-[16px] text-white/80 leading-snug">তম দিন<br />অধিবেশনের</span>
          </div>
        ) : st?.kind === 'after' ? (
          <div className="flex flex-col gap-1 lg:items-end">
            <span className="display text-[44px] font-bold leading-none tnum">{BN(st.days)} দিন</span>
            <span className="text-[14px] text-white/80">শেষ বৈঠকের পর; পরের অধিবেশনের তারিখ এখনো ঘোষণা হয়নি</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 lg:items-end">
            <ol className="grid grid-cols-4 gap-2 sm:gap-3" aria-live="off">
              {units.map(([u, v]) => (
                <li key={u} className="w-[68px] sm:w-[84px] rounded-xl bg-white/10 border border-white/15 px-2 py-3 flex flex-col items-center gap-1">
                  <span className="display text-[30px] sm:text-[38px] font-bold leading-none tnum">{v === null ? '––' : u === 'দিন' ? BN(v) : pad(v)}</span>
                  <span className="text-[12px] text-white/75">{u}</span>
                </li>
              ))}
            </ol>
            <span className="text-[12px] text-white/65">শুরুর দিন পর্যন্ত বাকি</span>
          </div>
        )}
      </div>
    </section>
  );
}
