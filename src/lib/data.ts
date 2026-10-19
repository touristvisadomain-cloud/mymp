/**
 * The site's data layer.
 *
 * Everything is read from the committed snapshot in data/, refreshed by
 * `npm run sync`. No database call happens when a visitor loads a page.
 */
import membersJson from '../../data/members.json';
import committeesJson from '../../data/committees.json';
import partiesJson from '../../data/parties.json';
import seatsJson from '../../data/seats.json';
import metaJson from '../../data/meta.json';
import ecsJson from '../../data/ecs.json';
import newsJson from '../../data/news.json';
import postsJson from '../../data/posts.json';
import { normalise } from './search';

export interface Party {
  abbr: string;
  slug: string;
  nameBn: string | null;
  nameEn: string | null;
  seats: number;
  seatsTerritorial: number;
  seatsReserved: number;
  /** Profile fields an editor saved; the sourced defaults are in lib/partyProfiles. */
  summaryBn?: string | null;
  originBn?: string | null;
  symbolBn?: string | null;
  foundedOn?: string | null;
  founderBn?: string | null;
  leaderTitleBn?: string | null;
  leaderNameBn?: string | null;
  secretaryTitleBn?: string | null;
  secretaryNameBn?: string | null;
  headquartersBn?: string | null;
  website?: string | null;
}

export interface Seat {
  no: number;
  reserved: boolean;
  nameBn: string | null;
  nameEn: string | null;
  slug: string;
  boundaryBn: string | null;
  /** Set when the member elected for this seat has resigned: the date the seat fell vacant. */
  vacantSince?: string | null;
}

export interface Member {
  id: string;
  slug: string;
  nameBn: string | null;
  nameEn: string | null;
  photoUrl: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  professionBn: string | null;
  fatherBn: string | null;
  fatherEn: string | null;
  motherBn: string | null;
  motherEn: string | null;
  isFreedomFighter: boolean;
  presentAddressBn: string | null;
  permanentAddressBn: string | null;
  email: string | null;
  hasMobile: boolean;
  /** Written by the source for the Speaker and Deputy Speaker only; anyone else only through an admin override. */
  bioBn: string | null;
  /** A one-paragraph summary the source provides for the presiding officers. */
  summaryBn: string | null;
  /** Where an editor's biography (bioBn) was written from: URLs, space- or line-separated. */
  bioSources?: string | null;
  /** The member's current office and what they have done in it lately, from dated news; an admin override only. */
  dutiesBn?: string | null;
  /** Where dutiesBn was written from: URLs, space- or line-separated. */
  dutiesSources?: string | null;
  /** This parliament: oath date to the scheduled end of the term. */
  term: { start: string | null; end: string | null };
  /**
   * Official pages: entered by an admin after checking them, or read by the
   * engine from the member's own Wikipedia article (then socialSource names
   * the article). Never from parliament.gov.bd.
   */
  facebook: string | null;
  x: string | null;
  youtube: string | null;
  instagram: string | null;
  website: string | null;
  /** The Wikipedia article(s) the links above were read from, space-separated; null once an editor has saved them. */
  socialSource?: string | null;
  /**
   * How far the Facebook link (facebook) is confirmed; it decides what the
   * page shows (see facebookState in history.ts). Null keeps the old rule:
   * a link is shown when there is one.
   */
  fbStatus?: 'verified' | 'pending' | 'disputed' | 'not_found' | null;
  fbType?: 'page' | 'profile' | 'party_page' | null;
  fbUsername?: string | null;
  /** Filled by hand later. */
  fbPageId?: string | null;
  /** Facebook's own verified badge; filled by hand later. */
  fbVerified?: boolean | null;
  /** Where the Facebook page and website were confirmed. */
  sourceUrl?: string | null;
  /** YYYY-MM-DD, when these links were last checked. */
  lastChecked?: string | null;
  /** Schools and degrees, from an editor or the member's Wikipedia infobox (see bioFromWiki). */
  educationBn?: string | null;
  /** Birthplace, from an editor or the member's Wikipedia infobox (see bioFromWiki). */
  birthPlaceBn?: string | null;
  /** Which of educationBn, birthPlaceBn and professionBn came from Wikipedia, comma-separated. */
  bioFromWiki?: string | null;
  /** The Wikipedia article(s) those came from, space-separated. */
  bioSource?: string | null;
  /** The member's 1200x630 link-preview card from the engine (og:cards), or null. */
  shareImage?: string | null;
  /** The member's office in their party ("চেয়ারম্যান"), from an editor or a hand-checked source. */
  partyRoleBn?: string | null;
  /** A ministry the member holds ("স্বরাষ্ট্র মন্ত্রণালয়") and the post: minister, state-minister or deputy-minister. */
  ministryBn?: string | null;
  govPost?: string | null;
  party: { abbr: string; nameBn: string | null; nameEn: string | null } | null;
  seat: Seat | null;
  offices: string[];
  status: string | null;
  /** Times elected, this term included, as the parliament secretariat records it. */
  termsCount?: number | null;
  /** The date the member resigned, when the source says so. */
  resignedOn?: string | null;
}

export interface CommitteeMemberRef {
  role: string;
  memberId: string;
}

export interface Committee {
  id: string;
  slug: string;
  nameBn: string | null;
  nameEn: string | null;
  type: string | null;
  startDate: string | null;
  /** False when the roster still lists members of the previous parliament. */
  rosterCurrent: boolean;
  memberCount: number;
  members: CommitteeMemberRef[];
  /** Set when the same committee also has a record from the previous parliament. */
  previousStartDate?: string | null;
}

export const committeeCounts = () => ({
  total: committees.length,
  current: committees.filter((c) => c.rosterCurrent).length,
  pending: committees.filter((c) => !c.rosterCurrent).length,
});

/** Everyone the source lists for this parliament, including members who have since resigned. */
export const allMembers = membersJson as Member[];
export const isResigned = (m: Member) => !!m.resignedOn;
/** Sitting members: every count, list and statistic on the site is about them. */
export const members = allMembers.filter((m) => !isResigned(m));
export const resignedMembers = allMembers.filter(isResigned);
export const committees = committeesJson as Committee[];
export const parties = partiesJson as Party[];
/** A seat's memberId is null when its holder has been hidden by an admin. */
export const seats = seatsJson as (Seat & { memberId: string | null })[];

export interface NewsPost {
  id: string;
  titleBn: string;
  sourceName: string;
  sourceUrl: string;
  publishedOn: string;
  excerptBn: string | null;
  /** The headline and excerpt in English, machine-translated (supabase/migrations/006); null or absent until then. */
  titleEn?: string | null;
  excerptEn?: string | null;
  memberId: string | null;
  seatSlug: string | null;
}

/** Published news only. Written by the sync from the admin database; empty until one exists. */
export const news = newsJson as NewsPost[];
export const publishedNews = () => [...news].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
export const newsForSeat = (slug: string) => publishedNews().filter((n) => n.seatSlug === slug);

/**
 * Government and parliamentary posts, from the posts table (kept current by
 * the posts sync, src/lib/posts/sync.ts) via the build. A post with a toDate
 * has ended; rows are never removed, so they are also the change history.
 */
export interface PostEntry {
  id: string;
  type: 'government' | 'parliament';
  /** প্রধানমন্ত্রী, মন্ত্রী, প্রতিমন্ত্রী, উপমন্ত্রী, উপদেষ্টা, স্পিকার… */
  title: string;
  rankNote: string | null;
  ministryBn: string | null;
  /** Null for someone who is not an MP (most advisers). */
  memberId: string | null;
  isMp: boolean;
  nameBn: string;
  nameEn: string | null;
  photoUrl: string | null;
  fromDate: string;
  toDate: string | null;
  /** Position in the source list. */
  order: number | null;
  sourceKey: string | null;
  sourceUrl: string | null;
  autoSynced: boolean;
}
export const posts = postsJson as {
  checkedAt: string | null;
  /** On a cabinet list but not yet placed as an MP or a non-MP by an editor (/admin/sync). */
  pending?: { nameBn: string; title: string; ministries: string[] }[];
  rows: PostEntry[];
};
export const currentPosts = (type?: PostEntry['type']) =>
  posts.rows.filter((r) => !r.toDate && (!type || r.type === type)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
export const governmentPostsOf = (memberId: string) => currentPosts('government').filter((r) => r.memberId === memberId);
/** The day, in Dhaka, the posts were last checked against their sources. */
export const postsCheckedOnBn = () =>
  posts.checkedAt ? dateBn(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date(posts.checkedAt))) : null;

export const meta = metaJson as {
  parliamentNo: number;
  syncedAt: string;
  /** When the site was last built from that snapshot; the mobile app's cache key. */
  builtAt: string;
  source: string;
  counts: Record<string, number>;
};

/**
 * National figures the Election Commission publishes on its own pages.
 * Kept separate from the parliament sync because they are read by a person,
 * not fetched: the commission's site sits behind bot protection.
 */
export const ecs = ecsJson as {
  source: string;
  sourceUrl: string;
  readOn: string;
  note: string;
  national: {
    registeredVoters: number;
    maleVoters: number;
    femaleVoters: number;
    pollingCentres: number;
    registeredParties: number;
  };
};

/** Bengali number grouping: 12,77,11,899 rather than 127,711,899. */
export function bnGroup(n: number): string {
  const s = String(n);
  if (s.length <= 3) return bn(s);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return bn(`${rest},${last3}`);
}

// Profiles stay reachable for members who have resigned.
const bySlug = new Map(allMembers.map((m) => [m.slug, m]));
const byId = new Map(allMembers.map((m) => [m.id, m]));

export const getMember = (slug: string) => bySlug.get(slug);
export const getMemberById = (id: string) => byId.get(id);
export const getSeat = (slug: string) => seats.find((s) => s.slug === slug);
export const getParty = (slug: string) => parties.find((p) => p.slug === slug);
export const getCommittee = (slug: string) => committees.find((c) => c.slug === slug);

export const membersOfParty = (abbr: string) =>
  members.filter((m) => m.party?.abbr === abbr).sort(seatOrder);

export const seatOrder = (a: Member, b: Member) => (a.seat?.no ?? 999) - (b.seat?.no ?? 999);

export const committeesOfMember = (id: string) =>
  committees.filter((c) => c.rosterCurrent && c.members.some((x) => x.memberId === id));

/**
 * The district a seat belongs to. Grouping keys off the English name because it is
 * stable, but the label shown is Bengali, since the site is Bengali first.
 * Reserved seats belong to no district.
 */
/**
 * Seat names the source spells differently from the rest of their district:
 * "Chittagong-8" beside "Chattogram-1…16", and "Cox'sBazar" with no space.
 * Without this, each became a district of its own with one seat.
 */
const DISTRICT_EN_ALIASES: Record<string, string> = {
  Chittagong: 'Chattogram',
  "Cox'sBazar": "Cox's Bazar",
};

export function districtOf(
  seat: Seat | null,
): { en: string; bn: string; slug: string } | null {
  if (!seat || seat.reserved || !seat.nameEn) return null;
  // "Pabna-5" and "Pabna 5" (as the source writes one of them) are both Pabna.
  const raw = seat.nameEn.replace(/[\s-]+\d+$/, '').trim();
  const en = DISTRICT_EN_ALIASES[raw] ?? raw;
  const bn = (seat.nameBn ?? en).replace(/[\s-]+[০-৯\d]+$/, '').trim();
  return { en, bn, slug: en.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') };
}

/** Party colour token. Anything outside the top four shares one colour. */
export function partyColor(abbr: string | null | undefined): string {
  switch (abbr) {
    case 'BNP': return 'var(--color-pbnp)';
    case 'BJEI': return 'var(--color-pjamaat)';
    case 'Ind': return 'var(--color-pind)';
    case 'NCP': return 'var(--color-pncp)';
    default: return 'var(--color-pother)';
  }
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Bengali numerals, used everywhere numbers appear in Bengali copy. */
export function bn(n: number | string): string {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function ageFrom(dob: string | null): number | null {
  const born = dhakaYmd(dob);
  const now = dhakaYmd(new Date().toISOString());
  if (!born || !now) return null;
  let age = now.y - born.y;
  if (now.m < born.m || (now.m === born.m && now.d < born.d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

/** parliament.gov.bd writes 81 members' English names in capitals ("MD. NURUL HAQUE"); pages show them in title case. */
export function nameEnDisplay(s: string | null | undefined): string | null {
  if (!s) return null;
  if (s !== s.toUpperCase() || !/[A-Z]{2}/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s.\-('])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}

/** A party's everyday short name, for chips and narrow rows; the full name everywhere else. */
const PARTY_SHORT_BN: Record<string, string> = {
  BNP: 'বিএনপি', BJEI: 'জামায়াতে ইসলামী', Ind: 'স্বতন্ত্র', NCP: 'এনসিপি', BKM: 'বাংলাদেশ খেলাফত মজলিস',
  IMB: 'ইসলামী আন্দোলন', GOP: 'গণঅধিকার পরিষদ', BJP: 'বিজেপি', KM: 'খেলাফত মজলিস', PSM: 'গণসংহতি আন্দোলন', JAGPA: 'জাগপা',
};
export const partyShortBn = (p: { abbr: string; nameBn?: string | null } | null | undefined) =>
  p ? PARTY_SHORT_BN[p.abbr] ?? p.nameBn ?? p.abbr : null;

/** Year, month and day of an instant as Bangladesh sees it; a date-only string is taken as that calendar day. */
const DHAKA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
export function dhakaYmd(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (plain) return { y: Number(plain[1]), m: Number(plain[2]), d: Number(plain[3]) };
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const [y, m, d] = DHAKA_DATE.format(t).split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

/** "১২ সেপ্টেম্বর ২০২৬", always the Bangladesh date, wherever the page is built or read. */
export function dateBn(iso: string | null): string | null {
  const x = dhakaYmd(iso);
  return x ? `${bn(x.d)} ${BN_MONTHS[x.m - 1]} ${bn(x.y)}` : null;
}

/** Bangla digits inside Bangla text from a source (a notice title, a headline); Latin text is left as written. */
export { bnText } from './bnText';

export const OFFICE_LABELS: Record<string, string> = {
  'speaker': 'স্পিকার',
  'deputy-speaker': 'ডেপুটি স্পিকার',
  'pm': 'প্রধানমন্ত্রী',
  'opposition-leader': 'বিরোধীদলীয় নেতা',
};

/** First letter of the Bengali name, for the avatar when a photo will not load. */
export function initial(m: Member): string {
  const name = (m.nameBn || m.nameEn || '?').trim();
  const stripped = name.replace(/^(মোঃ|মো\.|ব্যারিস্টার|ড\.|অ্যাডভোকেট)\s*/, '');
  return (stripped || name).charAt(0);
}

/* ---------------- statistics, all computed from the snapshot ---------------- */

/** Seats in the House, from the Constitution (art. 65): 300 elected and 50 reserved for women. Named here so no page writes the numbers itself. */
export const GENERAL_SEATS = 300;
export const RESERVED_SEATS = 50;
export const HOUSE_SEATS = GENERAL_SEATS + RESERVED_SEATS;

/** statistics() names its age bands in Bangla; their English. */
export const AGE_BAND_EN: Record<string, string> = {
  '৩০-এর নিচে': 'Under 30',
  '৩০-৩৯': '30–39',
  '৪০-৪৯': '40–49',
  '৫০-৫৯': '50–59',
  '৬০-৬৯': '60–69',
  '৭০+': '70+',
};

/** Variant spellings of an occupation, each mapped to the key of the one shown. */
const PROFESSION_CANON: Record<string, string> = {
  'ব্যবসায়ী': 'ব্যবসা',
  'ব্যবসায়': 'ব্যবসা',
  'ব্যাবসা': 'ব্যবসা',
  'ব্যাবসায়ী': 'ব্যবসা',
  'আইনজীবি': 'আইনজীবী',
  'এডভোকেট': 'আইনজীবী',
  'অ্যাডভোকেট': 'আইনজীবী',
};

const PROFESSION_FOLD = new Map(Object.entries(PROFESSION_CANON).map(([k, v]) => [normalise(k), normalise(v)]));
/** A folded job is shown in the table's own spelling ("ব্যবসা"), not whichever variant came first. */
const PROFESSION_LABEL = new Map(Object.values(PROFESSION_CANON).map((v) => [normalise(v), v]));

export function statistics() {
  const territorial = members.filter((m) => m.seat && !m.seat.reserved);
  const reserved = members.filter((m) => m.seat?.reserved);
  const women = members.filter((m) => m.gender === 'Female');

  const ages = members
    .map((m) => ({ m, age: ageFrom(m.dateOfBirth) }))
    .filter((x): x is { m: Member; age: number } => x.age !== null)
    .sort((a, b) => a.age - b.age);

  const bands = [
    { label: '৩০-এর নিচে', test: (a: number) => a < 30 },
    { label: '৩০-৩৯', test: (a: number) => a >= 30 && a < 40 },
    { label: '৪০-৪৯', test: (a: number) => a >= 40 && a < 50 },
    { label: '৫০-৫৯', test: (a: number) => a >= 50 && a < 60 },
    { label: '৬০-৬৯', test: (a: number) => a >= 60 && a < 70 },
    { label: '৭০+', test: (a: number) => a >= 70 },
  ].map((b) => ({ label: b.label, count: ages.filter((x) => b.test(x.age)).length }));

  // Profession values arrive with invisible joiners and spelling variants, so the
  // same job appears more than once. Fold before counting, or the chart lies.
  const profs = new Map<string, { label: string; count: number }>();
  for (const m of members) {
    if (!m.professionBn) continue;
    // Spellings of the same job fold to one key ("ব্যবসায়ী" and "ব্যবসা" are one
    // occupation), or the chart shows the same bar twice.
    // The table's spellings are folded the same way as the value, or a key never matches.
    const key = PROFESSION_FOLD.get(normalise(m.professionBn)) ?? normalise(m.professionBn);
    if (!key) continue;
    const e = profs.get(key) ?? { label: PROFESSION_LABEL.get(key) ?? m.professionBn.trim(), count: 0 };
    e.count++;
    profs.set(key, e);
  }

  return {
    total: members.length,
    territorial: territorial.length,
    reserved: reserved.length,
    women: women.length,
    womenTerritorial: territorial.filter((m) => m.gender === 'Female').length,
    womenReserved: reserved.filter((m) => m.gender === 'Female').length,
    freedomFighters: members.filter((m) => m.isFreedomFighter).length,
    withProfession: members.filter((m) => m.professionBn).length,
    youngest: ages[0] ?? null,
    oldest: ages[ages.length - 1] ?? null,
    medianAge: ages.length ? ages[Math.floor(ages.length / 2)].age : null,
    ageBands: bands,
    professions: [...profs.values()].sort((a, b) => b.count - a.count),
    // A majority of the whole House, not of whoever sits today: a vacancy does not lower the bar.
    majority: Math.floor(HOUSE_SEATS / 2) + 1,
  };
}
