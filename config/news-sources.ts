/**
 * Where the feed's news comes from.
 *
 * Every address here was fetched and counted on 2026-09-12, not copied from a
 * list: `rss` holds the feeds that answered with items, and `searchOnly` marks
 * the outlets that publish no usable feed, so the search collector knows it has
 * to cover them. Four of the outlets the brief names — যুগান্তর, কালের কণ্ঠ,
 * বাংলাদেশ প্রতিদিন, মানবজমিন — are in that second group, along with bdnews24,
 * সময় টিভি, কালবেলা and বাংলানিউজ২৪.
 *
 * Two free routes to that second group were tried and rejected: Google News
 * RSS answers a name query with a hundred items and reaches every one of these
 * outlets, but each link is an opaque news.google.com redirect whose target
 * cannot be recovered without reverse-engineering an internal endpoint, so the
 * feed could not link to the source.
 *
 * `sitemaps` is the third route and the one that changed the numbers. An
 * outlet's feed carries its top twenty stories; the news sitemap it publishes
 * for search engines carries everything it has filed, with the headline and the
 * time beside each address — ইত্তেফাক answers with a thousand, চ্যানেল ২৪ with
 * five hundred, where their feeds give twenty. That is the difference between a
 * page for the fifty members who make national news and a page for all of them,
 * because an ordinary member is named in a district story, never in the top
 * twenty. Every address below was fetched on 2026-09-13 and counted.
 *
 * `daily` marks the outlets whose sitemap is filed one day at a time, with the
 * date in the path: those can also be read backwards, which is what
 * `npm run feed:backfill` does.
 *
 * Some of these hosts answer 403 when asked twice in quick succession. They are
 * kept, and the collector spaces its requests instead of pretending to be a
 * browser.
 */
export interface NewsSource {
  /** Stable key, stored on every item. */
  key: string;
  nameBn: string;
  homepage: string;
  /** Feeds that answered with items. */
  rss?: string[];
  /** True when the outlet has no feed and only the search collector can reach it. */
  searchOnly?: boolean;
  /**
   * The outlet's news sitemap. `{d}` is filled with a date (YYYY-MM-DD) for the
   * outlets that file one sitemap per day.
   */
  sitemaps?: { url: string; daily?: boolean }[];
  /**
   * The outlet's dated archive of article addresses, with no headlines: `{d}`
   * is a day (YYYY-MM-DD) or, for `month`, the first of a month. These outlets
   * put the headline in the address itself, so `npm run feed:archive` reads
   * the headline from there, and opens only the articles that name a member.
   */
  archives?: { url: string; every: 'day' | 'month' }[];
  lang: 'bn' | 'en';
}

export const NEWS_SOURCES: NewsSource[] = [
  // ---- Bangla dailies and wires with working feeds
  { key: 'prothomalo', nameBn: 'প্রথম আলো', homepage: 'https://www.prothomalo.com', rss: ['https://www.prothomalo.com/feed/'], sitemaps: [{ url: 'https://www.prothomalo.com/news_sitemap.xml' }], lang: 'bn' },
  { key: 'ittefaq', nameBn: 'ইত্তেফাক', homepage: 'https://www.ittefaq.com.bd', rss: ['https://www.ittefaq.com.bd/feed/'], sitemaps: [{ url: 'https://www.ittefaq.com.bd/news-sitemap.xml' }], lang: 'bn' },
  { key: 'samakal', nameBn: 'সমকাল', homepage: 'https://samakal.com', rss: ['https://samakal.com/rss'], sitemaps: [{ url: 'https://samakal.com/news_sitemap.xml' }], archives: [{ url: 'https://samakal.com/sitemap/sitemap-daily-{d}.xml', every: 'day' }], lang: 'bn' },
  { key: 'banglatribune', nameBn: 'বাংলা ট্রিবিউন', homepage: 'https://www.banglatribune.com', rss: ['https://www.banglatribune.com/feed/'], sitemaps: [{ url: 'https://www.banglatribune.com/news-sitemap.xml' }], archives: [{ url: 'https://www.banglatribune.com/archive_{d}.xml', every: 'month' }], lang: 'bn' },
  { key: 'deshrupantor', nameBn: 'দেশ রূপান্তর', homepage: 'https://www.deshrupantor.com', rss: ['https://www.deshrupantor.com/feed/'], sitemaps: [{ url: 'https://www.deshrupantor.com/news-sitemap.xml' }], archives: [{ url: 'https://www.deshrupantor.com/{d}.xml', every: 'month' }], lang: 'bn' },
  { key: 'inqilab', nameBn: 'দৈনিক ইনকিলাব', homepage: 'https://dailyinqilab.com', rss: ['https://dailyinqilab.com/rss/rss.xml'], lang: 'bn' },
  { key: 'janakantha', nameBn: 'জনকণ্ঠ', homepage: 'https://www.dailyjanakantha.com', rss: ['https://www.dailyjanakantha.com/rss/rss.xml'], lang: 'bn' },
  { key: 'amardesh', nameBn: 'আমার দেশ', homepage: 'https://www.dailyamardesh.com', rss: ['https://www.dailyamardesh.com/feed'], sitemaps: [{ url: 'https://www.dailyamardesh.com/news-sitemap.xml' }], lang: 'bn' },
  { key: 'ajkerpatrika', nameBn: 'আজকের পত্রিকা', homepage: 'https://www.ajkerpatrika.com', rss: ['https://www.ajkerpatrika.com/feed'], sitemaps: [{ url: 'https://www.ajkerpatrika.com/news-sitemap.xml' }], lang: 'bn' },
  { key: 'jagonews24', nameBn: 'জাগো নিউজ ২৪', homepage: 'https://www.jagonews24.com', rss: ['https://www.jagonews24.com/rss/rss.xml'], sitemaps: [{ url: 'https://www.jagonews24.com/sitemaps/news-sitemap.xml' }], lang: 'bn' },
  { key: 'dhakapost', nameBn: 'ঢাকা পোস্ট', homepage: 'https://www.dhakapost.com', rss: ['https://www.dhakapost.com/rss/rss.xml'], sitemaps: [{ url: 'https://www.dhakapost.com/sitemaps/news-sitemap.xml' }], lang: 'bn' },
  { key: 'risingbd', nameBn: 'রাইজিংবিডি', homepage: 'https://www.risingbd.com', rss: ['https://www.risingbd.com/rss/rss.xml'], sitemaps: [{ url: 'https://www.risingbd.com/news-sitemap.xml' }], lang: 'bn' },
  { key: 'sangbad', nameBn: 'সংবাদ', homepage: 'https://sangbad.net.bd', rss: ['https://sangbad.net.bd/rss.xml'], lang: 'bn' },
  { key: 'barta24', nameBn: 'বার্তা২৪', homepage: 'https://barta24.com', rss: ['https://barta24.com/rss/rss.xml'], lang: 'bn' },
  { key: 'alokitobangladesh', nameBn: 'আলোকিত বাংলাদেশ', homepage: 'https://www.alokitobangladesh.com', rss: ['https://www.alokitobangladesh.com/rss/rss.xml'], lang: 'bn' },
  { key: 'sarabangla', nameBn: 'সারাবাংলা', homepage: 'https://sarabangla.net', rss: ['https://sarabangla.net/feed'], sitemaps: [{ url: 'https://sarabangla.net/sitemap.rss' }], lang: 'bn' },
  { key: 'arthosuchak', nameBn: 'অর্থসূচক', homepage: 'https://www.arthosuchak.com', rss: ['https://www.arthosuchak.com/feed/'], lang: 'bn' },
  { key: 'sharebiz', nameBn: 'শেয়ার বিজ', homepage: 'https://sharebiz.net', rss: ['https://sharebiz.net/rss/rss.xml'], lang: 'bn' },
  { key: 'bss', nameBn: 'বাসস', homepage: 'https://www.bssnews.net', rss: ['https://www.bssnews.net/rss/rss.xml'], lang: 'bn' },
  { key: 'netranews', nameBn: 'নেত্র নিউজ', homepage: 'https://netra.news', rss: ['https://netra.news/rss/'], lang: 'bn' },
  { key: 'bbcbangla', nameBn: 'বিবিসি বাংলা', homepage: 'https://www.bbc.com/bengali', rss: ['https://feeds.bbci.co.uk/bengali/rss.xml'], lang: 'bn' },

  // ---- Television
  { key: 'channel24', nameBn: 'চ্যানেল ২৪', homepage: 'https://www.channel24bd.tv', rss: ['https://www.channel24bd.tv/rss/rss.xml'], sitemaps: [{ url: 'https://www.channel24bd.tv/news-sitemap.xml' }], archives: [{ url: 'https://www.channel24bd.tv/sitemap/sitemap-daily-{d}.xml', every: 'day' }], lang: 'bn' },
  { key: 'itv', nameBn: 'ইনডিপেনডেন্ট টেলিভিশন', homepage: 'https://www.itvbd.com', rss: ['https://www.itvbd.com/feed/'], sitemaps: [{ url: 'https://www.itvbd.com/news-sitemap.xml' }], lang: 'bn' },
  { key: 'ekattor', nameBn: 'একাত্তর টিভি', homepage: 'https://ekattor.tv', rss: ['https://ekattor.tv/feed/'], sitemaps: [{ url: 'https://ekattor.tv/news-sitemap.xml' }], lang: 'bn' },
  { key: 'ekushey', nameBn: 'একুশে টেলিভিশন', homepage: 'https://www.ekushey-tv.com', rss: ['https://www.ekushey-tv.com/rss/rss.xml'], lang: 'bn' },
  { key: 'channeli', nameBn: 'চ্যানেল আই', homepage: 'https://www.channelionline.com', rss: ['https://www.channelionline.com/rss.xml'], sitemaps: [{ url: 'https://www.channelionline.com/news-sitemap.xml' }], lang: 'bn' },
  { key: 'news24bd', nameBn: 'নিউজ২৪', homepage: 'https://www.news24bd.tv', rss: ['https://www.news24bd.tv/rss.xml'], sitemaps: [{ url: 'https://www.news24bd.tv/daily-sitemap/{d}/sitemap.xml', daily: true }], lang: 'bn' },

  // ---- English
  { key: 'dhakatribune', nameBn: 'ঢাকা ট্রিবিউন', homepage: 'https://www.dhakatribune.com', rss: ['https://www.dhakatribune.com/feed/'], sitemaps: [{ url: 'https://www.dhakatribune.com/news-sitemap.xml' }], lang: 'en' },
  { key: 'dailystar', nameBn: 'দ্য ডেইলি স্টার', homepage: 'https://www.thedailystar.net', rss: ['https://www.thedailystar.net/rss.xml'], sitemaps: [{ url: 'https://www.thedailystar.net/googlenews.xml' }], lang: 'en' },
  { key: 'tbs', nameBn: 'দ্য বিজনেস স্ট্যান্ডার্ড', homepage: 'https://www.tbsnews.net', rss: ['https://www.tbsnews.net/top-news/rss.xml'], sitemaps: [{ url: 'https://www.tbsnews.net/bangla/googlenews.xml' }], lang: 'en' },
  { key: 'observerbd', nameBn: 'দ্য ডেইলি অবজারভার', homepage: 'https://www.observerbd.com', rss: ['https://www.observerbd.com/rss'], lang: 'en' },

  // ---- The owner's own outlet
  { key: 'durbinnews', nameBn: 'দুরবীন নিউজ', homepage: 'https://durbinnews.com', rss: ['https://durbinnews.com/feed.xml'], lang: 'bn' },

  // ---- No usable feed: the search collector has to reach these
  { key: 'jugantor', nameBn: 'যুগান্তর', homepage: 'https://www.jugantor.com', searchOnly: true, sitemaps: [{ url: 'https://www.jugantor.com/news_sitemap.xml' }], lang: 'bn' },
  { key: 'kalerkantho', nameBn: 'কালের কণ্ঠ', homepage: 'https://www.kalerkantho.com', searchOnly: true, sitemaps: [{ url: 'https://www.kalerkantho.com/daily-sitemap/{d}/sitemap.xml', daily: true }], lang: 'bn' },
  { key: 'bdpratidin', nameBn: 'বাংলাদেশ প্রতিদিন', homepage: 'https://www.bd-pratidin.com', searchOnly: true, sitemaps: [{ url: 'https://www.bd-pratidin.com/daily-sitemap/{d}/sitemap.xml', daily: true }], lang: 'bn' },
  { key: 'mzamin', nameBn: 'মানবজমিন', homepage: 'https://mzamin.com', searchOnly: true, lang: 'bn' },
  // Publishes a Google News sitemap (which the reader below can parse) but
  // answers 403 to anything that is not a browser, whatever User-Agent it
  // sends. Getting past that would mean disguising the client, so it stays
  // here for the search collector.
  { key: 'bdnews24', nameBn: 'বিডিনিউজ২৪', homepage: 'https://bdnews24.com', searchOnly: true, sitemaps: [{ url: 'https://bdnews24.com/news_sitemap.xml' }, { url: 'https://bangla.bdnews24.com/news_sitemap.xml' }], lang: 'bn' },
  { key: 'somoynews', nameBn: 'সময় টিভি', homepage: 'https://www.somoynews.tv', searchOnly: true, lang: 'bn' },
  // No feed, but a Google News sitemap that answers the collector (checked 2026-10-12: 500 stories).
  { key: 'jamuna', nameBn: 'যমুনা টিভি', homepage: 'https://jamuna.tv', searchOnly: true, sitemaps: [{ url: 'https://www.jamuna.tv/news_sitemap.xml' }], lang: 'bn' },
  { key: 'kalbela', nameBn: 'কালবেলা', homepage: 'https://www.kalbela.com', searchOnly: true, lang: 'bn' },
  { key: 'banglanews24', nameBn: 'বাংলানিউজ২৪', homepage: 'https://www.banglanews24.com', searchOnly: true, sitemaps: [{ url: 'https://www.banglanews24.com/daily-sitemap/{d}/sitemap.xml', daily: true }], lang: 'bn' },
  { key: 'nayadiganta', nameBn: 'নয়া দিগন্ত', homepage: 'https://www.dailynayadiganta.com', searchOnly: true, lang: 'bn' },
];

export const RSS_SOURCES = NEWS_SOURCES.filter((s) => s.rss?.length);
export const SITEMAP_SOURCES = NEWS_SOURCES.filter((s) => s.sitemaps?.length);
export const SEARCH_ONLY_SOURCES = NEWS_SOURCES.filter((s) => s.searchOnly);
export const sourceByKey = (key: string) => NEWS_SOURCES.find((s) => s.key === key);

/** How often the RSS collector should run, in minutes. */
export const RSS_INTERVAL_MINUTES = 30;
