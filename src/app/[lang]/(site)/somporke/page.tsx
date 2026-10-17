import type { Metadata } from 'next';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import Link from '@/i18n/Link';
import { meta, bn, dateBn, statistics, committeeCounts, parties, GENERAL_SEATS, RESERVED_SEATS } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { Page, PageHead, Card } from '@/components/ui';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/somporke'),
    ...pageShare('somporke', t),
    title: t('সম্পর্কে', 'About'),
    description: fitDescription(
      t(
        'আমার এমপি বাংলাদেশের সংসদ সদস্যদের তথ্যের একটি স্বাধীন, উন্মুক্ত ওয়েবসাইট: কে আপনার এমপি, কোন দলের, কোন কমিটিতে, কীভাবে যোগাযোগ। কেন বানানো, কী আছে, তথ্য কোথা থেকে আসে আর কী দেখানো হয় না।',
        'An independent, open website about the members of parliament of Bangladesh: who your MP is, their party, committees and contacts, and where the facts come from.',
      ),
    ),
  };
}

/** A number with its label, for the row of what the site holds. */
function Fact({ n, label, en = false }: { n: number; label: string; en?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 p-4 rounded-xl bg-paper">
      <span className="display tnum text-[26px] leading-none text-brand">{en ? n : bn(n)}</span>
      <span className="text-[13px] text-inksoft leading-snug">{label}</span>
    </div>
  );
}

export default async function AboutPage() {
  const t = await getT();
  const s = statistics();
  const cc = committeeCounts();
  const districts = districtList().length;
  const partyCount = parties.filter((p) => p.seats > 0).length;

  return (
    <Page>
      <PageHead
        eyebrow={t('আমার এমপি', 'My MP')}
        title={t('সম্পর্কে', 'About')}
        lede={t(
          'একজন নাগরিক যেন এক মিনিটে জানতে পারেন কে তাঁর সংসদ সদস্য, তিনি কোন দলের, সংসদে কী দায়িত্বে, আর তাঁর সঙ্গে যোগাযোগ কোথায়। সেই একটা কাজের জন্যই এই সাইট।',
          'So that any citizen can find out in a minute who their member of parliament is, which party they belong to, what their role in Parliament is, and where to contact them. This site exists for that one job.',
        )}
      />

      <div className="pt-8 pb-14 flex flex-col gap-6 max-w-[760px]">
        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">{t('কেন এই সাইট', 'Why this site')}</h2>
          {t.en ? (
            <>
              <p className="text-[15.5px] leading-relaxed text-inksoft">
                Information on members of parliament is on government websites, but scattered: the list of members in one place,
                the committees in another, the election results somewhere else, and none of it readable on a phone. My MP brings
                that public information together in one place, gives the source of each item, and sets it out in Bangla (and, on
                these pages, in English). The site is for its readers: not for any party, any member or any office.
              </p>
              <p className="text-[15.5px] leading-relaxed text-inksoft">
                My MP is an independent, non-governmental initiative. It is not a website of the Government of Bangladesh, the
                Parliament or the Election Commission, it does not represent any government body, and it has no connection with any
                political party or member of parliament.
              </p>
            </>
          ) : (
            <>
              <p className="text-[15.5px] leading-relaxed text-inksoft">
                সংসদ সদস্যদের তথ্য সরকারি ওয়েবসাইটে আছে, কিন্তু ছড়ানো: সদস্যের তালিকা এক জায়গায়, কমিটি আরেক জায়গায়, ভোটের
                ফল অন্য কোথাও, আর কোনোটাই ফোনে পড়ার মতো নয়। আমার এমপি সেই প্রকাশ্য তথ্যগুলোকে এক জায়গায় এনে, প্রতিটির
                সূত্র লিখে, বাংলায় সাজিয়ে দেয়। সাইটটা পাঠকের জন্য: কোনো দল, কোনো সদস্য বা কোনো দপ্তরের জন্য নয়।
              </p>
              <p className="text-[15.5px] leading-relaxed text-inksoft">
                আমার এমপি একটি স্বাধীন, বেসরকারি উদ্যোগ। এটি বাংলাদেশ সরকার, জাতীয় সংসদ বা নির্বাচন কমিশনের সাইট নয়, কোনো
                সরকারি প্রতিষ্ঠানের প্রতিনিধিত্ব করে না, আর কোনো রাজনৈতিক দল বা সংসদ সদস্যের সঙ্গে এর সম্পর্ক নেই।
              </p>
            </>
          )}
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="display text-[21px] font-bold">{t('এই সাইটে কী আছে', 'What this site holds')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Fact en={t.en} n={s.total} label={t('সংসদ সদস্য, প্রত্যেকের নিজের পাতা', 'members of parliament, each with their own page')} />
            <Fact
              en={t.en}
              n={GENERAL_SEATS + RESERVED_SEATS}
              label={t.en ? `seats: ${GENERAL_SEATS} general, ${RESERVED_SEATS} reserved` : `আসন: ${bn(GENERAL_SEATS)}টি সাধারণ, ${bn(RESERVED_SEATS)}টি সংরক্ষিত`}
            />
            <Fact en={t.en} n={districts} label={t('জেলা, প্রতিটির আসন ও সদস্য', 'districts, each with its seats and members')} />
            <Fact en={t.en} n={cc.total} label={t('সংসদীয় কমিটি, কাজ ও সদস্যসহ', 'parliamentary committees, with their work and members')} />
          </div>
          {t.en ? (
            <ul className="flex flex-col gap-2 text-[15.5px] leading-relaxed text-inksoft list-disc ps-5">
              <li>
                On a member&rsquo;s page: photo, party, seat and area, date of birth, education and profession (where there is a source),
                parliamentary committees, earlier terms, the seat&rsquo;s election results, official email, verified Facebook page and
                website, and the news published about them.
              </li>
              <li>
                <Link href="/ason" className="text-brand font-semibold hover:underline">Seats</Link>,{' '}
                <Link href="/jela" className="text-brand font-semibold hover:underline">districts</Link>,{' '}
                <Link href="/dol" className="text-brand font-semibold hover:underline">{partyCount} {partyCount === 1 ? 'party' : 'parties'}</Link>, the{' '}
                <Link href="/ministers" className="text-brand font-semibold hover:underline">Cabinet</Link>,{' '}
                <Link href="/odhibeshon" className="text-brand font-semibold hover:underline">sessions</Link> and{' '}
                <Link href="/parisonkhan" className="text-brand font-semibold hover:underline">statistics</Link>, each with its own page.
              </li>
              <li>
                Seat-by-seat results of the{' '}
                <Link href="/nirbachon" className="text-brand font-semibold hover:underline">13th parliamentary election</Link>, voters and
                polling centres, and who held which seat in earlier parliaments.
              </li>
              <li>In the search box you can type a name, seat, district or upazila, in Bangla or English, any way you like.</li>
            </ul>
          ) : (
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
          )}
        </Card>

        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">{t('তথ্য কোথা থেকে আসে', 'Where the information comes from')}</h2>
          {t.en ? (
            <p className="text-[15.5px] leading-relaxed text-inksoft">
              The core information comes from the Parliament of Bangladesh (parliament.gov.bd), the Election Commission (ecs.gov.bd) and
              the Cabinet Division (cabinet.gov.bd), and is read every day; last updated {t.date(meta.syncedAt)}. Election results come from
              The Business Standard and Wikipedia, and biographies from Wikipedia and the news, each marked separately. Which information
              comes from which source, and how it is checked, is set out in full on the{' '}
              <Link href="/sutro" className="text-brand font-semibold hover:underline">Sources and method</Link> page.
            </p>
          ) : (
            <p className="text-[15.5px] leading-relaxed text-inksoft">
              মূল তথ্য বাংলাদেশ জাতীয় সংসদ (parliament.gov.bd), নির্বাচন কমিশন (ecs.gov.bd) ও মন্ত্রিপরিষদ বিভাগ (cabinet.gov.bd)
              থেকে, প্রতিদিন পড়া হয়; সর্বশেষ হালনাগাদ {dateBn(meta.syncedAt)}। ভোটের ফল দ্য বিজনেস স্ট্যান্ডার্ড ও উইকিপিডিয়া
              থেকে, জীবনী উইকিপিডিয়া ও সংবাদ থেকে, প্রতিটি আলাদা করে চিহ্নিত। কোন তথ্য কোন সূত্র থেকে আর কীভাবে যাচাই হয়, পুরোটা{' '}
              <Link href="/sutro" className="text-brand font-semibold hover:underline">তথ্যসূত্র ও পদ্ধতি</Link> পাতায়।
            </p>
          )}
        </Card>

        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">{t('যা আমরা করি না', 'What we do not do')}</h2>
          {t.en ? (
            <ul className="flex flex-col gap-2.5 text-[15.5px] leading-relaxed text-inksoft list-disc ps-5">
              <li>We never fill in a number, name or date by guesswork. Where the source does not have it, the page says that the information is not available.</li>
              <li>
                Where a committee&rsquo;s membership list in Parliament&rsquo;s database is still that of the previous Parliament, we do not
                show its old members as current. {cc.pending === 1 ? 'There is 1 such committee at present.' : `There are ${cc.pending} such committees at present.`}
              </li>
              <li>We do not publish members&rsquo; personal mobile numbers or home addresses; only the official contact details provided by Parliament.</li>
              <li>We do not take or pass on messages on behalf of any member.</li>
              <li>We take no position for or against any party or member; the news section carries only the news outlets&rsquo; headlines, not any comment of ours.</li>
              <li>We collect no information about readers: no accounts, no advertising, no tracking.</li>
            </ul>
          ) : (
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
          )}
        </Card>

        <Card className="p-6 flex flex-col gap-3">
          <h2 className="display text-[21px] font-bold">{t('ভুল দেখলে', 'If you see a mistake')}</h2>
          {t.en ? (
            <p className="text-[15.5px] leading-relaxed text-inksoft">
              Every member&rsquo;s page has a &ldquo;Report a correction&rdquo; button. If you would rather tell us by email or on Facebook,
              or if you are yourself a member&rsquo;s office, the <Link href="/jogajog" className="text-brand font-semibold hover:underline">Contact</Link> page
              says what to send. Send it with a source and it is checked and fixed within 24 hours.
            </p>
          ) : (
            <p className="text-[15.5px] leading-relaxed text-inksoft">
              প্রতিটি সদস্যের পাতায় “সংশোধন জানান” বোতাম আছে। ইমেইল বা ফেসবুকে জানাতে চাইলে, বা আপনি নিজে কোনো সদস্যের দপ্তর হলে,
              কী পাঠাতে হবে তা <Link href="/jogajog" className="text-brand font-semibold hover:underline">যোগাযোগ</Link> পাতায়।
              সূত্রসহ জানালে ২৪ ঘণ্টার মধ্যে যাচাই করে ঠিক করা হয়।
            </p>
          )}
        </Card>
      </div>
    </Page>
  );
}
