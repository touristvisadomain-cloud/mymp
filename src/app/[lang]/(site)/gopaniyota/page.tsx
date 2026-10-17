import type { Metadata } from 'next';
import { shareGraph, langAlternates } from '@/lib/seo';
import { Page, PageHead, Card } from '@/components/ui';
import { dateBn } from '@/lib/data';
import { SITE_EMAIL, SITE_FACEBOOK } from '@/lib/site';
import { getT } from '@/i18n/server';

/*
 * The owner's text (2026-09-12). Three sentences are adjusted to match how the
 * site works: photos load from the site's own storage, not parliament.gov.bd;
 * some facts come from news outlets and Wikipedia, cited on each page; and the
 * correction form keeps only the correction it is sent. Home addresses were
 * taken off the member pages so that "we do not publish them" is true.
 *
 * The English is a translation of the Bangla, sentence for sentence: it says
 * no more and no less. Change both together.
 */
const UPDATED = '2026-09-12';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/gopaniyota'),
    openGraph: shareGraph('/gopaniyota', undefined, t.lang),
    title: t('গোপনীয়তা নীতি ও ব্যবহারের শর্ত', 'Privacy policy and terms of use'),
    description: t(
      'আমার এমপি সাইট আপনার সম্পর্কে কোনো ব্যক্তিগত তথ্য সংগ্রহ করে না। সদস্যদের কোন তথ্য প্রকাশ হয় আর কোনটি হয় না, এবং সাইটের তথ্য কোন শর্তে ব্যবহার করা যায়, এই পাতায়।',
      'The My MP site collects no personal information about you. Which information about members is published and which is not, and on what terms the site’s information may be used, are set out on this page.',
    ),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 flex flex-col gap-3">
      <h2 className="display text-[21px] font-bold">{title}</h2>
      <div className="flex flex-col gap-2.5 text-[15.5px] leading-relaxed text-inksoft">{children}</div>
    </Card>
  );
}

const link = 'text-brand font-semibold hover:underline';

function Contact() {
  return (
    <>
      আমাদের{' '}
      <a href={SITE_FACEBOOK} target="_blank" rel="noopener noreferrer" className={link}>ফেসবুক পেজে</a> মেসেজ করে বা{' '}
      <a href={`mailto:${SITE_EMAIL}`} className={link}>{SITE_EMAIL}</a> ঠিকানায় ইমেইল করে
    </>
  );
}

/** <Contact /> in English: "by messaging our Facebook page or by emailing …". */
function ContactEn() {
  return (
    <>
      by messaging our{' '}
      <a href={SITE_FACEBOOK} target="_blank" rel="noopener noreferrer" className={link}>Facebook page</a> or by emailing{' '}
      <a href={`mailto:${SITE_EMAIL}`} className={link}>{SITE_EMAIL}</a>
    </>
  );
}

export default async function PrivacyPage() {
  const t = await getT();
  return (
    <Page>
      <PageHead
        eyebrow={t('আমার এমপি', 'My MP')}
        title={t('গোপনীয়তা নীতি ও ব্যবহারের শর্ত', 'Privacy policy and terms of use')}
        lede={
          t.en
            ? `In short: this site collects no personal information about you. Last updated: ${t.date(UPDATED)}.`
            : `সংক্ষেপে: এই সাইট আপনার সম্পর্কে কোনো ব্যক্তিগত তথ্য সংগ্রহ করে না। সর্বশেষ হালনাগাদ: ${dateBn(UPDATED)}।`
        }
      />

      {t.en ? (
        <div className="pt-8 pb-14 flex flex-col gap-6 max-w-[760px]">
          <Section title="What we keep about you">
            <p>
              Nothing. This site has no way to open an account or to log in, and no form asks for your name, email or phone number.
              What you type in the search box stays in your browser; it is not sent to or stored on any server.
            </p>
            <p>
              If you send something through &ldquo;Report a correction&rdquo; on a member&rsquo;s page, only the correction you write and
              the link to your source are kept, for checking; there too, no name or email is asked for.
            </p>
            <p>
              At present this site has no advertising, no cookies and no third-party tracking scripts. If, in future, an analytics service
              is added to understand how many people are visiting the site, this page will say so, and no personal identity will be
              collected through it either.
            </p>
            <p>
              The site is hosted on our own server. Like any web server, it keeps ordinary server logs for a limited time (such as IP
              addresses and the times of requests), which help with security and with keeping the service running. We do not look at these logs
              or use them for any purpose.
            </p>
            <p>
              The photos of members of parliament are copies of the photos on the Parliament&rsquo;s website, loaded from our image storage
              (Supabase). When you view a photo, your browser sends a request to that storage; as with any web server, ordinary logs are
              kept there too, which we do not use for any purpose.
            </p>
          </Section>

          <Section title="Android app">
            <p>
              The &ldquo;My MP&rdquo; app shows this same site&rsquo;s information and works on the same policy: no account is needed, no
              personal information is collected, and there is no advertising or third-party tracking. Our answer on Google Play&rsquo;s
              Data safety form is therefore &ldquo;No data collected&rdquo;.
            </p>
            <p>
              The app asks only for permission to use the internet, to fetch information from mymp.bd. The list of members of parliament
              is stored on your phone itself, so that the app opens even when there is no network; this copy stays only on your phone,
              is not sent anywhere, and is deleted when you delete the app.
            </p>
            <p>
              Tapping a news headline opens the news outlet&rsquo;s own page in your browser; what happens from there on is governed by
              that outlet&rsquo;s own policy. The news pictures, too, are shown from the outlets&rsquo; own servers and are not copied
              anywhere on our side.
            </p>
            <p>
              On the English pages, news headlines are translated from Bangla by Google Translate (Google Cloud Translation). The
              translation is made on our server when a headline is collected, not in your browser: only the headline&rsquo;s text, which
              the outlet has already published, is sent to Google, and nothing about you or what you read.
            </p>
          </Section>

          <Section title="Information about members of parliament">
            <p>
              The people whose information is on this site are elected representatives of the people. The core information is taken
              from the public databases of the Parliament of Bangladesh and the Election Commission; some information, such as election
              results, education or party history, comes from public sources such as news outlets and Wikipedia, and the source of each
              item is given on the page concerned. We add no information of our own, and we do not guess.
            </p>
            <p>
              Even where members&rsquo; personal mobile numbers or home addresses are in Parliament&rsquo;s database, we do not publish
              them. Only official contact details are shown.
            </p>
            <p>
              If a member or their office believes that any information is wrong, out of date or inappropriate, let us know, with a
              source, <ContactEn />, and it is checked and acted on within 24 hours.
            </p>
          </Section>

          <Section title="Terms of use">
            <p>
              All the information on the site is taken from public sources, most of them government sources. Anyone may use, quote or
              share this information, citing &ldquo;My MP, mymp.bd&rdquo; as the source. The site&rsquo;s design, text and organised
              database are the site&rsquo;s own; the whole site or its code may not be copied without permission.
            </p>
            <p>
              Every effort is made to keep the information accurate and up to date, but the definitive source is always the Parliament
              and the Election Commission. Before using it for any legal, official or journalistic purpose, check it against the
              original source. The site accepts no liability for any loss caused by an error in the information.
            </p>
            <p>
              My MP is an independent, private initiative. It is not a website of the Government of Bangladesh or of the Parliament, and
              it has no connection with any member of parliament, political party or the Election Commission.
            </p>
          </Section>

          <Section title="Changes to this policy, and contact">
            <p>
              If the policy changes, this will be announced on this page by changing the date it was last updated. For any question or
              correction, let us know <ContactEn />.
            </p>
          </Section>
        </div>
      ) : (
      <div className="pt-8 pb-14 flex flex-col gap-6 max-w-[760px]">
        <Section title="আপনার সম্পর্কে আমরা কী রাখি">
          <p>
            কিছুই না। এই সাইটে অ্যাকাউন্ট খোলা বা লগইন করার ব্যবস্থা নেই, কোনো ফরমে আপনার নাম, ইমেইল বা ফোন নম্বর চাওয়া
            হয় না। খোঁজার ঘরে আপনি যা লেখেন তা আপনার ব্রাউজারেই থাকে; কোনো সার্ভারে পাঠানো বা সংরক্ষণ করা হয় না।
          </p>
          <p>
            সদস্যের পাতায় “সংশোধন জানান” দিয়ে কিছু পাঠালে শুধু আপনার লেখা সংশোধন ও সূত্রের লিংক যাচাইয়ের জন্য রাখা হয়;
            সেখানেও নাম বা ইমেইল চাওয়া হয় না।
          </p>
          <p>
            বর্তমানে এই সাইটে কোনো বিজ্ঞাপন, কুকি বা তৃতীয় পক্ষের ট্র্যাকিং স্ক্রিপ্ট নেই। ভবিষ্যতে সাইট কত মানুষ দেখছেন তা
            বোঝার জন্য কোনো পরিসংখ্যান সেবা যুক্ত হলে এই পাতায় তা জানানো হবে এবং তাতেও ব্যক্তিগত পরিচয় সংগ্রহ করা হবে না।
          </p>
          <p>
            সাইটটি আমাদের নিজস্ব সার্ভারে হোস্ট করা। যেকোনো ওয়েব সার্ভারের মতো সেটি সীমিত সময়ের জন্য সাধারণ সার্ভার লগ রাখে (যেমন IP
            ঠিকানা ও অনুরোধের সময়), যা নিরাপত্তা ও সেবা সচল রাখার কাজে লাগে। আমরা এই লগ দেখি না বা কোনো কাজে ব্যবহার করি না।
          </p>
          <p>
            সংসদ সদস্যদের ছবি জাতীয় সংসদের ওয়েবসাইটের ছবির কপি, যা আমাদের ছবির স্টোরেজ (Supabase) থেকে লোড হয়। ছবি দেখার
            সময় আপনার ব্রাউজার সেই স্টোরেজে একটি অনুরোধ পাঠায়; যেকোনো ওয়েব সার্ভারের মতো সেখানেও সাধারণ লগ থাকে, যা আমরা
            কোনো কাজে ব্যবহার করি না।
          </p>
        </Section>

        <Section title="অ্যান্ড্রয়েড অ্যাপ">
          <p>
            “আমার এমপি” অ্যাপটি এই সাইটেরই তথ্য দেখায় এবং একই নীতিতে চলে: কোনো অ্যাকাউন্ট লাগে না, কোনো ব্যক্তিগত তথ্য
            সংগ্রহ করা হয় না, কোনো বিজ্ঞাপন বা তৃতীয় পক্ষের ট্র্যাকিং নেই। Google Play-র ডেটা সেফটি ফর্মে আমাদের উত্তর
            তাই “কোনো তথ্য সংগ্রহ করা হয় না”।
          </p>
          <p>
            অ্যাপ শুধু ইন্টারনেট ব্যবহারের অনুমতি চায়, mymp.bd থেকে তথ্য আনার জন্য। সংসদ সদস্যদের তালিকাটি আপনার ফোনেই
            জমা রাখা হয়, যাতে নেটওয়ার্ক না থাকলেও অ্যাপ খোলে; এই কপি শুধু আপনার ফোনে থাকে, কোথাও পাঠানো হয় না, আর
            অ্যাপ মুছে ফেললে তাও মুছে যায়।
          </p>
          <p>
            কোনো সংবাদের শিরোনামে চাপ দিলে তা আপনার ব্রাউজারে সংশ্লিষ্ট সংবাদমাধ্যমের নিজস্ব পাতায় খোলে; সেখান থেকে
            তারপর কী হয় তা সেই সংবাদমাধ্যমের নিজস্ব নীতির অধীন। সংবাদের ছবিগুলোও সংবাদমাধ্যমের নিজস্ব সার্ভার থেকেই
            দেখানো হয়, আমাদের কোথাও কপি করা হয় না।
          </p>
        </Section>

        <Section title="সংসদ সদস্যদের তথ্য">
          <p>
            এই সাইটে যাঁদের তথ্য আছে তাঁরা নির্বাচিত জনপ্রতিনিধি। মূল তথ্য বাংলাদেশ জাতীয় সংসদ ও নির্বাচন কমিশনের প্রকাশ্য
            তথ্যভান্ডার থেকে নেওয়া; ভোটের ফল, শিক্ষা বা দলের ইতিহাসের মতো কিছু তথ্য সংবাদমাধ্যম ও উইকিপিডিয়ার মতো প্রকাশ্য সূত্র
            থেকে, আর প্রতিটির সূত্র সংশ্লিষ্ট পাতায় লেখা। আমরা নিজেরা কোনো তথ্য যোগ করি না, অনুমান করি না।
          </p>
          <p>
            সদস্যদের ব্যক্তিগত মোবাইল নম্বর বা বাসার ঠিকানা সংসদের তথ্যভান্ডারে থাকলেও আমরা তা প্রকাশ করি না। কেবল দাপ্তরিক
            যোগাযোগের তথ্য দেখানো হয়।
          </p>
          <p>
            কোনো সদস্য বা তাঁর দপ্তর যদি মনে করেন কোনো তথ্য ভুল, পুরোনো বা অনুচিত, <Contact /> সূত্রসহ জানালে ২৪ ঘণ্টার মধ্যে
            যাচাই করে ব্যবস্থা নেওয়া হয়।
          </p>
        </Section>

        <Section title="ব্যবহারের শর্ত">
          <p>
            সাইটের সব তথ্য প্রকাশ্য সূত্র থেকে নেওয়া, যার বেশির ভাগ সরকারি। যে কেউ “আমার এমপি, mymp.bd” সূত্র উল্লেখ করে এই তথ্য
            ব্যবহার, উদ্ধৃতি বা শেয়ার করতে পারেন। সাইটের নকশা, লেখা ও সাজানো তথ্যভান্ডার সাইটের নিজস্ব; অনুমতি ছাড়া পুরো সাইট
            বা তার কোড নকল করা যাবে না।
          </p>
          <p>
            তথ্য যথাসাধ্য সঠিক ও হালনাগাদ রাখার চেষ্টা করা হয়, তবে চূড়ান্ত সূত্র সবসময় জাতীয় সংসদ ও নির্বাচন কমিশন। কোনো আইনি,
            দাপ্তরিক বা সাংবাদিকতার কাজে ব্যবহারের আগে মূল সূত্রে যাচাই করুন। তথ্যের ভুলের কারণে কোনো ক্ষতির দায় সাইট নেয় না।
          </p>
          <p>
            আমার এমপি একটি স্বাধীন, ব্যক্তিগত উদ্যোগ। এটি বাংলাদেশ সরকার বা জাতীয় সংসদের কোনো সাইট নয় এবং কোনো সংসদ সদস্য,
            রাজনৈতিক দল বা নির্বাচন কমিশনের সঙ্গে এর কোনো সম্পর্ক নেই।
          </p>
        </Section>

        <Section title="এই নীতিতে পরিবর্তন ও যোগাযোগ">
          <p>
            নীতিতে কোনো পরিবর্তন হলে এই পাতায় হালনাগাদের তারিখ বদলে জানানো হবে। যেকোনো প্রশ্ন বা সংশোধনের জন্য <Contact />{' '}
            জানান।
          </p>
        </Section>
      </div>
      )}
    </Page>
  );
}
