import type { Metadata } from 'next';
import Link from 'next/link';
import { shareGraph } from '@/lib/seo';
import { bn, getMemberById } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { Page, PageHead, Stat, PartyDot } from '@/components/ui';

/**
 * The district index. Each district already had a page and the seat pages link
 * back to them, but /jela itself was a 404, so a reader on one district could
 * not step up to the rest, and the sixty-four pages hung off the election page
 * alone.
 */
const districts = districtList();
const seatTotal = districts.reduce((n, d) => n + d.seats.length, 0);

export const metadata: Metadata = {
  alternates: { canonical: '/jela' },
  openGraph: shareGraph('/jela'),
  title: 'জেলা অনুযায়ী আসন ও সংসদ সদস্য',
  description: `বাংলাদেশের ${bn(districts.length)}টি জেলার ${bn(seatTotal)}টি সংসদীয় আসন। নিজের জেলা বেছে সেখানকার প্রতিটি আসন ও বর্তমান সংসদ সদস্য দেখুন; তথ্যসূত্র বাংলাদেশ জাতীয় সংসদ।`,
};

export default function DistrictIndex() {
  return (
    <Page>
      <PageHead
        eyebrow="ত্রয়োদশ জাতীয় সংসদ"
        title="জেলা অনুযায়ী"
        lede={`${bn(districts.length)}টি জেলায় ${bn(seatTotal)}টি সংসদীয় আসন। জেলার পাতায় সেখানকার প্রতিটি আসন, বর্তমান সংসদ সদস্য ও দলভিত্তিক হিসাব আছে।`}
        aside={
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <Stat label="জেলা" value={bn(districts.length)} />
            <Stat label="আসন" value={bn(seatTotal)} />
          </div>
        }
      />

      <ul className="mt-8 pb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {districts.map((d) => {
          // The parties holding the district's seats, in seat order, so a
          // reader sees at a glance whether it went one way or split.
          const abbrs = d.seats
            .map((s) => (s.memberId ? getMemberById(s.memberId)?.party?.abbr : null))
            .filter((a): a is string => !!a);
          return (
            <li key={d.slug}>
              <Link
                href={`/jela/${d.slug}`}
                className="reveal group h-full bg-surface border border-rule rounded-card shadow-card p-4 flex items-center gap-3 hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
              >
                <span className="grow min-w-0 flex flex-col gap-0.5">
                  <span className="display text-[16.5px] group-hover:text-brand transition-colors">{d.bn}</span>
                  <span className="text-[12.5px] text-muted">{d.en}</span>
                </span>
                <span className="shrink-0 flex flex-col items-end gap-1.5">
                  <span className="tnum text-[13px] text-inksoft font-semibold">{bn(d.seats.length)}টি আসন</span>
                  <span aria-hidden="true" className="flex gap-1">
                    {abbrs.slice(0, 8).map((a, i) => (
                      <PartyDot key={`${a}-${i}`} abbr={a} size={9} />
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
