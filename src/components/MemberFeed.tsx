'use client';

import StoryThumb from './StoryThumb';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useQueryParam } from '@/lib/useQueryParam';

/**
 * সংবাদ ও ভিডিও on a member's profile.
 *
 * The profile is prerendered, so the feed comes from /api/feed/[slug] when the
 * section is first shown. The current month arrives with the first response;
 * an earlier month is fetched only when a reader opens it, and the open month
 * is written into the address (?m=2026-08) so it can be shared and so the back
 * button works.
 */

export interface FeedEntry {
  id: number;
  type: 'news' | 'video' | 'press' | 'social';
  title: string;
  url: string;
  summary: string | null;
  outletName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string;
  alsoIn: { outletName: string | null; url: string }[];
  pinned: boolean;
}

interface MonthCount { month: string; total: number; news: number; video: number }

interface FeedResponse {
  month: string;
  pinned: FeedEntry[];
  items: FeedEntry[];
  months: MonthCount[];
  total: number;
  news: number;
  video: number;
  outlets: string[];
  startsAt: string | null;
  unavailable?: boolean;
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

const WEEKDAYS_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
/** "বুধবার, ১৫ অক্টোবর ২০২৬" for a yyyy-mm-dd day. */
const dateLabel = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  return `${WEEKDAYS_BN[date.getUTCDay()]}, ${bn(d ?? 1)} ${MONTHS_BN[(m ?? 1) - 1]} ${bn(y ?? 0)}`;
};

const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_BN[(m ?? 1) - 1]} ${bn(y ?? 0)}`;
};

/** "৩ ঘণ্টা আগে" for today's news, a date for anything older. */
function whenBn(iso: string): string {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'এইমাত্র';
  if (mins < 60) return `${bn(mins)} মিনিট আগে`;
  if (mins < 24 * 60) return `${bn(Math.floor(mins / 60))} ঘণ্টা আগে`;
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: 'numeric', day: 'numeric' }).format(then).split('-');
  return `${bn(Number(d[2]))} ${MONTHS_BN[Number(d[1]) - 1]} ${bn(d[0]!)}`;
}

const duration = (s: number | null) => (s ? `${bn(Math.floor(s / 60))}:${bn(String(s % 60).padStart(2, '0'))}` : null);

const youtubeId = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1]! : null;
};

function Row({ item, onPlay }: { item: FeedEntry; onPlay: (item: FeedEntry) => void }) {
  const vid = item.type === 'video' ? youtubeId(item.url) : null;
  const body = (
    <>
      <span className="shrink-0 w-[92px] sm:w-[116px] aspect-video rounded-lg bg-paper border border-rulesoft overflow-hidden grid place-items-center relative">
        {/* The icon stays underneath, so a thumbnail that 404s leaves it showing. */}
        <Icon name={item.type === 'video' ? 'play' : 'file'} size={18} className="text-muted" />
        {/* The outlet's own thumbnail, drawn small; nothing is copied to our storage. */}
        {item.thumbnailUrl && <StoryThumb src={item.thumbnailUrl} />}
        {item.type === 'video' && (
          <span className="absolute inset-0 grid place-items-center bg-ink/25">
            <span className="w-7 h-7 rounded-full bg-white/90 grid place-items-center"><Icon name="play" size={13} className="text-ink" /></span>
          </span>
        )}
      </span>
      <span className="min-w-0 flex flex-col gap-1">
        <span className="font-semibold text-[15.5px] leading-snug">{item.title}</span>
        <span className="text-[12.5px] text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`px-1.5 py-px rounded border text-[11.5px] ${item.type === 'video' ? 'border-brandring text-brand' : 'border-rule'}`}>
            {item.type === 'video' ? 'ভিডিও' : item.type === 'press' ? 'প্রজ্ঞাপন' : 'সংবাদ'}
          </span>
          {item.outletName && <span>{item.outletName}</span>}
          <span>{whenBn(item.publishedAt)}</span>
          {item.durationSeconds ? <span>{duration(item.durationSeconds)}</span> : null}
          {item.alsoIn.length > 0 && <span>আরও {bn(item.alsoIn.length)}টি সংবাদমাধ্যমে</span>}
          {item.pinned && <span className="text-brand font-semibold">নির্বাচিত</span>}
        </span>
      </span>
    </>
  );

  const className = 'flex gap-3 py-3 border-b border-rulesoft last:border-0 text-start w-full hover:bg-surface/60 transition-colors';
  return vid ? (
    <button type="button" onClick={() => onPlay(item)} className={className}>{body}</button>
  ) : (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>{body}</a>
  );
}

export default function MemberFeed({ slug, correctionHref }: { slug: string; correctionHref: string }) {
  // One piece of state carries the answer and the question it answers, so the
  // effect never has to reset anything on its way in.
  const [state, setState] = useState<{ key: string; data: FeedResponse | null; error: boolean }>({ key: '', data: null, error: false });
  const [type, setTypeParam] = useQueryParam("t");
  const setType = (v: string | null) => setTypeParam(v ?? "");
  const [openMonth, setOpenMonthParam] = useQueryParam("m");
  const setOpenMonth = (v: string | null) => setOpenMonthParam(v ?? "");
  // One day, picked from the calendar: its month is fetched and the day's items shown on top.
  const [dayParam, setDayParam] = useQueryParam("d");
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : '';
  const dayMonth = day ? day.slice(0, 7) : '';
  const [outlet, setOutlet] = useState('');
  const [monthData, setMonthData] = useState<Record<string, FeedEntry[]>>({});
  const [playing, setPlaying] = useState<FeedEntry | null>(null);

  const typeParam = type === 'news' || type === 'video' ? `&type=${type}` : '';

  const key = `${slug}${typeParam}`;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const r = await fetch(`/api/feed/${slug}?x=1${typeParam}`);
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as FeedResponse;
        if (live) setState({ key: `${slug}${typeParam}`, data: j, error: false });
      } catch {
        if (live) setState({ key: `${slug}${typeParam}`, data: null, error: true });
      }
    })();
    return () => { live = false; };
  }, [slug, typeParam]);

  // A month is fetched when a reader opens it, picks a day in it, or on load when the address names one.
  // Fetched months are kept per type filter, so switching the filter never shows the other kind's list.
  const cacheKey = (month: string) => `${month}${typeParam}`;
  const wanted = [openMonth, dayMonth].filter((m): m is string => !!m && /^\d{4}-\d{2}$/.test(m) && !monthData[cacheKey(m)]);
  const wantedKey = wanted.join(',');
  useEffect(() => {
    if (!wantedKey) return;
    let live = true;
    for (const month of wantedKey.split(',')) {
      void (async () => {
        const r = await fetch(`/api/feed/${slug}?m=${month}${typeParam}`);
        if (!r.ok || !live) return;
        const j = (await r.json()) as { items: FeedEntry[] };
        if (live) setMonthData((prev) => ({ ...prev, [`${month}${typeParam}`]: j.items }));
      })();
    }
    return () => { live = false; };
  }, [wantedKey, slug, typeParam]);

  const byOutlet = (items: FeedEntry[]) => (outlet ? items.filter((i) => i.outletName === outlet) : items);
  const dhakaDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  /** "২০৫টি: ১৯০ সংবাদ, ১৫ ভিডিও", or just the one kind when the other is nil. */
  const countLabel = (m: MonthCount) => {
    if (!m.total) return 'কোনো সংবাদ নেই';
    const parts = [m.news ? `${bn(m.news)} সংবাদ` : '', m.video ? `${bn(m.video)} ভিডিও` : ''].filter(Boolean);
    return parts.length > 1 ? `${bn(m.total)}টি: ${parts.join(', ')}` : parts[0]!;
  };

  const settled = state.key === key;
  if (settled && state.error) {
    return <p className="text-[14.5px] text-muted">সংবাদ ও ভিডিও এখন দেখানো যাচ্ছে না। একটু পরে আবার দেখুন।</p>;
  }
  const data = settled ? state.data : null;
  if (!data) {
    return <p className="text-[14.5px] text-muted">সংবাদ ও ভিডিও আনা হচ্ছে…</p>;
  }

  const current = data.months.find((m) => m.month === data.month);
  const earlier = data.months.filter((m) => m.month !== data.month);
  const items = byOutlet(data.items);
  // The picked day's items come from the current month's list or the month fetched for it.
  const dayPool = day ? (dayMonth === data.month ? data.items : monthData[cacheKey(dayMonth)]) : undefined;
  const dayItems = dayPool ? byOutlet(dayPool.filter((i) => dhakaDay(i.publishedAt) === day)) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
        <span>মোট {bn(data.total)}টি, {bn(data.news)}টি সংবাদ, {bn(data.video)}টি ভিডিও</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[['', 'সব'], ['news', 'সংবাদ'], ['video', 'ভিডিও']].map(([value, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setType(value || null)}
            className={`h-9 px-3.5 rounded-full border text-[13.5px] font-semibold transition-colors ${(type ?? '') === value ? 'border-brand bg-brandsoft text-brand' : 'border-rule hover:border-ink'}`}
          >
            {label}
          </button>
        ))}
        {data.outlets.length > 1 && (
          <label className="flex items-center gap-1.5 text-[13px] text-muted">
            <span className="sr-only">সংবাদমাধ্যম</span>
            <select
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
              className="h-9 max-w-[220px] rounded-full border border-rule bg-surface px-3 text-[13.5px] text-ink focus:border-brand focus:ring-4 focus:ring-brandring outline-none"
            >
              <option value="">সব সংবাদমাধ্যম</option>
              {data.outlets.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1.5 text-[13px] text-muted">
          <span>তারিখ</span>
          <input
            type="date"
            value={day}
            min={data.startsAt ? data.startsAt.slice(0, 10) : '2026-01-01'}
            max={dhakaDay(new Date().toISOString())}
            onChange={(e) => setDayParam(e.target.value)}
            className="h-9 rounded-full border border-rule bg-surface px-3 text-[13.5px] text-ink focus:border-brand focus:ring-4 focus:ring-brandring outline-none"
          />
        </label>
        {day && (
          <button type="button" onClick={() => setDayParam('')} className="h-9 px-3 rounded-full border border-rule text-[13px] hover:border-ink">
            তারিখ সরান
          </button>
        )}
      </div>

      {day && (
        <div className="rounded-card border border-brandring bg-brandsoft/30 px-4 py-2">
          <h3 className="display text-[16px] py-1">{dateLabel(day)}</h3>
          {dayItems === null ? (
            <p className="py-2 text-[13.5px] text-muted">আনা হচ্ছে…</p>
          ) : dayItems.length ? (
            dayItems.map((i) => <Row key={i.id} item={i} onPlay={setPlaying} />)
          ) : (
            <p className="py-2 text-[13.5px] text-muted">এই দিনে কোনো সংবাদ বা ভিডিও নেই{outlet ? ` (${outlet})` : ''}।</p>
          )}
        </div>
      )}

      {data.pinned.length > 0 && (
        <div className="rounded-card border border-brandring bg-brandsoft/40 px-4">
          {data.pinned.map((p) => <Row key={p.id} item={p} onPlay={setPlaying} />)}
        </div>
      )}

      <div>
        <h3 className="display text-[17px] pb-1 flex flex-wrap items-baseline gap-x-3">
          {monthLabel(data.month)}
          {current && <span className="text-[13px] font-normal text-muted">{countLabel(current)}</span>}
        </h3>
        {items.length ? (
          <div>{items.map((i) => <Row key={i.id} item={i} onPlay={setPlaying} />)}</div>
        ) : (
          <p className="py-3 text-[14px] text-muted">
            {data.total === 0
              ? 'এখনো কোনো সংবাদ বা ভিডিও পাওয়া যায়নি। মনোনয়নপত্র জমার তারিখ থেকে খোঁজা হচ্ছে।'
              : 'এই মাসে কোনো সংবাদ নেই।'}
          </p>
        )}
        {current && current.total > items.length && outlet && (
          <p className="text-[12.5px] text-muted">এই মাসে মোট {bn(current.total)}টি; বাছাই সরালে সবগুলো দেখা যাবে।</p>
        )}
      </div>

      {earlier.length > 0 && (
        <ul className="flex flex-col border-t border-rulesoft">
          {earlier.map((m) => {
            const open = openMonth === m.month;
            const list = byOutlet(monthData[cacheKey(m.month)] ?? []);
            return (
              <li key={m.month} className="border-b border-rulesoft">
                <button
                  type="button"
                  onClick={() => setOpenMonth(open ? null : m.month)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-[15px] hover:text-brand transition-colors"
                >
                  <span className="font-semibold">{monthLabel(m.month)}</span>
                  <span className="flex items-center gap-2 text-muted text-[13.5px] text-end">
                    {countLabel(m)}
                    <Icon name="arrow" size={15} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
                  </span>
                </button>
                {open && (
                  <div className="pb-2">
                    {monthData[cacheKey(m.month)] === undefined ? (
                      <p className="py-2 text-[13.5px] text-muted">আনা হচ্ছে…</p>
                    ) : list.length ? (
                      list.map((i) => <Row key={i.id} item={i} onPlay={setPlaying} />)
                    ) : (
                      <p className="py-2 text-[13.5px] text-muted">কোনো সংবাদ নেই।</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[12.5px] text-muted leading-relaxed">
        সংবাদ ও ভিডিও বিভিন্ন সংবাদমাধ্যম ও ইউটিউব থেকে স্বয়ংক্রিয়ভাবে সংগ্রহ করা। শিরোনামে ক্লিক করলে মূল উৎসে যাবেন।{' '}
        কোনো সংবাদ ভুলভাবে যুক্ত হলে <a href={correctionHref} className="underline decoration-rule underline-offset-2 hover:text-brand">জানান</a>।
      </p>

      {playing && youtubeId(playing.url) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={playing.title}
          className="fixed inset-0 z-50 bg-ink/80 grid place-items-center p-4"
          onClick={() => setPlaying(null)}
        >
          <div className="w-full max-w-[900px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end pb-2">
              <button type="button" onClick={() => setPlaying(null)} className="h-9 px-3 rounded-lg bg-surface text-[13.5px] font-semibold">বন্ধ করুন</button>
            </div>
            <div className="aspect-video w-full rounded-card overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId(playing.url)}?autoplay=1`}
                title={playing.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <p className="pt-2 text-[13.5px] text-paper">{playing.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}
