import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import Link from 'next/link';
import { seats, getMemberById, parties, statistics, districtOf, bn, bnGroup, dateBn, meta, ecs, partyShortBn, GENERAL_SEATS } from '@/lib/data';
import { Page, PageHead, Card, Stat, CompositionBar, PartyDot } from '@/components/ui';
import { parliament } from '@/lib/activity';
import { parliamentsWithRecords, partySeatsOf, parliamentLabel, resultForSeat } from '@/lib/history';
import { partyColor } from '@/lib/data';
import ElectionMap, { type PinSeat } from '@/components/ElectionMap';
import { initial } from '@/lib/data';

// Seats of this parliament with a published result, and each seat's winner.
const winnerOf = (seatNo: number) => {
  const r = resultForSeat(seatNo, 13);
  if (!r) return null;
  const [top] = [...r.candidates].sort((a, b) => b.votes - a.votes);
  return top ? { votes: top.votes } : null;
};
const publishedSeats = seats.filter((s) => !s.reserved && winnerOf(s.no)).length;

/** Every seat for the map of the country: where it is comes from public/geo (ElectionMap), the rest from here. */
function pinSeats(): PinSeat[] {
  const out: PinSeat[] = [];
  for (const seat of seats) {
    if (seat.reserved) continue;
    const d = districtOf(seat);
    if (!d) continue;
    const m = seat.memberId ? getMemberById(seat.memberId) : undefined;
    const sitting = m && !m.resignedOn ? m : undefined;
    const r = resultForSeat(seat.no, 13);
    const [a, b] = r ? [...r.candidates].sort((x, y) => y.votes - x.votes) : [];
    out.push({
      no: seat.no,
      seat: seat.nameBn ?? seat.nameEn ?? '',
      slug: seat.slug,
      district: d.slug,
      districtBn: d.bn,
      member: sitting ? { name: sitting.nameBn ?? sitting.nameEn ?? '', slug: sitting.slug, photo: sitting.photoUrl, initial: initial(sitting), profession: sitting.professionBn ?? null } : null,
      party: sitting?.party?.abbr ?? null,
      partyBn: sitting ? partyShortBn(sitting.party) : null,
      partyFull: sitting?.party?.nameBn ?? null,
      color: sitting ? partyColor(sitting.party?.abbr) : 'var(--color-rule)',
      votes: a?.votes ?? null,
      margin: a && b ? a.votes - b.votes : null,
      runnerUp: b ? { name: b.name, party: b.party, votes: b.votes } : null,
    });
  }
  return out;
}

/** The page's sections, for the shortcuts under the heading. */
const SECTIONS: [string, string][] = [
  ['manchitro', 'মানচিত্র'],
  ['fol', 'ফলাফল'],
  ['votar', 'ভোটার ও তারিখ'],
  ['ager', 'আগের নির্বাচন'],
  ['jela', 'জেলা অনুযায়ী আসন'],
];

/** A section's title with a short note beside it. */
function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2.5">
      <h2 className="display text-[24px] sm:text-[26px] font-bold">{title}</h2>
      {note && <span className="text-[13px] text-muted">{note}</span>}
    </div>
  );
}

export const metadata: Metadata = {
  alternates: { canonical: '/nirbachon' },
  openGraph: shareGraph('/nirbachon'),
  title: 'ত্রয়োদশ জাতীয় সংসদ নির্বাচন',
  description: publishedSeats
    ? `২০২৬ সালের ত্রয়োদশ জাতীয় সংসদ নির্বাচন: ${bn(publishedSeats)}টি আসনের প্রকাশিত ফল, প্রার্থী ও প্রাপ্ত ভোট, দলভিত্তিক আসনসংখ্যা এবং জেলা অনুযায়ী নির্বাচিত সংসদ সদস্য।`
    : 'ত্রয়োদশ জাতীয় সংসদ নির্বাচনের আসনভিত্তিক ফলাফল ও নির্বাচিত সদস্যদের তালিকা।',
};

export default function ElectionPage() {
  const s = statistics();
  const territorial = seats.filter((x) => !x.reserved);

  const byDistrict = new Map<string, { bn: string; list: typeof territorial }>();
  for (const seat of territorial) {
    const d = districtOf(seat);
    if (!d) continue;
    const e = byDistrict.get(d.en) ?? { bn: d.bn, list: [] as typeof territorial };
    e.list.push(seat);
    byDistrict.set(d.en, e);
  }
  const districts = [...byDistrict.values()].sort((a, b) => a.bn.localeCompare(b.bn, 'bn'));

  return (
    <Page>
      <PageHead
        eyebrow="২০২৬"
        title="ত্রয়োদশ জাতীয় সংসদ নির্বাচন"
        lede={`${bn(GENERAL_SEATS)}টি আসনে নির্বাচন। বর্তমানে ${bn(s.territorial)}টি আসনে সদস্য আছেন, সেই সঙ্গে ${bn(s.reserved)}টি সংরক্ষিত নারী আসন মিলিয়ে সংসদে ${bn(s.total)} জন।`}
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Stat label="আসন" value={bn(GENERAL_SEATS)} />
            <Stat label="পূর্ণ" value={bn(s.territorial)} />
            <Stat label="দল" value={bn(parties.length)} />
          </div>
        }
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

      <section id="manchitro" className="mt-6 flex flex-col gap-4 scroll-mt-24">
        <div className="flex flex-col gap-2">
          <SectionHead title="কোন জেলায় কে জিতল" />
          <p className="text-[14.5px] text-inksoft text-pretty">
            দেশের মানচিত্রে {bn(GENERAL_SEATS)}টি আসন, প্রত্যেকটি তার জায়গায় দলের প্রতীকে; প্রতীকে চাপ দিলে আসনের এলাকা আর সংসদ সদস্য। “জেলার রং”-এ প্রতিটি জেলা সেখানে বেশিরভাগ আসন যে দলের, সেই রঙে।
          </p>
        </div>
        <ElectionMap seats={pinSeats()} />
      </section>

      <section id="fol" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <SectionHead title="ফলাফল" note={publishedSeats ? `${bn(publishedSeats)}টি আসনের ফল প্রকাশিত` : 'আসনভিত্তিক ফল এখনো যোগ হয়নি'} />
        <Card className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="display text-[19px] font-bold">সংসদের গঠন</h3>
            <p className="text-[13px] text-muted">সংরক্ষিত আসনসহ মোট {bn(s.total)}টি আসন; নিচে শুধু নির্বাচনে জেতা আসন।</p>
          </div>
          <CompositionBar parties={parties} total={s.total} majority={s.majority} />
          <div className="border-t border-rule pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[14px]">
            {parties.slice(0, 4).map((p) => (
              <Link key={p.abbr} href={`/dol/${p.slug}`} className="flex flex-col gap-1 rounded-lg -m-2 p-2 hover:bg-brandsoft/50 transition-colors">
                <span className="flex items-center gap-2 text-muted" title={p.nameBn ?? p.abbr}>
                  <PartyDot abbr={p.abbr} />
                  {partyShortBn(p)}
                </span>
                <span className="tnum">
                  <strong className="text-[17px]">{bn(p.seatsTerritorial)}</strong>
                  <span className="text-muted"> আসনে নির্বাচিত</span>
                </span>
              </Link>
            ))}
          </div>
          {publishedSeats ? (
            <p className="text-[13px] leading-relaxed text-muted border-t border-rule pt-3">
              প্রতিটি আসনের পাতায় সব প্রার্থী, দল ও প্রাপ্ত ভোট আছে; নিচে জেলা অনুযায়ী তালিকায় বিজয়ীর ভোট দেখুন। সূত্র দ্য বিজনেস স্ট্যান্ডার্ড ও উইকিপিডিয়া,
              নির্বাচন কমিশনের গেজেটের সঙ্গে এখনো মিলিয়ে দেখা হয়নি। যেসব আসনের ফল পাওয়া যায়নি, সেগুলোর পাতায় তা লেখা আছে।
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted border-t border-rule pt-3">
              নির্বাচন কমিশনের গেজেট থেকে প্রতিটি আসনের প্রার্থী, প্রতীক ও প্রাপ্ত ভোট যোগ করা হবে। যাচাই করা সংখ্যা ছাড়া কিছু দেখানো হবে না।
            </p>
          )}
        </Card>
      </section>

      <section id="votar" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <SectionHead title="ভোটার ও নির্বাচনের তারিখ" note="নির্বাচন কমিশন ও সংসদের তথ্য" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-stretch">
          <Card className="p-6 flex flex-col gap-4">
            {/* Crore-sized figures in Bangla grouping are wide: one column on a narrow phone, so two never run together. */}
            <div className="grid grid-cols-1 min-[440px]:grid-cols-2 gap-4">
              {([
                ['মোট ভোটার', ecs.national.registeredVoters],
                ['ভোটকেন্দ্র', ecs.national.pollingCentres],
              ] as [string, number][]).map(([label, n]) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="display tnum text-[26px] font-extrabold leading-none">{bnGroup(n)}</span>
                  <span className="text-[13px] text-muted">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-0.5 h-3 rounded-full overflow-hidden" role="img" aria-label={`পুরুষ ভোটার ${ecs.national.maleVoters}, নারী ভোটার ${ecs.national.femaleVoters}`}>
                <span className="bg-[#b9b4a6]" style={{ flex: `${ecs.national.maleVoters} 1 0` }} />
                <span className="bg-brand" style={{ flex: `${ecs.national.femaleVoters} 1 0` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px]">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#b9b4a6]" aria-hidden="true" />পুরুষ <b className="tnum">{bnGroup(ecs.national.maleVoters)}</b></span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand" aria-hidden="true" />নারী <b className="tnum">{bnGroup(ecs.national.femaleVoters)}</b></span>
              </div>
            </div>
            <p className="text-[12.5px] text-muted border-t border-rule pt-3 mt-auto">
              তথ্যসূত্র: {ecs.source} | পড়া হয়েছে {dateBn(ecs.readOn)}
            </p>
          </Card>
          <Card className="p-6">
            <ol className="flex flex-col">
              {([
                ['নির্বাচন', parliament.electionDate],
                ['গেজেট', parliament.gazetteDate],
                ['শপথ', parliament.oathDate],
                ['মেয়াদ শেষ', parliament.endDate],
              ] as [string, string | null][]).map(([label, value], i, all) => (
                <li key={label} className="relative ps-6 pb-5 last:pb-0">
                  <span aria-hidden="true" className={`absolute start-0 top-[6px] w-3 h-3 rounded-full border-2 ${i < all.length - 1 ? 'bg-brand border-brand' : 'bg-surface border-brand'}`} />
                  {i < all.length - 1 && <span aria-hidden="true" className="absolute start-[5px] top-[18px] bottom-0 w-0.5 bg-brandsoft" />}
                  <span className="block text-[12.5px] text-muted">{label}</span>
                  <span className="block text-[15.5px] font-semibold">{dateBn(value) ?? 'তারিখ নেই'}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </section>

      <section id="ager" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <SectionHead title="আগের নির্বাচনগুলোতে দলগুলোর আসন" note="সংসদের তথ্যভান্ডার" />
        {(() => {
          const rows = parliamentsWithRecords().filter((p) => partySeatsOf(p.no).length > 0);
          const totals = new Map<string, { abbr: string; nameBn: string | null; n: number }>();
          for (const p of rows) for (const ps of partySeatsOf(p.no)) {
            const e = totals.get(ps.abbr) ?? { abbr: ps.abbr, nameBn: ps.nameBn, n: 0 };
            e.n += ps.territorial; totals.set(ps.abbr, e);
          }
          const cols = [...totals.values()].sort((a, b) => b.n - a.n).slice(0, 5);
          return (
            <Card className="overflow-x-auto">
              <table className="w-full text-[14px] min-w-[640px]">
                <thead>
                  <tr className="bg-sunk/70 text-[12px] font-bold text-muted">
                    <th className="text-start px-4 py-2.5">সংসদ</th>
                    {cols.map((c) => (
                      <th key={c.abbr} className="text-end px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: partyColor(c.abbr) }} />{c.abbr}</span>
                      </th>
                    ))}
                    <th className="text-end px-3 py-2.5">অন্য</th>
                    <th className="text-end px-4 py-2.5">নথিভুক্ত</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rulesoft">
                  {rows.map((p) => {
                    const ps = partySeatsOf(p.no);
                    const get = (abbr: string) => ps.find((x) => x.abbr === abbr)?.territorial ?? 0;
                    const other = ps.filter((x) => !cols.some((c) => c.abbr === x.abbr)).reduce((n, x) => n + x.territorial, 0);
                    const total = ps.reduce((n, x) => n + x.territorial, 0);
                    return (
                      <tr key={p.no} className={p.no === parliament.no ? 'bg-brandsoft/40' : ''}>
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{parliamentLabel(p.no)}</td>
                        {cols.map((c) => <td key={c.abbr} className="px-3 py-2.5 text-end tnum">{get(c.abbr) ? bn(get(c.abbr)) : <span className="text-muted">০</span>}</td>)}
                        <td className="px-3 py-2.5 text-end tnum">{other ? bn(other) : <span className="text-muted">০</span>}</td>
                        <td className="px-4 py-2.5 text-end tnum text-muted">{bn(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        })()}
        <p className="text-[12.5px] text-muted leading-relaxed">
          সাধারণ (আসনভিত্তিক) আসনে সংসদের তথ্যভান্ডারে নথিভুক্ত সদস্য অনুযায়ী; সংরক্ষিত নারী আসন বাদ। উপনির্বাচন ও অসম্পূর্ণ রেকর্ডের কারণে
          কোনো কোনো সংসদে সংখ্যা সরকারি ফলের সঙ্গে সামান্য ভিন্ন হতে পারে; “নথিভুক্ত” কলামে সেটি দেখা যায়। ১ম থেকে ৩য় ও ৬ষ্ঠ সংসদের রেকর্ড সেখানে নেই।
        </p>
      </section>

      <section id="jela" className="mt-10 pb-14 flex flex-col gap-5 scroll-mt-24">
        <SectionHead title="জেলা অনুযায়ী আসন" note={`${bn(districts.length)} জেলা`} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {districts.map((d) => (
            <Card key={d.bn} className="p-5 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="display text-[18px] font-bold">{d.bn}</h3>
                <span className="text-[13px] text-muted tnum">{bn(d.list.length)} আসন</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[14.5px]">
                {d.list.map((seat) => {
                  const m = seat.memberId ? getMemberById(seat.memberId) : undefined;
                  const won = winnerOf(seat.no);
                  return (
                    <li key={seat.no}>
                      <Link href={`/ason/${seat.slug}`} className="flex items-center gap-2 hover:text-brand">
                        <PartyDot abbr={m?.party?.abbr} />
                        <span className="font-medium shrink-0">{seat.nameBn}</span>
                        <span className="text-muted truncate">{m?.nameBn ?? m?.nameEn}</span>
                        {won && <span className="ms-auto shrink-0 tnum text-[12.5px] text-muted">{bnGroup(won.votes)} ভোট</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ | হালনাগাদ {dateBn(meta.syncedAt)}
        </p>
      </section>
    </Page>
  );
}
