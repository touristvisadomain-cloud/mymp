/**
 * The fifty seats reserved for women: who holds them, by party, and the
 * questions readers ask about them, answered from the Constitution. The
 * reserved-seats page and the mobile app read the same facts.
 */
import { members, parties, statistics, RESERVED_SEATS } from '@/lib/data';
import type { T } from '@/i18n/core';

export const reservedMembers = members
  .filter((m) => m.seat?.reserved)
  .sort((a, b) => (a.seat?.no ?? 0) - (b.seat?.no ?? 0));

/** Parties holding reserved seats, largest first. */
export const reservedByParty = parties
  .map((p) => ({ party: p, held: reservedMembers.filter((m) => m.party?.abbr === p.abbr).length }))
  .filter((x) => x.held > 0)
  .sort((a, b) => b.held - a.held);

export function reservedQuestions(t: T) {
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
