import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { shareGraph, langAlternates } from '@/lib/seo';
import { Page, PageHead, Card } from '@/components/ui';
import { bn, dateBn, meta, ecs } from '@/lib/data';
import { NEWS_SOURCES } from '../../../../../config/news-sources';
import { CABINET_PAGE_FOR_READERS } from '../../../../../config/sync-sources';
import { getT } from '@/i18n/server';

/*
 * "তথ্যসূত্র ও পদ্ধতি": every kind of information on the site, where it comes
 * from, how often it moves and how it is checked. It says what the site
 * actually does: results come from The Business Standard and Wikipedia and
 * are not yet checked against the Election Commission's gazette, so the
 * gazette is not named as a source; a Facebook page is shown as verified only
 * when a source other than the page itself says it is the member's.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/sutro'),
    openGraph: shareGraph('/sutro', undefined, t.lang),
    title: t('তথ্যসূত্র ও পদ্ধতি', 'Sources and method'),
    description: t(
      'আমার এমপির প্রতিটি তথ্য কোথা থেকে আসে: জাতীয় সংসদ, নির্বাচন কমিশন, মন্ত্রিপরিষদ বিভাগ, দ্য বিজনেস স্ট্যান্ডার্ড, উইকিপিডিয়া ও সংবাদমাধ্যম। কত দিন পরপর হালনাগাদ হয়, কীভাবে যাচাই হয়, আর "যাচাই করা হয়নি" লেবেলের মানে কী।',
      'Where every piece of information on My MP comes from: the Parliament, the Election Commission, the Cabinet Division, The Business Standard, Wikipedia and the news media. How often it is updated, how it is checked, and what the "Not verified" label means.',
    ),
  };
}

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

export default async function SourcesPage() {
  const t = await getT();
  const outlets = NEWS_SOURCES.length;

  return (
    <Page>
      <PageHead
        eyebrow={t('আমার এমপি', 'My MP')}
        title={t('তথ্যসূত্র ও পদ্ধতি', 'Sources and method')}
        lede={
          t.en
            ? `Where every piece of information on this site comes from, how often it is updated and how it is checked. Last updated from Parliament's database: ${t.date(meta.syncedAt)}.`
            : `এই সাইটের প্রতিটি তথ্য কোথা থেকে আসে, কত দিন পরপর হালনাগাদ হয় আর কীভাবে যাচাই হয়। সংসদের তথ্যভান্ডার থেকে সর্বশেষ হালনাগাদ: ${dateBn(meta.syncedAt)}।`
        }
      />

      <div className="pt-8 pb-14 flex flex-col gap-6 max-w-[800px]">
        <Section title={t('কোন তথ্য কোথা থেকে', 'Which information comes from where')}>
          <p>
            {t(
              'সাইটে যা আছে তার প্রায় সবটাই সরকারি ওয়েবসাইট থেকে সরাসরি পড়া। যেটুকু অন্য সূত্র থেকে, সেটা এখানে আর সংশ্লিষ্ট পাতায়, দুই জায়গাতেই লেখা।',
              'Almost everything on the site is read directly from government websites. Whatever comes from another source is stated in both places: here and on the page concerned.',
            )}
          </p>
          <div className="mt-1">
            <Row
              what={t('সদস্যের নাম, ছবি, আসন, দল, জন্মতারিখ, পেশা, দাপ্তরিক ইমেইল', 'Members’ names, photos, seats, parties, dates of birth, professions, official email')}
              from={
                t.en
                  ? <>Parliament of Bangladesh ({ext('https://www.parliament.gov.bd', 'parliament.gov.bd')}), from Parliament&rsquo;s list of members</>
                  : <>বাংলাদেশ জাতীয় সংসদ ({ext('https://www.parliament.gov.bd', 'parliament.gov.bd')}), সংসদের সদস্য তালিকা থেকে</>
              }
              note={t.en ? `Read every day; most recently on ${t.date(meta.syncedAt)}.` : `প্রতিদিন পড়া হয়; সর্বশেষ ${dateBn(meta.syncedAt)}।`}
            />
            <Row
              what={t('সংসদীয় কমিটি, অধিবেশন, বৈঠক, সচিবালয়ের প্রজ্ঞাপন', 'Parliamentary committees, sessions, sittings, Secretariat notifications')}
              from={
                t.en
                  ? <>Parliament of Bangladesh; the description of each committee&rsquo;s work from the {ext('https://www.parliament.gov.bd/parliament-business/rules-of-procedure', 'Rules of Procedure')}</>
                  : <>বাংলাদেশ জাতীয় সংসদ, কমিটির কাজের বিবরণ {ext('https://www.parliament.gov.bd/parliament-business/rules-of-procedure', 'কার্যপ্রণালী বিধি')} থেকে</>
              }
              note={t(
                'যে কমিটির তালিকা সংসদের তথ্যভান্ডারে এখনো আগের সংসদের, তার পুরোনো সদস্যদের বর্তমান বলে দেখানো হয় না; পাতায় তা লেখা থাকে।',
                'Where a committee’s list in Parliament’s database is still that of the previous Parliament, its old members are not shown as current; the page says so.',
              )}
            />
            <Row
              what={t('নিবন্ধিত ভোটার ও ভোটকেন্দ্রের সংখ্যা', 'Numbers of registered voters and polling centres')}
              from={
                t.en
                  ? <>Bangladesh Election Commission ({ext('https://www.ecs.gov.bd', 'ecs.gov.bd')})</>
                  : <>বাংলাদেশ নির্বাচন কমিশন ({ext('https://www.ecs.gov.bd', 'ecs.gov.bd')})</>
              }
              note={t.en ? `The Commission’s published figures, read on ${t.date(ecs.readOn)}.` : `কমিশনের প্রকাশিত হিসাব, পড়া হয়েছে ${dateBn(ecs.readOn)}।`}
            />
            <Row
              what={t('মন্ত্রিসভা: মন্ত্রী, প্রতিমন্ত্রী, উপদেষ্টা ও মন্ত্রণালয়', 'Cabinet: Ministers, State Ministers, Advisers and ministries')}
              from={
                t.en
                  ? <>Cabinet Division ({ext(CABINET_PAGE_FOR_READERS, 'cabinet.gov.bd')})</>
                  : <>মন্ত্রিপরিষদ বিভাগ ({ext(CABINET_PAGE_FOR_READERS, 'cabinet.gov.bd')})</>
              }
              note={t('বিভাগের প্রকাশিত তালিকা থেকে; দায়িত্ব পাওয়ার তারিখসহ।', 'From the Division’s published list, with the date each took office.')}
            />
            <Row
              what={t('২০২৬ সালের নির্বাচনে আসনভিত্তিক ভোটের ফল', 'Seat-by-seat results of the 2026 election')}
              from={
                t.en
                  ? <>The Business Standard ({ext('https://www.tbsnews.net', 'tbsnews.net')}) and Wikipedia</>
                  : <>দ্য বিজনেস স্ট্যান্ডার্ড ({ext('https://www.tbsnews.net', 'tbsnews.net')}) ও উইকিপিডিয়া</>
              }
              note={t(
                'নির্বাচন কমিশনের গেজেটের সঙ্গে এখনো মেলানো হয়নি; প্রতিটি ফলের নিচে তা লেখা থাকে। মেলানো হলে সেখানেই জানানো হবে।',
                'Not yet checked against the Election Commission’s gazette; this is stated under every result. Once they have been checked, it will be stated there.',
              )}
            />
            <Row
              what={t('জীবনী, শিক্ষা, জন্মস্থান, দলের ইতিহাস', 'Biographies, education, birthplace, party history')}
              from={
                t.en
                  ? <>Bangla and English Wikipedia ({ext('https://bn.wikipedia.org', 'bn.wikipedia.org')}, {ext('https://en.wikipedia.org', 'en.wikipedia.org')}) and published news reports</>
                  : <>বাংলা ও ইংরেজি উইকিপিডিয়া ({ext('https://bn.wikipedia.org', 'bn.wikipedia.org')}, {ext('https://en.wikipedia.org', 'en.wikipedia.org')}) এবং প্রকাশিত সংবাদ</>
              }
              note={t(
                'প্রতিটি জীবনীর নিচে তার নিজস্ব সূত্রের লিংক থাকে। যাঁর সম্পর্কে নির্ভরযোগ্য সূত্র নেই, তাঁর পাতায় ওই তথ্য ফাঁকা থাকে, অনুমান করে লেখা হয় না।',
                'Every biography has links to its own sources beneath it. Where there is no reliable source about someone, that information is left blank on their page; it is not filled in by guesswork.',
              )}
            />
            <Row
              what={t('সদস্যের ফেসবুক পেজ ও ওয়েবসাইট', 'Members’ Facebook pages and websites')}
              from={t(
                'সদস্যের নিজের ওয়েবসাইট, দলের ওয়েবসাইট, সরকারি পাতা বা সংবাদমাধ্যম, যেখানে পেজটিকে তাঁর বলে উল্লেখ করা হয়েছে',
                'The member’s own website, the party’s website, a government page or a news outlet, where the page is named as theirs',
              )}
              note={t(
                'স্বাধীন সূত্রে নিশ্চিত হলে "অফিসিয়াল ফেসবুক পেজ" লেখা থাকে। শুধু পেজের নিজের দাবি বা নামের মিল থাকলে লিংক দেখানো হয় "যাচাই করা হয়নি" লেবেলসহ। একাধিক পেজের মধ্যে কোনটি আসল বোঝা না গেলে কোনো লিংক দেওয়া হয় না।',
                'When an independent source confirms it, it is labelled "Official Facebook page". When there is only the page’s own claim or a matching name, the link is shown with a "Not verified" label. When it cannot be told which of several pages is the real one, no link is given.',
              )}
            />
            <Row
              what={t('সংবাদ ও ভিডিও', 'News and videos')}
              from={t.en ? `Headlines published by ${outlets} approved news outlets, added by matching members’ names` : `${bn(outlets)}টি অনুমোদিত সংবাদমাধ্যমের প্রকাশিত শিরোনাম, সদস্যের নাম মিলিয়ে যুক্ত`}
              note={t(
                'সাইট শুধু শিরোনাম, সংবাদমাধ্যমের নাম আর মূল লিংক রাখে; নিজে কোনো সংবাদ লেখে না, লেখাও কপি করে না। একই নামের অন্য কারও খবর ভুলে যুক্ত হলে জানালে সরানো হয়।',
                'The site keeps only the headline, the outlet’s name and the original link; it writes no news itself and copies no text. If a story about someone else with the same name is added by mistake, it is removed once reported.',
              )}
            />
          </div>
        </Section>

        <Section title={t('কত দিন পরপর হালনাগাদ', 'How often it is updated')}>
          {t.en ? (
            <>
              <p>
                Every night the whole site is rebuilt from Parliament&rsquo;s database. When information on a new member, a notification,
                a sitting&rsquo;s order of the day or a change to a committee is published on Parliament&rsquo;s website, it appears here by
                the next day. News headlines, several times a day.
              </p>
              <p>
                When a member resigns or a seat falls vacant, this is recorded on the page according to the Parliament Secretariat&rsquo;s
                notification; when a new member comes in at a by-election, they appear here once they are on Parliament&rsquo;s list.
              </p>
            </>
          ) : (
            <>
              <p>
                প্রতি রাতে পুরো সাইট সংসদের তথ্যভান্ডার থেকে নতুন করে তৈরি হয়। সংসদের ওয়েবসাইটে নতুন সদস্যের তথ্য, প্রজ্ঞাপন,
                বৈঠকের কার্যসূচি বা কমিটির পরিবর্তন প্রকাশ হলে পরদিনের মধ্যে এখানে দেখা যায়। সংবাদ শিরোনাম দিনে কয়েকবার।
              </p>
              <p>
                কোনো সদস্য পদত্যাগ করলে বা আসন শূন্য হলে সংসদ সচিবালয়ের প্রজ্ঞাপন অনুযায়ী তা পাতায় লেখা হয়; উপনির্বাচনে
                নতুন সদস্য এলে সংসদের তালিকায় ওঠার পর তিনি এখানে আসেন।
              </p>
            </>
          )}
        </Section>

        <Section title={t('কীভাবে যাচাই হয়', 'How it is checked')}>
          {t.en ? (
            <>
              <p>
                Every page gives the source of its information, with a link to the original document or page wherever possible. If two
                sources disagree, or no source has it, the information is left out; no number, name or date is filled in by guesswork.
              </p>
              <p>
                Government sources (the Parliament, the Election Commission, the Cabinet Division) are shown directly. Information from
                other sources, such as election results or biographies, is marked separately, and how far it has been checked (whether it
                has been matched against the gazette, whether a page is verified) is stated on the page itself.
              </p>
              <p>
                If you find a mistake, or a member&rsquo;s office wants its own page updated, see the{' '}
                <Link href="/jogajog" className={link}>Contact</Link> page for what to send; send it with a source and it is checked
                and fixed within 24 hours.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </Section>

        <Section title={t('যা এই সাইটে রাখা হয় না', 'What this site does not hold')}>
          <ul className="list-disc ps-5 flex flex-col gap-1.5">
            <li>{t('সদস্যদের ব্যক্তিগত মোবাইল নম্বর বা বাসার ঠিকানা, সংসদের তথ্যভান্ডারে থাকলেও।', 'Members’ personal mobile numbers or home addresses, even where they are in Parliament’s database.')}</li>
            <li>{t('কোনো সদস্য, দল বা সরকারের পক্ষে-বিপক্ষে মতামত বা মূল্যায়ন।', 'Opinions or assessments for or against any member, party or the government.')}</li>
            <li>{t('যে তথ্যের কোনো নির্ভরযোগ্য সূত্র পাওয়া যায়নি।', 'Information for which no reliable source has been found.')}</li>
          </ul>
        </Section>
      </div>
    </Page>
  );
}
