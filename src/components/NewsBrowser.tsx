'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryParam } from '@/lib/useQueryParam';
import StoryCard, { outletIn } from './StoryCard';
import RangePicker, { dateLabel, parseRange, rangeLabel } from './RangePicker';
import type { StoryView, StoryMember } from '@/lib/newsView';
import { useT } from '@/i18n/client';
import { plural } from '@/i18n/core';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const bn = (n: number) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

/**
 * Headline text for matching: whole words, vowel signs kept. (search.ts's
 * normalise drops the signs, which splits a Bangla word into letters and would
 * let "ব্রিকস" match nearly any headline.) Joiners and the hasanta go, since
 * outlets write "বাক্‌স্বাধীনতা" and "বাকস্বাধীনতা" alike.
 */
const fold = (s: string) =>
  s.normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u09CD]/g, '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();

const PAGE = 30;
const NONE: StoryView[] = [];

/** One page of a span's stories from /api/news/range; `before` is the previous page's `next`. */
async function loadPage(key: string, before: string | null): Promise<{ stories: StoryView[]; next: string | null; counts: { news: number; video: number } | null } | null> {
  const [from, to] = key.split('~');
  const r = await fetch(`/api/news/range?from=${from}&to=${to}${before ? `&before=${encodeURIComponent(before)}` : ''}`);
  if (!r.ok) return null;
  return (await r.json()) as { stories: StoryView[]; next: string | null; counts: { news: number; video: number } | null };
}

/** "120 items (100 news, 20 videos), 30 shown": a span's real totals in English. */
function spanCountEn(kind: string, counts: { news: number; video: number }, shown: number | null) {
  const n = (kind === 'video' ? 0 : counts.news) + (kind === 'news' ? 0 : counts.video);
  const noun = kind === 'video' ? plural(n, 'video', 'videos') : kind === 'news' ? plural(n, 'story', 'stories') : plural(n, 'item', 'items');
  const g = (x: number) => x.toLocaleString('en-GB');
  return `${g(n)} ${noun}${kind ? '' : ` (${g(counts.news)} news, ${g(counts.video)} ${plural(counts.video, 'video', 'videos')})`}${shown !== null ? `, ${g(shown)} shown` : ''}`;
}

/** The filters live in the address ("/songbad?mp=<slug>"), so a member page can link to its own news; "#mp=" links from before still work. */
const legacyMember = (hash: string) => hash.match(/^#mp=([\w-]+)$/)?.[1] ?? null;

export default function NewsBrowser({
  stories: latest,
  members: latestMembers,
  outlets: latestOutlets,
  today,
  namesEn,
}: {
  stories: StoryView[];
  /** `name` is in the page's language. */
  members: { slug: string; name: string; count: number }[];
  outlets: { name: string; count: number }[];
  /** Today in Dhaka, yyyy-mm-dd, from the server, so the picker and the page agree. */
  today: string;
  /**
   * English pages only: every member's English name by slug, so the stories
   * a span brings from /api/news/range (which carry the Bangla name) show
   * the English one.
   */
  namesEn?: Record<string, string>;
}) {
  const t = useT();
  const [member, setMemberHash] = useQueryParam('mp', legacyMember);
  const [outlet, setOutlet] = useQueryParam('outlet');
  const [kind, setKind] = useQueryParam('type');
  const [q, setQ] = useQueryParam('q');

  // A day, a span or a month (?d=2026-10-15, ?d=2026-10-01~2026-10-31): its
  // stories are read from /api/news/range, since the page carries only the newest.
  const [rangeParam, setRangeParam] = useQueryParam('d');
  const range = parseRange(rangeParam);
  const rangeKey = range ? `${range.from}~${range.to}` : '';
  const [picked, setPicked] = useState<{ key: string; stories: StoryView[]; next: string | null; counts: { news: number; video: number } | null } | null>(null);
  const [fetching, setFetching] = useState(false);
  useEffect(() => {
    if (!rangeKey) return;
    let live = true;
    void loadPage(rangeKey, null).then((j) => { if (live && j) setPicked({ key: rangeKey, stories: j.stories, next: j.next, counts: j.counts }); });
    return () => { live = false; };
  }, [rangeKey]);
  // The next page of a span, appended; a story on the page boundary is not shown twice.
  const loadMore = async () => {
    if (!picked?.next || fetching) return;
    setFetching(true);
    const j = await loadPage(picked.key, picked.next);
    setFetching(false);
    if (!j) return;
    setPicked((p) => {
      if (!p || p.key !== picked.key) return p;
      const have = new Set(p.stories.map((s) => s.id));
      return { ...p, stories: [...p.stories, ...j.stories.filter((s) => !have.has(s.id))], next: j.next };
    });
  };
  const loading = !!range && picked?.key !== rangeKey;
  const rawStories = useMemo(() => (rangeKey ? (picked?.key === rangeKey ? picked.stories : NONE) : latest), [rangeKey, picked, latest]);
  // English pages: each member named in English, whichever list the story came from.
  const stories = useMemo(() => {
    if (!t.en || !namesEn) return rawStories;
    const en = (m: StoryMember): StoryMember => (m.nameEn || !namesEn[m.slug] ? m : { ...m, nameEn: namesEn[m.slug] });
    return rawStories.map((s) => ({ ...s, member: s.member ? en(s.member) : s.member, members: s.members?.map(en) }));
  }, [rawStories, namesEn, t.en]);

  // The member and outlet lists follow what is shown: the span's, or the newest.
  const { members, outlets } = useMemo(() => {
    if (!range) return { members: latestMembers, outlets: latestOutlets };
    const m = new Map<string, { slug: string; name: string; count: number }>();
    const o = new Map<string, number>();
    for (const s of stories) {
      for (const p of s.members?.length ? s.members : s.member ? [s.member] : []) {
        const e = m.get(p.slug) ?? { slug: p.slug, name: t.en ? p.nameEn || p.name : p.name, count: 0 };
        e.count++;
        m.set(p.slug, e);
      }
      for (const src of [s.lead.source, ...s.also.map((a) => a.source)]) o.set(src, (o.get(src) ?? 0) + 1);
    }
    return {
      members: [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, t.lang)),
      outlets: [...o.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bn')),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- range is rangeKey's parse
  }, [rangeKey, stories, latestMembers, latestOutlets]);
  const [shown, setShown] = useState(PAGE);
  const top = useRef<HTMLDivElement>(null);

  // A member picked from the side list lower down brings the list back into view.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const box = top.current?.getBoundingClientRect();
    if (box && box.top < 0) top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [member]);

  const keyed = useMemo(
    () => stories.map((s) => ({
      s,
      key: fold([s.lead.title, ...s.also.map((a) => a.title), ...(s.members ?? (s.member ? [s.member] : [])).flatMap((m) => [m.name, m.nameEn ?? ''])].join(' ')),
    })),
    [stories],
  );

  const filtered = useMemo(() => {
    const words = fold(q).split(' ').filter(Boolean);
    return keyed
      .filter(({ s, key }) => {
        if (kind === 'video' && s.kind !== 'video') return false;
        if (kind === 'news' && s.kind === 'video') return false;
        if (member && !(s.members?.length ? s.members.some((m) => m.slug === member) : s.member?.slug === member)) return false;
        if (outlet && s.lead.source !== outlet && !s.also.some((a) => a.source === outlet)) return false;
        return words.every((w) => key.includes(w));
      })
      .map((x) => x.s);
  }, [keyed, q, member, outlet, kind]);

  const visible = filtered.slice(0, shown);
  const days: { date: string; label: string; items: StoryView[] }[] = [];
  for (const s of visible) {
    const last = days[days.length - 1];
    if (last?.date === s.date) last.items.push(s);
    else days.push({ date: s.date, label: s.dateLabel, items: [s] });
  }
  const perDay = new Map<string, number>();
  for (const s of filtered) perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1);

  const filtering = !!(member || outlet || kind || q.trim() || range);
  const videos = useMemo(() => stories.filter((s) => s.kind === 'video').length, [stories]);
  const field = 'h-11 rounded-[10px] border border-rule bg-surface px-3 text-[14.5px] outline-none focus-within:border-brand focus-within:ring-4 focus-within:ring-brandring';

  return (
    <div ref={top} className="flex flex-col gap-6 scroll-mt-24">
      {videos > 0 && (
        <div className="flex gap-2">
          {[
            { value: '', label: t('সব', 'All') },
            { value: 'news', label: t('সংবাদ', 'News') },
            { value: 'video', label: t.en ? `Videos (${videos})` : `ভিডিও (${bn(videos)})` },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setKind(tab.value); setShown(PAGE); }}
              aria-pressed={kind === tab.value}
              className={`px-4 h-9 rounded-full border text-[14px] font-semibold transition-colors ${
                kind === tab.value ? 'border-ink bg-ink text-paper' : 'border-rule bg-surface hover:border-brand hover:text-brand'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:flex gap-2.5">
        <label className={`${field} col-span-2 flex items-center gap-2 grow min-w-0`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">{t('শিরোনামে খুঁজুন', 'Search the headlines')}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
            placeholder={t('শিরোনামে খুঁজুন', 'Search the headlines')}
            className="grow min-w-0 bg-transparent outline-none placeholder:text-muted"
          />
        </label>
        <select
          aria-label={t('সংসদ সদস্য', 'Member of Parliament')}
          value={member}
          onChange={(e) => { setMemberHash(e.target.value); setShown(PAGE); }}
          className={`${field} min-w-0 sm:w-[220px] sm:shrink-0`}
        >
          <option value="">{t('সব সংসদ সদস্য', 'All MPs')}</option>
          {members.map((m) => <option key={m.slug} value={m.slug}>{m.name} ({t.en ? m.count : bn(m.count)})</option>)}
        </select>
        <select
          aria-label={t('সংবাদমাধ্যম', 'News outlet')}
          value={outlet}
          onChange={(e) => { setOutlet(e.target.value); setShown(PAGE); }}
          className={`${field} min-w-0 sm:w-[200px] sm:shrink-0`}
        >
          <option value="">{t('সব সংবাদমাধ্যম', 'All outlets')}</option>
          {outlets.map((o) => <option key={o.name} value={o.name}>{outletIn(o.name, t.lang)} ({t.en ? o.count : bn(o.count)})</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RangePicker key={rangeParam} range={range} today={today} onPick={(raw) => { setRangeParam(raw); setShown(PAGE); }} />
      </div>


      <p className="text-[14px] text-muted flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
        {range && <strong className="text-ink font-semibold">{rangeLabel(range.from, range.to, t.lang)}:</strong>}
        <span>
          {loading
            ? t('আনা হচ্ছে…', 'Loading…')
            : range && picked?.counts && !member && !outlet && !q.trim()
              // The span's real totals; the list fills in as the reader goes down it.
              ? t.en
                ? spanCountEn(kind, picked.counts, picked.next ? filtered.length : null)
                : `${bn((kind === 'video' ? 0 : picked.counts.news) + (kind === 'news' ? 0 : picked.counts.video))}টি${kind ? '' : ` (${bn(picked.counts.news)} সংবাদ, ${bn(picked.counts.video)} ভিডিও)`}${picked.next ? `, ${bn(filtered.length)}টি দেখানো হচ্ছে` : ''}`
              : t.en
                ? `${filtered.length} ${kind === 'video' ? plural(filtered.length, 'video', 'videos') : plural(filtered.length, 'story', 'stories')}`
                : `${bn(filtered.length)}টি ${kind === 'video' ? 'ভিডিও' : 'খবর'}`}
        </span>
        {filtering && (
          <button
            type="button"
            onClick={() => { setMemberHash(''); setOutlet(''); setKind(''); setQ(''); setRangeParam(''); setShown(PAGE); }}
            className="font-semibold text-brand hover:underline"
          >
            {t('সব খবর দেখুন', 'See all news')}
          </button>
        )}
      </p>

      {loading ? null : filtered.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">
          {t.en
            ? range ? 'No news found for this period.' : 'No news found for this search.'
            : <>{range ? 'এই সময়ে' : 'এই খোঁজে'} কোনো খবর পাওয়া যায়নি।</>}
        </p>
      ) : (
        days.map((d) => (
          <section key={d.date} className="flex flex-col gap-3">
            <h2 className="flex items-baseline gap-2.5 text-[15px] font-bold text-ink">
              {t.en ? dateLabel(d.date, 'en') : d.label}
              <span className="text-[13px] font-medium text-muted">{t.en ? perDay.get(d.date) ?? d.items.length : <>{bn(perDay.get(d.date) ?? d.items.length)}টি</>}</span>
            </h2>
            <ul className="flex flex-col gap-3">
              {d.items.map((s) => <li key={s.id}><StoryCard s={s} /></li>)}
            </ul>
          </section>
        ))
      )}

      {(filtered.length > visible.length || (range && picked?.key === rangeKey && picked.next)) && (
        <button
          type="button"
          disabled={fetching}
          onClick={() => {
            // Near the end of what is loaded, the span's next page is fetched too.
            if (filtered.length <= visible.length + PAGE && range && picked?.next) void loadMore();
            setShown((n) => n + PAGE);
          }}
          className="self-center px-6 h-12 rounded-full border border-ink font-semibold text-[15px] hover:bg-surface disabled:opacity-60"
        >
          {fetching ? t('আনা হচ্ছে…', 'Loading…') : t('আরও দেখুন', 'See more')}
        </button>
      )}
    </div>
  );
}
