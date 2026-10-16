import type { Party } from './data';
import type { Lang } from '@/i18n/core';
import { inLang } from '@/i18n/content';

/*
 * Who founded each party, when and how, what it has done since, and who leads
 * it now (owner, 2026-09-11). The parliament's data has none of this. Every
 * fact below is from the party's Bangla and English Wikipedia articles, read
 * on the `checked` date.
 *
 * - Where the two disagreed, the more specific one was taken (BJP: 5 August
 *   2001 in the English article's history, not the Bangla infobox's "2000").
 * - Where a fact was contradicted or stated by neither, it was left out: PSM
 *   names no founder; Khelafat Majlis's two addresses conflict; JAGPA's
 *   founding place differs (Baitul Mukarram / Ramna); JAGPA's symbol is named
 *   only in one infobox. "Won a seat for the first time in 2026" is dropped
 *   for BKM, KM and IMB, because the same articles record a 1991 seat won
 *   under the Islami Oikya Jote banner.
 * - The text covers founding, leadership, elections and government,
 *   registration, alliances and the current parliament. Wikipedia's ideology
 *   labels and every party's evaluative criticism are left out alike: the site
 *   describes, it does not rate. Documented history that is part of how a
 *   party came to be stays in (Jamaat's predecessor opposed independence in
 *   1971, which is why it re-formed in 1979).
 *
 * An editor can change any of these in the admin panel; that override wins.
 *
 * Each Bangla text has its English beside it (`summaryEn` beside `summaryBn`),
 * translated sentence for sentence with the same facts. People are named as
 * they and the English press spell themselves, and as data/members.json
 * spells the members (Andaleeve, Prodhan); electoral symbols as the Election
 * Commission's English lists name them.
 */
export type PartyProfile = {
  /** One or two sentences for the party list. */
  summaryBn?: string;
  summaryEn?: string;
  /** The party's story for its own page; paragraphs split by a blank line. */
  originBn?: string;
  originEn?: string;
  /** YYYY-MM-DD, or YYYY when only the year is known. */
  foundedOn?: string;
  /** Several founders are joined with " ও " (English: " and "). */
  founderBn?: string;
  founderEn?: string;
  /** NCP's founders are two organisations, not people. */
  founderKind?: 'person' | 'org';
  symbolBn?: string;
  symbolEn?: string;
  leaderTitleBn?: string;
  leaderTitleEn?: string;
  leaderNameBn?: string;
  leaderNameEn?: string;
  /** Set when the leader sits in this parliament, to link their profile. */
  leaderMemberId?: string;
  secretaryTitleBn?: string;
  secretaryTitleEn?: string;
  secretaryNameBn?: string;
  secretaryNameEn?: string;
  secretaryMemberId?: string;
  headquartersBn?: string;
  headquartersEn?: string;
  website?: string;
  sources: string[];
  checked: string;
};

/** The fields an editor can change, under the same names on the party object. */
export const PROFILE_KEYS = [
  'summaryBn', 'originBn', 'foundedOn', 'founderBn', 'symbolBn', 'leaderTitleBn', 'leaderNameBn',
  'secretaryTitleBn', 'secretaryNameBn', 'headquartersBn', 'website',
] as const;
type ProfileKey = (typeof PROFILE_KEYS)[number];

const wiki = (lang: 'bn' | 'en', title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const CHECKED = '2026-09-11';

export const PARTY_PROFILES: Record<string, PartyProfile> = {
  // The owner's own wording (2026-09-12), with "ছয়বার" made "পাঁচবার" to agree with its own list of wins.
  BNP: {
    summaryBn: 'জিয়াউর রহমানের প্রতিষ্ঠিত দল, পাঁচবার জাতীয় নির্বাচনে জয়ী এবং ২০২৬ সালের নির্বাচনের পর থেকে সরকারে।',
    summaryEn: 'Founded by Ziaur Rahman, the party has won five general elections and has been in government since the 2026 election.',
    originBn:
      'তৎকালীন রাষ্ট্রপতি জিয়াউর রহমান ১৯৭৮ সালের ১ সেপ্টেম্বর ঢাকার রমনা রেস্তোরাঁয় এক সংবাদ সম্মেলনে ঘোষণাপত্র পড়ে দলটির যাত্রা শুরু করেন। এর কয়েক দিন আগে তাঁর সমর্থনে গড়া জাতীয়তাবাদী গণতান্ত্রিক দল (জাগদল) বিলুপ্ত হয়ে নতুন দলে মিশে যায়। প্রথম মহাসচিব ছিলেন অধ্যাপক একিউএম বদরুদ্দোজা চৌধুরী।\n\n' +
      '১৯৮১ সালে জিয়াউর রহমান নিহত হওয়ার পর খালেদা জিয়া দলের হাল ধরেন এবং ১৯৮৩ সাল থেকে নেতৃত্ব দেন; তিনি বাংলাদেশের প্রথম নারী প্রধানমন্ত্রী। ২০১৮ থেকে ২০২৫ সাল পর্যন্ত তারেক রহমান ভারপ্রাপ্ত চেয়ারম্যান ছিলেন; ২০২৫ সালে খালেদা জিয়ার মৃত্যুর পর তিনি চেয়ারম্যান হন এবং ২০২৬ সালের নির্বাচনে ঢাকা-১৭ আসন থেকে জয়ী হয়ে প্রধানমন্ত্রী হয়েছেন।\n\n' +
      'দলটি ১৯৭৯, ১৯৯১, ১৯৯৬ (ফেব্রুয়ারি), ২০০১ ও ২০২৬ সালের জাতীয় নির্বাচনে জয়ী হয়। ১৯৯৬ সালের ফেব্রুয়ারির নির্বাচনের পর গঠিত সরকার অল্প কিছুদিন টিকেছিল। ২০০৮, ২০১৪, ২০১৮ ও ২০২৪ সালের নির্বাচনে দলটি হয় হেরেছে, নয় অংশ নেয়নি।',
    originEn:
      'Ziaur Rahman, then President, launched the party on 1 September 1978 by reading out its manifesto at a press conference at the Ramna Restaurant in Dhaka. A few days earlier the Jatiyatabadi Ganatantrik Dal (JAGODAL), formed in his support, had been dissolved and merged into the new party. Its first secretary general was Professor A Q M Badruddoza Chowdhury.\n\n' +
      "After Ziaur Rahman was killed in 1981, Khaleda Zia took charge of the party and led it from 1983; she was Bangladesh's first woman Prime Minister. Tarique Rahman was acting chairman from 2018 to 2025; after Khaleda Zia's death in 2025 he became chairman, and having won the Dhaka-17 seat in the 2026 election he became Prime Minister.\n\n" +
      'The party won the general elections of 1979, 1991, 1996 (February), 2001 and 2026. The government formed after the February 1996 election lasted only a short time. In the elections of 2008, 2014, 2018 and 2024 the party either lost or did not take part.',
    foundedOn: '1978-09-01',
    founderBn: 'জিয়াউর রহমান',
    founderEn: 'Ziaur Rahman',
    founderKind: 'person',
    symbolBn: 'ধানের শীষ',
    symbolEn: 'Sheaf of paddy',
    leaderTitleBn: 'চেয়ারম্যান',
    leaderTitleEn: 'Chairman',
    leaderNameBn: 'তারেক রহমান',
    leaderNameEn: 'Tarique Rahman',
    leaderMemberId: '013019001',
    secretaryTitleBn: 'মহাসচিব (ভারপ্রাপ্ত)',
    secretaryTitleEn: 'Acting Secretary General',
    secretaryNameBn: 'রুহুল কবির রিজভী',
    secretaryNameEn: 'Ruhul Kabir Rizvi',
    headquartersBn: '২৮/১ নয়াপল্টন, ঢাকা',
    headquartersEn: '28/1 Naya Paltan, Dhaka',
    website: 'https://www.bnpbd.org',
    sources: [wiki('bn', 'বাংলাদেশ জাতীয়তাবাদী দল'), wiki('en', 'Bangladesh Nationalist Party')],
    checked: CHECKED,
  },
  BJEI: {
    summaryBn:
      'দেশের সবচেয়ে বড় ইসলামপন্থী রাজনৈতিক দল, বর্তমান রূপে ১৯৭৯ সালে গঠিত। ২০২৬ সালের নির্বাচনের পর থেকে জাতীয় সংসদে প্রধান বিরোধী দল।',
    summaryEn: "The country's largest Islamist political party, established in its present form in 1979. Since the 2026 election it has been the main opposition party in Parliament.",
    originBn:
      'দলটির উৎস ১৯৪১ সালে সৈয়দ আবুল আলা মওদুদীর প্রতিষ্ঠিত জামায়াতে ইসলামী। ১৯৭১ সালে এর পূর্বসূরি জামায়াতে ইসলামী পাকিস্তান বাংলাদেশের স্বাধীনতার বিরোধিতা করে পাকিস্তানি বাহিনীর পক্ষ নেয়। স্বাধীনতার পর ধর্মভিত্তিক রাজনীতি নিষিদ্ধ হলে এর নেতাকর্মীরা কিছুদিন ইসলামিক ডেমোক্রেটিক লীগের সঙ্গে যুক্ত ছিলেন; ১৯৭৯ সালের ২৭ মে ঢাকার হোটেল ইডেনে বাংলাদেশ জামায়াতে ইসলামী নামে দলটি আত্মপ্রকাশ করে, ভারপ্রাপ্ত আমির হন আব্বাস আলী খান।\n\n' +
      '১৯৯০ সালের গণ-অভ্যুত্থান ও তত্ত্বাবধায়ক সরকারের দাবির আন্দোলনে দলটি অংশ নেয়; ২০০১ সালে বিএনপির নেতৃত্বে চারদলীয় জোট সরকারে এর দুজন নেতা মন্ত্রী হন। ২০০৯ সালের পর ১৯৭১ সালের যুদ্ধাপরাধের মামলায় দলের কয়েকজন শীর্ষ নেতার বিচার হয়, ২০১৩ সালে হাইকোর্টের রায়ে নিবন্ধন অবৈধ ঘোষিত হয় এবং ২০২৪ সালের ১ আগস্ট সরকার দলটিকে নিষিদ্ধ করে। জুলাই অভ্যুত্থানের পর ২৮ আগস্ট ২০২৪ সেই নিষেধাজ্ঞা উঠে যায়, আর ২০২৫ সালের ১ জুন আপিল বিভাগের রায়ের পর নিবন্ধন ও দাঁড়িপাল্লা প্রতীক ফিরে আসে।',
    originEn:
      "The party's origin is the Jamaat-e-Islami founded by Syed Abul A'la Maududi in 1941. In 1971 its predecessor, Jamaat-e-Islami Pakistan, opposed the independence of Bangladesh and sided with the Pakistani forces. When religion-based politics was banned after independence, its leaders and activists were for a time associated with the Islamic Democratic League; on 27 May 1979 the party emerged under the name Bangladesh Jamaat-e-Islami at Hotel Eden in Dhaka, with Abbas Ali Khan as acting Ameer.\n\n" +
      'The party took part in the 1990 mass uprising and in the movement demanding a caretaker government; in 2001 two of its leaders became ministers in the BNP-led four-party alliance government. After 2009 several of its top leaders were tried in 1971 war crimes cases, in 2013 a High Court verdict declared its registration illegal, and on 1 August 2024 the government banned the party. After the July uprising the ban was lifted on 28 August 2024, and following an Appellate Division verdict on 1 June 2025 its registration and its scales symbol were restored.',
    foundedOn: '1979-05-27',
    founderBn: 'আব্বাস আলী খান',
    founderEn: 'Abbas Ali Khan',
    founderKind: 'person',
    symbolBn: 'দাঁড়িপাল্লা',
    symbolEn: 'Scales',
    leaderTitleBn: 'আমির',
    leaderTitleEn: 'Ameer',
    leaderNameBn: 'শফিকুর রহমান',
    leaderNameEn: 'Shafiqur Rahman',
    leaderMemberId: '013018801',
    secretaryTitleBn: 'সেক্রেটারি জেনারেল',
    secretaryTitleEn: 'Secretary General',
    secretaryNameBn: 'মিয়া গোলাম পরওয়ার',
    secretaryNameEn: 'Mia Golam Parwar',
    headquartersBn: '৫০৫ এলিফ্যান্ট রোড, মগবাজার, ঢাকা',
    headquartersEn: '505 Elephant Road, Moghbazar, Dhaka',
    website: 'https://jamaat-e-islami.org',
    sources: [wiki('bn', 'বাংলাদেশ জামায়াতে ইসলামী'), wiki('en', 'Bangladesh Jamaat-e-Islami')],
    checked: CHECKED,
  },
  NCP: {
    summaryBn:
      '২০২৪ সালের জুলাই অভ্যুত্থানের নেতৃত্ব দেওয়া তরুণদের গড়া দল, ২০২৫ সালে প্রতিষ্ঠিত। ২০২৬ সালের নির্বাচনে জামায়াতের নেতৃত্বাধীন ১১ দলীয় জোটের শরিক হিসেবে অংশ নেয়।',
    summaryEn: 'A party formed by the young people who led the July 2024 uprising, founded in 2025. It contested the 2026 election as a member of the Jamaat-led 11-party alliance.',
    originBn:
      '২০২৪ সালের ছাত্র-জনতার অভ্যুত্থানে আওয়ামী লীগ সরকারের পতনের পর বৈষম্যবিরোধী ছাত্র আন্দোলন একটি নতুন রাজনৈতিক বন্দোবস্তের কথা বলে। সে বছরের সেপ্টেম্বরে আখতার হোসেন ও নাসীরুদ্দীন পাটওয়ারীর নেতৃত্বে জাতীয় নাগরিক কমিটি গঠিত হয়, এরপর দেশজুড়ে থানা পর্যায়ে কমিটি গড়ার কাজ চলে।\n\n' +
      '২০২৫ সালের ২৮ ফেব্রুয়ারি এই দুই সংগঠনের উদ্যোগে জাতীয় নাগরিক পার্টি আত্মপ্রকাশ করে, আহ্বায়ক হন নাহিদ ইসলাম; এটিকে দেশের প্রথম ছাত্র-নেতৃত্বাধীন রাজনৈতিক দল বলা হয়। দলটি নির্বাচনী প্রতীক হিসেবে শাপলা কলি পায় এবং ২০২৫ সালের ২৮ ডিসেম্বর জামায়াতের নেতৃত্বাধীন ১১ দলীয় জোটে যোগ দিয়ে ২০২৬ সালের নির্বাচনে অংশ নেয়।',
    originEn:
      'After the Awami League government fell in the 2024 uprising of students and the people, Students Against Discrimination spoke of a new political settlement. In September that year the Jatiya Nagorik Committee was formed under the leadership of Akhter Hossen and Nasiruddin Patwary, and committees were then set up at thana level across the country.\n\n' +
      "The National Citizen Party was launched on 28 February 2025 on the initiative of these two organisations, with Nahid Islam as convener; it is described as the country's first student-led political party. The party was given the water lily bud as its electoral symbol, and on 28 December 2025 it joined the Jamaat-led 11-party alliance and contested the 2026 election.",
    foundedOn: '2025-02-28',
    founderBn: 'বৈষম্যবিরোধী ছাত্র আন্দোলন ও জাতীয় নাগরিক কমিটি',
    founderEn: 'Students Against Discrimination and Jatiya Nagorik Committee',
    founderKind: 'org',
    symbolBn: 'শাপলা কলি',
    symbolEn: 'Water lily bud',
    leaderTitleBn: 'আহ্বায়ক',
    leaderTitleEn: 'Convener',
    leaderNameBn: 'নাহিদ ইসলাম',
    leaderNameEn: 'Nahid Islam',
    leaderMemberId: '013018401',
    secretaryTitleBn: 'সদস্য সচিব',
    secretaryTitleEn: 'Member Secretary',
    secretaryNameBn: 'আখতার হোসেন',
    secretaryNameEn: 'Akhter Hossen',
    secretaryMemberId: '013002201',
    headquartersBn: 'রূপায়ণ ট্রেড সেন্টার, ১১৪ কাজী নজরুল ইসলাম এভিনিউ, বাংলামোটর, ঢাকা',
    headquartersEn: 'Rupayan Trade Center, 114 Kazi Nazrul Islam Avenue, Banglamotor, Dhaka',
    sources: [wiki('bn', 'জাতীয় নাগরিক পার্টি'), wiki('en', 'National Citizen Party')],
    checked: CHECKED,
  },
  BKM: {
    summaryBn:
      '১৯৮৯ সালে প্রতিষ্ঠিত খেলাফত মজলিস ২০০৫ সালে দুই ভাগ হলে শায়খুল হাদিস আজিজুল হকের অংশটি এই নামে চলে। ২০২৬ সালের নির্বাচনে দুটি আসনে জেতে।',
    summaryEn: "When Khelafat Majlis, founded in 1989, split in two in 2005, Shaikhul Hadith Azizul Haque's faction carried on under this name. It won two seats in the 2026 election.",
    originBn:
      '১৯৮৯ সালের ৮ ডিসেম্বর ঢাকার ইঞ্জিনিয়ার্স ইনস্টিটিউশন মিলনায়তনে শায়খুল হাদিস আজিজুল হকের খেলাফত আন্দোলন, আহমদ আবদুল কাদেরের ইসলামী যুব শিবির, মাসউদ খানের নেতৃত্বে ন্যাপের একাংশ ও তমদ্দুন মজলিসের সংগঠকেরা মিলে খেলাফত মজলিস গঠন করেন। প্রথম আমির ছিলেন মাওলানা আবদুল গফফার, পরে আমির হন আজিজুল হক।\n\n' +
      '২০০৫ সালে বিএনপির নেতৃত্বাধীন চারদলীয় জোটে থাকা নিয়ে দলটি দুই ভাগ হয়: জোটে থাকা অংশটি খেলাফত মজলিস নামে, আর আজিজুল হকের নেতৃত্বে জোট ছেড়ে যাওয়া অংশটি বাংলাদেশ খেলাফত মজলিস নামে চলে। দলটি ২০০৮ সালে নির্বাচন কমিশনে নিবন্ধিত হয়। ২০২৬ সালের নির্বাচনে ১১ দলীয় নির্বাচনী ঐক্যের শরিক হিসেবে দলটি দুটি সংসদীয় আসনে জেতে এবং সংরক্ষিত নারী আসনে একজন সদস্য পায়।',
    originEn:
      "On 8 December 1989, at the Institution of Engineers auditorium in Dhaka, organisers from Shaikhul Hadith Azizul Haque's Khelafat Andolan, Ahmad Abdul Quader's Islami Jubo Shibir, a faction of the National Awami Party (NAP) led by Masud Khan, and Tamaddun Majlish together formed Khelafat Majlis. Its first Ameer was Maulana Abdul Gaffar; Azizul Haque later became Ameer.\n\n" +
      'In 2005 the party split over staying in the BNP-led four-party alliance: the faction that stayed in the alliance carried on as Khelafat Majlis, and the faction that left it under Azizul Haque as Bangladesh Khelafat Majlis. The party was registered with the Election Commission in 2008. In the 2026 election, as a member of the 11-party electoral alliance, it won two parliamentary seats and gained one member in a reserved seat for women.',
    foundedOn: '1989-12-08',
    founderBn: 'শায়খুল হাদিস আজিজুল হক',
    founderEn: 'Shaikhul Hadith Azizul Haque',
    founderKind: 'person',
    symbolBn: 'রিকশা',
    symbolEn: 'Rickshaw',
    leaderTitleBn: 'আমির',
    leaderTitleEn: 'Ameer',
    leaderNameBn: 'মামুনুল হক',
    leaderNameEn: 'Mamunul Haque',
    secretaryTitleBn: 'মহাসচিব',
    secretaryTitleEn: 'Secretary General',
    secretaryNameBn: 'জালালুদ্দীন আহমেদ',
    secretaryNameEn: 'Jalaluddin Ahmed',
    headquartersBn: '৫৯/৩/৩ পুরানা পল্টন, ঢাকা',
    headquartersEn: '59/3/3 Purana Paltan, Dhaka',
    sources: [wiki('bn', 'বাংলাদেশ খেলাফত মজলিস'), wiki('en', 'Khelafat Majlis')],
    checked: CHECKED,
  },
  IMB: {
    summaryBn:
      'চরমোনাই পীর সৈয়দ ফজলুল করিমের ১৯৮৭ সালে শুরু করা ইসলামী শাসনতন্ত্র আন্দোলন থেকে আসা দল, চরমোনাই পীরের দল নামেও পরিচিত। ২০২৬ সালের নির্বাচনে একটি আসনে জেতে।',
    summaryEn: "A party that grew out of the Islami Shasantantra Andolan, started in 1987 by Syed Fazlul Karim, the Pir of Charmonai; it is also known as the Charmonai Pir's party. It won one seat in the 2026 election.",
    originBn:
      '১৯৮৭ সালের ১৩ মার্চ বাংলাদেশ মুজাহিদ কমিটির আমির সৈয়দ ফজলুল করিমের নেতৃত্বে কয়েকটি ইসলামি সংগঠন ও ব্যক্তিত্ব মিলে ইস্যুভিত্তিক আন্দোলন হিসেবে ইসলামী শাসনতন্ত্র আন্দোলন শুরু করেন। শরিকদের মধ্যে অনৈক্যের পর এটি চরমোনাই পীরের নেতৃত্বাধীন একক সংগঠনে পরিণত হয় এবং ১৯৯১ সাল থেকে পূর্ণাঙ্গ রাজনৈতিক দল হিসেবে কাজ করছে।\n\n' +
      '২০০৮ সালের ২০ নভেম্বর দলটি ইসলামী আন্দোলন বাংলাদেশ নামে নির্বাচন কমিশনে নিবন্ধিত হয়; নির্বাচনী প্রতীক হাতপাখা। ২০০৬ সাল থেকে দলের আমির সৈয়দ রেজাউল করিম। ২০২৬ সালের নির্বাচনে দলটির একজন প্রার্থী সংসদ সদস্য নির্বাচিত হন।',
    originEn:
      'On 13 March 1987, under the leadership of Syed Fazlul Karim, Ameer of the Bangladesh Mujahid Committee, several Islamic organisations and figures together started the Islami Shasantantra Andolan as an issue-based movement. After disunity among its partners it became a single organisation led by the Pir of Charmonai, and it has worked as a full political party since 1991.\n\n' +
      "On 20 November 2008 the party was registered with the Election Commission under the name Islami Andolan Bangladesh; its electoral symbol is the hand fan. Syed Rezaul Karim has been the party's Ameer since 2006. In the 2026 election one of its candidates was elected a Member of Parliament.",
    foundedOn: '1987-03-13',
    founderBn: 'সৈয়দ ফজলুল করিম (চরমোনাই পীর)',
    founderEn: 'Syed Fazlul Karim (Pir of Charmonai)',
    founderKind: 'person',
    symbolBn: 'হাতপাখা',
    symbolEn: 'Hand fan',
    leaderTitleBn: 'আমির',
    leaderTitleEn: 'Ameer',
    leaderNameBn: 'সৈয়দ রেজাউল করিম',
    leaderNameEn: 'Syed Rezaul Karim',
    secretaryTitleBn: 'মহাসচিব',
    secretaryTitleEn: 'Secretary General',
    secretaryNameBn: 'গাজী আতাউর রহমান',
    secretaryNameEn: 'Gazi Ataur Rahman',
    headquartersBn: '৫৫/বি নোয়াখালী টাওয়ার, পুরানা পল্টন, ঢাকা',
    headquartersEn: '55/B Noakhali Tower, Purana Paltan, Dhaka',
    sources: [wiki('bn', 'ইসলামী আন্দোলন বাংলাদেশ'), wiki('en', 'Islami Andolan Bangladesh')],
    checked: CHECKED,
  },
  GOP: {
    summaryBn:
      '২০১৮ সালের কোটা সংস্কার আন্দোলন থেকে উঠে আসা দল, ২০২১ সালে প্রতিষ্ঠিত। নেতৃত্বে ডাকসুর সাবেক সহসভাপতি নুরুল হক নুর।',
    summaryEn: "A party that grew out of the 2018 quota reform movement, founded in 2021. It is led by Nurul Haque Nur, a former vice-president of the Dhaka University Central Students' Union (DUCSU).",
    originBn:
      '২০১৮ সালের ১৭ ফেব্রুয়ারি কোটা সংস্কার আন্দোলনের নেতারা বাংলাদেশ সাধারণ ছাত্র অধিকার সংরক্ষণ পরিষদ গড়ে তোলেন, পরে যার নাম হয় বাংলাদেশ ছাত্র অধিকার পরিষদ। ২০১৯ সালের ডাকসু নির্বাচনে এই আন্দোলনের নেতা নুরুল হক নুর সহসভাপতি (ভিপি) নির্বাচিত হন।\n\n' +
      '২০২১ সালের ২৬ অক্টোবর অর্থনীতিবিদ ড. রেজা কিবরিয়া ও নুরুল হক নুরের নেতৃত্বে গণঅধিকার পরিষদ রাজনৈতিক দল হিসেবে আত্মপ্রকাশ করে। ২০২৩ সালে নেতৃত্ব নিয়ে বিরোধে দলটি দুই ভাগ হলে নুরুল হক সভাপতি নির্বাচিত হন, আর বছরের শেষে রেজা কিবরিয়া দল ছাড়েন। ২০২৪ সালের ২ সেপ্টেম্বর ট্রাক প্রতীকসহ দলটি নির্বাচন কমিশনের নিবন্ধন পায়।',
    originEn:
      "On 17 February 2018 leaders of the quota reform movement formed the Bangladesh Sadharan Chhatra Odhikar Sangrakkhan Parishad, later renamed Bangladesh Chhatra Odhikar Parishad. In the 2019 election of the Dhaka University Central Students' Union (DUCSU), the movement's leader Nurul Haque Nur was elected vice-president (VP).\n\n" +
      'On 26 October 2021 Gono Odhikar Parishad was launched as a political party under the leadership of the economist Dr Reza Kibria and Nurul Haque Nur. When the party split in two in 2023 in a dispute over its leadership, Nurul Haque was elected president, and at the end of that year Reza Kibria left the party. On 2 September 2024 the party received Election Commission registration, with the truck as its symbol.',
    foundedOn: '2021-10-26',
    founderBn: 'নুরুল হক নুর ও রেজা কিবরিয়া',
    founderEn: 'Nurul Haque Nur and Reza Kibria',
    founderKind: 'person',
    symbolBn: 'ট্রাক',
    symbolEn: 'Truck',
    leaderTitleBn: 'সভাপতি',
    leaderTitleEn: 'President',
    leaderNameBn: 'নুরুল হক নুর',
    leaderNameEn: 'Nurul Haque Nur',
    leaderMemberId: '013011301',
    secretaryTitleBn: 'সাধারণ সম্পাদক',
    secretaryTitleEn: 'General Secretary',
    secretaryNameBn: 'হাসান আল মামুন',
    secretaryNameEn: 'Hasan Al Mamun',
    headquartersBn: 'আল-রাজী কমপ্লেক্স, বিজয়নগর, পুরানা পল্টন, ঢাকা',
    headquartersEn: 'Al-Razi Complex, Bijoynagar, Purana Paltan, Dhaka',
    website: 'https://gonoodhikar.com',
    sources: [wiki('bn', 'গণঅধিকার পরিষদ'), wiki('en', 'Gono Odhikar Parishad')],
    checked: CHECKED,
  },
  BJP: {
    summaryBn:
      'জাতীয় পার্টি থেকে বেরিয়ে নাজিউর রহমান মঞ্জুর ২০০১ সালে দলটি গড়েন; এখন নেতৃত্বে তাঁর ছেলে ব্যারিস্টার আন্দালিব রহমান পার্থ।',
    summaryEn: 'Naziur Rahman Manzur formed the party in 2001 after leaving the Jatiya Party; it is now led by his son, Barrister Andaleeve Rahman Partho.',
    originBn:
      'নাজিউর রহমান মঞ্জুর মুক্তিযুদ্ধে অংশ নেন, এরশাদ সরকারের মন্ত্রী ও ঢাকার মেয়র ছিলেন এবং ১৯৯৮ থেকে ২০০১ সাল পর্যন্ত জাতীয় পার্টির মহাসচিবের দায়িত্বে ছিলেন। চেয়ারম্যান হুসেইন মুহম্মদ এরশাদের সঙ্গে নীতিগত মতভেদের পর তিনি ২০০১ সালের ৫ আগস্ট বাংলাদেশ জাতীয় পার্টি গঠন করেন, তাই দলটি জাতীয় পার্টি (নাজিউর) নামেও পরিচিত।\n\n' +
      'দলটি বিএনপির নেতৃত্বাধীন চারদলীয় জোটের শরিক হিসেবে ২০০১ সালের নির্বাচনে চারটি আসন পায় এবং পরে ২০ দলীয় জোটে থাকে; ২০১৯ সালে সেই জোট ছাড়ে। ২০০৮ সালে দলের চেয়ারম্যান ব্যারিস্টার আন্দালিব রহমান পার্থ ভোলা থেকে সংসদ সদস্য নির্বাচিত হন।',
    originEn:
      "Naziur Rahman Manzur took part in the Liberation War, was a minister in the Ershad government and Mayor of Dhaka, and was secretary general of the Jatiya Party from 1998 to 2001. After differences over policy with the party's chairman, Hussain Muhammad Ershad, he formed the Bangladesh Jatiya Party on 5 August 2001, which is why the party is also known as Jatiya Party (Naziur).\n\n" +
      "As a member of the BNP-led four-party alliance the party won four seats in the 2001 election, and it later stayed in the 20-party alliance; it left that alliance in 2019. In 2008 the party's chairman, Barrister Andaleeve Rahman Partho, was elected a Member of Parliament from Bhola.",
    foundedOn: '2001-08-05',
    founderBn: 'নাজিউর রহমান মঞ্জুর',
    founderEn: 'Naziur Rahman Manzur',
    founderKind: 'person',
    symbolBn: 'গরুর গাড়ি',
    symbolEn: 'Bullock cart',
    leaderTitleBn: 'চেয়ারম্যান',
    leaderTitleEn: 'Chairman',
    leaderNameBn: 'আন্দালিব রহমান পার্থ',
    leaderNameEn: 'Andaleeve Rahman Partho',
    leaderMemberId: '013011501',
    secretaryTitleBn: 'মহাসচিব',
    secretaryTitleEn: 'Secretary General',
    secretaryNameBn: 'আব্দুল মতিন সাউদ',
    secretaryNameEn: 'Abdul Matin Saud',
    headquartersBn: '৫০ ডি আই টি এক্সটেনশন রোড, নয়াপল্টন, ঢাকা',
    headquartersEn: '50 DIT Extension Road, Naya Paltan, Dhaka',
    sources: [wiki('bn', 'বাংলাদেশ জাতীয় পার্টি'), wiki('en', 'Bangladesh Jatiya Party')],
    checked: CHECKED,
  },
  KM: {
    summaryBn:
      '১৯৮৯ সালে প্রতিষ্ঠিত খেলাফত মজলিসের যে অংশ ২০০৫ সালে বিএনপির জোটে থেকে যায়, সেটিই আজকের খেলাফত মজলিস। ২০২৬ সালের নির্বাচনে একটি আসনে জেতে।',
    summaryEn: "Today's Khelafat Majlis is the faction of the Khelafat Majlis founded in 1989 that stayed in the BNP's alliance in 2005. It won one seat in the 2026 election.",
    originBn:
      '১৯৮৯ সালের ৮ ডিসেম্বর ঢাকার আইইবি মিলনায়তনে এক জাতীয় সম্মেলনে খেলাফত মজলিসের আত্মপ্রকাশ; শায়খুল হাদিস আজিজুল হকের নেতৃত্বে আহমদ আবদুল কাদেরের ইসলামী যুব শিবির, ন্যাপের একাংশ ও তমদ্দুন মজলিসের নেতারা এতে যুক্ত হন। ১৯৯০ সালের এরশাদবিরোধী গণ-অভ্যুত্থানে দলটি অংশ নেয়।\n\n' +
      '২০০৫ সালে বিএনপির নেতৃত্বাধীন চারদলীয় জোটে থাকা নিয়ে দলটি দুই ভাগ হয়; জোটে থাকা অংশে আমির হন মুহাম্মদ ইসহাক ও মহাসচিব আহমদ আবদুল কাদের, আর এই অংশটিই খেলাফত মজলিস নামে চলছে। দলটি ২০০৮ সালে নির্বাচন কমিশনে নিবন্ধিত হয়, ২২ বছর বিএনপির জোটে থাকার পর ২০২১ সালে জোট ছাড়ে এবং ২০২৬ সালের নির্বাচনে ১১ দলীয় নির্বাচনী ঐক্যের শরিক হিসেবে একটি আসনে জেতে।',
    originEn:
      "Khelafat Majlis was launched on 8 December 1989 at a national conference in the Institution of Engineers, Bangladesh (IEB) auditorium in Dhaka; under the leadership of Shaikhul Hadith Azizul Haque, leaders of Ahmad Abdul Quader's Islami Jubo Shibir, a faction of the National Awami Party (NAP) and Tamaddun Majlish joined it. The party took part in the 1990 mass uprising against Ershad.\n\n" +
      "In 2005 the party split over staying in the BNP-led four-party alliance; in the faction that stayed, Muhammad Ishaq became Ameer and Ahmad Abdul Quader secretary general, and it is this faction that carries on as Khelafat Majlis. The party was registered with the Election Commission in 2008, left the BNP's alliance in 2021 after 22 years in it, and won one seat in the 2026 election as a member of the 11-party electoral alliance.",
    foundedOn: '1989-12-08',
    founderBn: 'শায়খুল হাদিস আজিজুল হক',
    founderEn: 'Shaikhul Hadith Azizul Haque',
    founderKind: 'person',
    symbolBn: 'দেয়াল ঘড়ি',
    symbolEn: 'Wall clock',
    leaderTitleBn: 'আমির',
    leaderTitleEn: 'Ameer',
    leaderNameBn: 'আব্দুল বাছিত আজাদ',
    leaderNameEn: 'Abdul Basit Azad',
    secretaryTitleBn: 'মহাসচিব',
    secretaryTitleEn: 'Secretary General',
    secretaryNameBn: 'আহমদ আবদুল কাদের',
    secretaryNameEn: 'Ahmad Abdul Quader',
    sources: [wiki('bn', 'খেলাফত মজলিস'), wiki('en', 'Khelafat Majlis')],
    checked: CHECKED,
  },
  PSM: {
    summaryBn:
      'ছাত্র, শ্রমিক, নারী ও কৃষক সংগঠনের যৌথ উদ্যোগে ২০০২ সালে যাত্রা শুরু, ২০১৬ সালে রাজনৈতিক দল। ২০২৬ সালে জোনায়েদ সাকি ব্রাহ্মণবাড়িয়া-৬ আসনে জেতেন।',
    summaryEn: "Started in 2002 as a joint initiative of student, workers', women's and farmers' organisations; a political party since 2016. In 2026 Zonayed Saki won the Brahmanbaria-6 seat.",
    originBn:
      '২০০২ সালের ২৯ আগস্ট বাংলাদেশ ছাত্র ফেডারেশন, নারী সংহতি, গার্মেন্টস শ্রমিক সংহতি, প্রতিবেশ আন্দোলন, কৃষক-মজুর সংহতিসহ কয়েকটি সংগঠন মিলে ‘জনগণের নিজস্ব রাজনৈতিক শক্তি গড়ে তোলার আহ্বান’ নিয়ে গণসংহতি আন্দোলন গড়ে তোলে। ২০১৬ সালের নভেম্বরে তৃতীয় জাতীয় প্রতিনিধি সম্মেলনে এটি আনুষ্ঠানিকভাবে রাজনৈতিক দল হয়, প্রধান সমন্বয়কারী হন জোনায়েদ সাকি।\n\n' +
      'দলটি ২০২৪ সালের জুলাই অভ্যুত্থানে অংশ নেয় এবং সে বছরের ১৭ সেপ্টেম্বর নির্বাচন কমিশনের নিবন্ধন পায়। ২০২৬ সালের নির্বাচনে বিএনপির সঙ্গে সমঝোতায় জোনায়েদ সাকি ব্রাহ্মণবাড়িয়া-৬ আসনে জেতেন; পরে তিনি প্রধান সমন্বয়কারীর পদ ছাড়েন।',
    originEn:
      "On 29 August 2002 several organisations, among them Bangladesh Chhatra Federation, Nari Sanghati, Garments Sramik Sanghati, Protibesh Andolan and Krishak-Majur Sanghati, together formed Ganosamhati Andolan with ‘a call to build the people's own political force’. At its third national delegates' conference in November 2016 it formally became a political party, with Zonayed Saki as chief coordinator.\n\n" +
      'The party took part in the July 2024 uprising and received Election Commission registration on 17 September that year. In the 2026 election, under an understanding with the BNP, Zonayed Saki won the Brahmanbaria-6 seat; he later stepped down as chief coordinator.',
    foundedOn: '2002-08-29',
    symbolBn: 'মাথাল',
    symbolEn: "Mathal (a farmer's hat)",
    leaderTitleBn: 'প্রধান সমন্বয়কারী (ভারপ্রাপ্ত)',
    leaderTitleEn: 'Acting Chief Coordinator',
    leaderNameBn: 'দেওয়ান আব্দুল রশিদ নিলু',
    leaderNameEn: 'Dewan Abdul Rashid Nilu',
    secretaryTitleBn: 'নির্বাহী সমন্বয়কারী',
    secretaryTitleEn: 'Executive Coordinator',
    secretaryNameBn: 'আবুল হাসান রুবেল',
    secretaryNameEn: 'Abul Hasan Rubel',
    headquartersBn: '৩০৬-৩০৭ রোজ ভিউ প্লাজা, ১৮৫ বীর উত্তম সি আর দত্ত রোড, হাতিরপুল, ঢাকা',
    headquartersEn: '306-307 Rose View Plaza, 185 Bir Uttam C R Dutta Road, Hatirpool, Dhaka',
    website: 'https://ganosamhati.com',
    sources: [wiki('bn', 'গণসংহতি আন্দোলন'), wiki('en', 'Ganosanhati Andolan')],
    checked: CHECKED,
  },
  JAGPA: {
    summaryBn:
      'শফিউল আলম প্রধানের ১৯৮০ সালে গড়া দল; দীর্ঘ সময় বিএনপির নেতৃত্বাধীন জোটে ছিল, ২০২৫ সালে ১১ দলীয় নির্বাচনী ঐক্যে যোগ দেয়।',
    summaryEn: 'The party Shafiul Alam Prodhan formed in 1980; it was long part of the BNP-led alliance and joined the 11-party electoral alliance in 2025.',
    originBn:
      'শফিউল আলম প্রধান ১৯৮০ সালের ৬ এপ্রিল ঢাকায় এক সংবাদ সম্মেলনে জাতীয় গণতান্ত্রিক পার্টি (জাগপা) গঠনের ঘোষণা দেন। দলটি বিএনপির নেতৃত্বাধীন ২০ দলীয় জোটের শরিক ছিল; ২০২২ সালের ডিসেম্বরে সেই জোট বিলুপ্ত হলে ১২ দলীয় জোটে থাকে।\n\n' +
      '২০০৮ সালে নির্বাচন কমিশনের নিবন্ধন পেলেও ২০২১ সালের ৩১ জানুয়ারি তা বাতিল হয়; ২০২৫ সালের ১৯ মার্চ হাইকোর্ট সেই বাতিলকে অবৈধ ঘোষণা করে। একই বছর দলটি ১১ দলীয় নির্বাচনী ঐক্যে যোগ দেয়, আর ২০২৬ সালে দলের চেয়ারম্যান তাসমিয়া প্রধান সংরক্ষিত নারী আসনের সংসদ সদস্য হন।',
    originEn:
      'Shafiul Alam Prodhan announced the formation of the Jatiya Ganatantrik Party (JAGPA) at a press conference in Dhaka on 6 April 1980. The party was a member of the BNP-led 20-party alliance; after that alliance was dissolved in December 2022, it continued as part of the 12-party alliance.\n\n' +
      "It received Election Commission registration in 2008, but the registration was cancelled on 31 January 2021; on 19 March 2025 the High Court declared that cancellation illegal. The same year the party joined the 11-party electoral alliance, and in 2026 the party's chairperson, Tasmia Prodhan, became a Member of Parliament in a reserved seat for women.",
    foundedOn: '1980-04-06',
    founderBn: 'শফিউল আলম প্রধান',
    founderEn: 'Shafiul Alam Prodhan',
    founderKind: 'person',
    leaderTitleBn: 'চেয়ারম্যান',
    leaderTitleEn: 'Chairperson',
    leaderNameBn: 'তাসমিয়া প্রধান',
    leaderNameEn: 'Tasmia Prodhan',
    leaderMemberId: '013034701',
    secretaryTitleBn: 'সাধারণ সম্পাদক',
    secretaryTitleEn: 'General Secretary',
    secretaryNameBn: 'ইকবাল হোসেন প্রধান',
    secretaryNameEn: 'Iqbal Hossain Prodhan',
    headquartersBn: 'আসাদ গেট, ঢাকা',
    headquartersEn: 'Asad Gate, Dhaka',
    website: 'https://www.jagpa.org',
    sources: [wiki('bn', 'জাতীয় গণতান্ত্রিক পার্টি'), wiki('en', 'Jatiya Ganotantrik Party')],
    checked: CHECKED,
  },
};

/** The texts of a profile, each in one language. */
const TEXTS = ['summary', 'origin', 'founder', 'symbol', 'leaderTitle', 'leaderName', 'secretaryTitle', 'secretaryName', 'headquarters'] as const;
type TextField = (typeof TEXTS)[number];

/** A profile in one language: `summary` is the Bangla summary on a Bangla page, the English on an English one. */
export type ResolvedProfile = Partial<Record<TextField, string>> &
  Pick<PartyProfile, 'foundedOn' | 'founderKind' | 'leaderMemberId' | 'secretaryMemberId' | 'website' | 'sources' | 'checked'> & {
    /** True when an editor has changed at least one field, so the page does not claim Wikipedia for it. */
    edited: boolean;
  };

/**
 * The profile as the site shows it, in the page's language: an editor's value
 * where one was saved (a cleared field stays cleared), the sourced value
 * otherwise. A changed name no longer links to the member the sourced one was
 * matched to.
 *
 * Editors write in Bangla. On an English page their text shows in the English
 * of data/translations, or not at all: never the Bangla in its place, and
 * never the sourced English of a text the editor has replaced. A saved value
 * identical to the sourced Bangla keeps the sourced English.
 */
export function partyProfile(p: Party, lang: Lang = 'bn'): ResolvedProfile | null {
  const base = PARTY_PROFILES[p.abbr];
  const saved = p as Party & Partial<Record<ProfileKey, string | null>>;
  const touched = PROFILE_KEYS.filter((k) => k in saved);
  if (!base && !touched.some((k) => saved[k])) return null;

  const sfx = lang === 'en' ? 'En' : 'Bn';
  const out: ResolvedProfile = {
    foundedOn: base?.foundedOn,
    founderKind: base?.founderKind,
    leaderMemberId: base?.leaderMemberId,
    secretaryMemberId: base?.secretaryMemberId,
    website: base?.website,
    sources: base?.sources ?? [],
    checked: base?.checked ?? '',
    edited: base ? touched.length > 0 : true,
  };
  for (const f of TEXTS) out[f] = base?.[`${f}${sfx}`];
  for (const k of touched) {
    const v = saved[k];
    if (k === 'foundedOn' || k === 'website') {
      out[k] = v || undefined;
    } else {
      const f = k.replace(/Bn$/, '') as TextField;
      out[f] = !v ? undefined : lang === 'bn' ? v : v === base?.[k] ? base[`${f}En`] : (inLang(v, lang) ?? undefined);
    }
    if (k === 'leaderNameBn') delete out.leaderMemberId;
    if (k === 'secretaryNameBn') delete out.secretaryMemberId;
  }
  for (const key of Object.keys(out) as (keyof ResolvedProfile)[]) if (out[key] === undefined) delete out[key];
  return out;
}

/** Several founders, one by one: the text is joined with " ও " in Bangla and " and " in English. */
export const founderList = (founder: string, lang: Lang) => founder.split(lang === 'en' ? ' and ' : ' ও ');

/** "1978" from "1978-09-01" or "1978". */
export const foundedYear = (profile: { foundedOn?: string } | null) => profile?.foundedOn?.match(/^\d{4}/)?.[0] ?? null;

/** The story's paragraphs. */
export const paragraphs = (text: string | undefined) => (text ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
