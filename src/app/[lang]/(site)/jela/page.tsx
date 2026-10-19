import type { Metadata } from 'next';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import { getMemberById, partyColor } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { Page, PageHead, Stat } from '@/components/ui';
import { getT } from '@/i18n/server';
import { districtName, partyShort } from '@/i18n/names';
import { divisionOf } from '@/lib/districtIntro';
import DistrictBrowser, { type DivisionGroup, type SeatShare } from '@/components/DistrictBrowser';
import type { T } from '@/i18n/core';
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

/** Seat counts by party, largest first; vacant seats last. */
function sharesOf(abbrs: (string | null)[], t: T): SeatShare[] {
  const c = new Map<string | null, number>();
  for (const a of abbrs) c.set(a, (c.get(a) ?? 0) + 1);
  return [...c.entries()]
    .sort((x, y) => (x[0] === null ? 1 : y[0] === null ? -1 : y[1] - x[1]))
    .map(([a, count]) => ({
      abbr: a,
      label: a ? partyShort({ abbr: a }, t.lang) : t('শূন্য', 'Vacant'),
      color: a ? partyColor(a) : null,
      count,
    }));
}

/**
 * The districts under their divisions, in seat order: the division of the
 * first seat comes first, as the seats are numbered north to south.
 */
function divisionGroups(t: T): DivisionGroup[] {
  const groups = new Map<string, DivisionGroup & { abbrs: (string | null)[] }>();
  for (const d of districts) {
    const name = divisionOf(d, t.lang) ?? t('অন্যান্য', 'Other');
    const id = `div-${(divisionOf(d, 'en') ?? 'other').toLowerCase().replace(/[^a-z]+/g, '-')}`;
    const abbrs = d.seats.map((s) => (s.memberId ? getMemberById(s.memberId)?.party?.abbr ?? null : null));
    const g = groups.get(id) ?? { id, name, seats: 0, shares: [], districts: [], abbrs: [] };
    const name1 = t.en ? districtName(d, 'en') : d.bn;
    g.districts.push({
      slug: d.slug,
      name: name1,
      alt: t.en ? d.bn : d.en,
      altLang: t.en ? 'bn' : undefined,
      seats: d.seats.length,
      seatParties: abbrs.map((a) => ({ abbr: a, color: a ? partyColor(a) : null })),
      shares: sharesOf(abbrs, t),
      keys: `${d.bn} ${d.en} ${name1}`.toLowerCase(),
    });
    g.seats += d.seats.length;
    g.abbrs.push(...abbrs);
    groups.set(id, g);
  }
  return [...groups.values()].map(({ abbrs, ...g }) => ({ ...g, shares: sharesOf(abbrs, t) }));
}

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

      <DistrictBrowser divisions={divisionGroups(t)} />
    </Page>
  );
}
