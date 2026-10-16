'use client';

import StoryThumb from './StoryThumb';
import { outletIn } from './StoryCard';
import When from './When';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useQueryParam } from '@/lib/useQueryParam';
import RangePicker, { parseRange, rangeLabel } from './RangePicker';
import { useT } from '@/i18n/client';
import { plural, type T } from '@/i18n/core';

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

const monthLabel = (month: string, t: T) => {
  const [y, m] = month.split('-').map(Number);
  if (t.en) return `${t.month(m ?? 1)} ${y ?? 0}`;
  return `${MONTHS_BN[(m ?? 1) - 1]} ${bn(y ?? 0)}`;
};


/** "6,223": English figures take a thousands comma. */
const g = (n: number) => n.toLocaleString('en-GB');

const duration = (s: number | null, t: T) => (s ? (t.en ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${bn(Math.floor(s / 60))}:${bn(String(s % 60).padStart(2, '0'))}`) : null);

const youtubeId = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1]! : null;
};

function Row({ item, onPlay }: { item: FeedEntry; onPlay: (item: FeedEntry) => void }) {
  const t = useT();
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
        {/* The outlet's own headline, in Bangla on the English pages too. */}
        <span className="font-semibold text-[15.5px] leading-snug" lang="bn">{item.title}</span>
        <span className="text-[12.5px] text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`px-1.5 py-px rounded border text-[11.5px] ${item.type === 'video' ? 'border-brandring text-brand' : 'border-rule'}`}>
            {item.type === 'video' ? t('ভিডিও', 'Video') : item.type === 'press' ? t('প্রজ্ঞাপন', 'Notification') : t('সংবাদ', 'News')}
          </span>
          {item.outletName && <span>{outletIn(item.outletName, t.lang)}</span>}
          <When iso={item.publishedAt} />
          {item.durationSeconds ? <span>{duration(item.durationSeconds, t)}</span> : null}
          {item.alsoIn.length > 0 && (
            <span>{t.en ? `in ${item.alsoIn.length} more ${plural(item.alsoIn.length, 'outlet', 'outlets')}` : <>আরও {bn(item.alsoIn.length)}টি সংবাদমাধ্যমে</>}</span>
          )}
          {item.pinned && <span className="text-brand font-semibold">{t('নির্বাচিত', 'Selected')}</span>}
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
  const t = useT();
  // One piece of state carries the answer and the question it answers, so the
  // effect never has to reset anything on its way in.
  const [state, setState] = useState<{ key: string; data: FeedResponse | null; error: boolean }>({ key: '', data: null, error: false });
  const [type, setTypeParam] = useQueryParam("t");
  const setType = (v: string | null) => setTypeParam(v ?? "");
  const [openMonth, setOpenMonthParam] = useQueryParam("m");
  const setOpenMonth = (v: string | null) => setOpenMonthParam(v ?? "");
  // A day or a span of days (?d=2026-10-15 or ?d=2026-10-10~2026-10-15): the
  // months it covers are fetched and its items shown on top.
  const [rangeParam, setRangeParam] = useQueryParam("d");
  const range = parseRange(rangeParam);
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
  const wanted = [openMonth].filter((m): m is string => !!m && /^\d{4}-\d{2}$/.test(m) && !monthData[cacheKey(m)]);

  // The picked span is asked for as one query: a month's list stops at its
  // newest 300, which for the Prime Minister is a single week.
  const rangeKey = range ? `${range.from}~${range.to}${typeParam}` : '';
  const [rangeData, setRangeData] = useState<{ key: string; items: FeedEntry[]; more: boolean } | null>(null);
  useEffect(() => {
    if (!range || !rangeKey) return;
    let live = true;
    void (async () => {
      const r = await fetch(`/api/feed/${slug}?from=${range.from}&to=${range.to}${typeParam}`);
      if (!r.ok || !live) return;
      const j = (await r.json()) as { items: FeedEntry[]; more: boolean };
      if (live) setRangeData({ key: rangeKey, items: j.items, more: j.more });
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rangeKey carries the span and the type
  }, [rangeKey, slug]);
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
  /** "২০৫টি: ১৯০ সংবাদ, ১৫ ভিডিও" ("205 items: 190 news, 15 videos"), or just the one kind when the other is nil. */
  const countLabel = (m: MonthCount) => {
    if (t.en) {
      if (!m.total) return 'No news';
      const parts = [m.news ? `${g(m.news)} news` : '', m.video ? `${g(m.video)} ${plural(m.video, 'video', 'videos')}` : ''].filter(Boolean);
      return parts.length > 1 ? `${g(m.total)} ${plural(m.total, 'item', 'items')}: ${parts.join(', ')}` : parts[0]!;
    }
    if (!m.total) return 'কোনো সংবাদ নেই';
    const parts = [m.news ? `${bn(m.news)} সংবাদ` : '', m.video ? `${bn(m.video)} ভিডিও` : ''].filter(Boolean);
    return parts.length > 1 ? `${bn(m.total)}টি: ${parts.join(', ')}` : parts[0]!;
  };

  const settled = state.key === key;
  if (settled && state.error) {
    return <p className="text-[14.5px] text-muted">{t('সংবাদ ও ভিডিও এখন দেখানো যাচ্ছে না। একটু পরে আবার দেখুন।', 'News and videos cannot be shown right now. Please check again a little later.')}</p>;
  }
  const data = settled ? state.data : null;
  if (!data) {
    return <p className="text-[14.5px] text-muted">{t('সংবাদ ও ভিডিও আনা হচ্ছে…', 'Loading news and videos…')}</p>;
  }

  const current = data.months.find((m) => m.month === data.month);
  const earlier = data.months.filter((m) => m.month !== data.month);
  const items = byOutlet(data.items);
  const rangeItems = range && rangeData?.key === rangeKey ? byOutlet(rangeData.items) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
        <span>
          {t.en
            ? `${g(data.total)} in total, ${g(data.news)} news, ${g(data.video)} ${plural(data.video, 'video', 'videos')}`
            : <>মোট {bn(data.total)}টি, {bn(data.news)}টি সংবাদ, {bn(data.video)}টি ভিডিও</>}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[['', t('সব', 'All')], ['news', t('সংবাদ', 'News')], ['video', t('ভিডিও', 'Videos')]].map(([value, label]) => (
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
            <span className="sr-only">{t('সংবাদমাধ্যম', 'News outlet')}</span>
            <select
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
              className="h-9 max-w-[220px] rounded-full border border-rule bg-surface px-3 text-[13.5px] text-ink focus:border-brand focus:ring-4 focus:ring-brandring outline-none"
            >
              <option value="">{t('সব সংবাদমাধ্যম', 'All outlets')}</option>
              {data.outlets.map((o) => <option key={o} value={o}>{outletIn(o, t.lang)}</option>)}
            </select>
          </label>
        )}
        <RangePicker key={rangeParam} range={range} today={dhakaDay(new Date().toISOString())} onPick={(raw) => setRangeParam(raw)} />
      </div>

      {range && (
        <div className="rounded-card border border-brandring bg-brandsoft/30 px-4 py-2">
          <h3 className="display text-[16px] py-1 flex flex-wrap items-baseline gap-x-3">
            {rangeLabel(range.from, range.to, t.lang)}
            {rangeItems && rangeItems.length > 0 && (
              <span className="text-[13px] font-normal text-muted">
                {countLabel({ month: '', total: rangeItems.length, news: rangeItems.filter((i) => i.type !== 'video').length, video: rangeItems.filter((i) => i.type === 'video').length })}
              </span>
            )}
          </h3>
          {rangeData?.key === rangeKey && rangeData.more && (
            <p className="text-[12.5px] text-muted">
              {t.en
                ? `Showing the latest ${g(rangeData.items.length)} from this period; to see earlier ones, choose a shorter period.`
                : <>এই সময়ের সর্বশেষ {bn(rangeData.items.length)}টি দেখানো হচ্ছে; আরও আগেরগুলো দেখতে সময় ছোট করুন।</>}
            </p>
          )}
          {rangeItems === null ? (
            <p className="py-2 text-[13.5px] text-muted">{t('আনা হচ্ছে…', 'Loading…')}</p>
          ) : rangeItems.length ? (
            rangeItems.map((i) => <Row key={i.id} item={i} onPlay={setPlaying} />)
          ) : (
            <p className="py-2 text-[13.5px] text-muted">
              {t.en
                ? `No news or videos ${range.from === range.to ? 'on this day' : 'in this period'}${outlet ? ` (${outletIn(outlet, 'en')})` : ''}.`
                : <>{range.from === range.to ? 'এই দিনে' : 'এই সময়ে'} কোনো সংবাদ বা ভিডিও নেই{outlet ? ` (${outlet})` : ''}।</>}
            </p>
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
          {monthLabel(data.month, t)}
          {current && <span className="text-[13px] font-normal text-muted">{countLabel(current)}</span>}
        </h3>
        {items.length ? (
          <div>{items.map((i) => <Row key={i.id} item={i} onPlay={setPlaying} />)}</div>
        ) : (
          <p className="py-3 text-[14px] text-muted">
            {data.total === 0
              ? t('এখনো কোনো সংবাদ বা ভিডিও পাওয়া যায়নি। মনোনয়নপত্র জমার তারিখ থেকে খোঁজা হচ্ছে।', 'No news or videos have been found yet. The search runs from the date nomination papers were submitted.')
              : t('এই মাসে কোনো সংবাদ নেই।', 'No news this month.')}
          </p>
        )}
        {current && current.total > items.length && outlet && (
          <p className="text-[12.5px] text-muted">
            {t.en
              ? `${g(current.total)} in total this month; clear the filter to see them all.`
              : <>এই মাসে মোট {bn(current.total)}টি; বাছাই সরালে সবগুলো দেখা যাবে।</>}
          </p>
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
                  <span className="font-semibold">{monthLabel(m.month, t)}</span>
                  <span className="flex items-center gap-2 text-muted text-[13.5px] text-end">
                    {countLabel(m)}
                    <Icon name="arrow" size={15} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
                  </span>
                </button>
                {open && (
                  <div className="pb-2">
                    {monthData[cacheKey(m.month)] === undefined ? (
                      <p className="py-2 text-[13.5px] text-muted">{t('আনা হচ্ছে…', 'Loading…')}</p>
                    ) : list.length ? (
                      list.map((i) => <Row key={i.id} item={i} onPlay={setPlaying} />)
                    ) : (
                      <p className="py-2 text-[13.5px] text-muted">{t('কোনো সংবাদ নেই।', 'No news.')}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {t.en ? (
        <p className="text-[12.5px] text-muted leading-relaxed">
          News and videos are collected automatically from various news outlets and YouTube. Clicking a headline takes you to the original source.{' '}
          If a story has been added wrongly, <a href={t.href(correctionHref)} className="underline decoration-rule underline-offset-2 hover:text-brand">let us know</a>.
        </p>
      ) : (
        <p className="text-[12.5px] text-muted leading-relaxed">
          সংবাদ ও ভিডিও বিভিন্ন সংবাদমাধ্যম ও ইউটিউব থেকে স্বয়ংক্রিয়ভাবে সংগ্রহ করা। শিরোনামে ক্লিক করলে মূল উৎসে যাবেন।{' '}
          কোনো সংবাদ ভুলভাবে যুক্ত হলে <a href={correctionHref} className="underline decoration-rule underline-offset-2 hover:text-brand">জানান</a>।
        </p>
      )}

      {playing && youtubeId(playing.url) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={playing.title}
          // The video's title is the outlet's, in Bangla; the button inside is in the page's language.
          lang={t.en ? 'bn' : undefined}
          className="fixed inset-0 z-50 bg-ink/80 grid place-items-center p-4"
          onClick={() => setPlaying(null)}
        >
          <div className="w-full max-w-[900px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end pb-2">
              <button type="button" onClick={() => setPlaying(null)} lang={t.en ? 'en' : undefined} className="h-9 px-3 rounded-lg bg-surface text-[13.5px] font-semibold">{t('বন্ধ করুন', 'Close')}</button>
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
