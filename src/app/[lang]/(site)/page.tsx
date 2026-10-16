import type { Metadata } from "next";
import Link from "@/i18n/Link";
import {
  parties,
  meta,
  statistics,
  getMemberById,
  getMember,
  getSeat,
  getParty,
  GENERAL_SEATS,
} from "@/lib/data";
import { districtList } from "@/lib/districts";
import { finderSeats } from "@/lib/finderSeats";
import type { FinderSeat } from "@/lib/findSeat";
import type { StoryMember } from "@/lib/newsView";
import upazilaEn from "../../../../data/upazila-en.json";
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
import { getT } from "@/i18n/server";
import type { Lang } from "@/i18n/core";
import {
  HOUSE_ROLE,
  OFFICE,
  districtName,
  partyName,
  partyShort,
  personName,
  seatName,
} from "@/i18n/names";
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
  BASE_TWITTER,
  langAlternates,
  shareGraph,
  siteDescription,
  siteName,
  siteTitle,
} from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = siteTitle(t.lang);
  const description = siteDescription(t.lang);
  return {
    alternates: langAlternates(t.lang, "/"),
    // A child segment replaces the whole openGraph/twitter object, so the shared parts are spread back in.
    openGraph: {
      ...shareGraph("/", undefined, t.lang),
      url: t.en ? `${siteUrl}/en` : siteUrl,
      title,
      description,
    },
    twitter: {
      ...BASE_TWITTER,
      title,
      description,
    },
  };
}

/** The site itself, for search engines: its name, address and language. */
function websiteLd(lang: Lang) {
  const en = lang === "en";
  const home = en ? `${siteUrl}/en` : siteUrl;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": en ? `${siteUrl}/en#website` : `${siteUrl}/#website`,
    name: siteName(lang),
    alternateName: en ? ["mymp", siteName("bn")] : "mymp",
    url: home,
    inLanguage: en ? "en" : "bn-BD",
    description: siteDescription(lang),
    publisher: { "@id": `${siteUrl}/#organization` },
    // Search engines may offer a search box for the site; it lands on the member list, filtered.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${home}/mp?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * The place finder's seats for an English page: each member's English name
 * beside the Bangla, which is all the box needs to answer in English. The
 * Bangla page gets the list as it is.
 */
function finderSeatsIn(lang: Lang): FinderSeat[] {
  const list = finderSeats();
  if (lang === "bn") return list;
  return list.map((s) =>
    s.member
      ? { ...s, member: { ...s.member, nameEn: personName(getMember(s.member.slug), "en") || undefined } }
      : s,
  );
}

/**
 * Read again every five minutes, like /songbad: the headlines and videos come
 * from the live feed, and a home page built once at deploy time went stale.
 */
export const revalidate = 300;

export default async function Home() {
  const t = await getT();
  const stats = statistics();
  const [{ stories }, videos] = await Promise.all([
    newsPageStories(40),
    latestVideos(30),
  ]);
  // The live feed's stories carry the members' Bangla names only; an English page adds the English.
  const withEnglish = (m: StoryMember): StoryMember =>
    m.nameEn ? m : { ...m, nameEn: personName(getMember(m.slug), "en") || undefined };
  const latestNews = stories
    .filter((s) => s.kind !== "video")
    .slice(0, 3)
    .map((s) =>
      t.en
        ? { ...s, member: s.member && withEnglish(s.member), members: s.members?.map(withEnglish) }
        : s,
    );
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
    .map((d) => ({ bn: d.bn, en: d.en, slug: d.slug, count: d.seats.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd(t.lang)) }}
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
                {t("ত্রয়োদশ জাতীয় সংসদ, ২০২৬ থেকে", "13th Parliament, from 2026")}
              </span>
              <h1 className="rise [--rise-i:1] display text-[34px] sm:text-[50px] lg:text-[56px] leading-[1.12] text-balance">
                {t("আপনার", "Know your")}{" "}
                <span className="bg-gradient-to-r from-brand to-[#139a55] bg-clip-text text-transparent">
                  {t("সংসদ সদস্যকে", "Member of Parliament")}
                </span>
                {t.en ? null : <>{" "}চিনুন</>}
              </h1>
              {/* The owner's line said "সংসদে উপস্থিতি"; no open source has attendance (see /parisonkhan), so it names the notices member pages do carry. */}
              <p className="rise [--rise-i:2] text-[16px] sm:text-[19px] leading-relaxed text-inksoft max-w-[600px] text-pretty">
                {t.en ? (
                  `${t.count(stats.total, "", "member", "members")}, ${t.count(GENERAL_SEATS, "", "seat", "seats")}, ${t.count(parties.length, "", "party", "parties")}. Every member's profile, election results, committees and Parliament's notifications, all with sources`
                ) : (
                  <>
                    {t.n(stats.total)} জন সদস্য, {t.n(GENERAL_SEATS)} আসন,{" "}
                    {t.n(parties.length)}টি দল। প্রতিটি সদস্যের পরিচিতি, ভোটের ফল,
                    কমিটি ও সংসদের প্রজ্ঞাপন, সবই সূত্রসহ
                  </>
                )}
              </p>
              {/* Above the chips and the card that follow: each animates on its own layer, and later ones paint on top. */}
              <div className="rise [--rise-i:3] relative z-20">
                <SiteSearch
                  withButton
                  placeholder={t(
                    "উপজেলা, ইউনিয়ন, আসন, এমপি বা দলের নাম, বাংলা বা ইংরেজিতে",
                    "Name of an upazila, union, seat, MP or party, in Bangla or English",
                  )}
                  places={{ seats: finderSeatsIn(t.lang), upazilaEn: upazilaEn as [string, string][] }}
                />
              </div>
              <div className="rise [--rise-i:4] flex items-center gap-2.5 text-[13.5px] text-muted overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <span className="shrink-0">{t("বেশি খোঁজা হয়:", "Most searched:")}</span>
                {[
                  // The English names come from the data, like everywhere else.
                  { label: t.en ? seatName(getSeat("dhaka-17"), "en") : "ঢাকা-১৭", href: "/ason/dhaka-17" },
                  {
                    label: t.en ? districtName(districtList().find((d) => d.slug === "sylhet"), "en") : "সিলেট",
                    href: "/jela/sylhet",
                  },
                  { label: t.en ? partyShort(getParty("bnp"), "en") : "বিএনপি", href: "/dol/bnp" },
                  {
                    label: t.en ? OFFICE.speaker!.en : "স্পিকার",
                    href: featured[0] ? `/mp/${featured[0].m.slug}` : "/mp",
                  },
                  { label: t("সংরক্ষিত আসন", "Reserved seats"), href: "/mp?kind=reserved" },
                ].map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="shrink-0 px-3.5 py-1.5 border border-rule rounded-full bg-surface text-ink font-medium hover:border-brand hover:text-brand transition-colors"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>

            <Card className="rise [--rise-i:2] w-full lg:w-[440px] shrink-0 p-5 sm:p-7 flex flex-col gap-4">
              <div className="flex justify-between items-baseline">
                <h2 className="display text-[20px]">{t("সংসদের গঠন", "Composition of Parliament")}</h2>
                <Link
                  href="/parisonkhan"
                  className="text-[13.5px] font-semibold text-brand hover:underline"
                >
                  {t("পরিসংখ্যান", "Statistics")} →
                </Link>
              </div>
              <p className="text-[13.5px] text-muted -mt-2">
                {t.en ? (
                  `${t.count(stats.total, "", "member", "members")}: ${stats.territorial} elected from constituencies, ${stats.reserved} in reserved seats for women`
                ) : (
                  <>
                    {t.n(stats.total)} সদস্য, {t.n(stats.territorial)} আসনভিত্তিক,{" "}
                    {t.n(stats.reserved)} সংরক্ষিত নারী আসন
                  </>
                )}
              </p>
              <CompositionBar
                parties={parties}
                total={stats.total}
                majority={stats.majority}
              />
              <p className="text-[12px] text-muted border-t border-rule pt-3 leading-relaxed">
                {t("শুধু আসনভিত্তিক ফল আলাদা:", "The constituency results on their own:")}{" "}
                {parties
                  .slice(0, 2)
                  .map((p) => `${partyName(p, t.lang)} ${t.n(p.seatsTerritorial)}`)
                  .join(", ")}
                {t.en ? (
                  `. The ${stats.reserved} reserved seats are shared among the parties after the results.`
                ) : (
                  <>
                    । সংরক্ষিত {t.n(stats.reserved)}টি আসন ফলের পর দলগুলোর মধ্যে ভাগ
                    হয়।
                  </>
                )}
              </p>
            </Card>
          </div>
        </Page>
      </section>

      <Page>
        <section className="pb-12 flex flex-col gap-5">
          <SectionHead
            title={t("সংসদে এখন", "In Parliament now")}
            href="/odhibeshon"
            linkLabel={t("সব অধিবেশন", "All sessions")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-muted">
                <Icon name="calendar" size={15} /> {t("সর্বশেষ অধিবেশন", "Latest session")}
              </span>
              <span className="display text-[22px] leading-tight">
                {session ? sessionLabel(session, t.lang) : t("তথ্য নেই", "No information")}
              </span>
              <span className="text-[13px] text-muted">
                {session?.startDate
                  ? t(`শুরু ${t.date(session.startDate)}`, `Began ${t.date(session.startDate)}`)
                  : t("সংসদের তথ্যভান্ডারে নেই", "Not in Parliament's database")}
                {session
                  ? t(
                      `, ${t.n(session.sittings.length)} বৈঠক`,
                      `, ${t.count(session.sittings.length, "", "sitting", "sittings")}`,
                    )
                  : ""}
              </span>
            </Card>
            <Card className="p-5 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-muted">
                <Icon name="clock" size={15} /> {t("সর্বশেষ বৈঠক", "Latest sitting")}
              </span>
              <span className="display text-[22px] leading-tight">
                {sitting?.date ? t.date(sitting.date) : t("তথ্য নেই", "No information")}
              </span>
              <span className="flex items-center justify-between gap-2 text-[13px] text-muted">
                <span>
                  {sittingAgo === null
                    ? ""
                    : sittingAgo === 0
                      ? t("আজ", "Today")
                      : t(
                          `${t.n(sittingAgo)} দিন আগে`,
                          `${t.count(sittingAgo, "", "day", "days")} ago`,
                        )}
                </span>
                {sitting?.pdfUrl && (
                  <DocLink href={sitting.pdfUrl}>{t("কার্যসূচি", "Order of the day")}</DocLink>
                )}
              </span>
            </Card>
            <Card className="p-5 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-muted">
                <Icon name="bell" size={15} /> {t("সদস্যদের প্রজ্ঞাপন", "Notifications on members")}
              </span>
              <span className="display tnum text-[22px] leading-tight">
                {t.en ? t.n(memberNoticeCount()) : `${t.n(memberNoticeCount())}টি`}
              </span>
              <span className="text-[13px] text-muted">
                {t(
                  "সংসদ সচিবালয়ের প্রজ্ঞাপন, প্রতিটি সদস্যের পাতায়",
                  "Parliament Secretariat notifications, on each member's page",
                )}
              </span>
            </Card>
            <Card className="p-5 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-muted">
                <Icon name="refresh" size={15} /> {t("হালনাগাদ", "Updated")}
              </span>
              <span className="display text-[22px] leading-tight">
                {t.date(meta.syncedAt)}
              </span>
              <span className="text-[13px] text-muted">
                {t.en ? (
                  `Daily from Parliament's database; the papers of ${t.count(totalSittings(), "", "sitting", "sittings")}`
                ) : (
                  <>
                    সংসদের তথ্যভান্ডার থেকে প্রতিদিন, {t.n(totalSittings())} বৈঠকের
                    নথি
                  </>
                )}
              </span>
            </Card>
          </div>
        </section>

        <section className="pb-12 flex flex-col gap-5">
          <SectionHead
            title={t("সংসদ পরিচালনায়", "Running Parliament")}
            href="/mp"
            linkLabel={t(`সব ${t.n(stats.total)} জন`, `All ${stats.total}`)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map(({ o, m }) => (
              <MemberCard
                key={m.id}
                m={m}
                badge={(t.en ? HOUSE_ROLE[o.role]?.en : ROLE_LABELS[o.role]) ?? o.role}
              />
            ))}
          </div>
        </section>

        <section className="pb-12 flex flex-col gap-5">
          <SectionHead
            title={t("জেলা অনুযায়ী", "By district")}
            href="/jela"
            linkLabel={t("সব জেলা", "All districts")}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {topDistricts.map((d) => (
              <Link
                key={d.slug}
                href={`/jela/${d.slug}`}
                className="reveal group bg-surface border border-rule rounded-card shadow-card p-4 sm:p-5 flex items-center justify-between gap-3 hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
              >
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="display text-[18px] truncate">{districtName(d, t.lang)}</span>
                  <span className="text-[13px] text-muted">
                    {t.en ? t.count(d.count, "", "seat", "seats") : `${t.n(d.count)} আসন`}
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
            title={t("সংবাদে সংসদ সদস্যরা", "MPs in the news")}
            href="/songbad"
            linkLabel={t("সংবাদ", "News")}
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
              title={t("এখনো কোনো সংবাদ প্রকাশ করা হয়নি", "No news has been published yet")}
              body={t(
                "অনুমোদিত সংবাদমাধ্যমের শিরোনাম যাচাইয়ের পর এখানে দেখানো হবে। যাচাই ছাড়া কোনো সংবাদ এই সাইটে প্রকাশ করা হয় না।",
                "Headlines from approved news outlets will be shown here once they have been checked. No news is published on this site without being checked.",
              )}
            />
          )}
        </section>

        {videos.some((v) => v.thumbnail) && (
          <section className="pb-14 flex flex-col gap-5">
            <SectionHead
              title={t("ভিডিওতে সংসদ সদস্যরা", "MPs on video")}
              href="/songbad?type=video"
              linkLabel={t("সব ভিডিও", "All videos")}
            />
            <HomeVideos videos={videos} />
          </section>
        )}
      </Page>
    </>
  );
}
