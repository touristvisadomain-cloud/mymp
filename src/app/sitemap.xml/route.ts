import { allMembers as members, seats, parties, committees, meta, districtOf } from '@/lib/data';
import { allAdvisers, adviserPosts } from '@/lib/advisers';
import { siteUrl } from '@/lib/site';
import { hrefIn } from '@/i18n/core';

// Built once per deploy like the pages it lists; the data only changes with a publish.
export const dynamic = 'force-static';

type Entry = {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
  image?: string | null;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * Every page on the site, so a crawler finds all 349 members and 349 seats
 * rather than only what happens to be linked from the home page. Each page is
 * listed in both languages (Bangla at the plain address, English under /en),
 * each naming the other as its alternate.
 *
 * Written out here rather than with app/sitemap.ts: Next puts <image:image>
 * before <lastmod>, and the sitemap schema only allows extension elements
 * after <priority>, so every member entry broke the standard.
 */
export function GET() {
  const lastmod = new Date(meta.syncedAt).toISOString();
  const districtSlugs = [...new Set(seats.map((s) => districtOf(s)?.slug).filter((x): x is string => !!x))];

  const entries: Entry[] = [
    { path: '/', changefreq: 'daily', priority: 1 },
    { path: '/mp', changefreq: 'daily', priority: 0.9 },
    { path: '/nirbachon', changefreq: 'weekly', priority: 0.9 },
    { path: '/odhibeshon', changefreq: 'daily', priority: 0.8 },
    { path: '/dol', changefreq: 'weekly', priority: 0.8 },
    { path: '/committee', changefreq: 'weekly', priority: 0.8 },
    { path: '/ministers', changefreq: 'daily', priority: 0.8 },
    { path: '/parisonkhan', changefreq: 'weekly', priority: 0.8 },
    { path: '/ason', changefreq: 'weekly', priority: 0.8 },
    { path: '/jela', changefreq: 'weekly', priority: 0.8 },
    { path: '/sangrakkhito-ason', changefreq: 'weekly', priority: 0.7 },
    { path: '/songbad', changefreq: 'daily', priority: 0.6 },
    { path: '/somporke', changefreq: 'monthly', priority: 0.4 },
    { path: '/sutro', changefreq: 'monthly', priority: 0.4 },
    { path: '/jogajog', changefreq: 'monthly', priority: 0.4 },
    { path: '/gopaniyota', changefreq: 'yearly', priority: 0.2 },
    // Google Images finds each member's official photo from here.
    ...members.map((m): Entry => ({ path: `/mp/${m.slug}`, changefreq: 'weekly', priority: 0.8, image: m.photoUrl })),
    ...allAdvisers().map((a): Entry => ({ path: `/ministers/${a.slug}`, changefreq: 'monthly', priority: 0.6, image: adviserPosts(a).photoUrl })),
    ...seats.map((s): Entry => ({ path: `/ason/${s.slug}`, changefreq: 'weekly', priority: 0.7 })),
    ...districtSlugs.map((d): Entry => ({ path: `/jela/${d}`, changefreq: 'weekly', priority: 0.7 })),
    ...parties.map((p): Entry => ({ path: `/dol/${p.slug}`, changefreq: 'weekly', priority: 0.6 })),
    ...committees.map((c): Entry => ({ path: `/committee/${c.slug}`, changefreq: 'monthly', priority: 0.5 })),
  ];

  const urls = entries.flatMap((e) => {
    const bn = siteUrl + hrefIn('bn', e.path);
    const en = siteUrl + hrefIn('en', e.path);
    const alternates = [
      `<xhtml:link rel="alternate" hreflang="bn-BD" href="${esc(bn)}"/>`,
      `<xhtml:link rel="alternate" hreflang="en" href="${esc(en)}"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(bn)}"/>`,
    ];
    return [bn, en].map((loc) =>
      [
        '<url>',
        `<loc>${esc(loc)}</loc>`,
        `<lastmod>${lastmod}</lastmod>`,
        `<changefreq>${e.changefreq}</changefreq>`,
        `<priority>${e.priority}</priority>`,
        ...alternates,
        ...(e.image ? ['<image:image>', `<image:loc>${esc(e.image)}</image:loc>`, '</image:image>'] : []),
        '</url>',
      ].join('\n'),
    );
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
