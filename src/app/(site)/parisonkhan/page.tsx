import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import Link from 'next/link';
import { statistics, parties, committees, bn, bnGroup, dateBn, meta, ecs, partyColor } from '@/lib/data';
import { Page, PageHead, Card, Stat, Empty } from '@/components/ui';
import { experienceStats } from '@/lib/history';
import Hemicycle from '@/components/Hemicycle';

export const metadata: Metadata = {
  alternates: { canonical: '/parisonkhan' },
  openGraph: shareGraph('/parisonkhan'),
  title: 'পরিসংখ্যান',
  description: 'ত্রয়োদশ জাতীয় সংসদের সদস্যদের পরিসংখ্যান: দলভিত্তিক আসন, নারী ও পুরুষ সদস্য, বয়স, পেশা ও কতবার নির্বাচিত, সংসদের তথ্যভান্ডার থেকে হিসাব করা।',
};

/** A labelled horizontal bar. One series, so the heading names it and no legend is needed. */
function Bars({
  rows,
  total,
  labelWidth = 'w-[86px]',
}: {
  rows: { label: string; count: number }[];
  /** What the shares are of; each row then shows its share beside its count. */
  total?: number;
  labelWidth?: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className={`${labelWidth} shrink-0 text-[13px] text-inksoft`}>{r.label}</span>
          <span className="grow h-4 bg-sunk rounded-[3px] overflow-hidden">
            <span
              className={`block h-full rounded-[3px] ${r.count === max ? 'bg-brand' : 'bg-brand/60'}`}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </span>
          <span className="w-9 shrink-0 text-end text-[13px] font-bold tnum">{bn(r.count)}</span>
          {total ? <span className="w-10 shrink-0 text-end text-[12px] text-muted tnum">{bn(Math.round((r.count / total) * 100))}%</span> : null}
        </div>
      ))}
    </div>
  );
}

/** Two parts of one whole, side by side, each with its count and share. */
function Split({ a, b, label }: { a: { label: string; n: number; tone: string }; b: { label: string; n: number; tone: string }; label: string }) {
  const sum = a.n + b.n || 1;
  const pct = (n: number) => bn(Math.round((n / sum) * 100));
  const part = (x: { label: string; n: number; tone: string }) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${x.tone}`} aria-hidden="true" />
      {x.label} <b className="tnum">{bnGroup(x.n)}</b> <span className="text-muted tnum">({pct(x.n)}%)</span>
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
const SECTIONS: [string, string][] = [
  ['ason', 'দলভিত্তিক আসন'],
  ['boyos', 'বয়স'],
  ['nari', 'নারী প্রতিনিধিত্ব'],
  ['pesha', 'পেশা'],
  ['obhiggota', 'অভিজ্ঞতা'],
  ['votar', 'ভোটার'],
];

export default function StatisticsPage() {
  const s = statistics();
  const currentCommittees = committees.filter((c) => c.rosterCurrent).length;
  const womenPct = ((s.women / s.total) * 100).toFixed(1);
  const womenGeneralPct = ((s.womenTerritorial / s.territorial) * 100).toFixed(1);
  const seated = parties.filter((p) => p.seats > 0);

  return (
    <Page>
      <PageHead
        eyebrow="ত্রয়োদশ জাতীয় সংসদ"
        title="পরিসংখ্যান"
        lede={`বর্তমান ${bn(s.total)} জন সংসদ সদস্যের তথ্য থেকে হিসাব করা। প্রতিটি সংখ্যা জাতীয় সংসদের নিজস্ব তথ্যভান্ডার থেকে, কোনো অনুমান নয়।`}
      />

      <nav aria-label="এই পাতায়" className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="h-8 px-3 inline-flex items-center rounded-full border border-rule bg-surface text-[13px] font-semibold text-inksoft hover:border-brand hover:text-brand transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="মোট সদস্য" value={bn(s.total)} note={`${bn(s.territorial)} আসনভিত্তিক, ${bn(s.reserved)} সংরক্ষিত`} />
        <Stat label="নারী সদস্য" value={bn(s.women)} note={`${bn(womenPct)}%, এর ${bn(s.womenReserved)} জন সংরক্ষিত আসনে`} />
        <Stat
          label="মধ্যক বয়স"
          value={s.medianAge !== null ? bn(s.medianAge) : 'তথ্য নেই'}
          note={s.youngest && s.oldest ? `সর্বকনিষ্ঠ ${bn(s.youngest.age)}, সর্বজ্যেষ্ঠ ${bn(s.oldest.age)}` : undefined}
        />
        <Stat label="সংসদীয় কমিটি" value={bn(committees.length)} note={`${bn(currentCommittees)}টির সদস্য তালিকা হালনাগাদ`} />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card id="ason" className="lg:col-span-2 p-6 flex flex-col gap-5 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="display text-[21px] font-bold">দলভিত্তিক আসন</h2>
            <p className="text-[13px] text-muted">{bn(s.total)}টি আসনের সবগুলো, সংরক্ষিত আসনসহ; প্রতিটি বিন্দু একটি আসন</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 items-center">
            <Hemicycle
              blocs={seated.map((p) => ({ key: p.abbr, label: p.nameBn ?? p.abbr, seats: p.seats, color: partyColor(p.abbr) }))}
              total={s.total}
              majority={s.majority}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-[12px] text-muted border-b border-rule">
                    <th className="text-start font-semibold py-2">দল</th>
                    <th className="text-end font-semibold py-2 px-2">আসনভিত্তিক</th>
                    <th className="text-end font-semibold py-2 px-2">সংরক্ষিত</th>
                    <th className="text-end font-semibold py-2 ps-2">মোট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rulesoft">
                  {seated.map((p) => (
                    <tr key={p.abbr}>
                      <td className="py-2 pe-2">
                        <Link href={`/dol/${p.slug}`} className="inline-flex items-center gap-2 hover:text-brand">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: partyColor(p.abbr) }} aria-hidden="true" />
                          <span className="font-medium">{p.nameBn ?? p.abbr}</span>
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-end tnum">{bn(p.seatsTerritorial)}</td>
                      <td className="py-2 px-2 text-end tnum text-muted">{bn(p.seatsReserved)}</td>
                      <td className="py-2 ps-2 text-end tnum font-bold">{bn(p.seats)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[13px] text-muted border-t border-rule pt-3 leading-relaxed">
            সরকার গঠনে দরকার {bn(s.majority)}টি আসন। সংরক্ষিত {bn(s.reserved)}টি নারী আসন সাধারণ আসনের ফলের অনুপাতে দলগুলোর মধ্যে ভাগ হয়।
          </p>
        </Card>

        <Card id="boyos" className="p-6 flex flex-col gap-4 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="display text-[21px] font-bold">বয়স</h2>
            <p className="text-[13px] text-muted">{bn(s.total)} জনেরই জন্মতারিখ পাওয়া গেছে</p>
          </div>
          <Bars rows={s.ageBands} total={s.total} />
          {s.youngest && s.oldest && (
            <div className="border-t border-rule pt-3 flex flex-col gap-1.5 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted">সর্বকনিষ্ঠ</span>
                <span className="text-end">
                  <Link href={`/mp/${s.youngest.m.slug}`} className="font-semibold text-brand hover:underline">
                    {s.youngest.m.nameBn ?? s.youngest.m.nameEn}
                  </Link>{' '}
                  <span className="tnum text-muted">{bn(s.youngest.age)}</span>
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">সর্বজ্যেষ্ঠ</span>
                <span className="text-end">
                  <Link href={`/mp/${s.oldest.m.slug}`} className="font-semibold text-brand hover:underline">
                    {s.oldest.m.nameBn ?? s.oldest.m.nameEn}
                  </Link>{' '}
                  <span className="tnum text-muted">{bn(s.oldest.age)}</span>
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card id="nari" className="p-6 flex flex-col gap-4 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="display text-[21px] font-bold">নারী প্রতিনিধিত্ব</h2>
            <p className="text-[13px] text-muted">{bn(s.women)} জন নারী, {bn(s.total)} জনের মধ্যে</p>
          </div>
          <div
            className="flex gap-0.5 h-[30px] rounded-md overflow-hidden"
            role="img"
            aria-label={`পুরুষ ${s.total - s.women}, নারী ${s.women}`}
          >
            <div className="flex items-center ps-2.5 text-[13px] font-bold tnum bg-[#b9b4a6] text-ink" style={{ flex: `${s.total - s.women} 1 0` }}>
              পুরুষ {bn(s.total - s.women)}
            </div>
            <div className="flex items-center ps-2 text-[13px] font-bold tnum bg-brand text-white" style={{ flex: `${s.women} 1 0` }}>
              {bn(s.women)}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="grow p-4 bg-paper rounded-lg flex flex-col gap-1">
              <span className="display tnum text-[26px] font-extrabold text-brand leading-none">{bn(s.womenTerritorial)}</span>
              <span className="text-[13px] text-inksoft leading-snug">সাধারণ আসনে নির্বাচিত<br />{bn(s.territorial)} জনের মধ্যে</span>
            </div>
            <div className="grow p-4 bg-paper rounded-lg flex flex-col gap-1">
              <span className="display tnum text-[26px] font-extrabold text-brand leading-none">{bn(s.womenReserved)}</span>
              <span className="text-[13px] text-inksoft leading-snug">সংরক্ষিত আসনে<br />{bn(s.reserved)} জনের মধ্যে</span>
            </div>
          </div>
          <p className="text-[13px] text-muted border-t border-rule pt-3">
            সংরক্ষিত আসন বাদ দিলে সাধারণ আসনে নারীর হার {bn(womenGeneralPct)}%।{' '}
            <Link href="/sangrakkhito-ason" className="font-semibold text-brand hover:underline">
              সংরক্ষিত আসনের সদস্যরা
            </Link>
          </p>
        </Card>

        <Card id="pesha" className="p-6 flex flex-col gap-4 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="display text-[21px] font-bold">পেশা</h2>
            <p className="text-[13px] text-muted">
              {bn(s.total)} জনের মধ্যে {bn(s.withProfession)} জনের পেশা লিপিবদ্ধ
            </p>
          </div>
          <Bars rows={s.professions.slice(0, 8).map((p) => ({ label: p.label, count: p.count }))} total={s.withProfession} labelWidth="w-[96px]" />
          <p className="text-[13px] text-muted border-t border-rule pt-3 leading-relaxed">
            {bn(s.total - s.withProfession)} জনের পেশা সংসদের তথ্যভান্ডারে নেই, তাই এই হিসাবে তাঁরা ধরা হয়নি।
            একই পেশার ভিন্ন বানান এক করে গোনা হয়েছে।
          </p>
        </Card>
      </div>

      {(() => {
        const x = experienceStats();
        const max = Math.max(...x.bands.map((b) => b.count), 1);
        return (
          <section id="obhiggota" className="mt-10 flex flex-col gap-4 scroll-mt-24">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="display text-[24px]">সংসদে অভিজ্ঞতা</h2>
              <span className="text-[13px] text-muted">সংসদের তথ্যভান্ডার, ৪র্থ সংসদ থেকে</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <Card className="p-5 sm:p-6 flex flex-col gap-4">
                <Split
                  label={`এবারই প্রথম ${x.firstTime}, আগেও সদস্য ${x.returning}`}
                  a={{ label: 'এবারই প্রথম', n: x.firstTime, tone: 'bg-brand' }}
                  b={{ label: 'আগেও সদস্য ছিলেন', n: x.returning, tone: 'bg-pjamaat' }}
                />
                <div className="flex flex-col gap-2.5">
                  {x.bands.map((b) => (
                    <div key={b.label} className="grid grid-cols-[130px_1fr_40px] items-center gap-3 text-[14px]">
                      <span className="text-muted">{b.label}</span>
                      <div className="h-3 rounded-full bg-sunk overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(b.count / max) * 100}%` }} /></div>
                      <span className="tnum font-bold text-end">{bn(b.count)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5 sm:p-6 flex flex-col gap-3">
                <span className="text-[12px] font-bold tracking-[1px] text-muted">সবচেয়ে বেশি মেয়াদ</span>
                {x.most.length ? (
                  <ul className="flex flex-col divide-y divide-rulesoft">
                    {x.most.map(({ m, terms }) => (
                      <li key={m.id}>
                        <Link href={`/mp/${m.slug}`} className="py-2 flex items-center justify-between gap-3 hover:text-brand">
                          <span className="flex flex-col min-w-0">
                            <span className="font-semibold truncate">{m.nameBn ?? m.nameEn}</span>
                            <span className="text-[12.5px] text-muted">{m.seat?.nameBn}{m.party ? `, ${m.party.abbr}` : ''}</span>
                          </span>
                          <span className="shrink-0 tnum text-[13px] font-bold text-brand">{bn(terms)} মেয়াদ</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-muted">সংসদের তথ্যভান্ডারে কারও আগের মেয়াদ পাওয়া যায়নি।</p>
                )}
                <p className="text-[12px] text-muted leading-relaxed">১ম থেকে ৩য় ও ৬ষ্ঠ সংসদের রেকর্ড সেখানে নেই, তাই তার আগের মেয়াদ গোনা যায়নি।</p>
              </Card>
            </div>
          </section>
        );
      })()}

      <section id="votar" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <div className="flex flex-col gap-1">
          <h2 className="display text-[24px] font-bold">ভোটার ও ভোটকেন্দ্র</h2>
          <p className="text-[13.5px] text-muted">
            সারা দেশের হিসাব, নির্বাচন কমিশনের প্রকাশিত তথ্য অনুযায়ী। আসনভিত্তিক ভোটার সংখ্যা এখনো যোগ করা হয়নি।
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="মোট ভোটার" value={bnGroup(ecs.national.registeredVoters)} />
          <Stat label="পুরুষ ভোটার" value={bnGroup(ecs.national.maleVoters)} />
          <Stat label="নারী ভোটার" value={bnGroup(ecs.national.femaleVoters)} />
          <Stat
            label="ভোটকেন্দ্র"
            value={bnGroup(ecs.national.pollingCentres)}
            note={`নিবন্ধিত রাজনৈতিক দল ${bn(ecs.national.registeredParties)}টি`}
          />
        </div>
        <Card className="p-5">
          <Split
            label={`পুরুষ ভোটার ${ecs.national.maleVoters}, নারী ভোটার ${ecs.national.femaleVoters}`}
            a={{ label: 'পুরুষ', n: ecs.national.maleVoters, tone: 'bg-[#b9b4a6]' }}
            b={{ label: 'নারী', n: ecs.national.femaleVoters, tone: 'bg-brand' }}
          />
        </Card>
        <p className="text-[13px] text-muted">
          তথ্যসূত্র: {ecs.source} | পড়া হয়েছে {dateBn(ecs.readOn)}
        </p>
      </section>

      <div className="mt-8 pb-14 flex flex-col gap-4">
        <Empty
          title="যেসব হিসাব এখানে নেই"
          body="আসনভিত্তিক ভোটের সংখ্যা, ভোটার উপস্থিতি, সংসদে উপস্থিতি বা উত্থাপিত প্রশ্নের হিসাব কোনো উন্মুক্ত সূত্রে পাওয়া যায়নি। নির্ভরযোগ্য সূত্র ছাড়া এসব সংখ্যা আমরা দেখাই না।"
        />
        <p className="text-[13px] text-muted">
          তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ | হালনাগাদ {dateBn(meta.syncedAt)} | মুক্তিযোদ্ধা সদস্য {bn(s.freedomFighters)} জন
        </p>
      </div>
    </Page>
  );
}
