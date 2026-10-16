import type { Committee } from './data';
import type { Lang } from '@/i18n/core';
import { COMMITTEE_TYPE, committeeName } from '@/i18n/names';

/*
 * What each committee does (owner, 2026-09-12). The parliament's data gives
 * only a committee's name, type and members, so the duties here are the
 * Rules of Procedure of Parliament (English, as amended; parliament.gov.bd),
 * put into plain Bangla, rule by rule, plus Article 76 of the Constitution
 * for the two committees it requires. Nothing is added that the rules do not
 * say; a special committee's task is set by the motion that creates it, so
 * its entry says only that.
 *
 * The English beside each entry follows the rules' own English wording
 * wherever it can, so the English page says what the Bangla says.
 */
export const RULES_URL = 'https://www.parliament.gov.bd/parliament-business/rules-of-procedure';

export type CommitteeDuty = {
  /** One or two sentences, for the committee list and the page's lead. */
  summary: string;
  duties: string[];
  /** How the committee is made up, where the rules say something worth knowing. */
  note?: string;
  /** Where the duties come from, e.g. "বিধি ২৩৩-২৩৪". */
  rule: string;
  /** A sub-committee's parent committee; `name` is in the duty's language. */
  parent?: { slug: string; nameBn: string; name: string };
};

export const TYPE_BN: Record<string, string> = {
  'Parliamentary Committee': 'সংসদীয় কমিটি',
  'Ministry Related Standing Committee': 'মন্ত্রণালয় সম্পর্কিত স্থায়ী কমিটি',
};
export const typeBn = (type: string | null | undefined) => (type ? TYPE_BN[type] ?? type : null);
export const typeEn = (type: string | null | undefined) => (type ? COMMITTEE_TYPE[type]?.en ?? type : null);
/** The committee's type in either language. */
export const typeName = (type: string | null | undefined, lang: Lang = 'bn') => (lang === 'en' ? typeEn(type) : typeBn(type));

const PUBLIC_ACCOUNTS: CommitteeDuty = {
  summary:
    'সংসদের মঞ্জুর করা টাকা সরকার আইন মেনে ও নির্ধারিত খাতে খরচ করেছে কি না, তা মহা হিসাব-নিরীক্ষকের প্রতিবেদনসহ পরীক্ষা করে। সংবিধান অনুযায়ী এই কমিটি থাকা বাধ্যতামূলক।',
  duties: [
    'সরকারের ব্যয়ের জন্য সংসদের মঞ্জুর করা অর্থের উপযোজন হিসাব, সরকারের বার্ষিক আর্থিক হিসাব এবং সংসদে পেশ করা অন্যান্য হিসাব পরীক্ষা করা।',
    'মহা হিসাব-নিরীক্ষক ও নিয়ন্ত্রকের প্রতিবেদন দেখে নিশ্চিত হওয়া যে টাকা আইনত পাওয়া গিয়েছিল ও নির্ধারিত কাজেই খরচ হয়েছে, ব্যয় অনুমোদন মেনে হয়েছে এবং পুনঃউপযোজন নিয়ম মেনে হয়েছে।',
    'রাষ্ট্রায়ত্ত করপোরেশন ও সরকারি বাণিজ্যিক প্রকল্পের আয়-ব্যয়, স্থিতিপত্র ও লাভ-ক্ষতির হিসাব পরীক্ষা করা।',
    'প্রতিষ্ঠানের অনিয়ম ও ত্রুটি খতিয়ে দেখে প্রতিকারের সুপারিশসহ সংসদে প্রতিবেদন দেওয়া।',
  ],
  rule: 'সংবিধানের ৭৬ অনুচ্ছেদ; বিধি ২৩৩-২৩৪',
};

/** A sub-committee of any committee: rule 196. */
const subCommittee = (parent: { slug: string; nameBn: string }): CommitteeDuty => ({
  summary: `${parent.nameBn}র একটি উপ-কমিটি। মূল কমিটি যে নির্দিষ্ট বিষয় খতিয়ে দেখতে দেয়, তা পরীক্ষা করে।`,
  duties: [
    'মূল কমিটির পাঠানো নির্দিষ্ট বিষয় বা প্রশ্ন মূল কমিটির সমান ক্ষমতা নিয়ে পরীক্ষা করা।',
    'উপ-কমিটির প্রতিবেদন মূল কমিটি বিবেচনা করে; পুরো কমিটির বৈঠকে অনুমোদিত হলে সেটি মূল কমিটির প্রতিবেদন হিসেবে গণ্য হয়।',
  ],
  rule: 'বিধি ১৯৬',
  parent: { ...parent, name: parent.nameBn },
});

/** The committees the rules name one by one, by slug. */
const BY_SLUG: Record<string, CommitteeDuty> = {
  'business-advisory-committee': {
    summary: 'সংসদে সরকারি বিল ও অন্যান্য কাজের কোন ধাপে কত সময় আলোচনা হবে, তার সুপারিশ করে। স্পিকার এর সভাপতি।',
    duties: [
      'স্পিকার সংসদ নেতার সঙ্গে পরামর্শ করে যেসব সরকারি বিল ও অন্যান্য কাজ পাঠান, সেগুলোর আলোচনার সময় বরাদ্দের সুপারিশ করা।',
      'প্রস্তাবিত সময়সূচিতে বিল বা কাজের কোন ধাপ কখন শেষ হবে তা নির্দিষ্ট করা।',
      'স্পিকারের দেওয়া অন্যান্য দায়িত্ব পালন করা।',
    ],
    note: 'স্পিকার নিজেসহ সর্বোচ্চ ১৫ জন সদস্য নিয়ে কমিটি মনোনীত করেন এবং নিজেই সভাপতি থাকেন।',
    rule: 'বিধি ২১৯-২২১',
  },
  'committee-on-private-members-bills-and-resolutions': {
    summary:
      'মন্ত্রী নন এমন সংসদ সদস্যদের (বেসরকারি সদস্য) আনা বিল ও সিদ্ধান্ত-প্রস্তাব পরীক্ষা করে, গুরুত্ব অনুযায়ী ভাগ করে এবং আলোচনার সময়ের সুপারিশ করে।',
    duties: [
      'কোনো বেসরকারি সদস্য সংবিধান সংশোধনের বিল আনতে চাইলে, সেটি উত্থাপনের অনুমতির প্রস্তাব কার্যসূচিতে ওঠার আগে পরীক্ষা করা।',
      'উত্থাপিত সব বেসরকারি বিল আলোচনার আগে পরীক্ষা করে প্রকৃতি, জরুরিতা ও গুরুত্ব অনুযায়ী ‘ক’ ও ‘খ’ দুই শ্রেণিতে ভাগ করা।',
      'প্রতিটি বেসরকারি বিলের আলোচনার সময় এবং কোন ধাপ কখন শেষ হবে তার সুপারিশ করা।',
      'বেসরকারি সদস্যদের সিদ্ধান্ত-প্রস্তাব আলোচনার সময়সীমার সুপারিশ করা।',
    ],
    rule: 'বিধি ২২২-২২৪',
  },
  'house-committee': {
    summary: 'সংসদ সদস্যদের আবাসন এবং সংসদ সদস্য ভবনে থাকা, খাওয়া, চিকিৎসাসহ অন্যান্য সুবিধা দেখাশোনা করে। এর ভূমিকা পরামর্শমূলক।',
    duties: [
      'সংসদ সদস্যদের আবাসন সংক্রান্ত সব প্রশ্ন দেখা।',
      'সংসদ সদস্য ভবনে থাকা, খাবার, চিকিৎসা ও অন্যান্য সুবিধা তদারক করা।',
      'এর আবাসন উপ-কমিটি সদস্যদের বাসা বরাদ্দ নিয়ে পরামর্শ দেয়।',
    ],
    note: 'স্পিকার সভাপতিসহ সর্বোচ্চ ১২ জন সদস্য নিয়ে কমিটি মনোনীত করেন।',
    rule: 'বিধি ২৪৯-২৫২',
  },
  'library-committee': {
    summary: 'সংসদ লাইব্রেরির উন্নয়ন ও সেবা নিয়ে পরামর্শ দেয়, যাতে সংসদ সদস্যরা লাইব্রেরি পুরোপুরি কাজে লাগাতে পারেন।',
    duties: [
      'স্পিকারের পাঠানো লাইব্রেরি সংক্রান্ত বিষয় বিবেচনা করে পরামর্শ দেওয়া।',
      'লাইব্রেরির উন্নয়নের প্রস্তাব বিবেচনা করা।',
      'সংসদ সদস্যদের লাইব্রেরির সেবা পুরোপুরি কাজে লাগাতে সহায়তা করা।',
    ],
    rule: 'বিধি ২৫৭-২৫৮',
  },
  'special-committee': {
    summary: 'নির্দিষ্ট কোনো বিষয় দেখার জন্য সংসদ প্রস্তাব পাস করে বিশেষ কমিটি গঠন করে; এর সদস্য ও দায়িত্ব সেই প্রস্তাবেই ঠিক হয়।',
    duties: ['সংসদের গঠন-প্রস্তাবে যে বিষয় ও দায়িত্ব নির্ধারিত আছে, তা পালন করা।'],
    rule: 'বিধি ২৬৬',
  },
  'special-committee-on-reformation-of-constitution': {
    summary: 'সংবিধান সংশোধনের বিষয়ে কাজ করতে সংসদ এই বিশেষ কমিটি গঠন করেছে। বিশেষ কমিটির সদস্য ও দায়িত্ব সংসদ প্রস্তাব পাস করে ঠিক করে দেয়।',
    duties: ['সংসদের গঠন-প্রস্তাবে নির্ধারিত দায়িত্ব অনুযায়ী সংবিধান সংশোধনের বিষয় বিবেচনা করা।'],
    rule: 'বিধি ২৬৬',
  },
  'standing-committee-of-privileges': {
    summary:
      'সংসদ বা সংসদ সদস্যদের বিশেষ অধিকার (প্রিভিলেজ) লঙ্ঘনের অভিযোগ পরীক্ষা করে সুপারিশ দেয়। সংবিধান অনুযায়ী এই কমিটি থাকা বাধ্যতামূলক।',
    duties: [
      'সংসদ যে প্রশ্ন পাঠায়, তাতে বিশেষ অধিকার লঙ্ঘন হয়েছে কি না ঘটনার তথ্য দেখে নির্ধারণ করা।',
      'লঙ্ঘন হলে তার ধরন ও কোন পরিস্থিতিতে ঘটেছে তা জানিয়ে সুপারিশ দেওয়া; সুপারিশ কার্যকর করতে সংসদ কী পদ্ধতি নেবে তাও প্রতিবেদনে বলা যায়।',
    ],
    note: 'প্রতিটি সংসদ তার প্রথম অধিবেশনে সর্বোচ্চ ১০ জন সদস্য নিয়ে এই কমিটি নিয়োগ করে।',
    rule: 'সংবিধানের ৭৬ অনুচ্ছেদ; বিধি ২৪০-২৪৩',
  },
  'standing-committee-on-public-accounts': PUBLIC_ACCOUNTS,
  'public-accounts-committee-pac': PUBLIC_ACCOUNTS,
  'committee-on-estimates': {
    summary: 'সরকারের বাজেট প্রাক্কলন পরীক্ষা করে খরচ সাশ্রয়, দক্ষতা বাড়ানো ও প্রশাসনিক সংস্কারের পথ সুপারিশ করে।',
    duties: [
      'কমিটির উপযুক্ত মনে হওয়া বা সংসদের পাঠানো প্রাক্কলন পরীক্ষা করা।',
      'প্রাক্কলনের নীতির মধ্যে থেকে কী ধরনের সাশ্রয়, সাংগঠনিক উন্নতি, দক্ষতা বা প্রশাসনিক সংস্কার সম্ভব তা জানানো।',
      'প্রশাসনে দক্ষতা ও সাশ্রয় আনতে বিকল্প নীতির পরামর্শ দেওয়া।',
      'নীতির সীমার মধ্যে টাকা ঠিকভাবে বরাদ্দ হয়েছে কি না দেখা, এবং প্রাক্কলন সংসদে কোন আকারে পেশ হবে তার সুপারিশ করা।',
    ],
    note: 'কমিটিতে সর্বোচ্চ ১০ জন সদস্য থাকেন।',
    rule: 'বিধি ২৩৫-২৩৭',
  },
  'committee-on-government-assurances': {
    summary: 'মন্ত্রীরা সংসদে যেসব প্রতিশ্রুতি দেন, সেগুলো কতটা এবং কত দ্রুত বাস্তবায়িত হলো তা যাচাই করে সংসদকে জানায়।',
    duties: [
      'মন্ত্রীদের সংসদে দেওয়া আশ্বাস, প্রতিশ্রুতি ও অঙ্গীকার খতিয়ে দেখা।',
      'সেগুলো কতটা বাস্তবায়িত হয়েছে, আর বাস্তবায়িত হলে প্রয়োজনীয় ন্যূনতম সময়ের মধ্যে হয়েছে কি না, তা নিয়ে প্রতিবেদন দেওয়া।',
    ],
    note: 'সংসদ সর্বোচ্চ ৮ জন সদস্য নিয়ে কমিটি নিয়োগ করে।',
    rule: 'বিধি ২৪৪-২৪৫',
  },
  'committee-on-petitions': {
    summary: 'সংসদে পেশ করা পিটিশন (আবেদন) পরীক্ষা করে, তাতে থাকা অভিযোগ নিয়ে সংসদে প্রতিবেদন দেয় এবং প্রতিকারের সুনির্দিষ্ট প্রস্তাব করে।',
    duties: [
      'কমিটিতে পাঠানো প্রতিটি পিটিশন পরীক্ষা করা; নিয়ম মানা পিটিশন সদস্যদের মধ্যে বিতরণের নির্দেশ দিতে পারে।',
      'পিটিশনে থাকা নির্দিষ্ট অভিযোগ নিয়ে সংসদে প্রতিবেদন দেওয়া এবং প্রতিকারের সুনির্দিষ্ট ব্যবস্থার প্রস্তাব করা।',
    ],
    note: 'স্পিকার অন্তত ১০ জন সদস্য নিয়ে কমিটি মনোনীত করেন; কোনো মন্ত্রী এর সদস্য হতে পারেন না।',
    rule: 'বিধি ২৩১-২৩২',
  },
  'committee-on-public-undertakings': {
    summary: 'রাষ্ট্রায়ত্ত প্রতিষ্ঠানগুলোর হিসাব ও কাজ পরীক্ষা করে, সেগুলো সুষ্ঠু ব্যবসায়িক নীতিতে চলছে কি না দেখে এবং অনিয়ম দূর করার সুপারিশ করে।',
    duties: [
      'কার্যপ্রণালী বিধির চতুর্থ তফসিলে থাকা সরকারি প্রতিষ্ঠানের প্রতিবেদন ও হিসাব পরীক্ষা করা।',
      'এসব প্রতিষ্ঠান নিয়ে মহা হিসাব-নিরীক্ষকের প্রতিবেদন পরীক্ষা করা।',
      'প্রতিষ্ঠানগুলো সুষ্ঠু ব্যবসায়িক নীতি ও বিবেচনাপূর্ণ বাণিজ্যিক রীতিতে চলছে কি না দেখা, আর অনিয়মের প্রতিকার ও প্রতিষ্ঠানকে দুর্নীতিমুক্ত করার সুপারিশসহ সংসদে প্রতিবেদন দেওয়া।',
      'সরকারের বড় নীতিগত বিষয় এবং দৈনন্দিন প্রশাসন এই কমিটির পরীক্ষার বাইরে।',
    ],
    note: 'সংসদ সর্বোচ্চ ১০ জন সদস্য নির্বাচন করে; কোনো মন্ত্রী এর সদস্য হতে পারেন না।',
    rule: 'বিধি ২৩৮-২৩৯',
  },
  'standing-committee-on-rules-of-procedure': {
    summary: 'সংসদের কার্যপদ্ধতি ও কাজ পরিচালনার বিষয় বিবেচনা করে এবং কার্যপ্রণালী বিধিতে প্রয়োজনীয় সংশোধনের সুপারিশ করে। স্পিকার এর সভাপতি।',
    duties: [
      'সংসদের কার্যপদ্ধতি ও কাজ পরিচালনা সংক্রান্ত বিষয় বিবেচনা করা।',
      'কার্যপ্রণালী বিধিতে সংযোজন, পরিবর্তন, প্রতিস্থাপন বা বাতিলের সুপারিশ করা; কমিটির প্রতিবেদন সংসদে পেশ হয়।',
    ],
    note: 'সংসদ সভাপতিসহ ১২ জন সদস্য নিয়ে কমিটি নিয়োগ করে; স্পিকার পদাধিকারবলে সভাপতি।',
    rule: 'বিধি ২৬৩-২৬৫',
  },
};

/* ---------------- English ---------------- */

const PUBLIC_ACCOUNTS_EN: CommitteeDuty = {
  summary:
    'Examines, with the reports of the Comptroller and Auditor-General, whether the Government has spent the money granted by Parliament lawfully and on the purposes it was granted for. The Constitution requires this committee.',
  duties: [
    'Examining the accounts showing the appropriation of sums granted by Parliament for the expenditure of the Government, the annual finance accounts of the Government and other accounts laid before Parliament.',
    'Satisfying itself, from the reports of the Comptroller and Auditor-General, that the money was legally available for, and spent on, the purpose to which it was applied, that the expenditure conforms to the authority which governs it, and that every re-appropriation was made in accordance with the rules.',
    'Examining the statements of income and expenditure, balance sheets and profit and loss accounts of state corporations and government trading schemes and projects.',
    'Looking into irregularities and faults in these bodies, and reporting to Parliament with recommendations to remedy them.',
  ],
  rule: 'Article 76 of the Constitution; rules 233–234',
};

/** A sub-committee of any committee: rule 196. */
const subCommitteeEn = (parent: { slug: string; nameBn: string; name: string }): CommitteeDuty => ({
  summary: `A sub-committee of the ${parent.name}. It examines the particular matters the parent committee refers to it.`,
  duties: [
    'Examining the particular matters or questions referred to it by the parent committee, with the same powers as the parent committee.',
    "The parent committee considers the sub-committee's report; if it is approved at a meeting of the whole committee, it is treated as the report of the parent committee.",
  ],
  rule: 'rule 196',
  parent,
});

const BY_SLUG_EN: Record<string, CommitteeDuty> = {
  'business-advisory-committee': {
    summary: 'Recommends how much time Parliament should spend discussing each stage of Government Bills and other business. The Speaker is its chair.',
    duties: [
      'Recommending the time to be allotted for discussing the Government Bills and other business that the Speaker, in consultation with the Leader of the House, refers to it.',
      'Indicating in the proposed timetable when each stage of a Bill or other business is to be completed.',
      'Carrying out any other functions the Speaker assigns to it.',
    ],
    note: 'The Speaker nominates the committee, of not more than 15 members including the Speaker, and is its chair.',
    rule: 'rules 219–221',
  },
  'committee-on-private-members-bills-and-resolutions': {
    summary:
      'Examines the Bills and resolutions brought by Members of Parliament who are not Ministers (private members), classifies them by importance and recommends time for their discussion.',
    duties: [
      'When a private member seeks to bring a Bill to amend the Constitution, examining it before the motion for leave to introduce it is included in the list of business.',
      "Examining every private member's Bill after it is introduced and before it is discussed, and classifying it by its nature, urgency and importance into one of two categories, A and B.",
      "Recommending the time for discussing each private member's Bill and when each of its stages is to be completed.",
      "Recommending the time limit for discussing private members' resolutions.",
    ],
    rule: 'rules 222–224',
  },
  'house-committee': {
    summary: "Looks after the housing of Members of Parliament and the accommodation, food, medical care and other amenities in the members' hostels. Its role is advisory.",
    duties: [
      'Dealing with all questions relating to the accommodation of Members of Parliament.',
      "Supervising the accommodation, food, medical care and other amenities in the members' hostels.",
      'Its accommodation sub-committee advises on the allotment of housing to members.',
    ],
    note: 'The Speaker nominates the committee, of not more than 12 members including the chair.',
    rule: 'rules 249–252',
  },
  'library-committee': {
    summary: 'Advises on the development and services of the Parliament Library, so that Members of Parliament can make full use of it.',
    duties: [
      'Considering and advising on matters concerning the Library referred to it by the Speaker.',
      'Considering proposals for the improvement of the Library.',
      'Helping Members of Parliament make full use of the services of the Library.',
    ],
    rule: 'rules 257–258',
  },
  'special-committee': {
    summary: 'Parliament sets up a special committee, by passing a motion, to look into a particular matter; that motion fixes its members and its task.',
    duties: ['Carrying out the matters and duties set out in the motion of Parliament that set it up.'],
    rule: 'rule 266',
  },
  'special-committee-on-reformation-of-constitution': {
    summary: "Parliament has set up this special committee to work on amending the Constitution. Parliament fixes a special committee's members and task by passing a motion.",
    duties: ['Considering the amendment of the Constitution, in line with the task set out in the motion of Parliament that set it up.'],
    rule: 'rule 266',
  },
  'standing-committee-of-privileges': {
    summary:
      'Examines complaints of breach of the privileges of Parliament or of its members, and makes recommendations. The Constitution requires this committee.',
    duties: [
      'Determining, from the facts of the case, whether a question referred to it by Parliament involves a breach of privilege.',
      'If it does, stating the nature of the breach and the circumstances leading to it, and making recommendations; the report may also state the procedure Parliament is to follow in giving effect to them.',
    ],
    note: 'Each Parliament appoints this committee, of not more than 10 members, at its first session.',
    rule: 'Article 76 of the Constitution; rules 240–243',
  },
  'standing-committee-on-public-accounts': PUBLIC_ACCOUNTS_EN,
  'public-accounts-committee-pac': PUBLIC_ACCOUNTS_EN,
  'committee-on-estimates': {
    summary: "Examines the Government's budget estimates and recommends ways to make economies, improve efficiency and reform administration.",
    duties: [
      'Examining such estimates as it thinks fit or as Parliament refers to it.',
      'Reporting what economies, improvements in organisation, efficiency or administrative reform, consistent with the policy underlying the estimates, can be made.',
      'Suggesting alternative policies to bring about efficiency and economy in administration.',
      'Examining whether the money is well laid out within the limits of the policy, and recommending the form in which the estimates are to be presented to Parliament.',
    ],
    note: 'The committee has not more than 10 members.',
    rule: 'rules 235–237',
  },
  'committee-on-government-assurances': {
    summary: 'Checks how far, and how quickly, the promises Ministers make in Parliament have been carried out, and reports to Parliament.',
    duties: [
      'Scrutinising the assurances, promises and undertakings given by Ministers in Parliament.',
      'Reporting on the extent to which they have been implemented and, where implemented, whether this was done within the minimum time necessary.',
    ],
    note: 'Parliament appoints the committee, of not more than 8 members.',
    rule: 'rules 244–245',
  },
  'committee-on-petitions': {
    summary: 'Examines petitions presented to Parliament, reports to Parliament on the complaints they make and proposes specific remedies.',
    duties: [
      'Examining every petition referred to it; it may direct that a petition that complies with the rules be circulated to members.',
      'Reporting to Parliament on specific complaints made in a petition and proposing specific remedial measures.',
    ],
    note: 'The Speaker nominates the committee, of at least 10 members; no Minister may be a member.',
    rule: 'rules 231–232',
  },
  'committee-on-public-undertakings': {
    summary: 'Examines the accounts and work of state-owned undertakings, checks whether they are run on sound business principles and recommends how to remove irregularities.',
    duties: [
      'Examining the reports and accounts of the public undertakings listed in the Fourth Schedule to the Rules of Procedure.',
      'Examining the reports of the Comptroller and Auditor-General on these undertakings.',
      'Checking whether the undertakings are managed in accordance with sound business principles and prudent commercial practices, and reporting to Parliament with recommendations to remedy irregularities and rid the undertakings of corruption.',
      "Matters of major government policy and day-to-day administration are outside the committee's examination.",
    ],
    note: 'Parliament elects not more than 10 members; no Minister may be a member.',
    rule: 'rules 238–239',
  },
  'standing-committee-on-rules-of-procedure': {
    summary: 'Considers matters of procedure and the conduct of business in Parliament, and recommends any amendments needed to the Rules of Procedure. The Speaker is its chair.',
    duties: [
      'Considering matters of procedure and the conduct of business in Parliament.',
      "Recommending additions to, changes in, substitutions in or repeals of the Rules of Procedure; the committee's report is presented to Parliament.",
    ],
    note: 'Parliament appoints the committee, of 12 members including the chair; the Speaker is its chair ex officio.',
    rule: 'rules 263–265',
  },
};

/*
 * The parliament's records spell "য়" both as one code point and as য + nukta,
 * so names are compared in NFC (which always splits it).
 */
const nfc = (s: string | null | undefined) => (s ?? '').normalize('NFC');
const MINISTRY = nfc('মন্ত্রণালয়');

/** "ভূমি মন্ত্রণালয়" from "ভূমি মন্ত্রণালয় সম্পর্কিত (সংসদীয়) স্থায়ী কমিটি" or a sub-committee's name. */
function ministryOf(nameBn: string): string | null {
  const name = nfc(nameBn);
  const at = name.indexOf(MINISTRY);
  return at > 0 ? name.slice(0, at + MINISTRY.length) : null;
}

/** Every standing committee on a ministry has the same duties, for its own ministry. */
function ministryCommittee(ministry: string): CommitteeDuty {
  return {
    summary: `${ministry}ের কাজ সংসদের পক্ষে তদারক করে; মন্ত্রণালয়ের বিল ও কাজকর্ম পর্যালোচনা করে, অনিয়ম ও গুরুতর অভিযোগ তদন্ত করে এবং সুপারিশ দেয়।`,
    duties: [
      'সংসদের পাঠানো বিল ও অন্যান্য বিষয় এবং খসড়া বিল ও আইনের প্রস্তাব পরীক্ষা করা।',
      `${ministry}ের কাজকর্ম পর্যালোচনা করা।`,
      'মন্ত্রণালয়ের কোনো কার্যক্রম, অনিয়ম বা গুরুতর অভিযোগ তদন্ত করা এবং সুপারিশ দেওয়া।',
      'আইনের প্রয়োগ পর্যালোচনা করে তা কার্যকর করার উপায় প্রস্তাব করা।',
    ],
    note: 'কমিটি অন্তত মাসে একবার বৈঠকে বসে। সংসদ সভাপতিসহ সর্বোচ্চ ১০ জন সদস্য নিয়োগ করে; কোনো মন্ত্রী এর সভাপতি হতে পারেন না, তবে সংশ্লিষ্ট মন্ত্রী পদাধিকারবলে সদস্য।',
    rule: 'সংবিধানের ৭৬ অনুচ্ছেদ; বিধি ২৪৬-২৪৮',
  };
}

/** "Ministry of Land" from "Standing Committee on Ministry of Land" (or "…on Expatriates' Welfare…", which leaves "Ministry of" out). */
function ministryEnOf(nameEn: string | null | undefined): string | null {
  const name = tidy(nameEn);
  const m = /\bMinistry of (.+)$/i.exec(name) ?? /^Standing Committee on (?:the )?(.+)$/i.exec(name);
  return m ? `Ministry of ${m[1]!.replace(/\.$/, '')}` : null;
}

function ministryCommitteeEn(ministryEn: string | null): CommitteeDuty {
  const ministry = ministryEn ? `the ${ministryEn}` : 'its ministry';
  return {
    summary: `Oversees the work of ${ministry} on behalf of Parliament: it reviews the ministry's Bills and work, inquires into irregularities and serious complaints, and makes recommendations.`,
    duties: [
      'Examining Bills and other matters referred to it by Parliament, and draft Bills and other legislative proposals.',
      `Reviewing the work of ${ministry}.`,
      'Inquiring into any activity, irregularity or serious complaint concerning the ministry, and making recommendations.',
      'Reviewing the enforcement of laws and proposing measures for their enforcement.',
    ],
    note: 'The committee meets at least once a month. Parliament appoints not more than 10 members, including the chair; no Minister may chair it, but the Minister concerned is a member ex officio.',
    rule: 'Article 76 of the Constitution; rules 246–248',
  };
}

/** The source's English names carry doubled spaces and stray full stops ("Sub-Committee No. 5 of  Library Committee"). */
const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
/** A committee's name in the page's language; the English tidied of the source's doubled spaces and closing full stop. */
export const committeeTitle = (c: { nameBn?: string | null; nameEn?: string | null } | null | undefined, lang: Lang = 'bn') =>
  lang === 'en' ? tidy(committeeName(c, 'en')).replace(/([a-z]{3,})\.$/i, '$1') : committeeName(c, 'bn');

/** What a committee does, in Bangla (the default) or English. */
export function committeeDuty(c: Committee, all: Committee[], lang: Lang = 'bn'): CommitteeDuty | null {
  const en = lang === 'en';
  const own = (en ? BY_SLUG_EN : BY_SLUG)[c.slug];
  if (own) return own;
  const name = nfc(c.nameBn);
  const sub = (p: { slug: string; nameBn: string; nameEn?: string | null }) =>
    en ? subCommitteeEn({ slug: p.slug, nameBn: p.nameBn, name: committeeTitle(p, 'en') }) : subCommittee({ slug: p.slug, nameBn: p.nameBn });

  if (/উপ-কমিটি|সাব-কমিটি/.test(name)) {
    if (/^লাইব্রের[ীি] কমিটি/.test(name)) {
      const lib = all.find((x) => x.slug === 'library-committee');
      return sub({ slug: lib?.slug ?? 'library-committee', nameBn: lib?.nameBn ?? 'লাইব্রেরি কমিটি', nameEn: lib?.nameEn ?? 'Library Committee' });
    }
    const ministry = ministryOf(name);
    const parent = ministry
      ? all.find((x) => x.type === 'Ministry Related Standing Committee' && nfc(x.nameBn).startsWith(ministry))
      : undefined;
    if (parent?.nameBn) return sub({ slug: parent.slug, nameBn: parent.nameBn, nameEn: parent.nameEn });
    return null;
  }

  if (c.type === 'Ministry Related Standing Committee') {
    const ministry = ministryOf(name);
    if (!ministry) return null;
    return en ? ministryCommitteeEn(ministryEnOf(c.nameEn)) : ministryCommittee(ministry);
  }
  return null;
}
