import type { Metadata } from 'next';
import { langAlternates, shareGraph } from '@/lib/seo';
import { notFound } from 'next/navigation';
import { getMemberById, meta, partyColor } from '@/lib/data';
import SeatMap from '@/components/SeatMap';
import { districtGroups as districts } from '@/lib/districts';
import { districtIntro } from '@/lib/districtIntro';
import { Page, PageHead, Card, Breadcrumb, MemberRow, PartyDot, Stat } from '@/components/ui';
import Link from '@/i18n/Link';
import { getT } from '@/i18n/server';
import { districtName, partyName, seatName } from '@/i18n/names';

export function generateStaticParams() {
  return [...districts().keys()].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/jela/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  const d = districts().get(slug);
  if (!d) return { title: t('জেলা পাওয়া যায়নি', 'District not found') };
  const name = districtName(d, t.lang);
  return {
    title: t(`${d.bn} জেলার সংসদ সদস্য ও আসন`, `Members of Parliament and seats in ${name} district`),
    alternates: langAlternates(t.lang, `/jela/${d.slug}`),
    openGraph: shareGraph(`/jela/${d.slug}`, undefined, t.lang),
    description: districtIntro(d, t.lang).short,
  };
}

export default async function DistrictPage({ params }: PageProps<'/[lang]/jela/[slug]'>) {
  const { slug } = await params;
  const t = await getT();
  const d = districts().get(slug);
  if (!d) notFound();
  const name = districtName(d, t.lang);

  const rows = d.seats.map((s) => ({ seat: s, m: s.memberId ? getMemberById(s.memberId) : undefined }));
  const parties = new Map<string, number>();
  for (const r of rows) if (r.m?.party) parties.set(r.m.party.abbr, (parties.get(r.m.party.abbr) ?? 0) + 1);

  return (
    <Page>
      <Breadcrumb
        items={[
          { href: '/', label: t('হোম', 'Home') },
          { href: '/jela', label: t('জেলা', 'Districts') },
          { label: t(`${d.bn} জেলা`, `${name} district`) },
        ]}
      />
      <PageHead
        eyebrow={t('জেলা', 'District')}
        title={t(`${d.bn} জেলা`, `${name} district`)}
        lede={t(
          `${d.en}, ${t.n(d.seats.length)}টি সংসদীয় আসন। প্রতিটি আসনের বর্তমান সদস্য, সংসদের তথ্যভান্ডার অনুযায়ী।`,
          `${name}, ${t.count(d.seats.length, '', 'parliamentary seat', 'parliamentary seats')}. The current member for each seat, according to Parliament's database.`,
        )}
        aside={
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('আসন', 'Seats')} value={t.n(d.seats.length)} />
            <Stat label={t('দল', 'Parties')} value={t.n(parties.size)} />
          </div>
        }
      />

      {/* The district in a paragraph, from the site's own records: division, seats and their upazilas, who holds them now and who held them last time. */}
      <p className="mt-6 max-w-[760px] text-[16px] leading-[1.75] text-inksoft text-pretty">{districtIntro(d, t.lang).text}</p>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="display text-[22px] font-bold">{t('জেলার মানচিত্র', 'Map of the district')}</h2>
        <SeatMap
          geoUrl={`/geo/${slug}.json`}
          colors={Object.fromEntries(rows.map(({ seat, m }) => [seat.slug, partyColor(m?.party?.abbr)]))}
          seatNames={Object.fromEntries(d.seats.map((s) => [s.slug, t.en ? seatName(s, 'en') || s.slug : s.nameBn ?? s.nameEn ?? s.slug]))}
          title={t(`${d.bn} জেলা`, `${name} district`)}
        />
      </section>

      <div className="mt-8 pb-14 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <ul className="flex flex-col gap-3">
          {rows.map(({ seat, m }) => (
            <li key={seat.no} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 px-1">
                <Link href={`/ason/${seat.slug}`} className="text-[14px] font-bold text-brand hover:underline">
                  {t.en ? seatName(seat, 'en') : seat.nameBn}{' '}
                  <span className="text-muted font-medium">{t(`, আসন ${t.n(seat.no)}`, `, seat ${seat.no}`)}</span>
                </Link>
              </div>
              {m ? (
                <MemberRow m={m} />
              ) : (
                <Card className="px-4 py-3 text-[14px] text-muted">
                  {t('এই আসনের সদস্যের তথ্য সংসদের তথ্যভান্ডারে নেই।', "Parliament's database has no member for this seat.")}
                </Card>
              )}
            </li>
          ))}
        </ul>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[18px]">{t('দলভিত্তিক আসন', 'Seats by party')}</h2>
            <ul className="flex flex-col gap-2 text-[14.5px]">
              {[...parties.entries()].sort((a, b) => b[1] - a[1]).map(([abbr, n]) => {
                const party = rows.find((r) => r.m?.party?.abbr === abbr)?.m?.party;
                return (
                  <li key={abbr} className="flex items-center gap-2.5">
                    <PartyDot abbr={abbr} />
                    <span className="grow">{t.en ? partyName(party, 'en') || abbr : party?.nameBn ?? abbr}</span>
                    <span className="tnum font-bold">{t.n(n)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <p className="px-1 text-[12.5px] text-muted leading-relaxed">
            {t('তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ | হালনাগাদ', 'Source: Parliament of Bangladesh | Updated')} {t.date(meta.syncedAt)}
          </p>
        </aside>
      </div>
    </Page>
  );
}

export const dynamicParams = false;
