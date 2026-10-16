'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryParam } from '@/lib/useQueryParam';
import StoryCard from './StoryCard';
import RangePicker, { parseRange, rangeLabel } from './RangePicker';
import type { StoryView } from '@/lib/newsView';

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

/** The filters live in the address ("/songbad?mp=<slug>"), so a member page can link to its own news; "#mp=" links from before still work. */
const legacyMember = (hash: string) => hash.match(/^#mp=([\w-]+)$/)?.[1] ?? null;

export default function NewsBrowser({
  stories: latest,
  members: latestMembers,
  outlets: latestOutlets,
  today,
}: {
  stories: StoryView[];
  members: { slug: string; name: string; count: number }[];
  outlets: { name: string; count: number }[];
  /** Today in Dhaka, yyyy-mm-dd, from the server, so the picker and the page agree. */
  today: string;
}) {
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
  const stories = useMemo(() => (rangeKey ? (picked?.key === rangeKey ? picked.stories : NONE) : latest), [rangeKey, picked, latest]);

  // The member and outlet lists follow what is shown: the span's, or the newest.
  const { members, outlets } = useMemo(() => {
    if (!range) return { members: latestMembers, outlets: latestOutlets };
    const m = new Map<string, { slug: string; name: string; count: number }>();
    const o = new Map<string, number>();
    for (const s of stories) {
      for (const p of s.members?.length ? s.members : s.member ? [s.member] : []) {
        const e = m.get(p.slug) ?? { slug: p.slug, name: p.name, count: 0 };
        e.count++;
        m.set(p.slug, e);
      }
      for (const src of [s.lead.source, ...s.also.map((a) => a.source)]) o.set(src, (o.get(src) ?? 0) + 1);
    }
    return {
      members: [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bn')),
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
      key: fold([s.lead.title, ...s.also.map((a) => a.title), ...(s.members ?? (s.member ? [s.member] : [])).map((m) => m.name)].join(' ')),
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
            { value: '', label: 'সব' },
            { value: 'news', label: 'সংবাদ' },
            { value: 'video', label: `ভিডিও (${bn(videos)})` },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setKind(t.value); setShown(PAGE); }}
              aria-pressed={kind === t.value}
              className={`px-4 h-9 rounded-full border text-[14px] font-semibold transition-colors ${
                kind === t.value ? 'border-ink bg-ink text-paper' : 'border-rule bg-surface hover:border-brand hover:text-brand'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:flex gap-2.5">
        <label className={`${field} col-span-2 flex items-center gap-2 grow min-w-0`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">শিরোনামে খুঁজুন</span>
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
            placeholder="শিরোনামে খুঁজুন"
            className="grow min-w-0 bg-transparent outline-none placeholder:text-muted"
          />
        </label>
        <select
          aria-label="সংসদ সদস্য"
          value={member}
          onChange={(e) => { setMemberHash(e.target.value); setShown(PAGE); }}
          className={`${field} min-w-0 sm:w-[220px] sm:shrink-0`}
        >
          <option value="">সব সংসদ সদস্য</option>
          {members.map((m) => <option key={m.slug} value={m.slug}>{m.name} ({bn(m.count)})</option>)}
        </select>
        <select
          aria-label="সংবাদমাধ্যম"
          value={outlet}
          onChange={(e) => { setOutlet(e.target.value); setShown(PAGE); }}
          className={`${field} min-w-0 sm:w-[200px] sm:shrink-0`}
        >
          <option value="">সব সংবাদমাধ্যম</option>
          {outlets.map((o) => <option key={o.name} value={o.name}>{o.name} ({bn(o.count)})</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RangePicker key={rangeParam} range={range} today={today} onPick={(raw) => { setRangeParam(raw); setShown(PAGE); }} />
      </div>


      <p className="text-[14px] text-muted flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
        {range && <strong className="text-ink font-semibold">{rangeLabel(range.from, range.to)}:</strong>}
        <span>
          {loading
            ? 'আনা হচ্ছে…'
            : range && picked?.counts && !member && !outlet && !q.trim()
              // The span's real totals; the list fills in as the reader goes down it.
              ? `${bn((kind === 'video' ? 0 : picked.counts.news) + (kind === 'news' ? 0 : picked.counts.video))}টি${kind ? '' : ` (${bn(picked.counts.news)} সংবাদ, ${bn(picked.counts.video)} ভিডিও)`}${picked.next ? `, ${bn(filtered.length)}টি দেখানো হচ্ছে` : ''}`
              : `${bn(filtered.length)}টি ${kind === 'video' ? 'ভিডিও' : 'খবর'}`}
        </span>
        {filtering && (
          <button
            type="button"
            onClick={() => { setMemberHash(''); setOutlet(''); setKind(''); setQ(''); setRangeParam(''); setShown(PAGE); }}
            className="font-semibold text-brand hover:underline"
          >
            সব খবর দেখুন
          </button>
        )}
      </p>

      {loading ? null : filtered.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">{range ? 'এই সময়ে' : 'এই খোঁজে'} কোনো খবর পাওয়া যায়নি।</p>
      ) : (
        days.map((d) => (
          <section key={d.date} className="flex flex-col gap-3">
            <h2 className="flex items-baseline gap-2.5 text-[15px] font-bold text-ink">
              {d.label}
              <span className="text-[13px] font-medium text-muted">{bn(perDay.get(d.date) ?? d.items.length)}টি</span>
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
          {fetching ? 'আনা হচ্ছে…' : 'আরও দেখুন'}
        </button>
      )}
    </div>
  );
}
