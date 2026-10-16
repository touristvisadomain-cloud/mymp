import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import Link from 'next/link';
import { parties, statistics, bn, partyColor, type Party } from '@/lib/data';
import { partyLogo } from '@/lib/partyLogos';
import { partyProfile, foundedYear } from '@/lib/partyProfiles';
import { Page, PageHead, Card, CompositionBar, PartyMark, LogoCredit } from '@/components/ui';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

const independents = parties.find((p) => p.abbr === 'Ind')?.seats ?? 0;
const partyCount = parties.filter((p) => p.abbr !== 'Ind' && p.seats > 0).length;
export const metadata: Metadata = {
  alternates: { canonical: '/dol' },
  openGraph: shareGraph('/dol'),
  title: 'রাজনৈতিক দল',
  description: `ত্রয়োদশ জাতীয় সংসদে প্রতিনিধিত্বকারী ${bn(partyCount)}টি রাজনৈতিক দল ও ${bn(independents)} জন স্বতন্ত্র সংসদ সদস্যের তালিকা, প্রতিটি দলের আসনসংখ্যা ও সংসদ সদস্যদের নামসহ।`,
};

/**
 * One party: logo, name and seats; its story in two lines; founding year,
 * head and symbol; and a bar of its share of the House (elected seats solid,
 * reserved seats lighter).
 */
function PartyCard({ p, total }: { p: Party; total: number }) {
  const profile = p.abbr === 'Ind' ? null : partyProfile(p);
  const year = foundedYear(profile);
  const summary =
    p.abbr === 'Ind'
      ? 'কোনো রাজনৈতিক দলের প্রার্থী না হয়ে নির্বাচিত সংসদ সদস্যরা। স্বতন্ত্র কোনো দল নয়, তাই এর প্রতিষ্ঠাতা বা দলপ্রধান নেই।'
      : profile?.summaryBn;
  const facts = [
    year ? { k: 'প্রতিষ্ঠা', v: bn(year) } : null,
    profile?.leaderNameBn ? { k: profile.leaderTitleBn ?? 'দলপ্রধান', v: profile.leaderNameBn } : null,
    profile?.symbolBn ? { k: 'প্রতীক', v: profile.symbolBn } : null,
  ].filter((x): x is { k: string; v: string } => !!x);
  const color = partyColor(p.abbr);
  const share = (p.seats / total) * 100;

  return (
    <Link
      href={`/dol/${p.slug}`}
      className="reveal group h-full bg-surface border border-rule rounded-card shadow-card overflow-hidden flex flex-col hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
    >
      <span aria-hidden="true" className="h-1 shrink-0" style={{ background: color }} />
      <span className="p-5 sm:p-6 flex flex-col gap-4 grow">
        <span className="flex items-start gap-4">
          <PartyMark abbr={p.abbr} size={56} />
          <span className="grow min-w-0 flex flex-col gap-0.5 pt-0.5">
            <span className="display text-[18.5px] sm:text-[19.5px] leading-snug group-hover:text-brand transition-colors">
              {p.nameBn ?? p.abbr}
            </span>
            <span className="text-[13px] text-muted">{p.nameEn}</span>
          </span>
          <span className="shrink-0 text-end">
            <span className="display tnum block text-[30px] leading-none">{bn(p.seats)}</span>
            <span className="block text-[12px] text-muted mt-1.5">আসন</span>
          </span>
        </span>

        {summary && <span className="text-[14.5px] leading-relaxed text-inksoft text-pretty">{summary}</span>}

        {facts.length > 0 && (
          <span className="flex flex-wrap gap-2">
            {facts.map((f) => (
              <span key={f.k} className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-full bg-sunk text-[12.5px]">
                <span className="text-muted">{f.k}</span>
                <span className="font-semibold text-ink">{f.v}</span>
              </span>
            ))}
          </span>
        )}

        <span className="mt-auto pt-1 flex flex-col gap-1.5">
          <span aria-hidden="true" className="h-2 rounded-full bg-sunk overflow-hidden flex">
            <span style={{ width: `${(p.seatsTerritorial / total) * 100}%`, background: color }} />
            <span style={{ width: `${(p.seatsReserved / total) * 100}%`, background: color, opacity: 0.45 }} />
          </span>
          <span className="flex justify-between gap-3 text-[12px] text-muted tnum">
            <span>নির্বাচিত {bn(p.seatsTerritorial)}, সংরক্ষিত {bn(p.seatsReserved)}</span>
            <span>সংসদের {bn(share >= 10 ? share.toFixed(0) : share.toFixed(1))}%</span>
          </span>
        </span>
      </span>
    </Link>
  );
}

export default function PartiesPage() {
  const stats = statistics();

  return (
    <Page>
      <PageHead
        eyebrow="ত্রয়োদশ জাতীয় সংসদ"
        title="রাজনৈতিক দল"
        lede={`সংসদে আসন আছে এমন ${bn(parties.length)}টি দল। মোট ${bn(stats.total)}টি আসনের মধ্যে ${bn(stats.territorial)}টি নির্বাচনে জেতা, ${bn(stats.reserved)}টি সংরক্ষিত নারী আসন। প্রতিটি দল কবে, কীভাবে গড়ে উঠেছে আর এখন কে নেতৃত্বে, তা দলের পাতায়।`}
      />
      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}/dol`}
          title="রাজনৈতিক দল | আমার এমপি"
          text="ত্রয়োদশ জাতীয় সংসদের রাজনৈতিক দল, আসনসংখ্যা ও দলের পরিচিতি"
        />
      </div>

      <Card className="mt-8 p-6">
        <CompositionBar parties={parties} total={stats.total} majority={stats.majority} />
      </Card>

      <ul className="mt-6 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {parties.map((p) => (
          <li key={p.abbr} className="h-full">
            <PartyCard p={p} total={stats.total} />
          </li>
        ))}
      </ul>

      <section className="pb-14 text-[13px] text-muted leading-relaxed">
        <h2 className="font-bold text-inksoft">দলের লোগোর উৎস</h2>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {parties.filter((p) => partyLogo(p.abbr)).map((p) => (
            <li key={p.abbr}>{p.nameBn ?? p.abbr}{partyLogo(p.abbr)?.kind === 'flag' ? ' (পতাকা)' : ''}: <LogoCredit abbr={p.abbr} /></li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
