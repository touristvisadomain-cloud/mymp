/**
 * The names of things in either language: members, seats, parties,
 * committees, districts and the House's offices. Small tables only, so client
 * components can use these too. Long texts written in Bangla (biographies,
 * seat boundaries) are translated in data/translations and read through
 * src/i18n/content.ts, on the server.
 *
 * English names come from the source's own English fields wherever it has
 * them (parliament.gov.bd writes every member's, seat's and committee's name
 * in English too). Where the source's English is wrong or garbled, the
 * corrections are here, each with the reason.
 */
import type { Lang } from './core';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toBn = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);

/* ---------------- people ---------------- */

/** parliament.gov.bd writes 81 members' English names in capitals ("MD. NURUL HAQUE"); pages show them in title case. */
export function titleCaseName(s: string | null | undefined): string | null {
  if (!s) return null;
  // Stray spaces the source leaves around hyphens and before full stops: "Md Anwar - ul - Islam", "A . E. Sultan".
  s = s.replace(/\s*-\s*/g, '-').replace(/\s+\./g, '.').replace(/\s{2,}/g, ' ').trim();
  if (s !== s.toUpperCase() || !/[A-Z]{2}/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s.\-('])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}

/**
 * English names the source garbles, by member id: initials written with
 * commas, a missing space after "Md.", a misspelt title. Spelling of the name
 * itself is always the source's.
 */
const NAME_EN_FIX: Record<string, string> = {
  '013001001': 'A Z M Rezwanul Haque', // source: "A, Z, M, Rezwanul Haque"
  '013006201': 'Md. Salim Reza', // source: "Md.Salim Reza"
  '013023001': 'Mst. Tahsina Rushdir', // source: "Mst.Tahsina Rushdir"
  '013016301': 'Advocate Md. Jalal Uddin', // source: "ADVOCAT MD. JALAL UDDIN"
};

type Named = { id?: string; nameBn?: string | null; nameEn?: string | null };

/** A member's (or any person's) name in the page's language; the other language's name only when there is no other. */
export function personName(p: Named | null | undefined, lang: Lang): string {
  if (!p) return '';
  if (lang === 'en') return (p.id && NAME_EN_FIX[p.id]) || titleCaseName(p.nameEn) || p.nameBn || '';
  return p.nameBn || titleCaseName(p.nameEn) || '';
}

/** The name in the other language, shown under the main one on a profile; null when it is missing. */
export function otherName(p: Named | null | undefined, lang: Lang): string | null {
  if (!p) return null;
  return lang === 'en' ? p.nameBn || null : (p.id && NAME_EN_FIX[p.id]) || titleCaseName(p.nameEn);
}

/* ---------------- seats and districts ---------------- */

/**
 * District names as English readers know them, where the source's seat names
 * spell them otherwise ("ChapaiNawabganj-1"). The page addresses keep the
 * source's spelling, so links do not change.
 */
const DISTRICT_EN_DISPLAY: Record<string, string> = {
  ChapaiNawabganj: 'Chapai Nawabganj',
  "Cox'sBazar": "Cox's Bazar",
  Chittagong: 'Chattogram',
};

export const districtNameEn = (en: string) => DISTRICT_EN_DISPLAY[en] ?? en;

type SeatLike = { no?: number; nameBn?: string | null; nameEn?: string | null; reserved?: boolean } | null | undefined;

/**
 * "পঞ্চগড়-২" / "Panchagarh-2". The source writes a few English seat names
 * unevenly ("Pabna 5", "ChapaiNawabganj-1") and the reserved seats as
 * "Women Seat-1"; those read "Pabna-5", "Chapai Nawabganj-1", "Women's Seat-1".
 */
export function seatName(s: SeatLike, lang: Lang): string {
  if (!s) return '';
  if (lang === 'bn') return s.nameBn || s.nameEn || '';
  const raw = (s.nameEn || '').trim();
  const women = /^Women\s*Seat[\s-]*(\d+)$/i.exec(raw);
  if (women) return `Women's Seat-${women[1]}`;
  const m = /^(.*?)[\s-]*(\d+)$/.exec(raw);
  if (m) return `${districtNameEn(m[1]!.trim())}-${m[2]}`;
  return districtNameEn(raw) || s.nameBn || '';
}

/** "পঞ্চগড়" / "Panchagarh", for a district from districtOf or districtGroups. */
export function districtName(d: { bn: string; en: string } | null | undefined, lang: Lang): string {
  if (!d) return '';
  return lang === 'en' ? districtNameEn(d.en) : d.bn;
}

/* ---------------- parties ---------------- */

/**
 * The parties' names in English as they and the English press write them.
 * The source's English names are partly literal translations nobody uses
 * ("Council on People" for Gono Odhikar Parishad, "Islamic Movement
 * Bangladesh" for Islami Andolan Bangladesh), so the site keeps its own.
 */
const PARTY_EN: Record<string, { full: string; short: string }> = {
  BNP: { full: 'Bangladesh Nationalist Party (BNP)', short: 'BNP' },
  BJEI: { full: 'Bangladesh Jamaat-e-Islami', short: 'Jamaat-e-Islami' },
  Ind: { full: 'Independent', short: 'Independent' },
  INDEPENDENT: { full: 'Independent', short: 'Independent' },
  NCP: { full: 'National Citizen Party (NCP)', short: 'NCP' },
  BKM: { full: 'Bangladesh Khelafat Majlis', short: 'Bangladesh Khelafat Majlis' },
  IMB: { full: 'Islami Andolan Bangladesh', short: 'Islami Andolan' },
  IAB: { full: 'Islami Andolan Bangladesh', short: 'Islami Andolan' },
  GOP: { full: 'Gono Odhikar Parishad (GOP)', short: 'Gono Odhikar Parishad' },
  BJP: { full: 'Bangladesh Jatiya Party (BJP)', short: 'BJP' },
  KM: { full: 'Khelafat Majlis', short: 'Khelafat Majlis' },
  PSM: { full: 'Ganosamhati Andolan', short: 'Ganosamhati Andolan' },
  GSA: { full: 'Ganosamhati Andolan', short: 'Ganosamhati Andolan' },
  JAGPA: { full: 'Jatiya Ganatantrik Party (JAGPA)', short: 'JAGPA' },
  // Parties of earlier parliaments (data/history.json).
  BAL: { full: 'Bangladesh Awami League', short: 'Awami League' },
  JP: { full: 'Jatiya Party', short: 'Jatiya Party' },
  'JP(ERSHAD)': { full: 'Jatiya Party (Ershad)', short: 'Jatiya Party (Ershad)' },
  'JP(NA-FI)': { full: 'Jatiya Party (Naziur-Firoz)', short: 'Jatiya Party (N-F)' },
  CO: { full: 'Combined Opposition', short: 'Combined Opposition' },
  JSD: { full: 'Jatiya Samajtantrik Dal (JSD)', short: 'JSD' },
  BIF: { full: 'Bangladesh Islami Front', short: 'Islami Front' },
  FP: { full: 'Freedom Party', short: 'Freedom Party' },
  CPB: { full: 'Communist Party of Bangladesh', short: 'CPB' },
  IO: { full: 'Islami Oikya Jote', short: 'Islami Oikya Jote' },
  IOJ: { full: 'Islami Oikya Jote', short: 'Islami Oikya Jote' },
  'BNAL(MOJAFFAR)': { full: 'Bangladesh National Awami Party (Muzaffar)', short: 'NAP (Muzaffar)' },
  WPB: { full: 'Workers Party of Bangladesh', short: 'Workers Party' },
  WP: { full: 'Workers Party of Bangladesh', short: 'Workers Party' },
  NDP: { full: 'New Democratic Party', short: 'NDP' },
  LDP: { full: 'Liberal Democratic Party (LDP)', short: 'LDP' },
  KSJL: { full: 'Krishak Sramik Janata League', short: 'Krishak Sramik Janata League' },
  BJPAIO: { full: 'BJP and Islami Oikya Jote', short: 'BJP and Islami Oikya Jote' },
  BNF: { full: 'Bangladesh Nationalist Front (BNF)', short: 'BNF' },
  BTF: { full: 'Bangladesh Tarikat Federation', short: 'Tarikat Federation' },
  BDB: { full: 'Bikalpa Dhara Bangladesh', short: 'Bikalpa Dhara' },
  GF: { full: 'Gano Forum', short: 'Gano Forum' },
  KP: { full: 'Kalyan Party', short: 'Kalyan Party' },
};

type PartyLike = { abbr: string; nameBn?: string | null; nameEn?: string | null } | null | undefined;

/** A party's everyday short Bangla name, for chips and narrow rows. */
const PARTY_SHORT_BN: Record<string, string> = {
  BNP: 'বিএনপি', BJEI: 'জামায়াতে ইসলামী', Ind: 'স্বতন্ত্র', NCP: 'এনসিপি', BKM: 'বাংলাদেশ খেলাফত মজলিস',
  IMB: 'ইসলামী আন্দোলন', GOP: 'গণঅধিকার পরিষদ', BJP: 'বিজেপি', KM: 'খেলাফত মজলিস', PSM: 'গণসংহতি আন্দোলন', JAGPA: 'জাগপা',
};

/** A party's full name: "বাংলাদেশ জাতীয়তাবাদী দল (বি.এন.পি)" / "Bangladesh Nationalist Party (BNP)". */
export function partyName(p: PartyLike, lang: Lang): string {
  if (!p) return '';
  if (lang === 'en') return PARTY_EN[p.abbr]?.full ?? p.nameEn ?? p.abbr;
  return p.nameBn ?? p.abbr;
}

/** A party's everyday short name: "বিএনপি" / "BNP". */
export function partyShort(p: PartyLike, lang: Lang): string {
  if (!p) return '';
  if (lang === 'en') return PARTY_EN[p.abbr]?.short ?? p.nameEn ?? p.abbr;
  return PARTY_SHORT_BN[p.abbr] ?? p.nameBn ?? p.abbr;
}

/** A party by its abbreviation alone, with the Bangla name a record carries (results, history). */
export const partyByAbbr = (abbr: string | null | undefined, nameBn: string | null | undefined, lang: Lang, short = false) =>
  abbr ? (short ? partyShort : partyName)({ abbr, nameBn }, lang) : '';

/** "দল নেই" / "No party", for a member the source lists without one. */
export const noParty = (lang: Lang) => (lang === 'en' ? 'No party' : 'দল নেই');

/* ---------------- committees ---------------- */

type CommitteeLike = { nameBn?: string | null; nameEn?: string | null } | null | undefined;

/** "কার্য উপদেষ্টা কমিটি" / "Business Advisory Committee". */
export function committeeName(c: CommitteeLike, lang: Lang): string {
  if (!c) return '';
  return lang === 'en' ? c.nameEn || c.nameBn || '' : c.nameBn || c.nameEn || '';
}

/** The source's committee types. */
export const COMMITTEE_TYPE: Record<string, { bn: string; en: string }> = {
  'Parliamentary Committee': { bn: 'সংসদীয় কমিটি', en: 'Parliamentary committee' },
  'Ministry Related Standing Committee': { bn: 'মন্ত্রণালয় সম্পর্কিত স্থায়ী কমিটি', en: 'Standing committee on a ministry' },
};

/** A seat on a committee: সভাপতি / Chair, সদস্য / Member. */
export function committeeRole(role: string, lang: Lang): string {
  if (role === 'Chairman') return lang === 'en' ? 'Chair' : 'সভাপতি';
  if (role === 'Member') return lang === 'en' ? 'Member' : 'সদস্য';
  return role;
}

/* ---------------- offices ---------------- */

/** The offices on a member record (data/members.json `offices`). */
export const OFFICE: Record<string, { bn: string; en: string }> = {
  speaker: { bn: 'স্পিকার', en: 'Speaker' },
  'deputy-speaker': { bn: 'ডেপুটি স্পিকার', en: 'Deputy Speaker' },
  pm: { bn: 'প্রধানমন্ত্রী', en: 'Prime Minister' },
  'opposition-leader': { bn: 'বিরোধীদলীয় নেতা', en: 'Leader of the Opposition' },
};

/** The House's officers (data/activity.json `speakers`). */
export const HOUSE_ROLE: Record<string, { bn: string; en: string }> = {
  SPEAKER: { bn: 'স্পিকার', en: 'Speaker' },
  DEPUTY_SPEAKER: { bn: 'ডেপুটি স্পিকার', en: 'Deputy Speaker' },
  LEADER_OF_HOUSE: { bn: 'সংসদ নেতা', en: 'Leader of the House' },
  OPPOSITION_LEADER: { bn: 'বিরোধীদলীয় নেতা', en: 'Leader of the Opposition' },
  CHIEF_WHIP: { bn: 'চিফ হুইপ', en: 'Chief Whip' },
  WHIP: { bn: 'হুইপ', en: 'Whip' },
};

/** Government posts as the cabinet lists write them, Bangla to English. */
export const GOV_POST: Record<string, string> = {
  'প্রধানমন্ত্রী': 'Prime Minister',
  'মন্ত্রী': 'Minister',
  'প্রতিমন্ত্রী': 'State Minister',
  'উপমন্ত্রী': 'Deputy Minister',
  'উপদেষ্টা': 'Adviser',
  'প্রধানমন্ত্রীর উপদেষ্টা': 'Adviser to the Prime Minister',
  'স্পিকার': 'Speaker',
  'ডেপুটি স্পিকার': 'Deputy Speaker',
  'সংসদ নেতা': 'Leader of the House',
  'বিরোধীদলীয় নেতা': 'Leader of the Opposition',
  'বিরোধী দলীয় নেতা': 'Leader of the Opposition',
  'চিফ হুইপ': 'Chief Whip',
  'হুইপ': 'Whip',
};

export const govPost = (bn: string | null | undefined, lang: Lang): string => (!bn ? '' : lang === 'en' ? GOV_POST[bn.trim()] ?? bn : bn);

/* ---------------- parliaments ---------------- */

const ORDINAL_BN = ['', 'প্রথম', 'দ্বিতীয়', 'তৃতীয়', 'চতুর্থ', 'পঞ্চম', 'ষষ্ঠ', 'সপ্তম', 'অষ্টম', 'নবম', 'দশম', 'একাদশ', 'দ্বাদশ', 'ত্রয়োদশ', 'চতুর্দশ', 'পঞ্চদশ'];
const ORDINAL_EN = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth'];

/** "ত্রয়োদশ" / "13th", as in "ত্রয়োদশ জাতীয় সংসদ" / "13th Parliament". */
export function ordinalWord(n: number, lang: Lang): string {
  if (lang === 'en') {
    const s = n % 100;
    const suf = s >= 11 && s <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
    return `${n}${n % 10 > 3 ? 'th' : suf}`;
  }
  return ORDINAL_BN[n] ?? `${toBn(String(n))}তম`;
}

/** "First" … "Fifteenth", for a sentence that starts with it. */
export const ordinalWordEn = (n: number) => ORDINAL_EN[n] ?? `${n}th`;

/* ---------------- news outlets ---------------- */

/** The outlets the news feed reads (config/news-sources.ts), by their Bangla names, as each spells itself in English. */
const OUTLET_EN: Record<string, string> = {
  'অর্থসূচক': 'Orthosuchak', 'আজকের পত্রিকা': 'Ajker Patrika', 'আমাদের সময়': 'Amader Shomoy', 'আমার দেশ': 'Amar Desh',
  'আমার সংবাদ': 'Amar Sangbad', 'আরটিভি': 'RTV', 'আল জাজিরা': 'Al Jazeera', 'আলোকিত বাংলাদেশ': 'Alokito Bangladesh',
  'ইউএনবি': 'UNB', 'ইত্তেফাক': 'The Daily Ittefaq', 'ইনডিপেনডেন্ট টেলিভিশন': 'Independent Television', 'একাত্তর টিভি': 'Ekattor TV',
  'একুশে টেলিভিশন': 'Ekushey Television', 'এখন টিভি': 'Ekhon TV', 'এটিএন নিউজ': 'ATN News', 'এটিএন বাংলা': 'ATN Bangla',
  'এনটিভি': 'NTV', 'এসএ টিভি': 'SA TV', 'কালবেলা': 'Kalbela', 'কালের কণ্ঠ': 'Kaler Kantho', 'কুমিল্লার কাগজ': 'Cumillar Kagoj',
  'খবরের কাগজ': 'Khaborer Kagoj', 'খোলা কাগজ': 'Khola Kagoj', 'গণকণ্ঠ': 'Ganakantha', 'চাঁদপুর টাইমস': 'Chandpur Times',
  'চ্যানেল আই': 'Channel i', 'চ্যানেল এস': 'Channel S', 'চ্যানেল ২৪': 'Channel 24', 'জনকণ্ঠ': 'Daily Janakantha', 'জনবাণী': 'Janabani',
  'জাগো নিউজ ২৪': 'Jago News 24', 'ডয়চে ভেলে বাংলা': 'DW Bangla', 'ডিবিসি নিউজ': 'DBC News', 'ডেইলি বাংলা পোস্ট': 'Daily Bangla Post',
  'ডেইলি সান': 'Daily Sun', 'ডেইলি স্টার বাংলা': 'The Daily Star Bangla', 'ঢাকা টাইমস': 'Dhaka Times', 'ঢাকা ট্রিবিউন': 'Dhaka Tribune',
  'ঢাকা পোস্ট': 'Dhaka Post', 'ঢাকা প্রকাশ': 'Dhaka Prokash', 'ঢাকা মেইল': 'Dhaka Mail', 'দিনাজপুর টিভি': 'Dinajpur TV',
  'দুরবীন নিউজ': 'Durbin News', 'দেশ টিভি': 'Desh TV', 'দেশ রূপান্তর': 'Desh Rupantor', 'দেশে বিদেশে': 'Deshe Bideshe',
  'দৈনিক আজাদী': 'Dainik Azadi', 'দৈনিক ইনকিলাব': 'Daily Inqilab', 'দৈনিক করতোয়া': 'Dainik Karatoa', 'দৈনিক পূর্বকোণ': 'Dainik Purbokone',
  'দৈনিক বাংলা': 'Dainik Bangla', 'দৈনিক ভোরের ডাক': 'Dainik Bhorer Dak', 'দৈনিক শিক্ষা': 'Dainik Shiksha', 'দৈনিক সংগ্রাম': 'Daily Sangram',
  'দ্য ইকোনমিস্ট': 'The Economist', 'দ্য ইনডিপেনডেন্ট': 'The Independent', 'দ্য গার্ডিয়ান': 'The Guardian',
  'দ্য ডেইলি অবজারভার': 'The Daily Observer', 'দ্য ডেইলি ক্যাম্পাস': 'The Daily Campus', 'দ্য ডেইলি স্টার': 'The Daily Star',
  'দ্য নিউ ইয়র্ক টাইমস': 'The New York Times', 'দ্য ফিন্যান্সিয়াল এক্সপ্রেস': 'The Financial Express', 'দ্য বাংলাদেশ টুডে': 'The Bangladesh Today',
  'দ্য বিজনেস স্ট্যান্ডার্ড': 'The Business Standard', 'নয়া দিগন্ত': 'Naya Diganta', 'নয়া শতাব্দী': 'Naya Shatabdi', 'নাগরিক টিভি': 'Nagorik TV',
  'নিউ এজ': 'New Age', 'নিউজ২৪': 'News24', 'নেত্র নিউজ': 'Netra News', 'পূর্বাঞ্চল': 'Purbanchal', 'প্রতিদিনের বাংলাদেশ': 'Protidiner Bangladesh',
  'প্রতিদিনের সংবাদ': 'Protidiner Sangbad', 'প্রথম আলো ইংরেজি': 'Prothom Alo English', 'প্রথম আলো': 'Prothom Alo',
  'প্রেস নারায়ণগঞ্জ': 'Press Narayanganj', 'বণিক বার্তা': 'Bonik Barta', 'বরিশাল টাইমস': 'Barishal Times', 'বাংলা টিভি': 'Bangla TV',
  'বাংলা টেলিগ্রাফ': 'Bangla Telegraph', 'বাংলা ট্রিবিউন': 'Bangla Tribune', 'বাংলা স্ট্রিম': 'Bangla Stream', 'বাংলাদেশ জার্নাল': 'Bangladesh Journal',
  'বাংলাদেশ টাইমস': 'Bangladesh Times', 'বাংলাদেশ পোস্ট': 'Bangladesh Post', 'বাংলাদেশ প্রতিদিন': 'Bangladesh Pratidin',
  'বাংলাদেশের খবর': 'Bangladesher Khabor', 'বাংলানিউজ২৪': 'Banglanews24', 'বাংলাভিশন': 'Banglavision', 'বাণিজ্য প্রতিদিন': 'Banijya Protidin',
  'বার্তা বাজার': 'Barta Bazar', 'বার্তা২৪': 'Barta24', 'বাসস': 'BSS', 'বিটিভি': 'BTV', 'বিডিনিউজ২৪': 'bdnews24', 'বিডি২৪লাইভ': 'BD24Live',
  'বিবিসি বাংলা': 'BBC Bangla', 'বৈশাখী টিভি': 'Boishakhi TV', 'ব্লুমবার্গ': 'Bloomberg', 'ভোরের কাগজ': 'Bhorer Kagoj', 'মাই টিভি': 'My TV',
  'মাছরাঙা টেলিভিশন': 'Maasranga Television', 'মানবকণ্ঠ': 'Manobkantha', 'মানবজমিন': 'Manab Zamin', 'মোহনা টিভি': 'Mohona TV',
  'যমুনা টিভি': 'Jamuna TV', 'যায়যায়দিন': 'Jaijaidin', 'যুগান্তর': 'Jugantor', 'রাইজিংবিডি': 'Risingbd', 'রূপালী বাংলাদেশ': 'Rupali Bangladesh',
  'শেয়ার বিজ': 'Share Biz', 'শ্যামল সিলেট': 'Shyamal Sylhet', 'সংবাদ সারাবেলা': 'Sangbad Sarabela', 'সংবাদ': 'The Daily Sangbad',
  'সমকাল': 'Samakal', 'সময় টিভি': 'Somoy TV', 'সময়ের আলো': 'Shomoyer Alo', 'সময়ের কণ্ঠস্বর': 'Somoyer Konthosor', 'সারাবাংলা': 'Sarabangla',
  'সিএনএন': 'CNN', 'সিভয়েস২৪': 'CVoice24', 'সিলেট টুডে ২৪': 'Sylhet Today 24', 'সুপ্রভাত বাংলাদেশ': 'Suprobhat Bangladesh',
  'সোনালী সংবাদ': 'Sonali Sangbad', 'স্বদেশ প্রতিদিন': 'Swadesh Protidin',
};

/** A news outlet's name in the page's language; an outlet the table lacks keeps its Bangla name. */
export const outletName = (bn: string | null | undefined, lang: Lang): string => (!bn ? '' : lang === 'en' ? OUTLET_EN[bn.trim()] ?? bn : bn);
