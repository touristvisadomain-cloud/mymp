import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import Link from 'next/link';
import { meta, bn, dateBn, statistics, committeeCounts, parties, GENERAL_SEATS, RESERVED_SEATS } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { Page, PageHead, Card } from '@/components/ui';

export const metadata: Metadata = {
  alternates: { canonical: '/somporke' },
  openGraph: shareGraph('/somporke'),
  title: 'সম্পর্কে',
  description:
    'আমার এমপি বাংলাদেশের সংসদ সদস্যদের তথ্যের একটি স্বাধীন, উন্মুক্ত ওয়েবসাইট: কে আপনার এমপি, কোন দলের, কোন কমিটিতে, কীভাবে যোগাযোগ। কেন বানানো, কী আছে, তথ্য কোথা থেকে আসে আর কী দেখানো হয় না।',
};

/** A number with its label, for the row of what the site holds. */
function Fact({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-4 rounded-xl bg-paper">
      <span className="display tnum text-[26px] leading-none text-brand">{bn(n)}</span>
      <span className="text-[13px] text-inksoft leading-snug">{label}</span>
    </div>
  );
}

export default function AboutPage() {
  const s = statistics();
  const cc = committeeCounts();
  const districts = districtList().length;
  const partyCount = parties.filter((p) => p.seats > 0).length;

  return (
    <Page>
      <PageHead
        eyebrow="আমার এমপি"
        title="সম্পর্কে"
        lede="একজন নাগরিক যেন এক মিনিটে জানতে পারেন কে তাঁর সংসদ সদস্য, তিনি কোন দলের, সংসদে কী দায়িত্বে, আর তাঁর সঙ্গে যোগাযোগ কোথায়। সেই একটা কাজের জন্যই এই সাইট।"
      />

      <div className="pt-8 pb-14 flex flex-col gap-6 max-w-[760px]">
        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">কেন এই সাইট</h2>
          <p className="text-[15.5px] leading-relaxed text-inksoft">
            সংসদ সদস্যদের তথ্য সরকারি ওয়েবসাইটে আছে, কিন্তু ছড়ানো: সদস্যের তালিকা এক জায়গায়, কমিটি আরেক জায়গায়, ভোটের
            ফল অন্য কোথাও, আর কোনোটাই ফোনে পড়ার মতো নয়। আমার এমপি সেই প্রকাশ্য তথ্যগুলোকে এক জায়গায় এনে, প্রতিটির
            সূত্র লিখে, বাংলায় সাজিয়ে দেয়। সাইটটা পাঠকের জন্য: কোনো দল, কোনো সদস্য বা কোনো দপ্তরের জন্য নয়।
          </p>
          <p className="text-[15.5px] leading-relaxed text-inksoft">
            আমার এমপি একটি স্বাধীন, বেসরকারি উদ্যোগ। এটি বাংলাদেশ সরকার, জাতীয় সংসদ বা নির্বাচন কমিশনের সাইট নয়, কোনো
            সরকারি প্রতিষ্ঠানের প্রতিনিধিত্ব করে না, আর কোনো রাজনৈতিক দল বা সংসদ সদস্যের সঙ্গে এর সম্পর্ক নেই।
          </p>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="display text-[21px] font-bold">এই সাইটে কী আছে</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Fact n={s.total} label="সংসদ সদস্য, প্রত্যেকের নিজের পাতা" />
            <Fact n={GENERAL_SEATS + RESERVED_SEATS} label={`আসন: ${bn(GENERAL_SEATS)}টি সাধারণ, ${bn(RESERVED_SEATS)}টি সংরক্ষিত`} />
            <Fact n={districts} label="জেলা, প্রতিটির আসন ও সদস্য" />
            <Fact n={cc.total} label="সংসদীয় কমিটি, কাজ ও সদস্যসহ" />
          </div>
          <ul className="flex flex-col gap-2 text-[15.5px] leading-relaxed text-inksoft list-disc ps-5">
            <li>
              সদস্যের পাতায়: ছবি, দল, আসন ও এলাকা, জন্মতারিখ, শিক্ষা ও পেশা (যেখানে সূত্র আছে), সংসদীয় কমিটি, আগের মেয়াদ,
              আসনের ভোটের ফল, দাপ্তরিক ইমেইল, যাচাইকৃত ফেসবুক পেজ ও ওয়েবসাইট, আর তাঁকে নিয়ে প্রকাশিত সংবাদ।
            </li>
            <li>
              <Link href="/ason" className="text-brand font-semibold hover:underline">আসন</Link>,{' '}
              <Link href="/jela" className="text-brand font-semibold hover:underline">জেলা</Link>,{' '}
              <Link href="/dol" className="text-brand font-semibold hover:underline">{bn(partyCount)}টি দল</Link>,{' '}
              <Link href="/ministers" className="text-brand font-semibold hover:underline">মন্ত্রিসভা</Link>,{' '}
              <Link href="/odhibeshon" className="text-brand font-semibold hover:underline">অধিবেশন</Link> ও{' '}
              <Link href="/parisonkhan" className="text-brand font-semibold hover:underline">পরিসংখ্যান</Link>, প্রতিটির আলাদা পাতা।
            </li>
            <li>
              <Link href="/nirbachon" className="text-brand font-semibold hover:underline">ত্রয়োদশ নির্বাচনের</Link> আসনভিত্তিক ফল, ভোটার ও
              ভোটকেন্দ্র, আর আগের সংসদগুলোতে কে কোন আসনে ছিলেন।
            </li>
            <li>খোঁজার ঘরে নাম, আসন, জেলা বা উপজেলা, বাংলা বা ইংরেজি, যেভাবে খুশি লেখা যায়।</li>
          </ul>
        </Card>

        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">তথ্য কোথা থেকে আসে</h2>
          <p className="text-[15.5px] leading-relaxed text-inksoft">
            মূল তথ্য বাংলাদেশ জাতীয় সংসদ (parliament.gov.bd), নির্বাচন কমিশন (ecs.gov.bd) ও মন্ত্রিপরিষদ বিভাগ (cabinet.gov.bd)
            থেকে, প্রতিদিন পড়া হয়; সর্বশেষ হালনাগাদ {dateBn(meta.syncedAt)}। ভোটের ফল দ্য বিজনেস স্ট্যান্ডার্ড ও উইকিপিডিয়া
            থেকে, জীবনী উইকিপিডিয়া ও সংবাদ থেকে, প্রতিটি আলাদা করে চিহ্নিত। কোন তথ্য কোন সূত্র থেকে আর কীভাবে যাচাই হয়, পুরোটা{' '}
            <Link href="/sutro" className="text-brand font-semibold hover:underline">তথ্যসূত্র ও পদ্ধতি</Link> পাতায়।
          </p>
        </Card>

        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">যা আমরা করি না</h2>
          <ul className="flex flex-col gap-2.5 text-[15.5px] leading-relaxed text-inksoft list-disc ps-5">
            <li>কোনো সংখ্যা, নাম বা তারিখ অনুমান করে বসাই না। সূত্রে না থাকলে পাতায় লেখা থাকে যে তথ্যটি নেই।</li>
            <li>
              যেসব কমিটির সদস্য তালিকা সংসদের তথ্যভান্ডারে এখনো আগের সংসদের নামে আছে, সেগুলোর পুরোনো সদস্যদের বর্তমান বলে দেখাই না।
              এখন এমন কমিটি {bn(cc.pending)}টি।
            </li>
            <li>সদস্যদের ব্যক্তিগত মোবাইল নম্বর বা বাসার ঠিকানা প্রকাশ করি না; শুধু সংসদের দেওয়া দাপ্তরিক যোগাযোগ।</li>
            <li>কোনো সদস্যের পক্ষে বার্তা নিই না বা পৌঁছে দিই না।</li>
            <li>কোনো দল বা সদস্যের পক্ষে বা বিপক্ষে অবস্থান নিই না; সংবাদ অংশে শুধু সংবাদমাধ্যমের শিরোনাম থাকে, আমাদের কোনো মন্তব্য নয়।</li>
            <li>পাঠকের কোনো তথ্য সংগ্রহ করি না: অ্যাকাউন্ট নেই, বিজ্ঞাপন নেই, ট্র্যাকিং নেই।</li>
          </ul>
        </Card>

        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">ভুল দেখলে</h2>
          <p className="text-[15.5px] leading-relaxed text-inksoft">
            প্রতিটি সদস্যের পাতায় “সংশোধন জানান” বোতাম আছে। ইমেইল বা ফেসবুকে জানাতে চাইলে, বা আপনি নিজে কোনো সদস্যের দপ্তর হলে,
            কী পাঠাতে হবে তা <Link href="/jogajog" className="text-brand font-semibold hover:underline">যোগাযোগ</Link> পাতায়।
            সূত্রসহ জানালে ২৪ ঘণ্টার মধ্যে যাচাই করে ঠিক করা হয়।
          </p>
        </Card>
      </div>
    </Page>
  );
}
