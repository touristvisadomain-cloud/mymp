import type { Metadata } from 'next';
import { shareGraph, langAlternates } from '@/lib/seo';
import { bn, initial, getMember, allMembers, type Member } from '@/lib/data';
import { newsPageStories } from '@/lib/feed/storyView';
import { siteCounts, type SiteCounts } from '@/lib/feed/store';
import type { StoryMember, StoryView } from '@/lib/newsView';
import { NEWS_SOURCES } from '../../../../../config/news-sources';
import { Page, PageHead, Card, Empty, Stat } from '@/components/ui';
import NewsBrowser from '@/components/NewsBrowser';
import VideoStrip from '@/components/VideoStrip';
import MonthCards from '@/components/MonthCards';
import MemberPhoto from '@/components/MemberPhoto';
import { getT } from '@/i18n/server';
import { personName } from '@/i18n/names';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/songbad'),
    openGraph: shareGraph('/songbad', undefined, t.lang),
    title: t('সংসদ সদস্যদের খবর', 'News about the MPs of Bangladesh'),
    description: t(
      'সংসদ সদস্যদের নিয়ে দেশের সংবাদমাধ্যমের সর্বশেষ শিরোনাম, মূল খবরের লিংকসহ। প্রতিটি শিরোনাম সংশ্লিষ্ট সংসদ সদস্যের পাতাতেও দেখা যায়।',
      "The latest headlines from the country's news media about members of parliament, with links to the original stories. Each headline also appears on the page of the member concerned.",
    ),
  };
}

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

/** The first letter of a member's English name, without "Md." and the like, for the avatar on English pages. */
const initialEn = (m: Member) => {
  const name = personName(m, 'en').trim();
  return (name.replace(/^(?:Md\.?|Mst\.?|Mohammad|Dr\.?|Barrister|Advocate)\s+/i, '') || name).charAt(0);
};

/** English pages: a story's members carry their English names. */
const withEnglishNames = (s: StoryView): StoryView => {
  const en = (m: StoryMember): StoryMember => {
    const member = getMember(m.slug);
    return m.nameEn || !member ? m : { ...m, nameEn: personName(member, 'en') };
  };
  return { ...s, member: s.member ? en(s.member) : s.member, members: s.members?.map(en) };
};

export default async function NewsPage() {
  const t = await getT();
  const [{ stories: fetched }, figures] = await Promise.all([
    newsPageStories(LIMIT),
    // The figures are a nicety: if they cannot be read the page still lists the news.
    siteCounts().catch((e): SiteCounts | null => { console.error('the news counts could not be read', e); return null; }),
  ]);
  const stories = t.en ? fetched.map(withEnglishNames) : fetched;
  const videos = stories.filter((s) => s.kind === 'video');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const count = (n: number) => (t.en ? t.group(n) : bnCount(n));

  // Who is in the news, by number of stories; the list's member filter and the side card both use it.
  const counts = new Map<string, { slug: string; name: string; count: number }>();
  for (const s of stories) {
    for (const m of s.members?.length ? s.members : s.member ? [s.member] : []) {
      const e = counts.get(m.slug) ?? { slug: m.slug, name: t.en ? m.nameEn || m.name : m.name, count: 0 };
      e.count++;
      counts.set(m.slug, e);
    }
  }
  const members = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, t.lang));

  const outletCounts = new Map<string, number>();
  for (const s of stories) for (const src of [s.lead.source, ...s.also.map((a) => a.source)]) outletCounts.set(src, (outletCounts.get(src) ?? 0) + 1);
  const outlets = [...outletCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bn'));

  // English pages: every member's English name, for the stories a picked span brings in the browser.
  const namesEn = t.en ? Object.fromEntries(allMembers.map((m) => [m.slug, personName(m, 'en')])) : undefined;

  return (
    <Page>
      <PageHead
        eyebrow={t('মিডিয়া ও সংবাদ', 'Media and news')}
        title={t('সংবাদ', 'News')}
        lede={t(
          'সংসদ সদস্য ও আসন নিয়ে সংবাদমাধ্যমের শিরোনাম ও টেলিভিশনের ভিডিও, প্রতিটির সঙ্গে মূল সংবাদের লিংক। একই খবর কয়েকটি সংবাদমাধ্যমে এলে তা একসঙ্গে দেখানো হয়।',
          'Headlines from the news media and television videos about members of parliament and their seats, each with a link to the original story. When several outlets carry the same story, it is shown once, with all of them together.',
        )}
        aside={
          figures ? (
            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <Stat label={t('আজ খবর', 'News today')} value={t.n(figures.today.news)} note={t.en ? `${count(figures.total.news)} in total` : `মোট ${bnCount(figures.total.news)}`} />
              <Stat label={t('আজ ভিডিও', 'Videos today')} value={t.n(figures.today.video)} note={t.en ? `${count(figures.total.video)} in total` : `মোট ${bnCount(figures.total.video)}`} />
              <Stat label={t('আজ সংবাদমাধ্যম', 'Outlets today')} value={t.n(figures.today.outlets)} note={t.en ? `${NEWS_SOURCES.length} on the list` : `তালিকায় ${bn(NEWS_SOURCES.length)}টি`} />
            </div>
          ) : undefined
        }
      />

      {figures && figures.months.length > 0 && (
        <section className="pt-8 flex flex-col gap-3" aria-labelledby="by-month">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 id="by-month" className="display text-[22px] font-bold">{t('মাস অনুযায়ী সংবাদ ও ভিডিও', 'News and videos by month')}</h2>
            <p className="text-[13px] text-muted">
              {t(
                'ডিসেম্বর ২০২৫ থেকে, বর্তমান সংসদ সদস্যদের। মাসে চাপ দিলে সেই মাসের খবর।',
                "From December 2025, for the current members of parliament. Tap a month for that month's news.",
              )}
            </p>
          </div>
          <MonthCards
            listId="news-list"
            months={(() => {
              const most = Math.max(...figures.months.map((x) => x.news + x.video), 1);
              return figures.months.map((m) => {
                const total = m.news + m.video;
                return {
                  month: m.month,
                  label: t.en ? t.monthYear(`${m.month}-01`) ?? m.month : monthName(m.month),
                  span: monthSpan(m.month, today),
                  current: m.month === today.slice(0, 7),
                  total: count(total),
                  news: count(m.news),
                  video: count(m.video),
                  pct: Math.max(3, Math.round((total / most) * 100)),
                };
              });
            })()}
          />
        </section>
      )}

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
        <div className="min-w-0 flex flex-col gap-8">
          {videos.length > 0 && <VideoStrip videos={videos} moreHref="?type=video" />}
          {/* A month card above scrolls here. */}
          <span id="news-list" className="block -mb-8 scroll-mt-24" aria-hidden="true" />
          {stories.length ? (
            <NewsBrowser stories={stories} members={members} outlets={outlets} today={today} namesEn={namesEn} />
          ) : (
            <Empty
              title={t('এখনো কোনো সংবাদ প্রকাশ করা হয়নি', 'No news has been published yet')}
              body={t(
                'অনুমোদিত সংবাদমাধ্যমের শিরোনাম যাচাইয়ের পর এখানে দেখানো হবে।',
                'Headlines from approved news outlets will be shown here once they have been checked.',
              )}
            />
          )}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          {members.length > 0 && (
            <Card className="p-5 flex flex-col gap-3">
              <h2 className="display text-[18px] font-bold">{t('সবচেয়ে বেশি খবরে', 'Most in the news')}</h2>
              <ul className="flex flex-col">
                {members.slice(0, 8).map((m) => {
                  const member = getMember(m.slug);
                  return (
                    <li key={m.slug}>
                      <a href={`?mp=${m.slug}`} className="flex items-center gap-3 py-2 rounded-lg hover:text-brand transition-colors">
                        <MemberPhoto
                          src={member?.photoUrl ?? null}
                          alt=""
                          initial={member ? (t.en ? initialEn(member) : initial(member)) : m.name.charAt(0)}
                          size={36}
                        />
                        <span className="grow min-w-0 text-[14.5px] font-semibold truncate">{m.name}</span>
                        <span className="shrink-0 text-[13px] text-muted">{t.en ? `${m.count} ${m.count === 1 ? 'story' : 'stories'}` : <>{bn(m.count)}টি খবর</>}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[12.5px] text-muted leading-relaxed">{t('নামে চাপ দিলে শুধু তাঁর খবর দেখাবে।', 'Tap a name to see only their news.')}</p>
            </Card>
          )}


          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[18px] font-bold">{t('সংবাদ কীভাবে যুক্ত হয়', 'How the news is added')}</h2>
            <ol className="flex flex-col gap-3 text-[14px] leading-relaxed text-inksoft">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">{t('১', '1')}</span>
                {t.en ? (
                  <span>
                    Headlines are taken from a list of {NEWS_SOURCES.length} news outlets in Bangladesh and abroad: directly from those
                    that have a feed or a news sitemap, and from Google News searches for the rest. Videos come only from these outlets&rsquo;
                    own YouTube channels.
                  </span>
                ) : (
                  <span>দেশি-বিদেশি {bn(NEWS_SOURCES.length)}টি সংবাদমাধ্যমের তালিকা থেকে শিরোনাম নেওয়া হয়: যাদের ফিড বা নিউজ সাইটম্যাপ আছে সেখান থেকে সরাসরি, বাকিদের Google News-এর খোঁজ থেকে। ভিডিও আসে শুধু এই সংবাদমাধ্যমগুলোর নিজস্ব ইউটিউব চ্যানেল থেকে।</span>
                )}
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">{t('২', '2')}</span>
                <span>
                  {t(
                    'একটি খবর সেই সংসদ সদস্যের পাতায় যায়, খবরটি যাঁকে নিয়ে: শিরোনামে তাঁর নাম বা শুধু তাঁরই পদ (প্রধানমন্ত্রী, স্পিকার…) থাকলে, অথবা প্রথম বাক্যে তিনিই মূল ব্যক্তি হলে। খবরে শুধু নাম উল্লেখ থাকলে যায় না।',
                    'A story goes on the page of the member of parliament it is about: when the headline has their name or an office only they hold (Prime Minister, Speaker…), or when they are the main person in the first sentence. A story that only mentions their name does not.',
                  )}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">{t('৩', '3')}</span>
                <span>
                  <strong className="text-ink font-semibold">
                    {t(
                      'মিল নিশ্চিত হলে শিরোনাম নিজে থেকে প্রকাশ হয়; সন্দেহ থাকলে একজন সম্পাদক দেখে অনুমোদন করার পরই আসে।',
                      'When the match is certain, the headline is published automatically; when there is doubt, it appears only after an editor has looked at it and approved it.',
                    )}
                  </strong>{' '}
                  {t('ভুল মিল চোখে পড়লে জানান, সম্পাদক তা সরিয়ে দেবেন।', 'If you spot a wrong match, let us know and an editor will remove it.')}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">{t('৪', '4')}</span>
                <span>
                  {t(
                    'শুধু শিরোনাম, সংবাদমাধ্যমের নাম, তারিখ ও মূল সংবাদের লিংক রাখা হয়। পুরো সংবাদ কপি করা হয় না।',
                    "Only the headline, the outlet's name, the date and the link to the original story are kept. The full story is not copied.",
                  )}
                </span>
              </li>
              {t.en && (
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-brandsoft text-brand text-[12px] font-bold grid place-items-center tnum">5</span>
                  <span>
                    On these English pages, headlines are translated automatically from Bangla by Google Translate, so they may read
                    awkwardly or miss a nuance; open a story to read the original. Only the headline&rsquo;s text is sent to Google, nothing
                    about you. A headline not yet translated is shown in Bangla.
                  </span>
                </li>
              )}
            </ol>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
