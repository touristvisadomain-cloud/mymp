import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { langAlternates, shareGraph } from '@/lib/seo';
import { members, parties, partyColor, statistics, RESERVED_SEATS } from '@/lib/data';
import { Page, PageHead, Stat, Card, MemberCard, PartyDot, DocLink } from '@/components/ui';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';
import { getT } from '@/i18n/server';
import type { T } from '@/i18n/core';
import { partyName, seatName } from '@/i18n/names';

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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/sangrakkhito-ason'),
    openGraph: shareGraph('/sangrakkhito-ason', undefined, t.lang),
    title: t('সংরক্ষিত নারী আসন', 'Reserved seats for women'),
    description: t(
      `ত্রয়োদশ জাতীয় সংসদের ${t.n(RESERVED_SEATS)}টি সংরক্ষিত নারী আসনের সংসদ সদস্যদের তালিকা, কে কোন দলের এবং কোন আসনের। সংরক্ষিত আসন কীভাবে ভাগ হয় ও কারা ভোট দেন, তা-ও এই পাতায়।`,
      `A list of the Members of Parliament for the ${RESERVED_SEATS} reserved seats for women in the 13th Parliament: each one's party and seat. This page also explains how the reserved seats are shared out and who votes for them.`,
    ),
  };
}

function questions(t: T) {
  const womenTerritorial = statistics().womenTerritorial;
  return [
    {
      q: t('সংরক্ষিত নারী আসন কী', 'What are the reserved seats for women?'),
      a: t(
        `সংবিধানের ৬৫ অনুচ্ছেদ অনুযায়ী জাতীয় সংসদে ৩০০টি সাধারণ আসনের বাইরে নারীদের জন্য ${t.n(RESERVED_SEATS)}টি আসন সংরক্ষিত থাকে। এই আসনগুলো ধরে সংসদের মোট সদস্যসংখ্যা ৩৫০।`,
        `Under Article 65 of the Constitution, ${RESERVED_SEATS} seats in Parliament are reserved for women, in addition to the 300 general seats. Counting these seats, Parliament has 350 members in all.`,
      ),
    },
    {
      q: t('এই আসনে ভোট দেন কারা', 'Who votes for these seats?'),
      a: t(
        'সাধারণ ভোটাররা নন। সাধারণ আসনে নির্বাচিত ৩০০ জন সংসদ সদস্যই এই আসনের নির্বাচকমণ্ডলী। দলগুলো সাধারণ আসনে যত ভাগ আসন পেয়েছে, সেই আনুপাতিক হারে সংরক্ষিত আসন ভাগ হয়। তাই ব্যালটে এই সদস্যদের নাম থাকে না।',
        "Not the ordinary voters. The 300 Members of Parliament elected to the general seats are the electoral college for these seats. The reserved seats are shared out in proportion to each party's share of the general seats. That is why these members' names are never on the ballot.",
      ),
    },
    {
      q: t('একজন নারী কি সাধারণ আসনেও দাঁড়াতে পারেন', 'Can a woman stand for a general seat as well?'),
      a: t(
        `পারেন। সংরক্ষিত আসন বাড়তি সুযোগ, সীমা নয়। এই সংসদে ${t.n(womenTerritorial)} জন নারী সাধারণ আসনে সরাসরি ভোটে জিতে এসেছেন।`,
        `Yes. The reserved seats are an extra opportunity, not a limit. In this Parliament, ${t.count(womenTerritorial, '', 'woman has', 'women have')} won general seats by direct vote.`,
      ),
    },
    {
      q: t('সংরক্ষিত আসনের সদস্যের দায়িত্ব কি আলাদা', 'Are the duties of a member for a reserved seat different?'),
      a: t(
        'না। সংসদে ভোট দেওয়া, বিল আনা, প্রশ্ন করা, কমিটিতে বসা, সবই সাধারণ আসনের সদস্যদের মতোই। পার্থক্য শুধু নির্বাচিত হওয়ার পদ্ধতিতে, আর নির্দিষ্ট কোনো নির্বাচনী এলাকা না থাকায়।',
        'No. Voting in Parliament, bringing bills, asking questions, sitting on committees: all of it is the same as for members for general seats. The only differences are the way they are elected and that they have no constituency of their own.',
      ),
    },
  ];
}

export default async function ReservedSeatsPage() {
  const t = await getT();
  const stats = statistics();
  const filled = reserved.length;
  const QUESTIONS = questions(t);
  const FAQ_LD = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QUESTIONS.map((x) => ({
      '@type': 'Question',
      name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.a },
    })),
  };

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('সংরক্ষিত নারী আসন', 'Reserved seats for women')}
        lede={t(
          `সংবিধান অনুযায়ী সংসদে নারীদের জন্য ${t.n(RESERVED_SEATS)}টি আসন সংরক্ষিত। এই আসনে সাধারণ ভোটাররা ভোট দেন না; সাধারণ আসনে জেতা দলগুলোর আনুপাতিক হারে আসনগুলো ভাগ হয়, আর নির্বাচিত ৩০০ সংসদ সদস্য ভোট দিয়ে সদস্য বেছে নেন।`,
          `Under the Constitution, ${RESERVED_SEATS} seats in Parliament are reserved for women. Ordinary voters do not vote for these seats: they are shared among the parties in proportion to the general seats each won, and the 300 elected Members of Parliament vote to choose the members.`,
        )}
        aside={
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <Stat label={t('সংরক্ষিত আসন', 'Reserved seats')} value={t.n(RESERVED_SEATS)} />
            <Stat
              label={t('মোট নারী সদস্য', 'Women members in all')}
              value={t.n(stats.women)}
              note={t(`সাধারণ আসনে ${t.n(stats.womenTerritorial)} জন`, `${stats.womenTerritorial} in general seats`)}
            />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href('/sangrakkhito-ason')}`}
          title={t('সংরক্ষিত নারী আসন | আমার এমপি', 'Reserved seats for women | My MP')}
          text={t(
            `ত্রয়োদশ জাতীয় সংসদের ${t.n(RESERVED_SEATS)}টি সংরক্ষিত নারী আসনের সংসদ সদস্যরা`,
            `The Members of Parliament for the ${RESERVED_SEATS} reserved seats for women in the 13th Parliament`,
          )}
        />
      </div>

      <Card className="mt-8 p-5 sm:p-6">
        <h2 className="display text-[17px]">{t('কোন দল কতটি পেয়েছে', 'How many each party has')}</h2>
        <p className="mt-1 text-[13.5px] text-muted leading-relaxed">
          {t(
            'সাধারণ আসনে দলগুলোর ভাগ অনুযায়ী। দলের পাতায় তার সব সদস্যের তালিকা আছে।',
            "In proportion to the parties' shares of the general seats. Each party's page lists all its members.",
          )}
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
                  {t.en ? partyName(party, 'en') : party.nameBn ?? party.abbr}
                </span>
                <span aria-hidden="true" className="hidden sm:block w-40 h-2 rounded-full bg-sunk overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(held / RESERVED_SEATS) * 100}%`, background: partyColor(party.abbr) }}
                  />
                </span>
                <span className="tnum shrink-0 text-[14.5px] font-bold text-ink w-12 text-end">{t(`${t.n(held)}টি`, String(held))}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <section className="mt-10">
        <h2 className="display text-[19px]">
          {t('সংরক্ষিত আসনের সংসদ সদস্য', 'Members of Parliament for the reserved seats')}
          <span className="ms-2 text-[14px] text-muted font-normal tnum">{t(`${t.n(filled)} জন`, String(filled))}</span>
        </h2>
        <ul className="mt-4 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {reserved.map((m) => (
            <li key={m.id}>
              <MemberCard m={m} badge={(t.en ? seatName(m.seat, 'en') : m.seat?.nameBn) || undefined} />
            </li>
          ))}
        </ul>
      </section>

      <section className="pb-12">
        <h2 className="display text-[19px]">{t('প্রশ্ন ও উত্তর', 'Questions and answers')}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {QUESTIONS.map((x) => (
            <Card key={x.q} className="p-5">
              <h3 className="display text-[16px]">{x.q}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-inksoft text-pretty">{x.a}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted leading-relaxed">
          {t(
            'সূত্র: গণপ্রজাতন্ত্রী বাংলাদেশের সংবিধান, ৬৫ অনুচ্ছেদ; সদস্যদের নাম ও দল বাংলাদেশ জাতীয় সংসদের তথ্য থেকে।',
            "Sources: the Constitution of the People's Republic of Bangladesh, Article 65; members' names and parties from the Parliament of Bangladesh.",
          )}{' '}
          <DocLink href="https://www.parliament.gov.bd">parliament.gov.bd</DocLink>
        </p>
      </section>
    </Page>
  );
}
