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
  'Every member of the 13th Jatiya Sangsad (the Parliament of Bangladesh) in one place: seats, parties, reserved seats for women, parliamentary committees and sessions. Sources: the Parliament of Bangladesh and the Election Commission.';

export const siteName = (lang: Lang) => (lang === 'en' ? SITE_NAME_EN : SITE_NAME);
export const siteTitle = (lang: Lang) => (lang === 'en' ? SITE_TITLE_EN : SITE_TITLE);
export const siteDescription = (lang: Lang) => (lang === 'en' ? SITE_DESCRIPTION_EN : SITE_DESCRIPTION);

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
    ? { ...BASE_OPEN_GRAPH, siteName: SITE_NAME_EN, locale: 'en_GB', alternateLocale: ['bn_BD'], images: [{ ...SHARE_IMAGE, alt: 'My MP: the members of the Parliament of Bangladesh' }] }
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
