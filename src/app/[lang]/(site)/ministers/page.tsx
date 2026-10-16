import type { Metadata } from 'next';
import Link from 'next/link';
import { shareGraph } from '@/lib/seo';
import { posts, currentPosts, getMemberById, bn, dateBn, initial, partyColor, postsCheckedOnBn, type PostEntry } from '@/lib/data';
import { ministryKey, normalizeName } from '@/lib/posts/names';
import { adviserForPost } from '@/lib/advisers';
import { Page, PageHead, Card } from '@/components/ui';
import Icon from '@/components/Icon';
import MinistersBrowser, { type MinisterGroup, type MinisterPerson } from '@/components/MinistersBrowser';
import { CABINET_PAGE_FOR_READERS } from '../../../../../config/sync-sources';

const GROUPS = ['প্রধানমন্ত্রী', 'মন্ত্রী', 'প্রতিমন্ত্রী', 'উপমন্ত্রী', 'উপদেষ্টা'];
/** A line under each rank's tile. */
const RANK_SHORT: Record<string, string> = {
  প্রধানমন্ত্রী: 'সরকারপ্রধান',
  মন্ত্রী: 'মন্ত্রণালয়ের পূর্ণ দায়িত্বে',
  প্রতিমন্ত্রী: 'পদমর্যাদায় মন্ত্রীর পরে',
  উপমন্ত্রী: 'প্রতিমন্ত্রীর পরের ধাপ',
  উপদেষ্টা: 'প্রধানমন্ত্রীর পরামর্শক',
};

/** The list writes "জনাব" before most names; the site's names never carry it. */
const plainName = (name: string) => name.replace(/^জনাব\s+/, '').trim();
const firstLetter = (name: string) => (plainName(name).replace(/^(ড\.|ডাঃ|ডা\.|মোঃ|ব্রিগেডিয়ার জেনারেল \(অব:\))\s*/, '') || name).charAt(0);

function cabinet() {
  const people = new Map<string, MinisterPerson>();
  for (const r of currentPosts('government')) {
    const m = r.memberId ? getMemberById(r.memberId) : undefined;
    const key = `${r.title}|${r.memberId ?? normalizeName(r.nameBn)}`;
    let p = people.get(key);
    if (!p) {
      p = {
        key,
        title: r.title,
        name: m?.nameBn ?? plainName(r.nameBn),
        // Someone from outside parliament has a profile of their own.
        href: m ? `/mp/${m.slug}` : adviserForPost(r) ? `/ministers/${adviserForPost(r)!.slug}` : null,
        photo: m?.photoUrl ?? r.photoUrl,
        initial: m ? initial(m) : firstLetter(r.nameBn),
        party: m?.party ? { abbr: m.party.abbr, name: m.party.nameBn ?? m.party.abbr, color: partyColor(m.party.abbr) } : null,
        seat: m?.seat?.nameBn ?? null,
        rankNote: r.rankNote,
        isMp: !!m,
        pending: false,
        ministries: [],
        sourceUrl: r.sourceUrl,
      };
      people.set(key, p);
    }
    if (r.ministryBn) p.ministries.push({ name: r.ministryBn, key: ministryKey(r.ministryBn), since: dateBn(r.fromDate) });
  }
  for (const x of posts.pending ?? []) {
    const key = `${x.title}|pending|${normalizeName(x.nameBn)}`;
    people.set(key, {
      key, title: x.title, name: plainName(x.nameBn), href: null, photo: null, initial: firstLetter(x.nameBn), party: null, seat: null,
      rankNote: null, isMp: false, pending: true, ministries: x.ministries.map((n) => ({ name: n, key: ministryKey(n), since: null })),
      sourceUrl: CABINET_PAGE_FOR_READERS,
    });
  }
  const all = [...people.values()];
  const titles = [...GROUPS, ...new Set(all.map((p) => p.title).filter((t) => !GROUPS.includes(t)))];
  const groups: MinisterGroup[] = titles.map((title) => ({ title, people: all.filter((p) => p.title === title) }));

  const ministries = new Map<string, { key: string; label: string; count: number }>();
  for (const p of all) {
    for (const m of new Map(p.ministries.map((x) => [x.key, x])).values()) {
      const e = ministries.get(m.key) ?? { key: m.key, label: m.name, count: 0 };
      e.count++;
      ministries.set(m.key, e);
    }
  }
  return { groups, ministries: [...ministries.values()].sort((a, b) => a.label.localeCompare(b.label, 'bn')) };
}

interface Change { date: string; name: string; href: string | null; text: string; kind: 'start' | 'end' | 'change' }

/** The last changes in the cabinet, from the posts' own dates: a start, an end, or both on one day. */
function changes(limit = 20): Change[] {
  const byDay = new Map<string, { date: string; name: string; href: string | null; starts: PostEntry[]; ends: PostEntry[] }>();
  for (const r of posts.rows.filter((x) => x.type === 'government')) {
    const m = r.memberId ? getMemberById(r.memberId) : undefined;
    const person = r.memberId ?? normalizeName(r.nameBn);
    const add = (date: string, side: 'starts' | 'ends') => {
      const k = `${date}|${person}`;
      const e = byDay.get(k) ?? { date, name: m?.nameBn ?? plainName(r.nameBn), href: m ? `/mp/${m.slug}` : null, starts: [], ends: [] };
      e[side].push(r);
      byDay.set(k, e);
    };
    add(r.fromDate, 'starts');
    if (r.toDate) add(r.toDate, 'ends');
  }
  const label = (rows: PostEntry[]) => `${rows[0]!.title}${rows.some((r) => r.ministryBn) ? `, ${rows.map((r) => r.ministryBn).filter(Boolean).join(', ')}` : ''}`;
  return [...byDay.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((e) => ({
      date: e.date,
      name: e.name,
      href: e.href,
      kind: e.starts.length && e.ends.length ? 'change' : e.starts.length ? 'start' : 'end',
      text: e.starts.length && e.ends.length
        ? `${label(e.ends)} থেকে ${label(e.starts)}`
        : e.starts.length ? `${label(e.starts)}: দায়িত্ব পেলেন` : `${label(e.ends)}: দায়িত্ব শেষ`,
    }));
}

const data = cabinet();
const count = (title: string) => data.groups.find((g) => g.title === title)?.people.length ?? 0;

export const metadata: Metadata = {
  alternates: { canonical: '/ministers' },
  openGraph: shareGraph('/ministers'),
  title: 'মন্ত্রিসভা',
  description: `বাংলাদেশের মন্ত্রিসভা: প্রধানমন্ত্রী, ${bn(count('মন্ত্রী'))} জন মন্ত্রী, ${bn(count('প্রতিমন্ত্রী'))} জন প্রতিমন্ত্রী ও ${bn(count('উপদেষ্টা'))} জন উপদেষ্টা, মন্ত্রণালয় ও দায়িত্ব পাওয়ার তারিখসহ। সূত্র মন্ত্রিপরিষদ বিভাগ।`,
};

export default function MinistersPage() {
  const checked = postsCheckedOnBn();
  const log = changes();
  return (
    <Page>
      <PageHead
        eyebrow="সরকার"
        title="মন্ত্রিসভা"
        lede="কে কোন মন্ত্রণালয়ের দায়িত্বে, কবে থেকে, আর কে কোন আসনের সংসদ সদস্য। তালিকাটি মন্ত্রিপরিষদ বিভাগের ওয়েবসাইট থেকে দিনে কয়েকবার মিলিয়ে নেওয়া হয়; কোনো নাম হাতে বসানো হয় না।"
      />

      <div className="pt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {GROUPS.map((t, i) =>
            count(t) ? (
              // Each rank jumps to its own list below (MinistersBrowser's rankId).
              <a
                key={t}
                href={`#rank-${t}`}
                className={`group relative overflow-hidden rounded-card border border-rule bg-surface shadow-card px-4 pt-3.5 pb-4 flex flex-col gap-1.5 hover:border-brand hover:shadow-lift transition-all ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-inksoft group-hover:text-brand">
                  {t}
                  <Icon name="arrow" size={14} className="text-brand opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </span>
                <span className="display text-[32px] font-bold leading-none tnum">{bn(count(t))}</span>
                <span className="text-[12px] text-muted leading-snug">{RANK_SHORT[t]}</span>
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-brand/70 scale-x-0 group-hover:scale-x-100 origin-left transition-transform" />
              </a>
            ) : (
              <div key={t} className="rounded-card border border-dashed border-rule bg-surface/60 px-4 pt-3.5 pb-4 flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-muted">{t}</span>
                <span className="display text-[32px] font-bold leading-none text-rule tnum">০</span>
                <span className="text-[12px] text-muted">এখন কেউ নেই</span>
              </div>
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {checked && (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brandsoft text-branddark font-semibold">
              <Icon name="check" size={14} />
              সর্বশেষ যাচাই {checked}
            </span>
          )}
          <a
            href={CABINET_PAGE_FOR_READERS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-rule bg-surface text-inksoft hover:border-brand hover:text-brand transition-colors"
          >
            সূত্র: মন্ত্রিপরিষদ বিভাগ
            <Icon name="external" size={13} />
          </a>
          {(posts.pending?.length ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-warnsoft text-ink" title="তাঁদের নামের পাশে তা লেখা আছে">
              <Icon name="clock" size={14} />
              {bn(posts.pending!.length)} জন সংসদ সদস্য কিনা যাচাই হচ্ছে
            </span>
          )}
          <Link href="/mp" className="ms-auto inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            সব সংসদ সদস্য
            <Icon name="arrow" size={14} />
          </Link>
        </div>
      </div>

      <div className="pt-8 pb-10">
        <MinistersBrowser groups={data.groups} ministries={data.ministries} />
      </div>

      <section className="pb-14 flex flex-col gap-4" aria-labelledby="changes">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="changes" className="display text-[24px]">পরিবর্তন</h2>
          <p className="text-[13.5px] text-muted">মন্ত্রিপরিষদ বিভাগের তালিকায় যেদিন যা বদলেছে।</p>
        </div>
        <Card className="p-5 sm:p-6">
          {log.length === 0 ? (
            <p className="text-[14.5px] text-muted">এখনো কোনো পরিবর্তন লেখা হয়নি।</p>
          ) : (
            <ol className="flex flex-col">
              {log.map((c, i) => (
                <li key={i} className="relative ps-6 pb-5 last:pb-0">
                  <span
                    aria-hidden="true"
                    className={`absolute start-0 top-[7px] w-2.5 h-2.5 rounded-full ${c.kind === 'end' ? 'bg-rule' : 'bg-brand'}`}
                  />
                  {i < log.length - 1 && <span aria-hidden="true" className="absolute start-[4.5px] top-[19px] bottom-0 w-px bg-rulesoft" />}
                  <span className="block text-[12.5px] text-muted">{dateBn(c.date)}</span>
                  <span className="block text-[14.5px] leading-relaxed">
                    {c.href ? <Link href={c.href} className="font-semibold hover:text-brand">{c.name}</Link> : <span className="font-semibold">{c.name}</span>}
                    {', '}
                    <span className={c.kind === 'end' ? 'text-muted' : ''}>{c.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 pt-3 border-t border-rule text-[12.5px] text-muted leading-relaxed">
            দায়িত্ব পাওয়ার তারিখ মন্ত্রিপরিষদ বিভাগের তালিকার বণ্টনের তারিখ। কারও নাম তালিকা থেকে সরে গেলে যেদিন তা ধরা পড়ে,
            সেদিনকে দায়িত্ব শেষের তারিখ ধরা হয়।
          </p>
        </Card>
      </section>

    </Page>
  );
}
