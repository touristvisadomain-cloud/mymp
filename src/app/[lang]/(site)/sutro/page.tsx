import type { Metadata } from 'next';
import Link from 'next/link';
import { shareGraph } from '@/lib/seo';
import { Page, PageHead, Card } from '@/components/ui';
import { bn, dateBn, meta, ecs } from '@/lib/data';
import { NEWS_SOURCES } from '../../../../../config/news-sources';
import { CABINET_PAGE_FOR_READERS } from '../../../../../config/sync-sources';

/*
 * "তথ্যসূত্র ও পদ্ধতি": every kind of information on the site, where it comes
 * from, how often it moves and how it is checked. It says what the site
 * actually does: results come from The Business Standard and Wikipedia and
 * are not yet checked against the Election Commission's gazette, so the
 * gazette is not named as a source; a Facebook page is shown as verified only
 * when a source other than the page itself says it is the member's.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/sutro' },
  openGraph: shareGraph('/sutro'),
  title: 'তথ্যসূত্র ও পদ্ধতি',
  description:
    'আমার এমপির প্রতিটি তথ্য কোথা থেকে আসে: জাতীয় সংসদ, নির্বাচন কমিশন, মন্ত্রিপরিষদ বিভাগ, দ্য বিজনেস স্ট্যান্ডার্ড, উইকিপিডিয়া ও সংবাদমাধ্যম। কত দিন পরপর হালনাগাদ হয়, কীভাবে যাচাই হয়, আর "যাচাই করা হয়নি" লেবেলের মানে কী।',
};

const link = 'text-brand font-semibold hover:underline';
const ext = (href: string, label: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={link}>{label} ↗</a>
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 flex flex-col gap-3">
      <h2 className="display text-[21px] font-bold">{title}</h2>
      <div className="flex flex-col gap-2.5 text-[15.5px] leading-relaxed text-inksoft">{children}</div>
    </Card>
  );
}

/** One kind of information: what it is, where it comes from, how it is marked on the page. */
function Row({ what, from, note }: { what: string; from: React.ReactNode; note?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 py-3 border-t border-rulesoft first:border-0 first:pt-0">
      <div className="font-semibold text-ink">{what}</div>
      <div className="flex flex-col gap-1">
        <div>{from}</div>
        {note && <div className="text-[13.5px] text-muted leading-relaxed">{note}</div>}
      </div>
    </div>
  );
}

export default function SourcesPage() {
  const outlets = NEWS_SOURCES.length;

  return (
    <Page>
      <PageHead
        eyebrow="আমার এমপি"
        title="তথ্যসূত্র ও পদ্ধতি"
        lede={`এই সাইটের প্রতিটি তথ্য কোথা থেকে আসে, কত দিন পরপর হালনাগাদ হয় আর কীভাবে যাচাই হয়। সংসদের তথ্যভান্ডার থেকে সর্বশেষ হালনাগাদ: ${dateBn(meta.syncedAt)}।`}
      />

      <div className="pt-8 pb-14 flex flex-col gap-6 max-w-[800px]">
        <Section title="কোন তথ্য কোথা থেকে">
          <p>
            সাইটে যা আছে তার প্রায় সবটাই সরকারি ওয়েবসাইট থেকে সরাসরি পড়া। যেটুকু অন্য সূত্র থেকে, সেটা এখানে আর সংশ্লিষ্ট পাতায়, দুই জায়গাতেই লেখা।
          </p>
          <div className="mt-1">
            <Row
              what="সদস্যের নাম, ছবি, আসন, দল, জন্মতারিখ, পেশা, দাপ্তরিক ইমেইল"
              from={<>বাংলাদেশ জাতীয় সংসদ ({ext('https://www.parliament.gov.bd', 'parliament.gov.bd')}), সংসদের সদস্য তালিকা থেকে</>}
              note={`প্রতিদিন পড়া হয়; সর্বশেষ ${dateBn(meta.syncedAt)}।`}
            />
            <Row
              what="সংসদীয় কমিটি, অধিবেশন, বৈঠক, সচিবালয়ের প্রজ্ঞাপন"
              from={<>বাংলাদেশ জাতীয় সংসদ, কমিটির কাজের বিবরণ {ext('https://www.parliament.gov.bd/parliament-business/rules-of-procedure', 'কার্যপ্রণালী বিধি')} থেকে</>}
              note="যে কমিটির তালিকা সংসদের তথ্যভান্ডারে এখনো আগের সংসদের, তার পুরোনো সদস্যদের বর্তমান বলে দেখানো হয় না; পাতায় তা লেখা থাকে।"
            />
            <Row
              what="নিবন্ধিত ভোটার ও ভোটকেন্দ্রের সংখ্যা"
              from={<>বাংলাদেশ নির্বাচন কমিশন ({ext('https://www.ecs.gov.bd', 'ecs.gov.bd')})</>}
              note={`কমিশনের প্রকাশিত হিসাব, পড়া হয়েছে ${dateBn(ecs.readOn)}।`}
            />
            <Row
              what="মন্ত্রিসভা: মন্ত্রী, প্রতিমন্ত্রী, উপদেষ্টা ও মন্ত্রণালয়"
              from={<>মন্ত্রিপরিষদ বিভাগ ({ext(CABINET_PAGE_FOR_READERS, 'cabinet.gov.bd')})</>}
              note="বিভাগের প্রকাশিত তালিকা থেকে; দায়িত্ব পাওয়ার তারিখসহ।"
            />
            <Row
              what="২০২৬ সালের নির্বাচনে আসনভিত্তিক ভোটের ফল"
              from={<>দ্য বিজনেস স্ট্যান্ডার্ড ({ext('https://www.tbsnews.net', 'tbsnews.net')}) ও উইকিপিডিয়া</>}
              note="নির্বাচন কমিশনের গেজেটের সঙ্গে এখনো মেলানো হয়নি; প্রতিটি ফলের নিচে তা লেখা থাকে। মেলানো হলে সেখানেই জানানো হবে।"
            />
            <Row
              what="জীবনী, শিক্ষা, জন্মস্থান, দলের ইতিহাস"
              from={<>বাংলা ও ইংরেজি উইকিপিডিয়া ({ext('https://bn.wikipedia.org', 'bn.wikipedia.org')}, {ext('https://en.wikipedia.org', 'en.wikipedia.org')}) এবং প্রকাশিত সংবাদ</>}
              note="প্রতিটি জীবনীর নিচে তার নিজস্ব সূত্রের লিংক থাকে। যাঁর সম্পর্কে নির্ভরযোগ্য সূত্র নেই, তাঁর পাতায় ওই তথ্য ফাঁকা থাকে, অনুমান করে লেখা হয় না।"
            />
            <Row
              what="সদস্যের ফেসবুক পেজ ও ওয়েবসাইট"
              from="সদস্যের নিজের ওয়েবসাইট, দলের ওয়েবসাইট, সরকারি পাতা বা সংবাদমাধ্যম, যেখানে পেজটিকে তাঁর বলে উল্লেখ করা হয়েছে"
              note='স্বাধীন সূত্রে নিশ্চিত হলে "অফিসিয়াল ফেসবুক পেজ" লেখা থাকে। শুধু পেজের নিজের দাবি বা নামের মিল থাকলে লিংক দেখানো হয় "যাচাই করা হয়নি" লেবেলসহ। একাধিক পেজের মধ্যে কোনটি আসল বোঝা না গেলে কোনো লিংক দেওয়া হয় না।'
            />
            <Row
              what="সংবাদ ও ভিডিও"
              from={`${bn(outlets)}টি অনুমোদিত সংবাদমাধ্যমের প্রকাশিত শিরোনাম, সদস্যের নাম মিলিয়ে যুক্ত`}
              note="সাইট শুধু শিরোনাম, সংবাদমাধ্যমের নাম আর মূল লিংক রাখে; নিজে কোনো সংবাদ লেখে না, লেখাও কপি করে না। একই নামের অন্য কারও খবর ভুলে যুক্ত হলে জানালে সরানো হয়।"
            />
          </div>
        </Section>

        <Section title="কত দিন পরপর হালনাগাদ">
          <p>
            প্রতি রাতে পুরো সাইট সংসদের তথ্যভান্ডার থেকে নতুন করে তৈরি হয়। সংসদের ওয়েবসাইটে নতুন সদস্যের তথ্য, প্রজ্ঞাপন,
            বৈঠকের কার্যসূচি বা কমিটির পরিবর্তন প্রকাশ হলে পরদিনের মধ্যে এখানে দেখা যায়। সংবাদ শিরোনাম দিনে কয়েকবার।
          </p>
          <p>
            কোনো সদস্য পদত্যাগ করলে বা আসন শূন্য হলে সংসদ সচিবালয়ের প্রজ্ঞাপন অনুযায়ী তা পাতায় লেখা হয়; উপনির্বাচনে
            নতুন সদস্য এলে সংসদের তালিকায় ওঠার পর তিনি এখানে আসেন।
          </p>
        </Section>

        <Section title="কীভাবে যাচাই হয়">
          <p>
            প্রতিটি পাতায় তথ্যের সূত্র লেখা থাকে, যেখানে সম্ভব মূল নথি বা পাতার লিংকসহ। দুটি সূত্রে তথ্য না মিললে বা কোনো সূত্রে
            না থাকলে তথ্যটি বাদ রাখা হয়; কোনো সংখ্যা, নাম বা তারিখ অনুমান করে বসানো হয় না।
          </p>
          <p>
            সরকারি সূত্র (সংসদ, নির্বাচন কমিশন, মন্ত্রিপরিষদ বিভাগ) সরাসরি দেখানো হয়। অন্য সূত্রের তথ্য, যেমন ভোটের ফল বা জীবনী,
            আলাদাভাবে চিহ্নিত থাকে, আর যাচাইয়ের অবস্থা (গেজেটের সঙ্গে মেলানো হয়েছে কি না, পেজ যাচাইকৃত কি না) পাতাতেই লেখা।
          </p>
          <p>
            ভুল পেলে বা কোনো সদস্যের দপ্তর নিজের পাতা হালনাগাদ করাতে চাইলে{' '}
            <Link href="/jogajog" className={link}>যোগাযোগ</Link> পাতায় দেখুন কী পাঠাতে হবে; সূত্রসহ জানালে ২৪ ঘণ্টার মধ্যে
            যাচাই করে ঠিক করা হয়।
          </p>
        </Section>

        <Section title="যা এই সাইটে রাখা হয় না">
          <ul className="list-disc ps-5 flex flex-col gap-1.5">
            <li>সদস্যদের ব্যক্তিগত মোবাইল নম্বর বা বাসার ঠিকানা, সংসদের তথ্যভান্ডারে থাকলেও।</li>
            <li>কোনো সদস্য, দল বা সরকারের পক্ষে-বিপক্ষে মতামত বা মূল্যায়ন।</li>
            <li>যে তথ্যের কোনো নির্ভরযোগ্য সূত্র পাওয়া যায়নি।</li>
          </ul>
        </Section>
      </div>
    </Page>
  );
}
