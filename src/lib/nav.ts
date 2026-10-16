/** Public navigation. Lives outside the layout because Next allows no extra exports there. */
export const NAV: NavItem[] = [
  { href: '/nirbachon', label: 'ত্রয়োদশ নির্বাচন', labelEn: '2026 Election' },
  { href: '/dol', label: 'দল', labelEn: 'Parties' },
  { href: '/mp', label: 'সব এমপি', labelEn: 'All MPs' },
  { href: '/ministers', label: 'মন্ত্রিসভা', labelEn: 'Cabinet' },
  { href: '/committee', label: 'কমিটি', labelEn: 'Committees' },
  { href: '/odhibeshon', label: 'অধিবেশন', labelEn: 'Sessions' },
  { href: '/parisonkhan', label: 'পরিসংখ্যান', labelEn: 'Statistics' },
  { href: '/songbad', label: 'সংবাদ', labelEn: 'News' },
];

export const NAV_MORE: NavItem[] = [
  { href: '/somporke', label: 'সম্পর্কে', labelEn: 'About' },
  { href: '/jogajog', label: 'যোগাযোগ', labelEn: 'Contact' },
  { href: '/gopaniyota', label: 'গোপনীয়তা নীতি', labelEn: 'Privacy policy' },
];

/** The old form of /mp?kind=reserved; links written with it still open on the reserved seats. */
export const RESERVED_HASH = '#songrokkhito';

export type FooterLink = { href: string; label: string; labelEn: string; external?: boolean };
export type NavItem = { href: string; label: string; labelEn: string };

/** A list of links with each label in the page's language. */
export const navIn = <X extends { label: string; labelEn: string }>(items: X[], lang: 'bn' | 'en'): (X & { label: string })[] =>
  items.map((it) => ({ ...it, label: lang === 'en' ? it.labelEn : it.label }));

/*
 * The footer's own lists (owner's spec, 2026-09-12). The header keeps NAV and
 * NAV_MORE unchanged. The spec's English paths map to the site's routes:
 * /districts → /nirbachon#jela (its district list; there is no district index),
 * /parties → /dol, /committees → /committee, /sessions → /odhibeshon,
 * /stats → /parisonkhan, /election-2026 → /nirbachon (redirected), /news → /songbad,
 * /about → /somporke, /sources → /sutro (new; redirected), /contact → /jogajog,
 * /privacy → /gopaniyota.
 */
/** The House: who sits in it and where they come from. */
export const FOOTER_HOUSE: FooterLink[] = [
  { href: '/mp', label: 'সব এমপি', labelEn: 'All MPs' },
  { href: '/sangrakkhito-ason', label: 'সংরক্ষিত নারী আসন', labelEn: 'Reserved seats for women' },
  { href: '/ason', label: 'সব আসন', labelEn: 'All seats' },
  { href: '/jela', label: 'জেলা অনুযায়ী', labelEn: 'By district' },
  { href: '/dol', label: 'দল', labelEn: 'Parties' },
  { href: '/ministers', label: 'মন্ত্রিসভা', labelEn: 'Cabinet' },
];

/** What the House does, and the numbers behind it. */
export const FOOTER_WORK: FooterLink[] = [
  { href: '/committee', label: 'কমিটি', labelEn: 'Committees' },
  { href: '/odhibeshon', label: 'অধিবেশন', labelEn: 'Sessions' },
  { href: '/nirbachon', label: 'নির্বাচন ২০২৬', labelEn: 'Election 2026' },
  { href: '/parisonkhan', label: 'পরিসংখ্যান', labelEn: 'Statistics' },
  { href: '/songbad', label: 'সংবাদ', labelEn: 'News' },
];

/** Kept for anything that still reads the old single list. */
export const FOOTER_SECTIONS: FooterLink[] = [...FOOTER_HOUSE, ...FOOTER_WORK];

export const FOOTER_ABOUT: FooterLink[] = [
  { href: '/somporke', label: 'সম্পর্কে', labelEn: 'About' },
  { href: '/sutro', label: 'তথ্যসূত্র ও পদ্ধতি', labelEn: 'Sources and method' },
  { href: '/jogajog', label: 'সংশোধন জানান', labelEn: 'Report a correction' },
  { href: '/gopaniyota', label: 'গোপনীয়তা নীতি ও শর্ত', labelEn: 'Privacy policy and terms' },
  { href: 'https://www.parliament.gov.bd', label: 'বাংলাদেশ জাতীয় সংসদ', labelEn: 'Parliament of Bangladesh', external: true },
  { href: 'https://www.ecs.gov.bd', label: 'নির্বাচন কমিশন', labelEn: 'Election Commission', external: true },
];
