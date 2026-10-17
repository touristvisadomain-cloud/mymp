/**
 * The list and site pages' own share cards, by page key: the key is the
 * page's path (/mp is "mp"), the card says the page's name and, where one
 * comes naturally, the one figure the page is about ("৩৪৯ জন সংসদ সদস্য").
 * The card is drawn by src/lib/og/pageCard.tsx at /api/og/pages/<key>; a page
 * takes its share tags from pageShare. (Not /api/og/page/: under a folder named
 * "page" the router never matched the /en twin.)
 *
 * The figures are counted the way the pages count them, from the same data.
 */
import type { Metadata } from 'next';
import { members, parties, committees, currentPosts, posts, RESERVED_SEATS } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { publishedSeats } from '@/lib/electionMap';
import { totalSittings } from '@/lib/activity';
import { normalizeName } from '@/lib/posts/names';
import { cardImage, shareGraph, shareTwitter } from '@/lib/seo';
import type { T } from '@/i18n/core';

export interface PageCardText {
  /** Above the title: the parliament for the data pages, the site for its own pages. */
  kicker: string;
  title: string;
  figure: string | null;
}

const house = (t: T) => t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament of Bangladesh');
const site = (t: T) => t('আমার এমপি', 'My MP');

/** People holding a cabinet title now, counted as the cabinet page counts them: once each, the unplaced ones too. */
function holding(title: string): number {
  const people = new Set<string>();
  for (const r of currentPosts('government')) if (r.title === title) people.add(r.memberId ?? normalizeName(r.nameBn));
  for (const x of posts.pending ?? []) if (x.title === title) people.add(`pending|${normalizeName(x.nameBn)}`);
  return people.size;
}

const seatTotal = () => districtList().reduce((n, d) => n + d.seats.length, 0);

const PAGES = {
  mp: (t: T) => ({ kicker: house(t), title: t('সংসদ সদস্যদের তালিকা', 'Members of Parliament'), figure: t.count(members.length, ' জন সংসদ সদস্য', 'MP', 'MPs') }),
  ason: (t: T) => ({ kicker: house(t), title: t('সংসদীয় আসন ও এমপি', 'Constituencies and their MPs'), figure: t.count(seatTotal(), 'টি সংসদীয় আসন', 'constituency', 'constituencies') }),
  jela: (t: T) => ({ kicker: house(t), title: t('জেলাভিত্তিক আসন ও এমপি', 'Seats and MPs by district'), figure: t.count(districtList().length, 'টি জেলা', 'district', 'districts') }),
  dol: (t: T) => {
    const partyCount = parties.filter((p) => p.abbr !== 'Ind' && p.seats > 0).length;
    const independents = parties.find((p) => p.abbr === 'Ind')?.seats ?? 0;
    return {
      kicker: house(t),
      title: t('সংসদে রাজনৈতিক দল', 'Parties in Parliament'),
      figure: t(`${t.n(partyCount)}টি দল ও ${t.n(independents)} জন স্বতন্ত্র`, `${t.count(partyCount, '', 'party', 'parties')} and ${t.count(independents, '', 'independent', 'independents')}`),
    };
  },
  committee: (t: T) => ({
    kicker: house(t),
    title: t('সংসদীয় কমিটি', 'Parliamentary committees'),
    figure: t.count(committees.filter((c) => c.rosterCurrent).length, 'টি কমিটি', 'committee', 'committees'),
  }),
  ministers: (t: T) => ({
    kicker: t('বাংলাদেশ সরকার', 'Government of Bangladesh'),
    title: t('মন্ত্রিসভা', 'The Cabinet'),
    figure: t(
      `${t.n(holding('মন্ত্রী'))} জন মন্ত্রী ও ${t.n(holding('প্রতিমন্ত্রী'))} জন প্রতিমন্ত্রী`,
      `${t.count(holding('মন্ত্রী'), '', 'minister', 'ministers')} and ${t.count(holding('প্রতিমন্ত্রী'), '', 'state minister', 'state ministers')}`,
    ),
  }),
  nirbachon: (t: T) => ({
    kicker: house(t),
    title: t('জাতীয় সংসদ নির্বাচন ২০২৬', 'The 2026 general election'),
    figure: publishedSeats ? t(`${t.n(publishedSeats)}টি আসনের ফল`, `Results for ${t.count(publishedSeats, '', 'seat', 'seats')}`) : null,
  }),
  parisonkhan: (t: T) => ({ kicker: house(t), title: t('সংসদ সদস্যদের পরিসংখ্যান', 'Statistics on the MPs'), figure: t.count(members.length, ' জন সংসদ সদস্যের হিসাব', 'MP counted', 'MPs counted') }),
  'sangrakkhito-ason': (t: T) => ({ kicker: house(t), title: t('সংরক্ষিত নারী আসনের এমপি', 'Women MPs in reserved seats'), figure: t.count(RESERVED_SEATS, 'টি সংরক্ষিত আসন', 'reserved seat', 'reserved seats') }),
  odhibeshon: (t: T) => {
    const sittings = totalSittings();
    return { kicker: house(t), title: t('সংসদ অধিবেশন', 'Sessions of Parliament'), figure: sittings ? t.count(sittings, 'টি বৈঠক', 'sitting', 'sittings') : null };
  },
  songbad: (t: T) => ({ kicker: house(t), title: t('সংসদ সদস্যদের খবর', 'News about the MPs'), figure: null }),
  sutro: (t: T) => ({ kicker: site(t), title: t('তথ্যসূত্র ও পদ্ধতি', 'Sources and method'), figure: null }),
  somporke: (t: T) => ({ kicker: site(t), title: t('আমার এমপি সম্পর্কে', 'About My MP'), figure: null }),
  jogajog: (t: T) => ({ kicker: site(t), title: t('যোগাযোগ ও সংশোধন', 'Contact and corrections'), figure: null }),
  gopaniyota: (t: T) => ({ kicker: site(t), title: t('গোপনীয়তা নীতি ও ব্যবহারের শর্ত', 'Privacy policy and terms of use'), figure: null }),
} satisfies Record<string, (t: T) => PageCardText>;

export type PageKey = keyof typeof PAGES;
export const isPageKey = (key: string): key is PageKey => Object.prototype.hasOwnProperty.call(PAGES, key);

/** What a page's card says, in the language of `t`. */
export const pageCardText = (key: PageKey, t: T): PageCardText => PAGES[key](t);

/** The share tags of a list page: its own card, at its own address, for Open Graph and X alike. */
export function pageShare(key: PageKey, t: T): Pick<Metadata, 'openGraph' | 'twitter'> {
  const { title, figure } = pageCardText(key, t);
  const image = cardImage(`/api/og/pages/${key}${t.en ? '/en' : ''}`, figure ? `${title}: ${figure}` : title);
  return { openGraph: shareGraph(`/${key}`, image, t.lang), twitter: shareTwitter(image) };
}
