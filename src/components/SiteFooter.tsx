import Link from '@/i18n/Link';
import Brand from './Brand';
import Icon from './Icon';
import BrandIcon from './BrandIcon';
import { meta } from '@/lib/data';
import { FOOTER_HOUSE, FOOTER_WORK, FOOTER_ABOUT, navIn, type FooterLink } from '@/lib/nav';
import { getT } from '@/i18n/server';
import { SITE_EMAIL, SITE_FACEBOOK } from '@/lib/site';

/*
 * The footer on every public page (owner's spec, 2026-09-12, reshaped
 * 2026-09-23): brand, then three short link columns (সংসদ, কার্যক্রম, আমার
 * এমপি) side by side, so no column runs eleven links deep while the others
 * end halfway; on a tablet the three columns share a row under the brand, on
 * a phone they stack two abreast; then the bottom line. Text is 15-16px in clear light tones, since the owner found the first
 * version small and grey. On the green (#10281f) the body text #dbe6df is
 * 13:1, the logo-green headings #6ee79a 9.8:1, the bottom line #b9c7bf 9.2:1,
 * links white. No letter spacing on headings: it pulls Bangla letters apart.
 * External links carry ↗; internal ones do not.
 */
const HEADING = 'text-[15px] font-bold text-[#6ee79a]';
const LINK = 'text-white hover:text-[#6ee79a] transition-colors';
const NAV = 'flex flex-col gap-4 border-t border-white/15 pt-6 lg:border-0 lg:pt-0';
const LINKS = 'flex flex-col gap-y-3 text-[15.5px] sm:text-[16px] leading-snug';
const PILL = 'h-11 px-4 inline-flex items-center gap-2 rounded-full bg-white/10 text-white text-[15px] font-semibold hover:bg-white/20 transition-colors';

function FooterItem({ item }: { item: FooterLink }) {
  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {item.label} ↗
    </a>
  ) : (
    <Link href={item.href} className={LINK}>
      {item.label}
    </Link>
  );
}

export default async function SiteFooter() {
  const t = await getT();
  return (
    <footer className="bg-[#10281f] text-[#cfdad3] border-t-[3px] border-transparent [border-image:linear-gradient(90deg,var(--color-brand),var(--color-logo),var(--color-brand))_1]">
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:py-12 flex flex-col gap-8 sm:gap-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-8 lg:gap-12">
          <div className="flex flex-col gap-5 max-w-[440px] lg:pe-4">
            <Brand tone="light" label={t('আমার এমপি (mymp), হোম', 'My MP (mymp), home')} />
            <p className="text-[16px] leading-relaxed text-[#dbe6df]">
              {t(
                'বাংলাদেশ জাতীয় সংসদের সদস্য, আসন, কমিটি ও অধিবেশনের উন্মুক্ত তথ্যভান্ডার। মূল তথ্য জাতীয় সংসদ ও নির্বাচন কমিশন থেকে; বাকি তথ্যের সূত্র ও যাচাইয়ের অবস্থা প্রতিটি পাতায় লেখা। কোনো তথ্য অনুমান করে বসানো হয় না।',
                'An open database of the members, seats, committees and sessions of the Parliament of Bangladesh. The core information comes from the Parliament and the Election Commission; for everything else, the source and how far it has been checked are given on each page. Nothing is filled in by guesswork.',
              )}
            </p>
            {/* The owner asked for this line to stand out. */}
            <div className="flex gap-3 rounded-xl border border-[#17cf54]/40 bg-[#17cf54]/10 px-4 py-3.5">
              <Icon name="shield" size={24} className="text-[#6ee79a] mt-0.5" />
              <p className="text-[15px] leading-relaxed text-white">
                <strong className="block text-[17px] font-bold text-[#6ee79a]">{t('একটি স্বাধীন উদ্যোগ।', 'An independent initiative.')}</strong>
                {t('এটি কোনো সরকারি সাইট নয়; কোনো দল বা সংসদ সদস্যের সঙ্গে সম্পর্ক নেই।', 'This is not a government website, and it has no connection with any party or member of parliament.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <a href={SITE_FACEBOOK} target="_blank" rel="noopener noreferrer" className={PILL}>
                <BrandIcon name="facebook" size={17} color="#ffffff" />
                {t('ফেসবুক পেজ', 'Facebook page')} ↗
              </a>
              <a href={`mailto:${SITE_EMAIL}`} title={SITE_EMAIL} aria-label={`${t('ইমেইল', 'Email')}: ${SITE_EMAIL}`} className={PILL}>
                <Icon name="mail" size={16} />
                {t('ইমেইল', 'Email')}
              </a>
            </div>
          </div>

          {/* Below lg the three columns share one grid: two abreast on a phone, three on a tablet. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:contents">
            <nav aria-label={t('সংসদ', 'Parliament')} className={NAV}>
              <span className={HEADING}>{t('সংসদ', 'Parliament')}</span>
              <div className={LINKS}>
                {navIn(FOOTER_HOUSE, t.lang).map((item) => (
                  <FooterItem key={item.label} item={item} />
                ))}
              </div>
            </nav>

            <nav aria-label={t('কার্যক্রম', 'Work')} className={NAV}>
              <span className={HEADING}>{t('কার্যক্রম', 'Work')}</span>
              <div className={LINKS}>
                {navIn(FOOTER_WORK, t.lang).map((item) => (
                  <FooterItem key={item.label} item={item} />
                ))}
              </div>
            </nav>

            <nav aria-label={t('আমার এমপি', 'My MP')} className={`${NAV} col-span-2 sm:col-span-1`}>
              <span className={HEADING}>{t('আমার এমপি', 'My MP')}</span>
              <div className={LINKS}>
                {navIn(FOOTER_ABOUT, t.lang).map((item) => (
                  <FooterItem key={item.label} item={item} />
                ))}
              </div>
            </nav>
          </div>
        </div>

        <div className="border-t border-white/15 pt-5 flex flex-col sm:flex-row gap-2 justify-between text-[14px] text-[#b9c7bf]">
          <span>{t('© ২০২৬ আমার এমপি, mymp.bd', '© 2026 My MP, mymp.bd')}</span>
          {/* The date of the sync this build was made from (data/meta.json, written by every sync run). */}
          <span>{t('সংসদের তথ্যভান্ডার থেকে হালনাগাদ', "Updated from Parliament's database on")} {t.date(meta.syncedAt)}</span>
        </div>
      </div>
    </footer>
  );
}
