import type { Metadata } from 'next';
import { shareGraph, langAlternates } from '@/lib/seo';
import Link from '@/i18n/Link';
import { getT } from '@/i18n/server';
import type { T } from '@/i18n/core';
import { partyName } from '@/i18n/names';
import { parties, statistics, partyColor, type Party } from '@/lib/data';
import { partyLogo } from '@/lib/partyLogos';
import { partyProfile, foundedYear } from '@/lib/partyProfiles';
import { Page, PageHead, Card, CompositionBar, PartyMark, LogoCredit } from '@/components/ui';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

const independents = parties.find((p) => p.abbr === 'Ind')?.seats ?? 0;
const partyCount = parties.filter((p) => p.abbr !== 'Ind' && p.seats > 0).length;
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/dol'),
    openGraph: shareGraph('/dol', undefined, t.lang),
    title: t('রাজনৈতিক দল', 'Political parties'),
    description: t(
      `ত্রয়োদশ জাতীয় সংসদে প্রতিনিধিত্বকারী ${t.n(partyCount)}টি রাজনৈতিক দল ও ${t.n(independents)} জন স্বতন্ত্র সংসদ সদস্যের তালিকা, প্রতিটি দলের আসনসংখ্যা ও সংসদ সদস্যদের নামসহ।`,
      `The ${t.count(partyCount, '', 'political party', 'political parties')} and ${t.count(independents, '', 'independent member', 'independent members')} in the 13th Parliament, with each party's seats and the names of its MPs.`,
    ),
  };
}

/**
 * One party: logo, name and seats; its story in two lines; founding year,
 * head and symbol; and a bar of its share of the House (elected seats solid,
 * reserved seats lighter).
 */
function PartyCard({ p, total, t }: { p: Party; total: number; t: T }) {
  const profile = p.abbr === 'Ind' ? null : partyProfile(p, t.lang);
  const year = foundedYear(profile);
  const summary =
    p.abbr === 'Ind'
      ? t(
          'কোনো রাজনৈতিক দলের প্রার্থী না হয়ে নির্বাচিত সংসদ সদস্যরা। স্বতন্ত্র কোনো দল নয়, তাই এর প্রতিষ্ঠাতা বা দলপ্রধান নেই।',
          'Members of Parliament elected without standing as the candidate of any political party. Independents are not a party, so they have no founder or party leader.',
        )
      : profile?.summary;
  const facts = [
    year ? { k: t('প্রতিষ্ঠা', 'Founded'), v: t.n(year) } : null,
    profile?.leaderName ? { k: profile.leaderTitle ?? t('দলপ্রধান', 'Party leader'), v: profile.leaderName } : null,
    profile?.symbol ? { k: t('প্রতীক', 'Symbol'), v: profile.symbol } : null,
  ].filter((x): x is { k: string; v: string } => !!x);
  const color = partyColor(p.abbr);
  const share = (p.seats / total) * 100;
  const pct = share >= 10 ? share.toFixed(0) : share.toFixed(1);

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
              {partyName(p, t.lang)}
            </span>
            {!t.en && <span className="text-[13px] text-muted">{p.nameEn}</span>}
          </span>
          <span className="shrink-0 text-end">
            <span className="display tnum block text-[30px] leading-none">{t.n(p.seats)}</span>
            <span className="block text-[12px] text-muted mt-1.5">{t('আসন', p.seats === 1 ? 'seat' : 'seats')}</span>
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
            <span>
              {t(`নির্বাচিত ${t.n(p.seatsTerritorial)}, সংরক্ষিত ${t.n(p.seatsReserved)}`, `Elected ${p.seatsTerritorial}, reserved ${p.seatsReserved}`)}
            </span>
            <span>{t(`সংসদের ${t.n(pct)}%`, `${pct}% of Parliament`)}</span>
          </span>
        </span>
      </span>
    </Link>
  );
}

export default async function PartiesPage() {
  const stats = statistics();
  const t = await getT();

  return (
    <Page>
      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('রাজনৈতিক দল', 'Political parties')}
        lede={t(
          `সংসদে আসন আছে এমন ${t.n(parties.length)}টি দল। মোট ${t.n(stats.total)}টি আসনের মধ্যে ${t.n(stats.territorial)}টি নির্বাচনে জেতা, ${t.n(stats.reserved)}টি সংরক্ষিত নারী আসন। প্রতিটি দল কবে, কীভাবে গড়ে উঠেছে আর এখন কে নেতৃত্বে, তা দলের পাতায়।`,
          `The ${parties.length} parties with seats in Parliament. Of the ${stats.total} seats, ${stats.territorial} were won at the polls and ${stats.reserved} are reserved seats for women. When and how each party came to be, and who leads it now, is on each party's own page.`,
        )}
      />
      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href('/dol')}`}
          title={t('রাজনৈতিক দল | আমার এমপি', 'Political parties | My MP')}
          text={t('ত্রয়োদশ জাতীয় সংসদের রাজনৈতিক দল, আসনসংখ্যা ও দলের পরিচিতি', 'The political parties of the 13th Parliament, their seats and profiles')}
        />
      </div>

      <Card className="mt-8 p-6">
        <CompositionBar parties={parties} total={stats.total} majority={stats.majority} />
      </Card>

      <ul className="mt-6 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {parties.map((p) => (
          <li key={p.abbr} className="h-full">
            <PartyCard p={p} total={stats.total} t={t} />
          </li>
        ))}
      </ul>

      <section className="pb-14 text-[13px] text-muted leading-relaxed">
        <h2 className="font-bold text-inksoft">{t('দলের লোগোর উৎস', 'Sources of the party logos')}</h2>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {parties.filter((p) => partyLogo(p.abbr)).map((p) => (
            <li key={p.abbr}>
              {partyName(p, t.lang)}
              {partyLogo(p.abbr)?.kind === 'flag' ? t(' (পতাকা)', ' (flag)') : ''}: <LogoCredit abbr={p.abbr} />
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
