import type { Metadata } from 'next';
import Link from 'next/link';
import { shareGraph } from '@/lib/seo';
import { bn, getMemberById, GENERAL_SEATS, RESERVED_SEATS } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { Page, PageHead, Stat, PartyDot } from '@/components/ui';

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

export const metadata: Metadata = {
  alternates: { canonical: '/ason' },
  openGraph: shareGraph('/ason'),
  title: 'সব সংসদীয় আসন',
  description: `ত্রয়োদশ জাতীয় সংসদের ${bn(seatTotal)}টি সংসদীয় আসনের তালিকা, জেলা অনুযায়ী সাজানো, প্রতিটি আসনের বর্তমান সংসদ সদস্য ও দলসহ। তথ্যসূত্র বাংলাদেশ জাতীয় সংসদ।`,
};

export default function SeatIndex() {
  const vacant = districts.flatMap((d) => d.seats).filter((s) => !s.memberId || s.vacantSince).length;

  return (
    <Page>
      <PageHead
        eyebrow="ত্রয়োদশ জাতীয় সংসদ"
        title="সব সংসদীয় আসন"
        lede={`${bn(GENERAL_SEATS)}টি আসনে সরাসরি ভোটে সদস্য নির্বাচিত হন, আর ${bn(RESERVED_SEATS)}টি সংরক্ষিত নারী আসন ভাগ হয় দলগুলোর আনুপাতিক হারে। নিচের তালিকা জেলা অনুযায়ী সাজানো; আসনের পাতায় সেখানকার ভোটের ফল ও আগের সদস্যরা আছেন।`}
        aside={
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <Stat label="আসন" value={bn(seatTotal)} />
            <Stat label="জেলা" value={bn(districts.length)} />
          </div>
        }
      />

      <p className="mt-5 text-[14px] text-inksoft">
        সংরক্ষিত নারী আসনের {bn(RESERVED_SEATS)}টি আলাদা{' '}
        <Link href="/sangrakkhito-ason" className="font-semibold text-brand hover:underline">
          সংরক্ষিত নারী আসন
        </Link>{' '}
        পাতায়।
        {vacant > 0 && ` এই মুহূর্তে ${bn(vacant)}টি আসন শূন্য।`}
      </p>

      <div className="mt-8 pb-12 flex flex-col gap-7">
        {districts.map((d) => (
          <section key={d.slug}>
            <h2 className="display text-[17px] flex items-baseline gap-2">
              <Link href={`/jela/${d.slug}`} className="hover:text-brand transition-colors">
                {d.bn}
              </Link>
              <span className="text-[12.5px] text-muted font-normal tnum">{bn(d.seats.length)}টি আসন</span>
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
                        {s.nameBn ?? s.nameEn}
                      </span>
                      <span className="grow min-w-0 text-end text-[12.5px] text-muted truncate">
                        {m ? m.nameBn ?? m.nameEn : <span className="text-warn font-semibold">শূন্য</span>}
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
