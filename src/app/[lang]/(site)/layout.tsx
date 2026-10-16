import Link from '@/i18n/Link';
import { publishedNews } from '@/lib/data';
import { NAV, NAV_MORE, navIn } from '@/lib/nav';
import { getT } from '@/i18n/server';
import LangSwitch from '@/components/LangSwitch';
import SiteSearch from '@/components/SiteSearch';
import Brand from '@/components/Brand';
import MobileNav from '@/components/MobileNav';
import HeaderClock from '@/components/HeaderClock';
import Intro from '@/components/Intro';
import NewsTicker from '@/components/NewsTicker';
import SiteFooter from '@/components/SiteFooter';
import Icon from '@/components/Icon';
import { siteUrl, SITE_EMAIL, SITE_FACEBOOK } from '@/lib/site';

/**
 * How the site works, in three lines, above the footer (owner, 2026-09-12).
 * Each line ends in the page that answers it in full, so a reader who wants
 * the detail is one click away instead of reading a paragraph here.
 */
const HOW_IT_WORKS = [
  {
    icon: 'file',
    title: 'কোথা থেকে তথ্য আসে',
    titleEn: 'Where the information comes from',
    body: 'সদস্য, আসন, কমিটি ও অধিবেশন আসে জাতীয় সংসদের ওয়েবসাইট থেকে; ভোটার সংখ্যা নির্বাচন কমিশন ও মন্ত্রিসভা মন্ত্রিপরিষদ বিভাগ থেকে। ভোটের ফল ও জীবনীর সূত্র আলাদা করে প্রতিটি পাতায় লেখা।',
    bodyEn: 'Members, seats, committees and sessions come from the Parliament of Bangladesh website; voter numbers from the Election Commission, and the Cabinet from the Cabinet Division. The sources of election results and biographies are given separately on each page.',
    href: '/sutro',
    cta: 'সব সূত্র দেখুন',
    ctaEn: 'See all sources',
  },
  {
    icon: 'refresh',
    title: 'কত দিন পরপর হালনাগাদ',
    titleEn: 'How often it is updated',
    body: 'প্রতি রাতে পুরো সাইট সংসদের তথ্যভান্ডার থেকে নতুন করে তৈরি হয়। নতুন প্রজ্ঞাপন, বৈঠকের কার্যসূচি বা কমিটির পরিবর্তন পরদিনের মধ্যে যুক্ত হয়; সংবাদ শিরোনাম দিনে কয়েকবার।',
    bodyEn: "Every night the whole site is rebuilt from Parliament's database. A new notification, a sitting's order of the day or a change to a committee appears by the next day; news headlines several times a day.",
    href: '/sutro',
    cta: 'পদ্ধতি',
    ctaEn: 'Method',
  },
  {
    icon: 'flag',
    title: 'ভুল পেলে',
    titleEn: 'If you find a mistake',
    body: 'প্রতিটি সদস্যের পাতায় “সংশোধন জানান” বোতাম আছে। সূত্রসহ জানালে ২৪ ঘণ্টার মধ্যে যাচাই করে ঠিক করা হয়; সদস্যের দপ্তর নিজের পাতাও হালনাগাদ করাতে পারেন।',
    bodyEn: "Every member's page has a “Report a correction” button. Send it with a source and it is checked and fixed within 24 hours; a member's office can also have their own page updated.",
    href: '/jogajog',
    cta: 'যোগাযোগ',
    ctaEn: 'Contact',
  },
];

/** Tells search engines who publishes the site, which image is its logo, and its own page and address. */
const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${siteUrl}/#organization`,
  name: 'আমার এমপি',
  alternateName: ['mymp', 'My MP'],
  url: siteUrl,
  logo: `${siteUrl}/icon-512.png`,
  email: SITE_EMAIL,
  sameAs: [SITE_FACEBOOK],
};

/** Public site shell. Reads no session, so every page beneath it can be prerendered. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const nav = navIn(NAV, t.lang);
  const navMore = navIn(NAV_MORE, t.lang);
  // The ticker starts from this build's headlines and then asks for newer ones itself.
  const headlines = publishedNews()
    .slice(0, 12)
    .map(({ id, titleBn, sourceName, sourceUrl }) => ({ id, titleBn, sourceName, sourceUrl }));

  return (
    <>
      <Intro />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION) }} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand focus:text-white"
      >
        {t('মূল বিষয়ে যান', 'Skip to content')}
      </a>

      {/* Today's date and time (Bangladesh), above the bar; it scrolls away and the bar stays.
          Centred on a phone, where a lone line at one edge looked lost. */}
      <div className="bg-[#10281f] text-[#cfdad3] text-[12.5px]">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-5 h-7 flex items-center justify-center sm:justify-end gap-2">
          <span className="live-dot text-logo" aria-hidden="true" />
          <HeaderClock />
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-surface border-b border-rule shadow-card">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-5">
          <div className="flex items-center gap-3 lg:gap-4 xl:gap-6 h-[60px] lg:h-16">
            <Brand label={t('আমার এমপি (mymp), হোম', 'My MP (mymp), home')} />

            <nav aria-label={t('প্রধান', 'Main')} className="hidden lg:flex items-center gap-0.5 grow text-[14.5px] font-semibold">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-2 xl:px-2.5 py-1.5 rounded-md whitespace-nowrap text-inksoft hover:text-brand hover:bg-brandsoft transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ms-auto lg:ms-0 w-[128px] sm:w-auto sm:grow lg:grow-0 min-w-0 sm:max-w-[300px] flex justify-end">
              <SiteSearch compact />
            </div>

            <LangSwitch />

            <MobileNav items={nav} more={navMore} />
          </div>
        </div>
      </header>

      <NewsTicker initial={headlines} />

      <main id="main" className="grow">{children}</main>

      <section aria-label={t('তথ্যের সূত্র ও হালনাগাদ', 'Sources and updates')} className="mt-6 sm:mt-16 border-t border-brandring bg-brandsoft">
        <div className="mx-auto max-w-[1200px] px-5 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {HOW_IT_WORKS.map((h) => (
            <div key={h.title} className="flex gap-4">
              <span className="shrink-0 w-11 h-11 rounded-xl bg-surface text-brand grid place-items-center ring-1 ring-brandring">
                <Icon name={h.icon} size={21} />
              </span>
              <div className="flex flex-col items-start gap-1.5">
                <h2 className="display text-[19px] font-bold text-ink">{t(h.title, h.titleEn)}</h2>
                <p className="text-[15.5px] leading-relaxed text-inksoft text-pretty">{t(h.body, h.bodyEn)}</p>
                <Link href={h.href} className="mt-0.5 text-[14.5px] font-semibold text-brand hover:underline">
                  {t(h.cta, h.ctaEn)} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
