import type { Metadata } from 'next';
import { langAlternates, shareGraph, shareTwitter, cardImage, fitDescription, fitTitle } from '@/lib/seo';
import { notFound } from 'next/navigation';
import { getMemberById, meta } from '@/lib/data';
import SeatMap from '@/components/SeatMap';
import { districtGroups as districts } from '@/lib/districts';
import { districtIntro, divisionOf } from '@/lib/districtIntro';
import { districtWiki } from '@/lib/districtWiki';
import { seatArea } from '@/lib/seatArea';
import upazilaEnTable from '../../../../../../data/upazila-en.json';
import fs from 'node:fs';
import path from 'node:path';
import { Page, PageHead, Card, Breadcrumb, MemberRow, PartyDot, Stat, DocLink } from '@/components/ui';
import Link from '@/i18n/Link';
import { getT } from '@/i18n/server';
import { districtName, partyName, partyShort, personName, seatName } from '@/i18n/names';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

/**
 * One colour a seat on the district's map, so the seats tell apart even when
 * one party holds them all; the legend under the map names each seat's party.
 */
const SEAT_TONES = ['#0f6a4b', '#d97706', '#2563eb', '#c026d3', '#dc2626', '#0891b2', '#65a30d', '#7c3aed', '#db2777', '#a16207', '#0d9488', '#4f46e5'];

const upazilaEn = new Map((upazilaEnTable as [string, string][]).map(([en, bn]) => [bn.normalize('NFC'), en]));

/** The district's upazilas, from its map, each with the seats it is in. */
function upazilasOf(slug: string): { name: string; seats: string[] }[] {
  try {
    const g = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'geo', `${slug}.json`), 'utf8')) as {
      features: { properties: { name: string; kind: string; seats: Record<string, string> } }[];
    };
    return g.features.filter((f) => f.properties.kind === 'upazila').map((f) => ({ name: f.properties.name, seats: Object.keys(f.properties.seats) }));
  } catch {
    return [];
  }
}

export function generateStaticParams() {
  return [...districts().keys()].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/jela/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  const d = districts().get(slug);
  if (!d) return { title: t('জেলা পাওয়া যায়নি', 'District not found') };
  const name = districtName(d, t.lang);
  const title = t(`${d.bn} জেলার এমপি ও সংসদীয় আসন`, `${name} district: MPs and constituencies`);
  // The district's own card (src/app/api/og/jela/[slug]/route.tsx): its seats, and who holds them.
  const image = cardImage(`/api/og/jela/${d.slug}${t.en ? '/en' : ''}`, title);
  return {
    title: fitTitle(t.lang, title),
    alternates: langAlternates(t.lang, `/jela/${d.slug}`),
    openGraph: shareGraph(`/jela/${d.slug}`, image, t.lang),
    twitter: shareTwitter(image),
    description: fitDescription(districtIntro(d, t.lang).short),
  };
}

export default async function DistrictPage({ params }: PageProps<'/[lang]/jela/[slug]'>) {
  const { slug } = await params;
  const t = await getT();
  const d = districts().get(slug);
  if (!d) notFound();
  const name = districtName(d, t.lang);
  const division = divisionOf(d, t.lang);
  const divisionId = divisionOf(d, 'en')?.toLowerCase().replace(/[^a-z]+/g, '-');
  const wiki = districtWiki(d.slug, t.lang);
  const upazilas = upazilasOf(d.slug);
  const tone = Object.fromEntries(d.seats.map((s, i) => [s.slug, SEAT_TONES[i % SEAT_TONES.length]!]));
  const upazilaName = (bn: string) => (t.en ? upazilaEn.get(bn.normalize('NFC')) ?? bn : bn);

  const rows = d.seats.map((s) => ({ seat: s, m: s.memberId ? getMemberById(s.memberId) : undefined }));
  const parties = new Map<string, number>();
  for (const r of rows) if (r.m?.party) parties.set(r.m.party.abbr, (parties.get(r.m.party.abbr) ?? 0) + 1);

  // The two things people ask of a district, answered from the list below: how many seats, and who holds each.
  const seatLabel = (s: (typeof d.seats)[number]) => (t.en ? seatName(s, 'en') || s.slug : s.nameBn ?? s.slug);
  const holders = rows.map(({ seat, m }) =>
    m && !seat.vacantSince
      ? `${seatLabel(seat)}: ${personName(m, t.lang)}${m.party ? ` (${partyShort(m.party, t.lang)})` : ''}`
      : `${seatLabel(seat)}: ${t('শূন্য', 'vacant')}`,
  );
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: t(`${d.bn} জেলায় কয়টি সংসদীয় আসন?`, `How many parliamentary seats does ${name} district have?`),
        acceptedAnswer: {
          '@type': 'Answer',
          text: t(
            `${d.bn} জেলায় ${t.n(d.seats.length)}টি সংসদীয় আসন: ${d.seats.map(seatLabel).join(', ')}।`,
            `${name} district has ${t.count(d.seats.length, '', 'parliamentary seat', 'parliamentary seats')}: ${d.seats.map(seatLabel).join(', ')}.`,
          ),
        },
      },
      {
        '@type': 'Question',
        name: t(`${d.bn} জেলার এমপি কারা?`, `Who are the MPs of ${name} district?`),
        acceptedAnswer: {
          '@type': 'Answer',
          text: t(`ত্রয়োদশ জাতীয় সংসদে ${d.bn} জেলার সংসদ সদস্য: ${holders.join('; ')}।`, `The Members of the 13th Parliament from ${name} district: ${holders.join('; ')}.`),
        },
      },
    ],
  };

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Breadcrumb
        items={[
          { href: '/', label: t('হোম', 'Home') },
          { href: '/jela', label: t('জেলা', 'Districts') },
          { label: t(`${d.bn} জেলা`, `${name} district`) },
        ]}
      />
      <PageHead
        eyebrow={division ? t(`${division} বিভাগ`, `${division} Division`) : t('জেলা', 'District')}
        title={t(`${d.bn} জেলা`, `${name} district`)}
        lede={t(
          `${d.en} · ${t.n(d.seats.length)}টি সংসদীয় আসন${upazilas.length ? ` · ${t.n(upazilas.length)}টি উপজেলা` : ''}। প্রতিটি আসনের বর্তমান সদস্য, সংসদের তথ্যভান্ডার অনুযায়ী।`,
          `${t.count(d.seats.length, '', 'parliamentary seat', 'parliamentary seats')}${upazilas.length ? ` · ${upazilas.length} upazilas` : ''}. The current member for each seat, according to Parliament's database.`,
        )}
        aside={
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <Stat label={t('আসন', 'Seats')} value={t.n(d.seats.length)} />
            <Stat label={t('উপজেলা', 'Upazilas')} value={upazilas.length ? t.n(upazilas.length) : '–'} />
            <Stat label={t('দল', 'Parties')} value={t.n(parties.size)} />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href(`/jela/${d.slug}`)}`}
          title={`${t(`${d.bn} জেলা`, `${name} district`)} | ${t('আমার এমপি', 'My MP')}`}
          text={
            d.seats.length === 1
              ? t(`${d.bn} জেলার একমাত্র আসনের সংসদ সদস্য`, `The Member of Parliament for ${name} district's only seat`)
              : t(`${d.bn} জেলার ${t.n(d.seats.length)}টি আসনের সংসদ সদস্য`, `The Members of Parliament for the ${d.seats.length} seats of ${name} district`)
          }
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* The district itself, from Wikipedia; then in Parliament, from the site's own records. */}
        <Card className="p-5 sm:p-7 flex flex-col gap-5">
          {wiki && (
            <div className="flex flex-col gap-2.5">
              <h2 className="display text-[19px] sm:text-[21px]">{t('জেলা পরিচিতি', 'About the district')}</h2>
              <p className="text-[15.5px] sm:text-[16px] leading-[1.8] text-inksoft text-pretty">{wiki.text}</p>
              <p className="text-[12.5px] text-muted">
                {t('উইকিপিডিয়া থেকে', 'From Wikipedia')}: <DocLink href={wiki.url}>{wiki.title}</DocLink> · CC BY-SA 4.0
              </p>
            </div>
          )}
          <div className={`flex flex-col gap-2.5 ${wiki ? 'pt-5 border-t border-rulesoft' : ''}`}>
            <h2 className="display text-[19px] sm:text-[21px]">{t('সংসদে জেলাটি', 'The district in Parliament')}</h2>
            <p className="text-[15.5px] sm:text-[16px] leading-[1.8] text-inksoft text-pretty">{districtIntro(d, t.lang).text}</p>
          </div>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-4">
            <h2 className="display text-[17px]">{t('এক নজরে', 'At a glance')}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[14px]">
              {division && (
                <>
                  <dt className="text-muted">{t('বিভাগ', 'Division')}</dt>
                  <dd className="font-semibold text-ink">
                    <Link href={`/jela${divisionId ? `#div-${divisionId}` : ''}`} className="hover:text-brand">{division}</Link>
                  </dd>
                </>
              )}
              <dt className="text-muted">{t('সংসদীয় আসন', 'Seats')}</dt>
              <dd className="font-semibold text-ink tnum">{t.n(d.seats.length)}</dd>
              {upazilas.length > 0 && (
                <>
                  <dt className="text-muted">{t('উপজেলা', 'Upazilas')}</dt>
                  <dd className="font-semibold text-ink tnum">{t.n(upazilas.length)}</dd>
                </>
              )}
            </dl>
            {upazilas.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {upazilas.map((u) => (
                  <li key={u.name} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-sunk text-[12.5px] font-semibold text-inksoft">
                    {u.seats.slice(0, 2).map((sl) => (
                      <span key={sl} aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: tone[sl] }} />
                    ))}
                    {upazilaName(u.name)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[17px]">{t('দলভিত্তিক আসন', 'Seats by party')}</h2>
            <ul className="flex flex-col gap-2.5 text-[14.5px]">
              {[...parties.entries()].sort((a, b) => b[1] - a[1]).map(([abbr, n]) => {
                const party = rows.find((r) => r.m?.party?.abbr === abbr)?.m?.party;
                return (
                  <li key={abbr} className="flex items-center gap-2.5">
                    <PartyDot abbr={abbr} size={24} />
                    <span className="grow">{t.en ? partyName(party, 'en') || abbr : party?.nameBn ?? abbr}</span>
                    <span className="display tnum text-[18px]">{t.n(n)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>

      <section className="mt-10 flex flex-col gap-3">
        <h2 className="display text-[22px] font-bold">{t('জেলার মানচিত্র', 'Map of the district')}</h2>
        <SeatMap
          geoUrl={`/geo/${slug}.json`}
          colors={tone}
          seatNames={Object.fromEntries(d.seats.map((s) => [s.slug, t.en ? seatName(s, 'en') || s.slug : s.nameBn ?? s.nameEn ?? s.slug]))}
          title={t(`${d.bn} জেলা`, `${name} district`)}
        />
        {/* The legend: each seat's colour on the map, its member and party. */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {rows.map(({ seat, m }) => {
            const sitting = m && !seat.vacantSince ? m : undefined;
            return (
              <li key={seat.slug}>
                <Link href={`/ason/${seat.slug}`} className="group h-full bg-surface border border-rule rounded-card px-3.5 py-2.5 flex items-center gap-3 hover:border-brand transition-colors">
                  <span aria-hidden="true" className="w-4 h-4 rounded-[5px] shrink-0" style={{ background: tone[seat.slug], opacity: 0.85 }} />
                  <span className="grow min-w-0 flex flex-col">
                    <span className="display text-[14.5px] group-hover:text-brand">{seatLabel(seat)}</span>
                    <span className="text-[12.5px] text-muted truncate">{sitting ? personName(sitting, t.lang) : t('আসনটি এখন শূন্য', 'The seat is vacant')}</span>
                  </span>
                  {sitting?.party && <PartyDot abbr={sitting.party.abbr} size={22} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10 pb-14 flex flex-col gap-4">
        <h2 className="display text-[22px] font-bold">{t('আসন ও সংসদ সদস্য', 'Seats and their members')}</h2>
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map(({ seat, m }) => {
            const area = t.en ? null : seatArea(seat.boundaryBn);
            return (
              <li key={seat.no} className="flex flex-col gap-2">
                <div className="flex items-start gap-2.5 px-1">
                  <span aria-hidden="true" className="mt-1.5 w-3 h-3 rounded-[4px] shrink-0" style={{ background: tone[seat.slug], opacity: 0.85 }} />
                  <div className="min-w-0 flex flex-col">
                    <Link href={`/ason/${seat.slug}`} className="text-[15px] font-bold text-brand hover:underline">
                      {seatLabel(seat)} <span className="text-muted font-medium">{t(`, আসন ${t.n(seat.no)}`, `, seat ${seat.no}`)}</span>
                    </Link>
                    {area && <span className="text-[12.5px] text-muted leading-snug">{area}</span>}
                  </div>
                </div>
                {m ? (
                  <MemberRow m={m} />
                ) : (
                  <Card className="px-4 py-3 text-[14px] text-muted">
                    {t('এই আসনের সদস্যের তথ্য সংসদের তথ্যভান্ডারে নেই।', "Parliament's database has no member for this seat.")}
                  </Card>
                )}
              </li>
            );
          })}
        </ul>
        <p className="px-1 text-[12.5px] text-muted leading-relaxed">
          {t('তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ | হালনাগাদ', 'Source: Parliament of Bangladesh | Updated')} {t.date(meta.syncedAt)}
        </p>
      </section>
    </Page>
  );
}

export const dynamicParams = false;
