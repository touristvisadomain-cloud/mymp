import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import { getMemberById, partyColor, GENERAL_SEATS, RESERVED_SEATS } from '@/lib/data';
import { districtList } from '@/lib/districts';
import { Page, PageHead, Stat } from '@/components/ui';
import { getT } from '@/i18n/server';
import { districtName, partyShort, personName, seatName } from '@/i18n/names';
import { divisionOf } from '@/lib/districtIntro';
import { memberInitial } from '@/components/mp/initial';
import SeatBrowser, { type PartyTotal, type SeatDivision } from '@/components/SeatBrowser';
import type { T } from '@/i18n/core';
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

/** A seat's sitting member: one who resigned keeps the seat's memberId while it stands vacant. */
const holder = (s: (typeof districts)[number]['seats'][number]) => (s.memberId && !s.vacantSince ? getMemberById(s.memberId) ?? null : null);

/** "(ক) পঞ্চগড় সদর, (খ) তেঁতুলিয়া এবং (গ)আটোয়ারী উপজেলা" → "পঞ্চগড় সদর, তেঁতুলিয়া ও আটোয়ারী উপজেলা": what the card shows under the member. */
function areaOf(boundary: string | null | undefined): string | null {
  if (!boundary) return null;
  const s = boundary
    .replace(/\([ক-হ]\)\s*/g, '')
    .replace(/\([০-৯\d]+\)\s*/g, '')
    .replace(/\s*এবং\s*/g, ' ও ')
    .replace(/\s*ঃ\s*-?/g, ': ')
    .replace(/\s+/g, ' ')
    .trim();
  return s || null;
}

/** The seats under their divisions and districts, as the browser shows them. */
function divisionsOf(t: T): SeatDivision[] {
  const out = new Map<string, SeatDivision>();
  for (const d of districts) {
    const id = `div-${(divisionOf(d, 'en') ?? 'other').toLowerCase().replace(/[^a-z]+/g, '-')}`;
    const v = out.get(id) ?? { id, name: divisionOf(d, t.lang) ?? t('অন্যান্য', 'Other'), districts: [] };
    v.districts.push({
      slug: d.slug,
      name: districtName(d, t.lang),
      seats: d.seats.map((s) => {
        const m = holder(s);
        return {
          slug: s.slug,
          name: t.en ? seatName(s, 'en') : s.nameBn ?? s.nameEn ?? '',
          // The boundary text is in Bangla only; an English page leaves it to the seat's page.
          area: t.en ? null : areaOf(s.boundaryBn),
          member: m
            ? {
                name: t.en ? personName(m, 'en') : m.nameBn ?? m.nameEn ?? '',
                slug: m.slug,
                photo: m.photoUrl ?? null,
                initial: memberInitial(m, t.lang),
                abbr: m.party?.abbr ?? null,
                color: partyColor(m.party?.abbr),
                party: m.party ? partyShort(m.party, t.lang) : t('স্বতন্ত্র', 'Independent'),
              }
            : null,
          keys: [s.nameBn, s.nameEn, seatName(s, 'en'), m?.nameBn, m?.nameEn, m ? personName(m, 'en') : null, d.bn, d.en].filter(Boolean).join(' '),
        };
      }),
    });
    out.set(id, v);
  }
  return [...out.values()];
}

/** The general seats by party, largest first, vacant seats last. */
function partyTotals(t: T): PartyTotal[] {
  const c = new Map<string | null, number>();
  for (const s of districts.flatMap((d) => d.seats)) {
    const a = holder(s)?.party?.abbr ?? null;
    c.set(a, (c.get(a) ?? 0) + 1);
  }
  return [...c.entries()]
    .sort((x, y) => (x[0] === null ? 1 : y[0] === null ? -1 : y[1] - x[1]))
    .map(([abbr, count]) => ({ abbr, count, color: abbr ? partyColor(abbr) : null, label: abbr ? partyShort({ abbr }, t.lang) : t('শূন্য', 'Vacant') }));
}

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
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full md:w-auto">
            <Stat label={t('আসন', 'Seats')} value={t.n(seatTotal)} />
            <Stat label={t('জেলা', 'Districts')} value={t.n(districts.length)} />
            <Stat label={t('শূন্য আসন', 'Vacant')} value={t.n(vacant)} />
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

      <SeatBrowser divisions={divisionsOf(t)} parties={partyTotals(t)} />
    </Page>
  );
}
