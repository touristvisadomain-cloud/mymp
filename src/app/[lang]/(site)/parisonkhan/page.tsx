import type { Metadata } from 'next';
import { shareGraph, langAlternates } from '@/lib/seo';
import Link from '@/i18n/Link';
import { statistics, parties, committees, bn, bnGroup, dateBn, meta, ecs, partyColor, AGE_BAND_EN } from '@/lib/data';
import { Page, PageHead, Card, Stat, Empty } from '@/components/ui';
import { experienceStats } from '@/lib/history';
import Hemicycle from '@/components/Hemicycle';
import { getT } from '@/i18n/server';
import { inLang } from '@/i18n/content';
import { partyName, personName, seatName } from '@/i18n/names';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/parisonkhan'),
    openGraph: shareGraph('/parisonkhan', undefined, t.lang),
    title: t('পরিসংখ্যান', 'Statistics'),
    description: t(
      'ত্রয়োদশ জাতীয় সংসদের সদস্যদের পরিসংখ্যান: দলভিত্তিক আসন, নারী ও পুরুষ সদস্য, বয়স, পেশা ও কতবার নির্বাচিত, সংসদের তথ্যভান্ডার থেকে হিসাব করা।',
      'Statistics on the members of the 13th Parliament: seats by party, women and men, age, profession and how many times elected, worked out from Parliament’s own database.',
    ),
  };
}

/** A labelled horizontal bar. One series, so the heading names it and no legend is needed. */
async function Bars({
  rows,
  total,
  labelWidth = 'w-[86px]',
}: {
  rows: { label: string; count: number }[];
  /** What the shares are of; each row then shows its share beside its count. */
  total?: number;
  labelWidth?: string;
}) {
  const t = await getT();
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        // Two source spellings can share one English name, so the label alone is not a key.
        <div key={`${i}-${r.label}`} className="flex items-center gap-3">
          <span className={`${labelWidth} shrink-0 text-[13px] text-inksoft`}>{r.label}</span>
          <span className="grow h-4 bg-sunk rounded-[3px] overflow-hidden">
            <span
              className={`block h-full rounded-[3px] ${r.count === max ? 'bg-brand' : 'bg-brand/60'}`}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </span>
          <span className="w-9 shrink-0 text-end text-[13px] font-bold tnum">{t.n(r.count)}</span>
          {total ? <span className="w-10 shrink-0 text-end text-[12px] text-muted tnum">{t.n(Math.round((r.count / total) * 100))}%</span> : null}
        </div>
      ))}
    </div>
  );
}

/** Two parts of one whole, side by side, each with its count and share. */
async function Split({ a, b, label }: { a: { label: string; n: number; tone: string }; b: { label: string; n: number; tone: string }; label: string }) {
  const t = await getT();
  const sum = a.n + b.n || 1;
  const pct = (n: number) => t.n(Math.round((n / sum) * 100));
  const part = (x: { label: string; n: number; tone: string }) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${x.tone}`} aria-hidden="true" />
      {x.label} <b className="tnum">{t.group(x.n)}</b> <span className="text-muted tnum">({pct(x.n)}%)</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-0.5 h-3 rounded-full overflow-hidden" role="img" aria-label={label}>
        <span className={a.tone} style={{ flex: `${a.n} 1 0` }} />
        <span className={b.tone} style={{ flex: `${b.n} 1 0` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px]">
        {part(a)}
        {part(b)}
      </div>
    </div>
  );
}

/** The page's sections, for the shortcuts under the heading. */
const SECTIONS: [string, string, string][] = [
  ['ason', 'দলভিত্তিক আসন', 'Seats by party'],
  ['boyos', 'বয়স', 'Age'],
  ['pesha', 'পেশা', 'Profession'],
  ['nari', 'নারী প্রতিনিধিত্ব', 'Women'],
  ['obhiggota', 'অভিজ্ঞতা', 'Experience'],
  ['votar', 'ভোটার', 'Voters'],
];

export default async function StatisticsPage() {
  const t = await getT();
  const s = statistics();
  const ageBands = s.ageBands.map((b) => ({ label: t(b.label, AGE_BAND_EN[b.label] ?? b.label), count: b.count }));
  // The eight commonest professions; on the English page, those with no English yet are counted apart.
  const topProfessions = s.professions.slice(0, 8).map((p) => ({ label: inLang(p.label, t.lang), count: p.count }));
  const professionRows = topProfessions.filter((p): p is { label: string; count: number } => !!p.label);
  const professionsUnnamed = topProfessions.length - professionRows.length;
  const youngestName = s.youngest ? (t.en ? personName(s.youngest.m, 'en') : s.youngest.m.nameBn ?? s.youngest.m.nameEn) : null;
  const oldestName = s.oldest ? (t.en ? personName(s.oldest.m, 'en') : s.oldest.m.nameBn ?? s.oldest.m.nameEn) : null;
  const currentCommittees = committees.filter((c) => c.rosterCurrent).length;
  const womenPct = ((s.women / s.total) * 100).toFixed(1);
  const womenGeneralPct = ((s.womenTerritorial / s.territorial) * 100).toFixed(1);
  const seated = parties.filter((p) => p.seats > 0);

  return (
    <Page>
      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('পরিসংখ্যান', 'Statistics')}
        lede={t(
          `বর্তমান ${bn(s.total)} জন সংসদ সদস্যের তথ্য থেকে হিসাব করা। প্রতিটি সংখ্যা জাতীয় সংসদের নিজস্ব তথ্যভান্ডার থেকে, কোনো অনুমান নয়।`,
          `Worked out from the records of the ${s.total} current Members of Parliament. Every figure comes from Parliament’s own database; none is an estimate.`,
        )}
      />

      <nav aria-label={t('এই পাতায়', 'On this page')} className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label, labelEn]) => (
          <a
            key={id}
            href={`#${id}`}
            className="h-8 px-3 inline-flex items-center rounded-full border border-rule bg-surface text-[13px] font-semibold text-inksoft hover:border-brand hover:text-brand transition-colors"
          >
            {t(label, labelEn)}
          </a>
        ))}
      </nav>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label={t('মোট সদস্য', 'Total members')}
          value={t.n(s.total)}
          note={t(`${bn(s.territorial)} আসনভিত্তিক, ${bn(s.reserved)} সংরক্ষিত`, `${s.territorial} elected from seats, ${s.reserved} reserved`)}
        />
        <Stat
          label={t('নারী সদস্য', 'Women members')}
          value={t.n(s.women)}
          note={t(`${bn(womenPct)}%, এর ${bn(s.womenReserved)} জন সংরক্ষিত আসনে`, `${womenPct}%, of whom ${s.womenReserved} in reserved seats`)}
        />
        <Stat
          label={t('মধ্যক বয়স', 'Median age')}
          value={s.medianAge !== null ? t.n(s.medianAge) : t('তথ্য নেই', 'No data')}
          note={s.youngest && s.oldest ? t(`সর্বকনিষ্ঠ ${bn(s.youngest.age)}, সর্বজ্যেষ্ঠ ${bn(s.oldest.age)}`, `Youngest ${s.youngest.age}, oldest ${s.oldest.age}`) : undefined}
        />
        <Stat
          label={t('সংসদীয় কমিটি', 'Parliamentary committees')}
          value={t.n(committees.length)}
          note={t(`${bn(currentCommittees)}টির সদস্য তালিকা হালনাগাদ`, `${currentCommittees} with an up-to-date membership list`)}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <Card id="ason" className="lg:col-span-2 p-6 flex flex-col gap-5 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="display text-[21px] font-bold">{t('দলভিত্তিক আসন', 'Seats by party')}</h2>
            <p className="text-[13px] text-muted">
              {t(
                `${bn(s.total)}টি আসনের সবগুলো, সংরক্ষিত আসনসহ; প্রতিটি বিন্দু একটি আসন`,
                `All ${s.total} seats, reserved seats included; each dot is one seat`,
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 items-center">
            <Hemicycle
              blocs={seated.map((p) => ({ key: p.abbr, label: t.en ? partyName(p, 'en') : p.nameBn ?? p.abbr, seats: p.seats, color: partyColor(p.abbr) }))}
              total={s.total}
              majority={s.majority}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-[12px] text-muted border-b border-rule">
                    <th className="text-start font-semibold py-2">{t('দল', 'Party')}</th>
                    <th className="text-end font-semibold py-2 px-2">{t('আসনভিত্তিক', 'Elected')}</th>
                    <th className="text-end font-semibold py-2 px-2">{t('সংরক্ষিত', 'Reserved')}</th>
                    <th className="text-end font-semibold py-2 ps-2">{t('মোট', 'Total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rulesoft">
                  {seated.map((p) => (
                    <tr key={p.abbr}>
                      <td className="py-2 pe-2">
                        <Link href={`/dol/${p.slug}`} className="inline-flex items-center gap-2 hover:text-brand">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: partyColor(p.abbr) }} aria-hidden="true" />
                          <span className="font-medium">{t.en ? partyName(p, 'en') : p.nameBn ?? p.abbr}</span>
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-end tnum">{t.n(p.seatsTerritorial)}</td>
                      <td className="py-2 px-2 text-end tnum text-muted">{t.n(p.seatsReserved)}</td>
                      <td className="py-2 ps-2 text-end tnum font-bold">{t.n(p.seats)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[13px] text-muted border-t border-rule pt-3 leading-relaxed">
            {t.en ? (
              <>
                Forming a government takes {s.majority} seats. The {s.reserved} seats reserved for women are shared among the parties in proportion to
                their results in the general seats.
              </>
            ) : (
              <>সরকার গঠনে দরকার {bn(s.majority)}টি আসন। সংরক্ষিত {bn(s.reserved)}টি নারী আসন সাধারণ আসনের ফলের অনুপাতে দলগুলোর মধ্যে ভাগ হয়।</>
            )}
          </p>
        </Card>

        <Card id="boyos" className="p-6 flex flex-col gap-4 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="display text-[21px] font-bold">{t('বয়স', 'Age')}</h2>
            <p className="text-[13px] text-muted">{t(`${bn(s.total)} জনেরই জন্মতারিখ পাওয়া গেছে`, `Dates of birth found for all ${s.total}`)}</p>
          </div>
          <Bars rows={ageBands} total={s.total} />
          {s.youngest && s.oldest && (
            <div className="mt-auto border-t border-rule pt-3 flex flex-col gap-1.5 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t('সর্বকনিষ্ঠ', 'Youngest')}</span>
                <span className="text-end">
                  <Link href={`/mp/${s.youngest.m.slug}`} className="font-semibold text-brand hover:underline">
                    {youngestName}
                  </Link>{' '}
                  <span className="tnum text-muted">{t.n(s.youngest.age)}</span>
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t('সর্বজ্যেষ্ঠ', 'Oldest')}</span>
                <span className="text-end">
                  <Link href={`/mp/${s.oldest.m.slug}`} className="font-semibold text-brand hover:underline">
                    {oldestName}
                  </Link>{' '}
                  <span className="tnum text-muted">{t.n(s.oldest.age)}</span>
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card id="pesha" className="p-6 flex flex-col gap-4 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="display text-[21px] font-bold">{t('পেশা', 'Profession')}</h2>
            <p className="text-[13px] text-muted">
              {t.en ? `Profession recorded for ${s.withProfession} of ${s.total}` : <>{bn(s.total)} জনের মধ্যে {bn(s.withProfession)} জনের পেশা লিপিবদ্ধ</>}
            </p>
          </div>
          {professionRows.length > 0 && <Bars rows={professionRows} total={s.withProfession} labelWidth="w-[96px]" />}
          {t.en && professionsUnnamed > 0 && (
            <p className="text-[13px] text-muted leading-relaxed">
              {professionsUnnamed === topProfessions.length
                ? 'The commonest professions are recorded in Bangla and have not been translated yet: '
                : `${professionsUnnamed} more of the commonest professions have not been translated yet: `}
              {/* The Bangla page is another root layout (<html lang>), so a full page load, not a client navigation. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/parisonkhan#pesha" hrefLang="bn" className="font-semibold text-brand hover:underline">see them on the Bangla page</a>.
            </p>
          )}
          {t.en ? (
            <p className="mt-auto text-[13px] text-muted border-t border-rule pt-3 leading-relaxed">
              Parliament’s database has no profession for {s.total - s.withProfession}, so they are not counted here. Different spellings of the same
              profession are counted as one.
            </p>
          ) : (
            <p className="mt-auto text-[13px] text-muted border-t border-rule pt-3 leading-relaxed">
              {bn(s.total - s.withProfession)} জনের পেশা সংসদের তথ্যভান্ডারে নেই, তাই এই হিসাবে তাঁরা ধরা হয়নি।
              একই পেশার ভিন্ন বানান এক করে গোনা হয়েছে।
            </p>
          )}
        </Card>

        <Card id="nari" className="lg:col-span-2 p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-x-8 gap-y-4 items-center scroll-mt-24">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex flex-col gap-1">
              <h2 className="display text-[21px] font-bold">{t('নারী প্রতিনিধিত্ব', 'Women in Parliament')}</h2>
              <p className="text-[13px] text-muted">{t(`${bn(s.women)} জন নারী, ${bn(s.total)} জনের মধ্যে`, `${s.women} women out of ${s.total}`)}</p>
            </div>
            <div
              className="flex gap-0.5 h-[30px] rounded-md overflow-hidden"
              role="img"
              aria-label={t(`পুরুষ ${s.total - s.women}, নারী ${s.women}`, `Men ${s.total - s.women}, women ${s.women}`)}
            >
              <div className="flex items-center ps-2.5 text-[13px] font-bold tnum bg-[#b9b4a6] text-ink" style={{ flex: `${s.total - s.women} 1 0` }}>
                {t('পুরুষ', 'Men')} {t.n(s.total - s.women)}
              </div>
              <div className="flex items-center ps-2 text-[13px] font-bold tnum bg-brand text-white" style={{ flex: `${s.women} 1 0` }}>
                {t.n(s.women)}
              </div>
            </div>
            <p className="text-[13px] text-muted">
              {t.en ? (
                <>Leaving the reserved seats aside, women hold {womenGeneralPct}% of the general seats.</>
              ) : (
                <>সংরক্ষিত আসন বাদ দিলে সাধারণ আসনে নারীর হার {bn(womenGeneralPct)}%।</>
              )}{' '}
              <Link href="/sangrakkhito-ason" className="font-semibold text-brand hover:underline">
                {t('সংরক্ষিত আসনের সদস্যরা', 'Members in the reserved seats')}
              </Link>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-paper rounded-lg flex flex-col gap-1">
              <span className="display tnum text-[26px] font-extrabold text-brand leading-none">{t.n(s.womenTerritorial)}</span>
              <span className="text-[13px] text-inksoft leading-snug">
                {t.en ? <>Elected in general seats<br />out of {s.territorial}</> : <>সাধারণ আসনে নির্বাচিত<br />{bn(s.territorial)} জনের মধ্যে</>}
              </span>
            </div>
            <div className="p-4 bg-paper rounded-lg flex flex-col gap-1">
              <span className="display tnum text-[26px] font-extrabold text-brand leading-none">{t.n(s.womenReserved)}</span>
              <span className="text-[13px] text-inksoft leading-snug">
                {t.en ? <>In reserved seats<br />out of {s.reserved}</> : <>সংরক্ষিত আসনে<br />{bn(s.reserved)} জনের মধ্যে</>}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {(() => {
        const x = experienceStats(t.lang);
        const max = Math.max(...x.bands.map((b) => b.count), 1);
        return (
          <section id="obhiggota" className="mt-10 flex flex-col gap-4 scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2.5">
              <h2 className="display text-[24px] font-bold">{t('সংসদে অভিজ্ঞতা', 'Experience in Parliament')}</h2>
              <span className="text-[13px] text-muted">{t('সংসদের তথ্যভান্ডার, ৪র্থ সংসদ থেকে', 'Parliament’s database, from the 4th Parliament on')}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <Card className="p-5 sm:p-6 flex flex-col gap-5">
                <Split
                  label={t(`এবারই প্রথম ${x.firstTime}, আগেও সদস্য ${x.returning}`, `First time ${x.firstTime}, members before ${x.returning}`)}
                  a={{ label: t('এবারই প্রথম', 'First time'), n: x.firstTime, tone: 'bg-brand' }}
                  b={{ label: t('আগেও সদস্য ছিলেন', 'Members before'), n: x.returning, tone: 'bg-pjamaat' }}
                />
                <div className="grow flex flex-col justify-evenly gap-3">
                  {x.bands.map((b) => (
                    <div key={b.label} className="grid grid-cols-[130px_1fr_40px] items-center gap-3 text-[14px]">
                      <span className="text-muted">{b.label}</span>
                      <div className="h-3 rounded-full bg-sunk overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(b.count / max) * 100}%` }} /></div>
                      <span className="tnum font-bold text-end">{t.n(b.count)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5 sm:p-6 flex flex-col gap-3">
                <span className="text-[12px] font-bold tracking-[1px] text-muted">{t('সবচেয়ে বেশি মেয়াদ', 'Most terms')}</span>
                {x.most.length ? (
                  <ul className="flex flex-col divide-y divide-rulesoft">
                    {x.most.map(({ m, terms }) => (
                      <li key={m.id}>
                        <Link href={`/mp/${m.slug}`} className="py-2 flex items-center justify-between gap-3 hover:text-brand">
                          <span className="flex flex-col min-w-0">
                            <span className="font-semibold truncate">{t.en ? personName(m, 'en') : m.nameBn ?? m.nameEn}</span>
                            <span className="text-[12.5px] text-muted">{t.en ? seatName(m.seat, 'en') : m.seat?.nameBn}{m.party ? `, ${m.party.abbr}` : ''}</span>
                          </span>
                          <span className="shrink-0 tnum text-[13px] font-bold text-brand">{t.count(terms, ' মেয়াদ', 'term', 'terms')}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-muted">{t('সংসদের তথ্যভান্ডারে কারও আগের মেয়াদ পাওয়া যায়নি।', 'Parliament’s database shows no earlier term for anyone.')}</p>
                )}
                <p className="mt-auto text-[12px] text-muted leading-relaxed">
                  {t(
                    '১ম থেকে ৩য় ও ৬ষ্ঠ সংসদের রেকর্ড সেখানে নেই, তাই তার আগের মেয়াদ গোনা যায়নি।',
                    'The records of the 1st to 3rd and the 6th Parliaments are not in it, so terms in those could not be counted.',
                  )}
                </p>
              </Card>
            </div>
          </section>
        );
      })()}

      <section id="votar" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <div className="flex flex-col gap-1 border-b border-rule pb-2.5">
          <h2 className="display text-[24px] font-bold">{t('ভোটার ও ভোটকেন্দ্র', 'Voters and polling centres')}</h2>
          <p className="text-[13.5px] text-muted">
            {t(
              'সারা দেশের হিসাব, নির্বাচন কমিশনের প্রকাশিত তথ্য অনুযায়ী। আসনভিত্তিক ভোটার সংখ্যা এখনো যোগ করা হয়নি।',
              'Figures for the whole country, as published by the Election Commission. Voter numbers by seat have not been added yet.',
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t('মোট ভোটার', 'Total voters')} value={t.en ? t.group(ecs.national.registeredVoters) : bnGroup(ecs.national.registeredVoters)} />
          <Stat label={t('পুরুষ ভোটার', 'Male voters')} value={t.en ? t.group(ecs.national.maleVoters) : bnGroup(ecs.national.maleVoters)} />
          <Stat label={t('নারী ভোটার', 'Female voters')} value={t.en ? t.group(ecs.national.femaleVoters) : bnGroup(ecs.national.femaleVoters)} />
          <Stat
            label={t('ভোটকেন্দ্র', 'Polling centres')}
            value={t.en ? t.group(ecs.national.pollingCentres) : bnGroup(ecs.national.pollingCentres)}
            note={t(`নিবন্ধিত রাজনৈতিক দল ${bn(ecs.national.registeredParties)}টি`, `${ecs.national.registeredParties} registered political parties`)}
          />
        </div>
        <Card className="p-5">
          <Split
            label={t(`পুরুষ ভোটার ${ecs.national.maleVoters}, নারী ভোটার ${ecs.national.femaleVoters}`, `Male voters ${ecs.national.maleVoters}, female voters ${ecs.national.femaleVoters}`)}
            a={{ label: t('পুরুষ', 'Men'), n: ecs.national.maleVoters, tone: 'bg-[#b9b4a6]' }}
            b={{ label: t('নারী', 'Women'), n: ecs.national.femaleVoters, tone: 'bg-brand' }}
          />
        </Card>
        <p className="text-[13px] text-muted">
          {t.en ? <>Source: {ecs.source} | read on {t.date(ecs.readOn)}</> : <>তথ্যসূত্র: {ecs.source} | পড়া হয়েছে {dateBn(ecs.readOn)}</>}
        </p>
      </section>

      <div className="mt-8 pb-14 flex flex-col gap-4">
        <Empty
          title={t('যেসব হিসাব এখানে নেই', 'Figures not shown here')}
          body={t(
            'আসনভিত্তিক ভোটের সংখ্যা, ভোটার উপস্থিতি, সংসদে উপস্থিতি বা উত্থাপিত প্রশ্নের হিসাব কোনো উন্মুক্ত সূত্রে পাওয়া যায়নি। নির্ভরযোগ্য সূত্র ছাড়া এসব সংখ্যা আমরা দেখাই না।',
            'Votes by seat, voter turnout, attendance in Parliament and questions asked: none of these was found in any open source. We do not show such figures without a reliable source.',
          )}
        />
        <p className="text-[13px] text-muted">
          {t.en ? (
            <>Source: Parliament of Bangladesh | updated {t.date(meta.syncedAt)} | freedom fighter members: {s.freedomFighters}</>
          ) : (
            <>তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ | হালনাগাদ {dateBn(meta.syncedAt)} | মুক্তিযোদ্ধা সদস্য {bn(s.freedomFighters)} জন</>
          )}
        </p>
      </div>
    </Page>
  );
}
