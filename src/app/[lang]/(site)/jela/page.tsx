import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import { getMemberById } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { Page, PageHead, Stat, PartyDot } from '@/components/ui';
import { getT } from '@/i18n/server';
import { districtName } from '@/i18n/names';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

/**
 * The district index. Each district already had a page and the seat pages link
 * back to them, but /jela itself was a 404, so a reader on one district could
 * not step up to the rest, and the sixty-four pages hung off the election page
 * alone.
 */
const districts = districtList();
const seatTotal = districts.reduce((n, d) => n + d.seats.length, 0);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/jela'),
    ...pageShare('jela', t),
    title: t('জেলাভিত্তিক সংসদীয় আসন ও এমপি তালিকা', 'Constituencies and MPs of Bangladesh by district'),
    description: fitDescription(
      t(
        `বাংলাদেশের ${t.n(districts.length)}টি জেলার ${t.n(seatTotal)}টি সংসদীয় আসন। নিজের জেলা বেছে সেখানকার প্রতিটি আসন ও বর্তমান সংসদ সদস্য দেখুন; তথ্যসূত্র বাংলাদেশ জাতীয় সংসদ।`,
        `The ${seatTotal} parliamentary seats in Bangladesh's ${districts.length} districts. Choose your district to see each of its seats and its current MP. Source: Parliament of Bangladesh.`,
      ),
    ),
  };
}

export default async function DistrictIndex() {
  const t = await getT();
  return (
    <Page>
      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('জেলা অনুযায়ী', 'By district')}
        lede={t(
          `${t.n(districts.length)}টি জেলায় ${t.n(seatTotal)}টি সংসদীয় আসন। জেলার পাতায় সেখানকার প্রতিটি আসন, বর্তমান সংসদ সদস্য ও দলভিত্তিক হিসাব আছে।`,
          `${seatTotal} parliamentary seats in ${districts.length} districts. Each district's page lists its seats, their current Members of Parliament and a count by party.`,
        )}
        aside={
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <Stat label={t('জেলা', 'Districts')} value={t.n(districts.length)} />
            <Stat label={t('আসন', 'Seats')} value={t.n(seatTotal)} />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href('/jela')}`}
          title={t('জেলাভিত্তিক সংসদীয় আসন | আমার এমপি', 'Constituencies by district | My MP')}
          text={t(
            `${t.n(districts.length)}টি জেলার ${t.n(seatTotal)}টি সংসদীয় আসন ও তাদের সংসদ সদস্য`,
            `The ${seatTotal} parliamentary seats in Bangladesh's ${districts.length} districts, and their MPs`,
          )}
        />
      </div>

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
                  <span className="display text-[16.5px] group-hover:text-brand transition-colors">{t.en ? districtName(d, 'en') : d.bn}</span>
                  {/* The Bangla page gives the English name underneath; the English page, the Bangla. */}
                  {t.en ? <span lang="bn" className="text-[12.5px] text-muted">{d.bn}</span> : <span className="text-[12.5px] text-muted">{d.en}</span>}
                </span>
                <span className="shrink-0 flex flex-col items-end gap-1.5">
                  <span className="tnum text-[13px] text-inksoft font-semibold">{t.count(d.seats.length, 'টি আসন', 'seat', 'seats')}</span>
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
