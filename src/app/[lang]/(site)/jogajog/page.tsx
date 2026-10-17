import type { Metadata } from 'next';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import Link from '@/i18n/Link';
import { Page, PageHead, Card } from '@/components/ui';
import Icon from '@/components/Icon';
import BrandIcon from '@/components/BrandIcon';
import { SITE_EMAIL, SITE_FACEBOOK } from '@/lib/site';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/jogajog'),
    ...pageShare('jogajog', t),
    title: t('যোগাযোগ ও সংশোধন', 'Contact and corrections'),
    description: fitDescription(
      t.en
        ? `Contact My MP by email (${SITE_EMAIL}) or on Facebook: how to report a mistake, how an MP's office can update their page, and how to reach an MP.`
        : `আমার এমপির সঙ্গে যোগাযোগ: ইমেইল ${SITE_EMAIL} বা ফেসবুক পেজ। ভুল তথ্য কীভাবে জানাবেন, সংসদ সদস্য বা তাঁর দপ্তর নিজের পাতা কীভাবে হালনাগাদ করাবেন, আর কোনো সদস্যের সঙ্গে যোগাযোগ কোথায়, এই পাতায়।`,
    ),
  };
}

/**
 * The contact page. Three things a reader comes here for, in the order they
 * come: to reach the site, to get something corrected, to reach a member.
 * The GitHub issue tracker was dropped from this page on 23 September 2026 at
 * the owner's request; the code stays public, but readers write to the site
 * by email or Facebook.
 */

const WAYS = [
  {
    title: 'সাইটে কোনো তথ্য ভুল',
    titleEn: 'Something on the site is wrong',
    body: 'সদস্যের পাতার নিচে "সংশোধন জানান" বোতাম আছে; সেখান থেকে পাঠালে পাতাটা আপনাআপনি যুক্ত হয়ে যায়। ইমেইলে জানালে পাতার লিংক, কোন তথ্যটা ভুল আর সঠিকটা কোথায় লেখা আছে (সংবাদ, গেজেট বা সরকারি সাইটের লিংক), এই তিনটা দিন।',
    bodyEn: 'At the bottom of a member’s page there is a "Report a correction" button; if you send it from there, the page is attached automatically. If you write by email, give these three things: the link to the page, which information is wrong, and where the correct information is written (a link to a news report, the gazette or a government website).',
  },
  {
    title: 'আপনি সংসদ সদস্য বা তাঁর দপ্তর',
    titleEn: 'You are a member of parliament or their office',
    body: 'নিজের পাতার ছবি, পরিচিতি, ফেসবুক পেজ বা ওয়েবসাইট হালনাগাদ করাতে চাইলে দাপ্তরিক ইমেইল থেকে লিখুন, অথবা যাচাই করা যায় এমন সূত্র (নিজের ওয়েবসাইট, দলের সাইট, সংবাদ) দিন। "যাচাই করা হয়নি" লেখা ফেসবুক পেজ এভাবেই যাচাইকৃত হয়।',
    bodyEn: 'To have the photo, profile, Facebook page or website on your own page updated, write from your official email, or give a source that can be checked (your own website, your party’s site, a news report). This is how a Facebook page marked "Not verified" becomes verified.',
  },
  {
    title: 'কোনো সংবাদ ভুল সদস্যের পাতায় গেছে',
    titleEn: 'A news story is on the wrong member’s page',
    body: 'সংবাদ অংশে শিরোনাম যুক্ত হয় নাম মিলিয়ে, তাই একই নামের অন্য কারও খবর কখনো ভুল পাতায় যেতে পারে। খবরের লিংক আর সদস্যের নাম জানালে সরিয়ে দেওয়া হয়।',
    bodyEn: 'Headlines are added to the news section by matching names, so a story about someone else with the same name can sometimes end up on the wrong page. Send the link to the story and the member’s name, and it is removed.',
  },
  {
    title: 'তথ্য ব্যবহার করতে চান',
    titleEn: 'You want to use the information',
    body: 'সাইটের সব তথ্য প্রকাশ্য সূত্র থেকে নেওয়া; "আমার এমপি, mymp.bd" সূত্র উল্লেখ করে যে কেউ ব্যবহার করতে পারেন। গবেষণা বা সংবাদের কাজে পুরো তালিকা লাগলে ইমেইলে চাইলে দেওয়া হয়।',
    bodyEn: 'All the information on the site is taken from public sources; anyone may use it, citing "My MP, mymp.bd" as the source. If you need the full list for research or news work, ask by email and it will be provided.',
  },
];

export default async function ContactPage() {
  const t = await getT();
  return (
    <Page>
      <PageHead
        eyebrow={t('আমার এমপি', 'My MP')}
        title={t('যোগাযোগ', 'Contact')}
        lede={t(
          'ভুল তথ্য জানাতে, নিজের পাতা হালনাগাদ করাতে, বা সাইট নিয়ে কিছু বলতে। সূত্রসহ জানালে ২৪ ঘণ্টার মধ্যে যাচাই করে ব্যবস্থা নেওয়া হয়।',
          'To report wrong information, to have your own page updated, or to say something about the site. Send it with a source and it is checked and acted on within 24 hours.',
        )}
      />

      <div className="pt-8 pb-14 flex flex-col gap-6 max-w-[760px]">
        <Card className="p-6 flex flex-col gap-4">
          <h2 className="display text-[21px] font-bold">{t('আমার এমপির সঙ্গে যোগাযোগ', 'Contacting My MP')}</h2>
          <p className="text-[15.5px] leading-relaxed text-inksoft">
            {t(
              'ইমেইল সবচেয়ে ভালো: লিংক আর সূত্র সঙ্গে দেওয়া যায়, আর উত্তরটাও লিখিত থাকে। ফেসবুক পেজে বার্তা পাঠালেও একই লোক পড়েন।',
              'Email is best: you can include links and sources, and the reply is in writing too. Messages sent to the Facebook page are read by the same people.',
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`mailto:${SITE_EMAIL}`}
              className="h-12 px-5 inline-flex items-center gap-2.5 rounded-xl bg-brand text-white text-[15px] font-semibold hover:bg-branddark transition-colors"
            >
              <Icon name="mail" size={18} />
              {SITE_EMAIL}
            </a>
            <a
              href={SITE_FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-5 inline-flex items-center gap-2.5 rounded-xl border border-rule bg-surface text-[15px] font-semibold hover:border-brand hover:text-brand transition-colors"
            >
              <BrandIcon name="facebook" size={18} />
              {t('ফেসবুক পেজ', 'Facebook page')}
              <Icon name="external" size={14} className="text-muted" />
            </a>
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted border-t border-rule pt-3">
            {t(
              'আপনার নাম বা ইমেইল কোথাও প্রকাশ হয় না; শুধু সংশোধনটা আর তার সূত্র রাখা হয়।',
              'Your name and email are never published anywhere; only the correction and its source are kept.',
            )}{' '}
            <Link href="/gopaniyota" className="text-brand font-semibold hover:underline">{t('গোপনীয়তা নীতি', 'Privacy policy')}</Link>
          </p>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold px-1">{t('কোন কাজে কী লিখবেন', 'What to write in each case')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WAYS.map((w) => (
              <Card key={w.title} className="p-5 flex flex-col gap-2">
                <h3 className="display text-[16.5px] font-bold">{t(w.title, w.titleEn)}</h3>
                <p className="text-[14.5px] leading-relaxed text-inksoft text-pretty">{t(w.body, w.bodyEn)}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">{t('কোনো সংসদ সদস্যের সঙ্গে যোগাযোগ', 'Contacting a member of parliament')}</h2>
          {t.en ? (
            <p className="text-[15.5px] leading-relaxed text-inksoft">
              This site is not any member&rsquo;s office, and it does not take or pass on messages on their behalf. Every member&rsquo;s
              page has, in its &ldquo;Contact&rdquo; section, the official email provided by Parliament (for example{' '}
              <span className="font-mono text-[14px]">panchagarh.1@parliament.gov.bd</span>), and also the verified Facebook page or
              website of those who have one. Write to them there directly.{' '}
              <Link href="/mp" className="text-brand font-semibold hover:underline">List of members →</Link>
            </p>
          ) : (
            <p className="text-[15.5px] leading-relaxed text-inksoft">
              এই সাইট কোনো সদস্যের দপ্তর নয়, তাঁদের পক্ষে বার্তা নেয় না বা পৌঁছে দেয় না। প্রত্যেক সদস্যের পাতায়
              &ldquo;যোগাযোগ&rdquo; অংশে জাতীয় সংসদের দেওয়া দাপ্তরিক ইমেইল আছে (যেমন{' '}
              <span className="font-mono text-[14px]">panchagarh.1@parliament.gov.bd</span>), আর যাঁদের যাচাইকৃত ফেসবুক
              পেজ বা ওয়েবসাইট আছে, সেগুলোও। সরাসরি সেখানে লিখুন।{' '}
              <Link href="/mp" className="text-brand font-semibold hover:underline">সদস্যদের তালিকা →</Link>
            </p>
          )}
          <p className="text-[14.5px] leading-relaxed text-muted">
            {t(
              'সদস্যদের ব্যক্তিগত মোবাইল নম্বর বা বাসার ঠিকানা এই সাইটে রাখা হয় না, চাইলেও দেওয়া যায় না।',
              'Members’ personal mobile numbers and home addresses are not kept on this site, and cannot be given out even on request.',
            )}
          </p>
        </Card>
      </div>
    </Page>
  );
}
