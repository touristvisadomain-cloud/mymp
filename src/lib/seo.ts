import type { Metadata } from 'next';
import { hrefIn, type Lang } from '@/i18n/core';

/*
 * Site-wide SEO and share metadata. Every page inherits BASE_OPEN_GRAPH and
 * BASE_TWITTER from the root layout. They deliberately carry no title or
 * description: Next fills og:title, og:description and the twitter pair from
 * each page's own title and description, so an MP page shares as that MP. The
 * home page adds the explicit title, description and og:url on top.
 */
export const SITE_NAME = 'আমার এমপি';
export const SITE_TITLE = 'আমার এমপি | বাংলাদেশের সংসদ সদস্যদের তথ্য';
export const SITE_DESCRIPTION =
  'ত্রয়োদশ জাতীয় সংসদের সব সংসদ সদস্যের তথ্য এক জায়গায়। আসন, দল, সংরক্ষিত আসন, সংসদীয় কমিটি ও অধিবেশনের তথ্য। সূত্র: বাংলাদেশ জাতীয় সংসদ ও নির্বাচন কমিশন।';

/* The same three in English, for the pages under /en. "Amar MP" is the name's own sound; "My MP" is what it says. */
export const SITE_NAME_EN = 'My MP';
export const SITE_TITLE_EN = 'My MP | Members of the Parliament of Bangladesh';
export const SITE_DESCRIPTION_EN =
  "Every member of Bangladesh's 13th Parliament: seats, parties, reserved seats for women, committees and sessions. From Parliament and the Election Commission.";

export const siteName = (lang: Lang) => (lang === 'en' ? SITE_NAME_EN : SITE_NAME);
export const siteTitle = (lang: Lang) => (lang === 'en' ? SITE_TITLE_EN : SITE_TITLE);
export const siteDescription = (lang: Lang) => (lang === 'en' ? SITE_DESCRIPTION_EN : SITE_DESCRIPTION);

/**
 * Characters as a reader sees them: grapheme clusters, so a conjunct with its
 * vowel sign counts once ("ত্রয়ো" is 3, not 7). The owner's own example
 * description is 131 by this count and 204 in code points.
 */
const graphemes = new Intl.Segmenter('bn', { granularity: 'grapheme' });
export const charCount = (s: string) => [...graphemes.segment(s)].length;

/** About as much of a description as Google shows; a longer one is cut off mid-word in the result. */
export const DESCRIPTION_MAX = 160;
/** Where a description that runs over is cut, leaving room for the "…". */
const DESCRIPTION_CUT = 158;
/** A cut at a sentence's end is kept only when what is left still says this much. */
const SENTENCE_MIN = 80;
/** About as much of a title as Google shows, " | My MP" included. */
export const TITLE_MAX = 60;

/** A full stop after one of these is an abbreviation ("Dr. ", "মো. "), not a sentence's end. */
const ABBREVIATION = /(?:^|[\s(])(?:Dr|Mr|Mrs|Ms|Md|Mst|St|No|Prof|Lt|Col|Gen|Brig|ড|ডা|মো|মোছা)$/;

/**
 * A description held to what search engines show. One that fits (160
 * characters or fewer) is returned whole, so a Bangla description written to
 * fit is never touched. A longer one ends at the last full sentence within
 * 158 characters (। . ? !) when that still says enough, otherwise at the last
 * whole word, with "…".
 */
export function fitDescription(text: string): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (charCount(s) <= DESCRIPTION_MAX) return s;
  const g = [...graphemes.segment(s)].map((x) => x.segment);
  const head = g.slice(0, DESCRIPTION_CUT).join('');
  // One character past the cut shows whether a stop at the very end is followed by a space.
  const probe = head + (g[DESCRIPTION_CUT] ?? '');
  let end = -1;
  for (const m of probe.matchAll(/[।.?!](?=\s)/g)) {
    if (m.index + 1 > head.length) break;
    if (m[0] === '.' && ABBREVIATION.test(probe.slice(0, m.index))) continue;
    end = m.index + 1;
  }
  if (end > 0 && charCount(head.slice(0, end)) >= SENTENCE_MIN) return head.slice(0, end);
  // A whole word, without a dangling comma or "and" before the "…".
  const words = g.slice(0, DESCRIPTION_CUT - 1).join('');
  const space = words.lastIndexOf(' ');
  let cut = (space > 0 ? words.slice(0, space) : words).replace(/[\s,;:(–—-]+$/, '');
  while (/\s(?:and|or|of|the|in|for|with|to|a|an|ও|এবং|বা)$/i.test(cut)) cut = cut.replace(/\s\S+$/, '').replace(/[\s,;:(–—-]+$/, '');
  return `${cut}…`;
}

/**
 * A page title held to what search engines show. Each candidate, best first,
 * is tried with the site's name after it (the layout's " | My MP"), then on
 * its own; the first that fits is used. When none does, the last stands on
 * its own, since the site's name is the part a reader can most spare.
 */
export function fitTitle(lang: Lang, ...candidates: string[]): string | { absolute: string } {
  const suffix = ` | ${siteName(lang)}`;
  for (const c of candidates) {
    if (charCount(c + suffix) <= TITLE_MAX) return c;
    if (charCount(c) <= TITLE_MAX) return { absolute: c };
  }
  return { absolute: candidates[candidates.length - 1] ?? siteName(lang) };
}

/** A title that carries the site's name itself ({ absolute }): with " | My MP" when it fits, without when it does not. */
export const withSiteName = (title: string, lang: Lang) => {
  const full = `${title} | ${siteName(lang)}`;
  return charCount(full) <= TITLE_MAX ? full : title;
};

/**
 * The version stamped on the drawn preview cards, /api/og/mp/[slug] and
 * /api/og/party/[slug].
 *
 * Facebook keeps the picture it fetched the first time an address was shared
 * and does not look again, so a redrawn card went on showing the old design
 * there while WhatsApp, which fetches afresh, showed the new one. A changed
 * address is the only thing Facebook reads as a new picture. Raise this
 * whenever a card's design changes. Posts already published keep the picture
 * they were shared with; Facebook's Sharing Debugger can be asked to look at a
 * single address again.
 */
export const CARD_VERSION = '2';

/** A drawn preview card, at the address the crawlers are given. */
export const cardImage = (path: string, alt: string) => ({
  url: `${path}?v=${CARD_VERSION}`,
  width: 1200,
  height: 630,
  type: 'image/png',
  alt,
});

/** public/og-image-v3.png: the mymp mark on white (npm run og-image); a new name makes crawlers and messaging apps fetch it afresh. */
export const SHARE_IMAGE = {
  url: '/og-image-v3.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'আমার এমপি: বাংলাদেশের সংসদ সদস্যদের তথ্য',
};

export const BASE_OPEN_GRAPH: NonNullable<Metadata['openGraph']> = {
  type: 'website',
  siteName: SITE_NAME,
  locale: 'bn_BD',
  images: [SHARE_IMAGE],
};

/** The Open Graph defaults for a language: its site name and locale, the other language as the alternate. */
export function baseOpenGraph(lang: Lang): NonNullable<Metadata['openGraph']> {
  return lang === 'en'
    ? { ...BASE_OPEN_GRAPH, siteName: SITE_NAME_EN, locale: 'en_GB', alternateLocale: ['bn_BD'], images: [shareImageIn('en')] }
    : { ...BASE_OPEN_GRAPH, alternateLocale: ['en_GB'] };
}

/**
 * A page's canonical address in its own language and its address in the
 * other, so search engines show each reader their language's page and do not
 * take the two for duplicates. Bangla is the default (x-default).
 */
export function langAlternates(lang: Lang, path: string): NonNullable<Metadata['alternates']> {
  const bn = hrefIn('bn', path);
  const en = hrefIn('en', path);
  return { canonical: lang === 'en' ? en : bn, languages: { 'bn-BD': bn, en, 'x-default': bn } };
}

export const BASE_TWITTER: NonNullable<Metadata['twitter']> = {
  card: 'summary_large_image',
  images: [SHARE_IMAGE],
};

/** The site's share image with its description in the page's language. */
const shareImageIn = (lang: Lang) => (lang === 'en' ? { ...SHARE_IMAGE, alt: 'My MP: the members of the Parliament of Bangladesh' } : SHARE_IMAGE);

/** Twitter's defaults for a language. */
export const baseTwitter = (lang: Lang): NonNullable<Metadata['twitter']> => ({ ...BASE_TWITTER, images: [shareImageIn(lang)] });

/**
 * The share tags for one page: the site's Open Graph defaults plus the page's
 * own address (og:url), and a page image where it has one. Next fills
 * og:title and og:description from the page's title and description.
 */
/** Twitter's copy of a page image; a square photo gets the square "summary" card. Without one the site's image stays. */
export function shareTwitter(image?: { url: string; width: number; height: number; alt?: string } | null): NonNullable<Metadata['twitter']> {
  if (!image) return BASE_TWITTER;
  return { ...BASE_TWITTER, card: image.width === image.height ? 'summary' : 'summary_large_image', images: [image] };
}

export function shareGraph(
  path: string,
  image?: { url: string; width: number; height: number; alt?: string } | null,
  lang: Lang = 'bn',
): NonNullable<Metadata['openGraph']> {
  return { ...baseOpenGraph(lang), url: hrefIn(lang, path), ...(image ? { images: [image] } : {}) };
}
