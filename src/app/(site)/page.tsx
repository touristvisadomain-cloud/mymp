import type { Metadata } from "next";
import Link from "next/link";
import {
  parties,
  meta,
  bn,
  dateBn,
  statistics,
  getMemberById,
  GENERAL_SEATS,
} from "@/lib/data";
import { districtList } from "@/lib/districts";
import { newsPageStories, latestVideos } from "@/lib/feed/storyView";
import {
  latestSession,
  latestSitting,
  sessionLabel,
  officers,
  memberNoticeCount,
  totalSittings,
  ROLE_LABELS,
  daysSince,
} from "@/lib/activity";
import {
  Page,
  Card,
  MemberCard,
  CompositionBar,
  Empty,
  SectionHead,
  DocLink,
} from "@/components/ui";
import SiteSearch from "@/components/SiteSearch";
import StoryCard from "@/components/StoryCard";
import HomeVideos from "@/components/HomeVideos";
import Icon from "@/components/Icon";
import { siteUrl } from "@/lib/site";
import {
  BASE_OPEN_GRAPH,
  BASE_TWITTER,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  // A child segment replaces the whole openGraph/twitter object, so the shared parts are spread back in.
  openGraph: {
    ...BASE_OPEN_GRAPH,
    url: siteUrl,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    ...BASE_TWITTER,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

/** The site itself, for search engines: its name, address and language. */
const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "আমার এমপি",
  alternateName: "mymp",
  url: siteUrl,
  inLanguage: "bn-BD",
  description: SITE_DESCRIPTION,
  publisher: { "@id": `${siteUrl}/#organization` },
  // Search engines may offer a search box for the site; it lands on the member list, filtered.
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/mp?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/**
 * Read again every five minutes, like /songbad: the headlines and videos come
 * from the live feed, and a home page built once at deploy time went stale.
 */
export const revalidate = 300;

export default async function Home() {
  const stats = statistics();
  const [{ stories }, videos] = await Promise.all([
    newsPageStories(40),
    latestVideos(30),
  ]);
  const latestNews = stories.filter((s) => s.kind !== "video").slice(0, 3);
  const session = latestSession();
  const sitting = latestSitting();
  const sittingAgo = daysSince(sitting?.date ?? null);

  // The House's own officers lead the page: Speaker, Deputy Speaker, Leader of
  // the House, Leader of the Opposition, in the order the source lists them.
  const featured = officers
    .map((o) => ({ o, m: o.memberId ? getMemberById(o.memberId) : undefined }))
    .filter(
      (
        x,
      ): x is {
        o: (typeof officers)[number];
        m: NonNullable<ReturnType<typeof getMemberById>>;
      } => !!x.m,
    )
    .filter((x, i, arr) => arr.findIndex((y) => y.m.id === x.m.id) === i)
    .slice(0, 4);

  // Counted from the seats, not from the members: a seat with no member on
  // the roll (Chattogram-4 in September 2026) is still a seat, and the card
  // says "আসন".
  const topDistricts = districtList()
    .map((d) => ({ bn: d.bn, slug: d.slug, count: d.seats.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }}
      />
      <section className="relative bg-[radial-gradient(ellipse_at_top_left,_var(--color-brandsoft),_transparent_55%)]">
        {/* The glows are clipped on their own layer, so the search results can open past the hero's edge. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden pointer-events-none"
        >
          <div className="hero-glow w-[420px] h-[420px] -top-40 -left-24 bg-[#17cf54]/15" />
          <div className="hero-glow w-[360px] h-[360px] top-10 right-[-120px] bg-[#0f6a4b]/12 [animation-delay:-9s]" />
        </div>
        <Page>
          <div className="pt-9 sm:pt-14 pb-10 sm:pb-14 flex flex-col lg:flex-row gap-9 lg:gap-14 items-start">
            <div className="grow flex flex-col gap-5 sm:gap-6 w-full min-w-0">
              <span className="rise text-[12.5px] font-bold tracking-[1.5px] text-brand">
                ত্রয়োদশ জাতীয় সংসদ, ২০২৬ থেকে
              </span>
              <h1 className="rise [--rise-i:1] display text-[34px] sm:text-[50px] lg:text-[56px] leading-[1.12] text-balance">
                আপনার{" "}
                <span className="bg-gradient-to-r from-brand to-[#139a55] bg-clip-text text-transparent">
                  সংসদ সদস্যকে
                </span>{" "}
                চিনুন
              </h1>
              {/* The owner's line said "সংসদে উপস্থিতি"; no open source has attendance (see /parisonkhan), so it names the notices member pages do carry. */}
              <p className="rise [--rise-i:2] text-[16px] sm:text-[19px] leading-relaxed text-inksoft max-w-[600px] text-pretty">
                {bn(stats.total)} জন সদস্য, {bn(GENERAL_SEATS)} আসন,{" "}
                {bn(parties.length)}টি দল। প্রতিটি সদস্যের পরিচিতি, ভোটের ফল,
                কমিটি ও সংসদের প্রজ্ঞাপন, সবই সূত্রসহ
              </p>
              {/* Above the chips and the card that follow: each animates on its own layer, and later ones paint on top. */}
              <div className="rise [--rise-i:3] relative z-20">
                <SiteSearch
                  withButton
                  placeholder="আসন, জেলা, এমপি বা দলের নাম, বাংলা বা ইংরেজিতে"
                />
              </div>
              <div className="rise [--rise-i:4] flex items-center gap-2.5 text-[13.5px] text-muted overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <span className="shrink-0">বেশি খোঁজা হয়:</span>
                {[
                  { label: "ঢাকা-১৭", href: "/ason/dhaka-17" },
                  { label: "সিলেট", href: "/jela/sylhet" },
                  { label: "বিএনপি", href: "/dol/bnp" },
                  {
                    label: "স্পিকার",
                    href: featured[0] ? `/mp/${featured[0].m.slug}` : "/mp",
                  },
                  { label: "সংরক্ষিত আসন", href: "/mp?kind=reserved" },
                ].map((t) => (
                  <Link
                    key={t.label}
                    href={t.href}
                    className="shrink-0 px-3.5 py-1.5 border border-rule rounded-full bg-surface text-ink font-medium hover:border-brand hover:text-brand transition-colors"
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>

            <Card className="rise [--rise-i:2] w-full lg:w-[440px] shrink-0 p-5 sm:p-7 flex flex-col gap-4">
              <div className="flex justify-between items-baseline">
                <h2 className="display text-[20px]">সংসদের গঠন</h2>
                <Link
                  href="/parisonkhan"
                  className="text-[13.5px] font-semibold text-brand hover:underline"
                >
                  পরিসংখ্যান →
                </Link>
              </div>
              <p className="text-[13.5px] text-muted -mt-2">
                {bn(stats.total)} সদস্য, {bn(stats.territorial)} আসনভিত্তিক,{" "}
                {bn(stats.reserved)} সংরক্ষিত নারী আসন
              </p>
              <CompositionBar
                parties={parties}
                total={stats.total}
                majority={stats.majority}
              />
              <p className="text-[12px] text-muted border-t border-rule pt-3 leading-relaxed">
                শুধু আসনভিত্তিক ফল আলাদা:{" "}
                {parties
                  .slice(0, 2)
                  .map((p) => `${p.nameBn ?? p.abbr} ${bn(p.seatsTerritorial)}`)
                  .join(", ")}
                । সংরক্ষিত {bn(stats.reserved)}টি আসন ফলের পর দলগুলোর মধ্যে ভাগ
                হয়।
              </p>
            </Card>
          </div>
        </Page>
      </section>

      <Page>
        <section className="pb-12 flex flex-col gap-5">
          <SectionHead
            title="সংসদে এখন"
            href="/odhibeshon"
            linkLabel="সব অধিবেশন"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-muted">
                <Icon name="calendar" size={15} /> সর্বশেষ অধিবেশন
              </span>
              <span className="display text-[22px] leading-tight">
                {session ? sessionLabel(session) : "তথ্য নেই"}
              </span>
              <span className="text-[13px] text-muted">
                {session?.startDate
                  ? `শুরু ${dateBn(session.startDate)}`
                  : "সংসদের তথ্যভান্ডারে নেই"}
                {session ? `, ${bn(session.sittings.length)} বৈঠক` : ""}
              </span>
            </Card>
            <Card className="p-5 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-muted">
                <Icon name="clock" size={15} /> সর্বশেষ বৈঠক
              </span>
              <span className="display text-[22px] leading-tight">
                {sitting?.date ? dateBn(sitting.date) : "তথ্য নেই"}
              </span>
              <span className="flex items-center justify-between gap-2 text-[13px] text-muted">
                <span>
                  {sittingAgo === null
                    ? ""
                    : sittingAgo === 0
                      ? "আজ"
                      : `${bn(sittingAgo)} দিন আগে`}
                </span>
                {sitting?.pdfUrl && (
                  <DocLink href={sitting.pdfUrl}>কার্যসূচি</DocLink>
                )}
              </span>
            </Card>
            <Card className="p-5 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-muted">
                <Icon name="bell" size={15} /> সদস্যদের প্রজ্ঞাপন
              </span>
              <span className="display tnum text-[22px] leading-tight">
                {bn(memberNoticeCount())}টি
              </span>
              <span className="text-[13px] text-muted">
                সংসদ সচিবালয়ের প্রজ্ঞাপন, প্রতিটি সদস্যের পাতায়
              </span>
            </Card>
            <Card className="p-5 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-muted">
                <Icon name="refresh" size={15} /> হালনাগাদ
              </span>
              <span className="display text-[22px] leading-tight">
                {dateBn(meta.syncedAt)}
              </span>
              <span className="text-[13px] text-muted">
                সংসদের তথ্যভান্ডার থেকে প্রতিদিন, {bn(totalSittings())} বৈঠকের
                নথি
              </span>
            </Card>
          </div>
        </section>

        <section className="pb-12 flex flex-col gap-5">
          <SectionHead
            title="সংসদ পরিচালনায়"
            href="/mp"
            linkLabel={`সব ${bn(stats.total)} জন`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map(({ o, m }) => (
              <MemberCard
                key={m.id}
                m={m}
                badge={ROLE_LABELS[o.role] ?? o.role}
              />
            ))}
          </div>
        </section>

        <section className="pb-12 flex flex-col gap-5">
          <SectionHead title="জেলা অনুযায়ী" href="/jela" linkLabel="সব জেলা" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {topDistricts.map((d) => (
              <Link
                key={d.slug}
                href={`/jela/${d.slug}`}
                className="reveal group bg-surface border border-rule rounded-card shadow-card p-4 sm:p-5 flex items-center justify-between gap-3 hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
              >
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="display text-[18px] truncate">{d.bn}</span>
                  <span className="text-[13px] text-muted">
                    {bn(d.count)} আসন
                  </span>
                </span>
                <Icon
                  name="arrow"
                  size={16}
                  className="text-muted group-hover:text-brand group-hover:translate-x-0.5 transition-transform"
                />
              </Link>
            ))}
          </div>
        </section>

        <section className="pb-14 flex flex-col gap-5">
          <SectionHead
            title="সংবাদে সংসদ সদস্যরা"
            href="/songbad"
            linkLabel="সংবাদ"
          />
          {/* The cards share a height (no items-start), so the row lines up
              whether or not a story came with a picture. */}
          {latestNews.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {latestNews.map((s) => (
                <StoryCard key={s.id} s={s} />
              ))}
            </div>
          ) : (
            <Empty
              title="এখনো কোনো সংবাদ প্রকাশ করা হয়নি"
              body="অনুমোদিত সংবাদমাধ্যমের শিরোনাম যাচাইয়ের পর এখানে দেখানো হবে। যাচাই ছাড়া কোনো সংবাদ এই সাইটে প্রকাশ করা হয় না।"
            />
          )}
        </section>

        {videos.some((v) => v.thumbnail) && (
          <section className="pb-14 flex flex-col gap-5">
            <SectionHead
              title="ভিডিওতে সংসদ সদস্যরা"
              href="/songbad?type=video"
              linkLabel="সব ভিডিও"
            />
            <HomeVideos videos={videos} />
          </section>
        )}
      </Page>
    </>
  );
}
