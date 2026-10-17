import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import { getMemberById, GENERAL_SEATS, RESERVED_SEATS } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { Page, PageHead, Stat, PartyDot } from '@/components/ui';
import { getT } from '@/i18n/server';
import { districtName, personName, seatName } from '@/i18n/names';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

/**
 * Every constituency on one page, district by district.
 *
 * Each seat has had its own page since the start, but they could only be
 * reached one district at a time, and /ason itself was a 404. A reader who
 * knows the seat name and nothing else now has somewhere to look, and the
 * three hundred pages sit one click from the top of the site.
 */
const districts = districtList();
const seatTotal = districts.reduce((n, d) => n + d.seats.length, 0);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/ason'),
    ...pageShare('ason', t),
    title: t('সংসদীয় আসনের তালিকা ও প্রতিটি আসনের এমপি', 'Constituencies of Bangladesh and their MPs'),
    description: fitDescription(
      t(
        `ত্রয়োদশ জাতীয় সংসদের ${t.n(seatTotal)}টি সংসদীয় আসনের তালিকা, জেলা অনুযায়ী সাজানো, প্রতিটি আসনের বর্তমান সংসদ সদস্য ও দলসহ। তথ্যসূত্র বাংলাদেশ জাতীয় সংসদ।`,
        `The ${seatTotal} constituencies of the 13th Parliament, listed by district, with each seat's current Member of Parliament and party. Source: Parliament of Bangladesh.`,
      ),
    ),
  };
}

export default async function SeatIndex() {
  const t = await getT();
  const vacant = districts.flatMap((d) => d.seats).filter((s) => !s.memberId || s.vacantSince).length;

  return (
    <Page>
      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('সব সংসদীয় আসন', 'All constituencies')}
        lede={t(
          `${t.n(GENERAL_SEATS)}টি আসনে সরাসরি ভোটে সদস্য নির্বাচিত হন, আর ${t.n(RESERVED_SEATS)}টি সংরক্ষিত নারী আসন ভাগ হয় দলগুলোর আনুপাতিক হারে। নিচের তালিকা জেলা অনুযায়ী সাজানো; আসনের পাতায় সেখানকার ভোটের ফল ও আগের সদস্যরা আছেন।`,
          `Members for ${GENERAL_SEATS} seats are elected by direct vote, and the ${RESERVED_SEATS} reserved seats for women are shared among the parties in proportion. The list below is arranged by district; each seat's page has its election results and its earlier members.`,
        )}
        aside={
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <Stat label={t('আসন', 'Seats')} value={t.n(seatTotal)} />
            <Stat label={t('জেলা', 'Districts')} value={t.n(districts.length)} />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href('/ason')}`}
          title={t('সব সংসদীয় আসন | আমার এমপি', 'All constituencies | My MP')}
          text={t(
            `ত্রয়োদশ জাতীয় সংসদের ${t.n(seatTotal)}টি সংসদীয় আসন ও প্রতিটি আসনের সংসদ সদস্য, জেলা অনুযায়ী`,
            `The ${seatTotal} constituencies of the 13th Parliament and the MP for each, district by district`,
          )}
        />
      </div>

      {t.en ? (
        <p className="mt-5 text-[14px] text-inksoft">
          The {RESERVED_SEATS} reserved seats for women are listed separately, on the{' '}
          <Link href="/sangrakkhito-ason" className="font-semibold text-brand hover:underline">
            Reserved seats for women
          </Link>{' '}
          page.
          {vacant > 0 && ` ${vacant} ${vacant === 1 ? 'seat is' : 'seats are'} vacant at the moment.`}
        </p>
      ) : (
        <p className="mt-5 text-[14px] text-inksoft">
          সংরক্ষিত নারী আসনের {t.n(RESERVED_SEATS)}টি আলাদা{' '}
          <Link href="/sangrakkhito-ason" className="font-semibold text-brand hover:underline">
            সংরক্ষিত নারী আসন
          </Link>{' '}
          পাতায়।
          {vacant > 0 && ` এই মুহূর্তে ${t.n(vacant)}টি আসন শূন্য।`}
        </p>
      )}

      <div className="mt-8 pb-12 flex flex-col gap-7">
        {districts.map((d) => (
          <section key={d.slug}>
            <h2 className="display text-[17px] flex items-baseline gap-2">
              <Link href={`/jela/${d.slug}`} className="hover:text-brand transition-colors">
                {districtName(d, t.lang)}
              </Link>
              <span className="text-[12.5px] text-muted font-normal tnum">{t.count(d.seats.length, 'টি আসন', 'seat', 'seats')}</span>
            </h2>
            <ul className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {d.seats.map((s) => {
                // A seat whose holder has resigned keeps its memberId, and the
                // seat's own page says it is vacant; the index has to agree.
                const m = s.memberId && !s.vacantSince ? getMemberById(s.memberId) : null;
                return (
                  <li key={s.slug}>
                    <Link
                      href={`/ason/${s.slug}`}
                      className="group bg-surface border border-rule rounded-card px-3.5 py-2.5 flex items-center gap-2.5 hover:border-brand hover:shadow-card transition-all"
                    >
                      <span className="display text-[14.5px] shrink-0 group-hover:text-brand transition-colors">
                        {t.en ? seatName(s, 'en') : s.nameBn ?? s.nameEn}
                      </span>
                      <span className="grow min-w-0 text-end text-[12.5px] text-muted truncate">
                        {m ? (t.en ? personName(m, 'en') : m.nameBn ?? m.nameEn) : <span className="text-warn font-semibold">{t('শূন্য', 'Vacant')}</span>}
                      </span>
                      {m?.party && <PartyDot abbr={m.party.abbr} size={9} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}
