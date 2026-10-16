import type { Metadata } from 'next';
import Link from 'next/link';
import { shareGraph } from '@/lib/seo';
import { members, parties, bn, partyColor, statistics, RESERVED_SEATS } from '@/lib/data';
import { Page, PageHead, Stat, Card, MemberCard, PartyDot, DocLink } from '@/components/ui';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

/**
 * The fifty seats reserved for women, on one page.
 *
 * Each of them already has a seat page and a member page, but nowhere showed
 * the fifty together: who holds them, which party each came from and how they
 * are filled. That last question is the one readers ask, because these members
 * are not elected in a constituency and the ballot never carries their names.
 */

const reserved = members
  .filter((m) => m.seat?.reserved)
  .sort((a, b) => (a.seat?.no ?? 0) - (b.seat?.no ?? 0));

/** Parties holding reserved seats, largest first. */
const byParty = parties
  .map((p) => ({ party: p, held: reserved.filter((m) => m.party?.abbr === p.abbr).length }))
  .filter((x) => x.held > 0)
  .sort((a, b) => b.held - a.held);

export const metadata: Metadata = {
  alternates: { canonical: '/sangrakkhito-ason' },
  openGraph: shareGraph('/sangrakkhito-ason'),
  title: 'সংরক্ষিত নারী আসন',
  description: `ত্রয়োদশ জাতীয় সংসদের ${bn(RESERVED_SEATS)}টি সংরক্ষিত নারী আসনের সংসদ সদস্যদের তালিকা, কে কোন দলের এবং কোন আসনের। সংরক্ষিত আসন কীভাবে ভাগ হয় ও কারা ভোট দেন, তা-ও এই পাতায়।`,
};

const QUESTIONS = [
  {
    q: 'সংরক্ষিত নারী আসন কী',
    a: `সংবিধানের ৬৫ অনুচ্ছেদ অনুযায়ী জাতীয় সংসদে ৩০০টি সাধারণ আসনের বাইরে নারীদের জন্য ${bn(RESERVED_SEATS)}টি আসন সংরক্ষিত থাকে। এই আসনগুলো ধরে সংসদের মোট সদস্যসংখ্যা ৩৫০।`,
  },
  {
    q: 'এই আসনে ভোট দেন কারা',
    a: 'সাধারণ ভোটাররা নন। সাধারণ আসনে নির্বাচিত ৩০০ জন সংসদ সদস্যই এই আসনের নির্বাচকমণ্ডলী। দলগুলো সাধারণ আসনে যত ভাগ আসন পেয়েছে, সেই আনুপাতিক হারে সংরক্ষিত আসন ভাগ হয়। তাই ব্যালটে এই সদস্যদের নাম থাকে না।',
  },
  {
    q: 'একজন নারী কি সাধারণ আসনেও দাঁড়াতে পারেন',
    a: `পারেন। সংরক্ষিত আসন বাড়তি সুযোগ, সীমা নয়। এই সংসদে ${bn(statistics().womenTerritorial)} জন নারী সাধারণ আসনে সরাসরি ভোটে জিতে এসেছেন।`,
  },
  {
    q: 'সংরক্ষিত আসনের সদস্যের দায়িত্ব কি আলাদা',
    a: 'না। সংসদে ভোট দেওয়া, বিল আনা, প্রশ্ন করা, কমিটিতে বসা, সবই সাধারণ আসনের সদস্যদের মতোই। পার্থক্য শুধু নির্বাচিত হওয়ার পদ্ধতিতে, আর নির্দিষ্ট কোনো নির্বাচনী এলাকা না থাকায়।',
  },
];

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QUESTIONS.map((x) => ({
    '@type': 'Question',
    name: x.q,
    acceptedAnswer: { '@type': 'Answer', text: x.a },
  })),
};

export default function ReservedSeatsPage() {
  const stats = statistics();
  const filled = reserved.length;

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <PageHead
        eyebrow="ত্রয়োদশ জাতীয় সংসদ"
        title="সংরক্ষিত নারী আসন"
        lede={`সংবিধান অনুযায়ী সংসদে নারীদের জন্য ${bn(RESERVED_SEATS)}টি আসন সংরক্ষিত। এই আসনে সাধারণ ভোটাররা ভোট দেন না; সাধারণ আসনে জেতা দলগুলোর আনুপাতিক হারে আসনগুলো ভাগ হয়, আর নির্বাচিত ৩০০ সংসদ সদস্য ভোট দিয়ে সদস্য বেছে নেন।`}
        aside={
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <Stat label="সংরক্ষিত আসন" value={bn(RESERVED_SEATS)} />
            <Stat label="মোট নারী সদস্য" value={bn(stats.women)} note={`সাধারণ আসনে ${bn(stats.womenTerritorial)} জন`} />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}/sangrakkhito-ason`}
          title="সংরক্ষিত নারী আসন | আমার এমপি"
          text={`ত্রয়োদশ জাতীয় সংসদের ${bn(RESERVED_SEATS)}টি সংরক্ষিত নারী আসনের সংসদ সদস্যরা`}
        />
      </div>

      <Card className="mt-8 p-5 sm:p-6">
        <h2 className="display text-[17px]">কোন দল কতটি পেয়েছে</h2>
        <p className="mt-1 text-[13.5px] text-muted leading-relaxed">
          সাধারণ আসনে দলগুলোর ভাগ অনুযায়ী। দলের পাতায় তার সব সদস্যের তালিকা আছে।
        </p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {byParty.map(({ party, held }) => (
            <li key={party.abbr}>
              <Link
                href={`/dol/${party.slug}`}
                className="group flex items-center gap-3 py-1.5 hover:text-brand transition-colors"
              >
                <PartyDot abbr={party.abbr} />
                <span className="grow min-w-0 truncate text-[14.5px] font-semibold text-inksoft group-hover:text-brand">
                  {party.nameBn ?? party.abbr}
                </span>
                <span aria-hidden="true" className="hidden sm:block w-40 h-2 rounded-full bg-sunk overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(held / RESERVED_SEATS) * 100}%`, background: partyColor(party.abbr) }}
                  />
                </span>
                <span className="tnum shrink-0 text-[14.5px] font-bold text-ink w-12 text-end">{bn(held)}টি</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <section className="mt-10">
        <h2 className="display text-[19px]">
          সংরক্ষিত আসনের সংসদ সদস্য
          <span className="ms-2 text-[14px] text-muted font-normal tnum">{bn(filled)} জন</span>
        </h2>
        <ul className="mt-4 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {reserved.map((m) => (
            <li key={m.id}>
              <MemberCard m={m} badge={m.seat?.nameBn ?? undefined} />
            </li>
          ))}
        </ul>
      </section>

      <section className="pb-12">
        <h2 className="display text-[19px]">প্রশ্ন ও উত্তর</h2>
        <div className="mt-4 flex flex-col gap-3">
          {QUESTIONS.map((x) => (
            <Card key={x.q} className="p-5">
              <h3 className="display text-[16px]">{x.q}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-inksoft text-pretty">{x.a}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted leading-relaxed">
          সূত্র: গণপ্রজাতন্ত্রী বাংলাদেশের সংবিধান, ৬৫ অনুচ্ছেদ; সদস্যদের নাম ও দল বাংলাদেশ জাতীয় সংসদের তথ্য থেকে।{' '}
          <DocLink href="https://www.parliament.gov.bd">parliament.gov.bd</DocLink>
        </p>
      </section>
    </Page>
  );
}
