/**
 * The two languages of the site. Bangla is the default and lives at the plain
 * addresses (/mp/x); English lives under /en (/en/mp/x). Everything a page
 * shows in one language or the other goes through a `T` made here, so text,
 * digits, dates and links always agree with the page's language.
 *
 * Pure: no React and no Next, so server code, client components and scripts
 * can all use it.
 */
export type Lang = 'bn' | 'en';
export const LANGS: readonly Lang[] = ['bn', 'en'];
export const isLang = (v: unknown): v is Lang => v === 'bn' || v === 'en';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toBn = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
const toLatin = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

export const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Year, month and day as Bangladesh sees them; a bare "2026-09-10" is that calendar day. */
const DHAKA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
export function ymd(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (plain) return { y: Number(plain[1]), m: Number(plain[2]), d: Number(plain[3]) };
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const [y, m, d] = DHAKA_DATE.format(t).split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

/** Paths that are not pages of either language: they never take the /en prefix. */
const NOT_A_PAGE = /^\/(?:api|admin|_next)(?:[/?#]|$)|^\/[^?#]*\.[a-z0-9]{2,5}(?:[?#]|$)/i;

/** "/en/mp/x" → "/mp/x"; "/en" → "/"; a Bangla path is returned as it is. */
export function stripLang(path: string): string {
  const m = /^\/en(?=$|[/?#])(.*)$/.exec(path);
  if (!m) return path;
  const rest = m[1]!;
  if (!rest) return '/';
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/** The same page in the given language: "/mp/x" ⇄ "/en/mp/x". Leaves other sites, files and the admin alone. */
export function hrefIn(lang: Lang, path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || NOT_A_PAGE.test(path)) return path;
  const bare = stripLang(path);
  if (lang === 'bn') return bare;
  if (bare === '/') return '/en';
  // "/?q=x" and "/#top" belong to the home page: "/en?q=x", "/en#top".
  return /^\/[?#]/.test(bare) ? `/en${bare.slice(1)}` : `/en${bare}`;
}

function ordinalEn(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * The page's language, as a function and a toolkit.
 *   t('সব এমপি', 'All MPs')   the text in this language
 *   t.n(12)                   "১২" or "12"
 *   t.group(127711899)        "১২,৭৭,১১,৮৯৯" or "127,711,899"
 *   t.date('2026-02-17')      "১৭ ফেব্রুয়ারি ২০২৬" or "17 February 2026"
 *   t.href('/mp/x')           "/mp/x" or "/en/mp/x"
 */
export interface T {
  (bn: string, en: string): string;
  readonly lang: Lang;
  readonly en: boolean;
  /** Either of two values of any kind, by language. */
  pick<X>(bn: X, en: X): X;
  /** Digits in this language's script; anything else in the value is kept. */
  n(v: number | string | null | undefined): string;
  /** A whole number with the language's grouping: lakh and crore in Bangla, thousands in English. */
  group(v: number): string;
  /** A number with fixed decimals (one by default), e.g. a percentage. */
  fixed(v: number, digits?: number): string;
  /** "১৭ ফেব্রুয়ারি ২০২৬" / "17 February 2026", on the Bangladesh calendar. */
  date(iso: string | null | undefined): string | null;
  /** "ফেব্রুয়ারি ২০২৬" / "February 2026". */
  monthYear(iso: string | null | undefined): string | null;
  /** The month's name, 1 = January. */
  month(m: number): string;
  /** The weekday's name, 0 = Sunday. */
  weekday(d: number): string;
  /** This path in this language. */
  href(path: string): string;
  /** An ordinal: Bangla writes the bare number ("১৩"), English "13th". */
  ord(n: number): string;
  /**
   * A count with its noun: t.count(5, 'আসন', 'seat', 'seats') is "৫টি আসন" /
   * "5 seats". The Bangla classifier is given in full (`'টি আসন'`, `' জন'`).
   */
  count(n: number, bn: string, one: string, many: string): string;
}

/** English singular or plural by count. */
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const made = new Map<Lang, T>();

export function makeT(lang: Lang): T {
  const done = made.get(lang);
  if (done) return done;
  const en = lang === 'en';
  const digits = (v: number | string | null | undefined) => (v == null ? '' : en ? toLatin(String(v)) : toBn(String(v)));
  const t = ((bn: string, enText: string) => (en ? enText : bn)) as T;
  Object.assign(t, {
    lang,
    en,
    pick: <X,>(bn: X, enV: X) => (en ? enV : bn),
    n: digits,
    group: (v: number) => {
      const s = String(Math.round(v));
      const neg = s.startsWith('-');
      const body = neg ? s.slice(1) : s;
      let out: string;
      if (en) out = body.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      else if (body.length <= 3) out = body;
      else out = `${body.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${body.slice(-3)}`;
      return digits((neg ? '-' : '') + out);
    },
    fixed: (v: number, d = 1) => digits(v.toFixed(d)),
    date: (iso: string | null | undefined) => {
      const x = ymd(iso);
      if (!x) return null;
      return en ? `${x.d} ${MONTHS_EN[x.m - 1]} ${x.y}` : `${toBn(String(x.d))} ${MONTHS_BN[x.m - 1]} ${toBn(String(x.y))}`;
    },
    monthYear: (iso: string | null | undefined) => {
      const x = ymd(iso);
      if (!x) return null;
      return en ? `${MONTHS_EN[x.m - 1]} ${x.y}` : `${MONTHS_BN[x.m - 1]} ${toBn(String(x.y))}`;
    },
    month: (m: number) => (en ? MONTHS_EN : MONTHS_BN)[m - 1] ?? '',
    weekday: (d: number) => (en ? WEEKDAYS_EN : WEEKDAYS_BN)[d] ?? '',
    href: (path: string) => hrefIn(lang, path),
    ord: (n: number) => (en ? ordinalEn(n) : toBn(String(n))),
    count: (n: number, bn: string, one: string, many: string) => (en ? `${n} ${n === 1 ? one : many}` : `${toBn(String(n))}${bn}`),
  });
  made.set(lang, t);
  return t;
}
