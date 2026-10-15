import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import { bn, initial, getMember } from '@/lib/data';
import { newsPageStories } from '@/lib/feed/storyView';
import { siteCounts, type SiteCounts } from '@/lib/feed/store';
import { NEWS_SOURCES } from '../../../../config/news-sources';
import { Page, PageHead, Card, Empty, Stat } from '@/components/ui';
import NewsBrowser from '@/components/NewsBrowser';
import VideoStrip from '@/components/VideoStrip';
import MemberPhoto from '@/components/MemberPhoto';

export const metadata: Metadata = {
  alternates: { canonical: '/songbad' },
  openGraph: shareGraph('/songbad'),
  title: 'সংবাদ',
  description: 'সংসদ সদস্যদের নিয়ে দেশের সংবাদমাধ্যমের সর্বশেষ শিরোনাম, মূল খবরের লিংকসহ। প্রতিটি শিরোনাম সংশ্লিষ্ট সংসদ সদস্যের পাতাতেও দেখা যায়।',
};

/** How many stories the page hands the browser's filter. */
const LIMIT = 400;

/**
 * Read again every five minutes. The headlines come from the live feed, which
 * gains a few hundred a day, so a page built once at deploy time would be out
 * of date by lunch; five minutes is soon enough for a news list and keeps the
 * site's shape, where a reader almost never waits on a function.
 */
export const revalidate = 300;

const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const monthName = (m: string) => `${MONTHS_BN[Number(m.slice(5, 7)) - 1]} ${bn(m.slice(0, 4))}`;
/** "১০,২৪৫": a thousands comma, the way the newspapers print a large figure. */
const bnCount = (n: number) => bn(n.toLocaleString('en-US'));
/** The first and last day of a month, the last being today in the current month. */
const monthSpan = (m: string, today: string) => {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(Date.UTC(y!, mo!, 0)).toISOString().slice(0, 10);
  return `${m}-01~${last < today ? last : today}`;
};

export default async function NewsPage() {
  const [{ stories }, figures] = await Promise.all([
    newsPageStories(LIMIT),
    // The figures are a nicety: if they cannot be read the page still lists the news.
    siteCounts().catch((e): SiteCounts | null => { console.error('the news counts could not be read', e); return null; }),
  ]);
  const videos = stories.filter((s) => s.kind === 'video');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

  // Who is in the news, by number of stories; the list's member filter and the side card both use it.
  const counts = new Map<string, { slug: string; name: string; count: number }>();
  for (const s of stories) {
    for (const m of s.members?.length ? s.members : s.member ? [s.member] : []) {
      const e = counts.get(m.slug) ?? { slug: m.slug, name: m.name, count: 0 };
      e.count++;
      counts.set(m.slug, e);
    }
  }
  const members = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bn'));

  const outletCounts = new Map<string, number>();
  for (const s of stories) for (const src of [s.lead.source, ...s.also.map((a) => a.source)]) outletCounts.set(src, (outletCounts.get(src) ?? 0) + 1);
  const outlets = [...outletCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bn'));

  return (
    <Page>
      <PageHead
        eyebrow="মিডিয়া ও সংবাদ"
        title="সংবাদ"
        lede="সংসদ সদস্য ও আসন নিয়ে সংবাদমাধ্যমের শিরোনাম ও টেলিভিশনের ভিডিও, প্রতিটির সঙ্গে মূল সংবাদের লিংক। একই খবর কয়েকটি সংবাদমাধ্যমে এলে তা একসঙ্গে দেখানো হয়।"
        aside={
          figures ? (
            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <Stat label="আজ খবর" value={bn(figures.today.news)} note={`মোট ${bnCount(figures.total.news)}`} />
              <Stat label="আজ ভিডিও" value={bn(figures.today.video)} note={`মোট ${bnCount(figures.total.video)}`} />
              <Stat label="আজ সংবাদমাধ্যম" value={bn(figures.today.outlets)} note={`তালিকায় ${bn(NEWS_SOURCES.length)}টি`} />
            </div>
          ) : undefined
        }
      />

      {figures && figures.months.length > 0 && (
        <section className="pt-8 flex flex-col gap-3" aria-labelledby="by-month">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 id="by-month" className="display text-[22px] font-bold">মাস অনুযায়ী সংবাদ ও ভিডিও</h2>
            <p className="text-[13px] text-muted">ডিসেম্বর ২০২৫ থেকে, বর্তমান সংসদ সদস্যদের। মাসে চাপ দিলে সেই মাসের খবর।</p>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {figures.months.map((m) => {
              const total = m.news + m.video;
              const most = Math.max(...figures.months.map((x) => x.news + x.video));
              const current = m.month === today.slice(0, 7);
              return (
                <li key={m.month}>
                  <a
                    href={`?d=${monthSpan(m.month, today)}`}
                    className={`h-full bg-surface border rounded-card shadow-card p-4 flex flex-col gap-1.5 hover:border-brand hover:shadow-lift transition-all ${current ? 'border-brand' : 'border-rule'}`}
                  >
                    <span className="text-[13px] font-semibold text-muted">
                      {monthName(m.month)}
                      {current && <span className="ms-1.5 text-brand">· চলতি</span>}
                    </span>
                    <span className="display text-[26px] font-bold leading-none tnum">{bnCount(total)}</span>
                    <span className="h-1.5 rounded-full bg-rulesoft overflow-hidden" aria-hidden="true">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(3, Math.round((total / most) * 100))}%` }} />
                    </span>
                    <span className="text-[12.5px] text-inksoft tnum">
                      {bnCount(m.news)} সংবাদ · {bnCount(m.video)} ভিডিও
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
        <div className="min-w-0 flex flex-col gap-8">
          {videos.length > 0 && <VideoStrip videos={videos} moreHref="?type=video" />}
          {stories.length ? (
            <NewsBrowser stories={stories} members={members} outlets={outlets} today={today} />
          ) : (
            <Empty
              title="এখনো কোনো সংবাদ প্রকাশ করা হয়নি"
              body="অনুমোদিত সংবাদমাধ্যমের শিরোনাম যাচাইয়ের পর এখানে দেখানো হবে।"
            />
          )}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          {members.length > 0 && (
            <Card className="p-5 flex flex-col gap-3">
              <h2 className="display text-[18px] font-bold">সবচেয়ে বেশি খবরে</h2>
              <ul className="flex flex-col">
                {members.slice(0, 8).map((m) => {
                  const member = getMember(m.slug);
                  return (
                    <li key={m.slug}>
                      <a href={`?mp=${m.slug}`} className="flex items-center gap-3 py-2 rounded-lg hover:text-brand transition-colors">
                        <MemberPhoto src={member?.photoUrl ?? null} alt="" initial={member ? initial(member) : m.name.charAt(0)} size={36} />
                        <span className="grow min-w-0 text-[14.5px] font-semibold truncate">{m.name}</span>
                        <span className="shrink-0 text-[13px] text-muted">{bn(m.count)}টি খবর</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[12.5px] text-muted leading-relaxed">নামে চাপ দিলে শুধু তাঁর খবর দেখাবে।</p>
            </Card>
          )}


          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[18px] font-bold">সংবাদ কীভাবে যুক্ত হয়</h2>
            <ol className="flex flex-col gap-3 text-[14px] leading-relaxed text-inksoft">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">১</span>
                <span>দেশি-বিদেশি {bn(NEWS_SOURCES.length)}টি সংবাদমাধ্যমের তালিকা থেকে শিরোনাম নেওয়া হয়: যাদের ফিড বা নিউজ সাইটম্যাপ আছে সেখান থেকে সরাসরি, বাকিদের Google News-এর খোঁজ থেকে। ভিডিও আসে শুধু এই সংবাদমাধ্যমগুলোর নিজস্ব ইউটিউব চ্যানেল থেকে।</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">২</span>
                <span>একটি খবর সেই সংসদ সদস্যের পাতায় যায়, খবরটি যাঁকে নিয়ে: শিরোনামে তাঁর নাম বা শুধু তাঁরই পদ (প্রধানমন্ত্রী, স্পিকার…) থাকলে, অথবা প্রথম বাক্যে তিনিই মূল ব্যক্তি হলে। খবরে শুধু নাম উল্লেখ থাকলে যায় না।</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">৩</span>
                <span>
                  <strong className="text-ink font-semibold">মিল নিশ্চিত হলে শিরোনাম নিজে থেকে প্রকাশ হয়; সন্দেহ থাকলে একজন সম্পাদক দেখে অনুমোদন করার পরই আসে।</strong>{' '}
                  ভুল মিল চোখে পড়লে জানান, সম্পাদক তা সরিয়ে দেবেন।
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">৪</span>
                <span>শুধু শিরোনাম, সংবাদমাধ্যমের নাম, তারিখ ও মূল সংবাদের লিংক রাখা হয়। পুরো সংবাদ কপি করা হয় না।</span>
              </li>
            </ol>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
