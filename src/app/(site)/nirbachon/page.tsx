import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import Link from 'next/link';
import { seats, getMemberById, parties, statistics, districtOf, bn, bnGroup, dateBn, meta, ecs, partyShortBn, GENERAL_SEATS } from '@/lib/data';
import { Page, PageHead, Card, Stat, CompositionBar, Empty, PartyDot } from '@/components/ui';
import { parliament } from '@/lib/activity';
import { parliamentsWithRecords, partySeatsOf, parliamentLabel, resultForSeat } from '@/lib/history';
import { partyColor } from '@/lib/data';
import DistrictMap, { type MapDistrict } from '@/components/DistrictMap';
import ElectionMap, { type PinSeat } from '@/components/ElectionMap';
import { DISTRICT_TILES, TILE_COLUMNS } from '@/lib/districtTiles';
import { initial } from '@/lib/data';

// Seats of this parliament with a published result, and each seat's winner.
const winnerOf = (seatNo: number) => {
  const r = resultForSeat(seatNo, 13);
  if (!r) return null;
  const [top] = [...r.candidates].sort((a, b) => b.votes - a.votes);
  return top ? { votes: top.votes } : null;
};
const publishedSeats = seats.filter((s) => !s.reserved && winnerOf(s.no)).length;

/** The winner's votes and lead over the runner-up, where the result is published. */
const marginOf = (seatNo: number) => {
  const r = resultForSeat(seatNo, 13);
  if (!r) return null;
  const [a, b] = [...r.candidates].sort((x, y) => y.votes - x.votes);
  return a ? { votes: a.votes, margin: b ? a.votes - b.votes : null } : null;
};

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

/** Each district for the tile map: its seats, who holds them, and the parties by seats held. */
function mapDistricts(): { districts: MapDistrict[]; legend: { abbr: string; name: string; color: string; districts: number }[] } {
  const bySlug = new Map<string, MapDistrict>();
  for (const seat of seats) {
    if (seat.reserved) continue;
    const d = districtOf(seat);
    const tile = d ? DISTRICT_TILES[d.slug] : undefined;
    if (!d || !tile) continue;
    const e = bySlug.get(d.slug) ?? { slug: d.slug, name: d.bn, tile, seats: [], parties: [] };
    const m = seat.memberId ? getMemberById(seat.memberId) : undefined;
    const sitting = m && !m.resignedOn ? m : undefined;
    const r = marginOf(seat.no);
    e.seats.push({
      no: seat.no,
      seat: seat.nameBn ?? seat.nameEn ?? '',
      slug: seat.slug,
      member: sitting ? { name: sitting.nameBn ?? sitting.nameEn ?? '', slug: sitting.slug } : null,
      party: sitting?.party?.abbr ?? null,
      partyBn: sitting ? partyShortBn(sitting.party) : null,
      color: sitting ? partyColor(sitting.party?.abbr) : 'var(--color-rule)',
      votes: r?.votes ?? null,
      margin: r?.margin ?? null,
    });
    bySlug.set(d.slug, e);
  }
  const lead = new Map<string, { abbr: string; name: string; color: string; districts: number }>();
  for (const d of bySlug.values()) {
    d.seats.sort((a, b) => a.no - b.no);
    const count = new Map<string, MapDistrict['parties'][number]>();
    for (const s of d.seats) {
      if (!s.party) continue;
      const p = count.get(s.party) ?? { abbr: s.party, name: s.partyBn ?? s.party, color: s.color, seats: 0 };
      p.seats++;
      count.set(s.party, p);
    }
    d.parties = [...count.values()].sort((a, b) => b.seats - a.seats);
    const [a, b] = d.parties;
    if (a && !(b && b.seats === a.seats)) {
      const l = lead.get(a.abbr) ?? { abbr: a.abbr, name: a.name, color: a.color, districts: 0 };
      l.districts++;
      lead.set(a.abbr, l);
    }
  }
  return { districts: [...bySlug.values()], legend: [...lead.values()].sort((a, b) => b.districts - a.districts) };
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
  const map = mapDistricts();

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

      <Card className="mt-8 px-5 sm:px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          ['নির্বাচন', parliament.electionDate],
          ['গেজেট', parliament.gazetteDate],
          ['শপথ', parliament.oathDate],
          ['মেয়াদ শেষ', parliament.endDate],
        ] as [string, string | null][]).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[12.5px] text-muted">{label}</span>
            <span className="text-[15.5px] font-semibold">{dateBn(value) ?? 'তারিখ নেই'}</span>
          </div>
        ))}
      </Card>

      <Card className="mt-4 p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="display text-[21px] font-bold">সংসদের গঠন</h2>
          <p className="text-[13px] text-muted">
            সংরক্ষিত আসনসহ মোট {bn(s.total)}টি আসন। শুধু নির্বাচনের ফল আলাদা, নিচে দেখুন।
          </p>
        </div>
        <CompositionBar parties={parties} total={s.total} majority={s.majority} />
        <div className="border-t border-rule pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[14px]">
          {parties.slice(0, 4).map((p) => (
            <div key={p.abbr} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-muted" title={p.nameBn ?? p.abbr}>
                <PartyDot abbr={p.abbr} />
                {partyShortBn(p)}
              </span>
              <span className="tnum">
                <strong className="text-[17px]">{bn(p.seatsTerritorial)}</strong>
                <span className="text-muted"> আসনে নির্বাচিত</span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="display text-[21px] font-bold">ভোটার ও ভোটকেন্দ্র</h2>
          <p className="text-[13px] text-muted">
            সারা দেশের হিসাব, নির্বাচন কমিশনের প্রকাশিত তথ্য অনুযায়ী
          </p>
        </div>
        {/* Crore-sized figures in Bangla grouping are wide: one column on a narrow phone, so two never run together. */}
        <div className="grid grid-cols-1 min-[440px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <span className="display tnum text-[26px] font-extrabold leading-none">{bnGroup(ecs.national.registeredVoters)}</span>
            <span className="text-[13px] text-muted">মোট ভোটার</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="display tnum text-[26px] font-extrabold leading-none">{bnGroup(ecs.national.maleVoters)}</span>
            <span className="text-[13px] text-muted">পুরুষ ভোটার</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="display tnum text-[26px] font-extrabold leading-none">{bnGroup(ecs.national.femaleVoters)}</span>
            <span className="text-[13px] text-muted">নারী ভোটার</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="display tnum text-[26px] font-extrabold leading-none">{bnGroup(ecs.national.pollingCentres)}</span>
            <span className="text-[13px] text-muted">ভোটকেন্দ্র</span>
          </div>
        </div>
        <p className="text-[12.5px] text-muted border-t border-rule pt-3">
          তথ্যসূত্র: {ecs.source} | পড়া হয়েছে {dateBn(ecs.readOn)}
        </p>
      </Card>

      <div className="mt-4">
        {publishedSeats ? (
          <Card className="p-5 sm:p-6 flex flex-col gap-2">
            <h2 className="display text-[19px] font-bold">{bn(publishedSeats)}টি আসনের ফল প্রকাশিত</h2>
            <p className="text-[14.5px] leading-relaxed text-inksoft">
              প্রতিটি আসনের পাতায় সব প্রার্থী, দল ও প্রাপ্ত ভোট আছে; নিচে জেলা অনুযায়ী তালিকায় বিজয়ীর ভোট দেখুন। সূত্র দ্য বিজনেস স্ট্যান্ডার্ড ও উইকিপিডিয়া,
              নির্বাচন কমিশনের গেজেটের সঙ্গে এখনো মিলিয়ে দেখা হয়নি। যেসব আসনের ফল পাওয়া যায়নি, সেগুলোর পাতায় তা লেখা আছে।
            </p>
          </Card>
        ) : (
          <Empty
            title="আসনভিত্তিক প্রার্থী তালিকা ও ভোটের সংখ্যা এখনো যোগ করা হয়নি"
            body="নির্বাচন কমিশনের গেজেট থেকে প্রতিটি আসনের প্রার্থী, প্রতীক ও প্রাপ্ত ভোট যোগ করা হবে। যাচাই করা সংখ্যা ছাড়া কিছু দেখানো হবে না।"
          />
        )}
      </div>

      <section className="mt-10 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="display text-[26px]">আগের নির্বাচনগুলোতে দলগুলোর আসন</h2>
          <span className="text-[13px] text-muted">সংসদের তথ্যভান্ডার</span>
        </div>
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

      <section id="manchitro" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <div className="flex flex-col gap-1.5">
          <h2 className="display text-[26px] font-bold">কোন জেলায় কে জিতল</h2>
          <p className="text-[14.5px] text-inksoft text-pretty">
            দেশের মানচিত্রে {bn(GENERAL_SEATS)}টি আসন, প্রত্যেকটি তার জায়গায় দলের প্রতীকে; প্রতীকে চাপ দিলে আসনের এলাকা আর সংসদ সদস্য। “জেলার রং”-এ প্রতিটি জেলা সেখানে বেশিরভাগ আসন যে দলের, সেই রঙে।
          </p>
        </div>
        <ElectionMap seats={pinSeats()} tiles={<DistrictMap districts={map.districts} columns={TILE_COLUMNS} legend={map.legend} />} />
      </section>

      <section id="jela" className="mt-10 pb-14 flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="display text-[26px] font-bold">জেলা অনুযায়ী আসন</h2>
          <span className="text-[14px] text-muted tnum">{bn(districts.length)} জেলা</span>
        </div>
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
