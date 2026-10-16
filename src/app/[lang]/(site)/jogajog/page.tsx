import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import Link from 'next/link';
import { Page, PageHead, Card } from '@/components/ui';
import Icon from '@/components/Icon';
import BrandIcon from '@/components/BrandIcon';
import { SITE_EMAIL, SITE_FACEBOOK } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: '/jogajog' },
  openGraph: shareGraph('/jogajog'),
  title: 'যোগাযোগ ও সংশোধন',
  description: `আমার এমপির সঙ্গে যোগাযোগ: ইমেইল ${SITE_EMAIL} বা ফেসবুক পেজ। ভুল তথ্য কীভাবে জানাবেন, সংসদ সদস্য বা তাঁর দপ্তর নিজের পাতা কীভাবে হালনাগাদ করাবেন, আর কোনো সদস্যের সঙ্গে যোগাযোগ কোথায়, এই পাতায়।`,
};

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
    body: 'সদস্যের পাতার নিচে "সংশোধন জানান" বোতাম আছে; সেখান থেকে পাঠালে পাতাটা আপনাআপনি যুক্ত হয়ে যায়। ইমেইলে জানালে পাতার লিংক, কোন তথ্যটা ভুল আর সঠিকটা কোথায় লেখা আছে (সংবাদ, গেজেট বা সরকারি সাইটের লিংক), এই তিনটা দিন।',
  },
  {
    title: 'আপনি সংসদ সদস্য বা তাঁর দপ্তর',
    body: 'নিজের পাতার ছবি, পরিচিতি, ফেসবুক পেজ বা ওয়েবসাইট হালনাগাদ করাতে চাইলে দাপ্তরিক ইমেইল থেকে লিখুন, অথবা যাচাই করা যায় এমন সূত্র (নিজের ওয়েবসাইট, দলের সাইট, সংবাদ) দিন। "যাচাই করা হয়নি" লেখা ফেসবুক পেজ এভাবেই যাচাইকৃত হয়।',
  },
  {
    title: 'কোনো সংবাদ ভুল সদস্যের পাতায় গেছে',
    body: 'সংবাদ অংশে শিরোনাম যুক্ত হয় নাম মিলিয়ে, তাই একই নামের অন্য কারও খবর কখনো ভুল পাতায় যেতে পারে। খবরের লিংক আর সদস্যের নাম জানালে সরিয়ে দেওয়া হয়।',
  },
  {
    title: 'তথ্য ব্যবহার করতে চান',
    body: 'সাইটের সব তথ্য প্রকাশ্য সূত্র থেকে নেওয়া; "আমার এমপি, mymp.bd" সূত্র উল্লেখ করে যে কেউ ব্যবহার করতে পারেন। গবেষণা বা সংবাদের কাজে পুরো তালিকা লাগলে ইমেইলে চাইলে দেওয়া হয়।',
  },
];

export default function ContactPage() {
  return (
    <Page>
      <PageHead
        eyebrow="আমার এমপি"
        title="যোগাযোগ"
        lede="ভুল তথ্য জানাতে, নিজের পাতা হালনাগাদ করাতে, বা সাইট নিয়ে কিছু বলতে। সূত্রসহ জানালে ২৪ ঘণ্টার মধ্যে যাচাই করে ব্যবস্থা নেওয়া হয়।"
      />

      <div className="pt-8 pb-14 flex flex-col gap-6 max-w-[760px]">
        <Card className="p-6 flex flex-col gap-4">
          <h2 className="display text-[21px] font-bold">আমার এমপির সঙ্গে যোগাযোগ</h2>
          <p className="text-[15.5px] leading-relaxed text-inksoft">
            ইমেইল সবচেয়ে ভালো: লিংক আর সূত্র সঙ্গে দেওয়া যায়, আর উত্তরটাও লিখিত থাকে। ফেসবুক পেজে বার্তা পাঠালেও একই লোক পড়েন।
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
              ফেসবুক পেজ
              <Icon name="external" size={14} className="text-muted" />
            </a>
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted border-t border-rule pt-3">
            আপনার নাম বা ইমেইল কোথাও প্রকাশ হয় না; শুধু সংশোধনটা আর তার সূত্র রাখা হয়।{' '}
            <Link href="/gopaniyota" className="text-brand font-semibold hover:underline">গোপনীয়তা নীতি</Link>
          </p>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold px-1">কোন কাজে কী লিখবেন</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WAYS.map((w) => (
              <Card key={w.title} className="p-5 flex flex-col gap-2">
                <h3 className="display text-[16.5px] font-bold">{w.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-inksoft text-pretty">{w.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">কোনো সংসদ সদস্যের সঙ্গে যোগাযোগ</h2>
          <p className="text-[15.5px] leading-relaxed text-inksoft">
            এই সাইট কোনো সদস্যের দপ্তর নয়, তাঁদের পক্ষে বার্তা নেয় না বা পৌঁছে দেয় না। প্রত্যেক সদস্যের পাতায়
            &ldquo;যোগাযোগ&rdquo; অংশে জাতীয় সংসদের দেওয়া দাপ্তরিক ইমেইল আছে (যেমন{' '}
            <span className="font-mono text-[14px]">panchagarh.1@parliament.gov.bd</span>), আর যাঁদের যাচাইকৃত ফেসবুক
            পেজ বা ওয়েবসাইট আছে, সেগুলোও। সরাসরি সেখানে লিখুন।{' '}
            <Link href="/mp" className="text-brand font-semibold hover:underline">সদস্যদের তালিকা →</Link>
          </p>
          <p className="text-[14.5px] leading-relaxed text-muted">
            সদস্যদের ব্যক্তিগত মোবাইল নম্বর বা বাসার ঠিকানা এই সাইটে রাখা হয় না, চাইলেও দেওয়া যায় না।
          </p>
        </Card>
      </div>
    </Page>
  );
}
