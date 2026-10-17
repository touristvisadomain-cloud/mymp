import type { Metadata } from 'next';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import Link from '@/i18n/Link';
import { seats, getMemberById, parties, statistics, districtOf, ecs, partyShortBn, meta, GENERAL_SEATS } from '@/lib/data';
import { winnerOf, publishedSeats, pinSeats, districtNamesEn } from '@/lib/electionMap';
import { Page, PageHead, Card, Stat, CompositionBar, PartyDot } from '@/components/ui';
import { parliament } from '@/lib/activity';
import { parliamentsWithRecords, partySeatsOf, parliamentLabel } from '@/lib/history';
import { partyColor } from '@/lib/data';
import ElectionMap from '@/components/ElectionMap';
import { getT } from '@/i18n/server';
import { plural } from '@/i18n/core';
import { districtName, partyByAbbr, partyName, partyShort, personName, seatName } from '@/i18n/names';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

/** The page's sections, for the shortcuts under the heading. */
const SECTIONS: [string, string, string][] = [
  ['manchitro', 'মানচিত্র', 'Map'],
  ['fol', 'ফলাফল', 'Results'],
  ['votar', 'ভোটার ও তারিখ', 'Voters and dates'],
  ['ager', 'আগের নির্বাচন', 'Earlier elections'],
  ['jela', 'জেলা অনুযায়ী আসন', 'Seats by district'],
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/nirbachon'),
    ...pageShare('nirbachon', t),
    title: t('ত্রয়োদশ জাতীয় সংসদ নির্বাচন ২০২৬: ফলাফল', 'Bangladesh election 2026 results: 13th Parliament'),
    description: fitDescription(
      publishedSeats
        ? t(
            `২০২৬ সালের ত্রয়োদশ জাতীয় সংসদ নির্বাচন: ${t.n(publishedSeats)}টি আসনের প্রকাশিত ফল, প্রার্থী ও প্রাপ্ত ভোট, দলভিত্তিক আসনসংখ্যা এবং জেলা অনুযায়ী নির্বাচিত সংসদ সদস্য।`,
            `The 2026 election to the 13th Parliament: results for ${publishedSeats} ${plural(publishedSeats, 'seat', 'seats')}, the candidates and their votes, seats by party, and the MPs elected in each district.`,
          )
        : t(
            'ত্রয়োদশ জাতীয় সংসদ নির্বাচনের আসনভিত্তিক ফলাফল ও নির্বাচিত সদস্যদের তালিকা।',
            'Seat-by-seat results of the election to the 13th Parliament, and a list of the members elected.',
          ),
    ),
  };
}

export default async function ElectionPage() {
  const t = await getT();
  const s = statistics();
  const territorial = seats.filter((x) => !x.reserved);

  const byDistrict = new Map<string, { bn: string; name: string; list: typeof territorial }>();
  for (const seat of territorial) {
    const d = districtOf(seat);
    if (!d) continue;
    const e = byDistrict.get(d.en) ?? { bn: d.bn, name: districtName(d, t.lang), list: [] as typeof territorial };
    e.list.push(seat);
    byDistrict.set(d.en, e);
  }
  const districts = [...byDistrict.values()].sort((a, b) => (t.en ? a.name.localeCompare(b.name, 'en') : a.bn.localeCompare(b.bn, 'bn')));

  return (
    <Page>
      <PageHead
        eyebrow={t('২০২৬', '2026')}
        title={t('ত্রয়োদশ জাতীয় সংসদ নির্বাচন', 'Election to the 13th Parliament')}
        lede={t(
          `${t.n(GENERAL_SEATS)}টি আসনে নির্বাচন। বর্তমানে ${t.n(s.territorial)}টি আসনে সদস্য আছেন, সেই সঙ্গে ${t.n(s.reserved)}টি সংরক্ষিত নারী আসন মিলিয়ে সংসদে ${t.n(s.total)} জন।`,
          `An election to ${GENERAL_SEATS} seats. ${s.territorial} ${plural(s.territorial, 'seat has', 'seats have')} a member at present; with the ${s.reserved} reserved seats for women, Parliament has ${s.total} ${plural(s.total, 'member', 'members')}.`,
        )}
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('আসন', 'Seats')} value={t.n(GENERAL_SEATS)} />
            <Stat label={t('পূর্ণ', 'Filled')} value={t.n(s.territorial)} />
            <Stat label={t('দল', 'Parties')} value={t.n(parties.length)} />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href('/nirbachon')}`}
          title={t('ত্রয়োদশ জাতীয় সংসদ নির্বাচন | আমার এমপি', 'Election to the 13th Parliament | My MP')}
          text={
            publishedSeats
              ? t(
                  `২০২৬ সালের ত্রয়োদশ জাতীয় সংসদ নির্বাচন: ${t.n(publishedSeats)}টি আসনের ফল, প্রার্থীদের ভোট ও দলভিত্তিক আসন`,
                  `The 2026 election to the 13th Parliament: results for ${t.count(publishedSeats, '', 'seat', 'seats')}, the candidates' votes and seats by party`,
                )
              : t('২০২৬ সালের ত্রয়োদশ জাতীয় সংসদ নির্বাচনের আসনভিত্তিক ফল', 'Seat-by-seat results of the 2026 election to the 13th Parliament')
          }
        />
      </div>

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

      <section id="manchitro" className="mt-6 flex flex-col gap-4 scroll-mt-24">
        <div className="flex flex-col gap-2">
          <SectionHead title={t('কোন জেলায় কে জিতল', 'Who won in each district')} />
          {t.en ? (
            <p className="text-[14.5px] text-inksoft text-pretty">
              The {GENERAL_SEATS} seats on a map of the country, each in its place and marked with its party’s symbol; tap a symbol to see the seat’s area and its Member of Parliament. In “District colours”, each district is in the colour of the party that holds most of its seats.
            </p>
          ) : (
            <p className="text-[14.5px] text-inksoft text-pretty">
              দেশের মানচিত্রে {t.n(GENERAL_SEATS)}টি আসন, প্রত্যেকটি তার জায়গায় দলের প্রতীকে; প্রতীকে চাপ দিলে আসনের এলাকা আর সংসদ সদস্য। “জেলার রং”-এ প্রতিটি জেলা সেখানে বেশিরভাগ আসন যে দলের, সেই রঙে।
            </p>
          )}
        </div>
        <ElectionMap seats={pinSeats(t)} districtNames={t.en ? districtNamesEn() : undefined} />
      </section>

      <section id="fol" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <SectionHead
          title={t('ফলাফল', 'Results')}
          note={
            publishedSeats
              ? t(`${t.n(publishedSeats)}টি আসনের ফল প্রকাশিত`, `Results published for ${publishedSeats} ${plural(publishedSeats, 'seat', 'seats')}`)
              : t('আসনভিত্তিক ফল এখনো যোগ হয়নি', 'Seat-by-seat results not yet added')
          }
        />
        <Card className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="display text-[19px] font-bold">{t('সংসদের গঠন', 'Make-up of Parliament')}</h3>
            {t.en ? (
              <p className="text-[13px] text-muted">{s.total} seats in all, including the reserved seats; below, only the seats won at the election.</p>
            ) : (
              <p className="text-[13px] text-muted">সংরক্ষিত আসনসহ মোট {t.n(s.total)}টি আসন; নিচে শুধু নির্বাচনে জেতা আসন।</p>
            )}
          </div>
          <CompositionBar parties={parties} total={s.total} majority={s.majority} />
          <div className="border-t border-rule pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[14px]">
            {parties.slice(0, 4).map((p) => (
              <Link key={p.abbr} href={`/dol/${p.slug}`} className="flex flex-col gap-1 rounded-lg -m-2 p-2 hover:bg-brandsoft/50 transition-colors">
                <span className="flex items-center gap-2 text-muted" title={t.en ? partyName(p, 'en') : p.nameBn ?? p.abbr}>
                  <PartyDot abbr={p.abbr} />
                  {t.en ? partyShort(p, 'en') : partyShortBn(p)}
                </span>
                <span className="tnum">
                  <strong className="text-[17px]">{t.n(p.seatsTerritorial)}</strong>
                  <span className="text-muted">{t(' আসনে নির্বাচিত', ` ${plural(p.seatsTerritorial, 'seat', 'seats')} won`)}</span>
                </span>
              </Link>
            ))}
          </div>
          {publishedSeats ? (
            t.en ? (
              <p className="text-[13px] leading-relaxed text-muted border-t border-rule pt-3">
                Each seat’s page has every candidate, their party and the votes they received; the list by district below shows the winner’s votes. Sources: The Business Standard and Wikipedia; not yet checked against the Election Commission’s gazette. Seats whose results could not be found say so on their pages.
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed text-muted border-t border-rule pt-3">
                প্রতিটি আসনের পাতায় সব প্রার্থী, দল ও প্রাপ্ত ভোট আছে; নিচে জেলা অনুযায়ী তালিকায় বিজয়ীর ভোট দেখুন। সূত্র দ্য বিজনেস স্ট্যান্ডার্ড ও উইকিপিডিয়া,
                নির্বাচন কমিশনের গেজেটের সঙ্গে এখনো মিলিয়ে দেখা হয়নি। যেসব আসনের ফল পাওয়া যায়নি, সেগুলোর পাতায় তা লেখা আছে।
              </p>
            )
          ) : (
            <p className="text-[13px] leading-relaxed text-muted border-t border-rule pt-3">
              {t(
                'নির্বাচন কমিশনের গেজেট থেকে প্রতিটি আসনের প্রার্থী, প্রতীক ও প্রাপ্ত ভোট যোগ করা হবে। যাচাই করা সংখ্যা ছাড়া কিছু দেখানো হবে না।',
                'Each seat’s candidates, symbols and votes will be added from the Election Commission’s gazette. No figure will be shown unless it has been verified.',
              )}
            </p>
          )}
        </Card>
      </section>

      <section id="votar" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <SectionHead title={t('ভোটার ও নির্বাচনের তারিখ', 'Voters and election dates')} note={t('নির্বাচন কমিশন ও সংসদের তথ্য', 'Figures from the Election Commission and Parliament')} />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-stretch">
          <Card className="p-6 flex flex-col gap-4">
            {/* Crore-sized figures in Bangla grouping are wide: one column on a narrow phone, so two never run together. */}
            <div className="grid grid-cols-1 min-[440px]:grid-cols-2 gap-x-4 gap-y-5">
              {([
                [t('মোট ভোটার', 'Total voters'), t.group(ecs.national.registeredVoters)],
                [t('ভোটকেন্দ্র', 'Polling centres'), t.group(ecs.national.pollingCentres)],
                [t('নিবন্ধিত রাজনৈতিক দল', 'Registered political parties'), t.n(ecs.national.registeredParties)],
                [t('ভোটারের মধ্যে নারী', 'Women among voters'), `${t.n(((ecs.national.femaleVoters / ecs.national.registeredVoters) * 100).toFixed(1))}%`],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="display tnum text-[26px] font-extrabold leading-none">{value}</span>
                  <span className="text-[13px] text-muted">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div
                className="flex gap-0.5 h-3 rounded-full overflow-hidden"
                role="img"
                aria-label={t(
                  `পুরুষ ভোটার ${ecs.national.maleVoters}, নারী ভোটার ${ecs.national.femaleVoters}`,
                  `Male voters ${t.group(ecs.national.maleVoters)}, female voters ${t.group(ecs.national.femaleVoters)}`,
                )}
              >
                <span className="bg-[#b9b4a6]" style={{ flex: `${ecs.national.maleVoters} 1 0` }} />
                <span className="bg-brand" style={{ flex: `${ecs.national.femaleVoters} 1 0` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px]">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#b9b4a6]" aria-hidden="true" />{t('পুরুষ ', 'Men ')}<b className="tnum">{t.group(ecs.national.maleVoters)}</b></span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand" aria-hidden="true" />{t('নারী ', 'Women ')}<b className="tnum">{t.group(ecs.national.femaleVoters)}</b></span>
              </div>
            </div>
            <p className="text-[12.5px] text-muted border-t border-rule pt-3 mt-auto">
              {t('তথ্যসূত্র: ', 'Source: ')}{ecs.source}{t(' | পড়া হয়েছে ', ' | Read on ')}{t.date(ecs.readOn)}
            </p>
          </Card>
          <Card className="p-6">
            <ol className="flex flex-col">
              {([
                [t('নির্বাচন', 'Election'), parliament.electionDate],
                [t('গেজেট', 'Gazette'), parliament.gazetteDate],
                [t('শপথ', 'Oath'), parliament.oathDate],
                [t('মেয়াদ শেষ', 'Term ends'), parliament.endDate],
              ] as [string, string | null][]).map(([label, value], i, all) => (
                <li key={label} className="relative ps-6 pb-5 last:pb-0">
                  <span aria-hidden="true" className={`absolute start-0 top-[6px] w-3 h-3 rounded-full border-2 ${i < all.length - 1 ? 'bg-brand border-brand' : 'bg-surface border-brand'}`} />
                  {i < all.length - 1 && <span aria-hidden="true" className="absolute start-[5px] top-[18px] bottom-0 w-0.5 bg-brandsoft" />}
                  <span className="block text-[12.5px] text-muted">{label}</span>
                  <span className="block text-[15.5px] font-semibold">{t.date(value) ?? t('তারিখ নেই', 'No date')}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </section>

      <section id="ager" className="mt-10 flex flex-col gap-4 scroll-mt-24">
        <SectionHead title={t('আগের নির্বাচনগুলোতে দলগুলোর আসন', 'Seats by party in earlier elections')} note={t('সংসদের তথ্যভান্ডার', 'Parliament’s database')} />
        {(() => {
          const rows = parliamentsWithRecords().filter((p) => partySeatsOf(p.no).length > 0);
          const totals = new Map<string, { abbr: string; nameBn: string | null; n: number }>();
          for (const p of rows) for (const ps of partySeatsOf(p.no)) {
            const e = totals.get(ps.abbr) ?? { abbr: ps.abbr, nameBn: ps.nameBn, n: 0 };
            e.n += ps.territorial; totals.set(ps.abbr, e);
          }
          const cols = [...totals.values()].sort((a, b) => b.n - a.n).slice(0, 5);
          const zero = <span className="text-muted">{t('০', '0')}</span>;
          return (
            <Card className="overflow-x-auto">
              <table className="w-full text-[14px] min-w-[640px]">
                <thead>
                  <tr className="bg-sunk/70 text-[12px] font-bold text-muted">
                    <th className="text-start px-4 py-2.5">{t('সংসদ', 'Parliament')}</th>
                    {cols.map((c) => (
                      <th key={c.abbr} className="text-end px-3 py-2.5 whitespace-nowrap" title={t.en ? partyByAbbr(c.abbr, c.nameBn, 'en') : undefined}>
                        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: partyColor(c.abbr) }} />{c.abbr}</span>
                      </th>
                    ))}
                    <th className="text-end px-3 py-2.5">{t('অন্য', 'Other')}</th>
                    <th className="text-end px-4 py-2.5">{t('নথিভুক্ত', 'Recorded')}</th>
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
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{parliamentLabel(p.no, t.lang)}</td>
                        {cols.map((c) => <td key={c.abbr} className="px-3 py-2.5 text-end tnum">{get(c.abbr) ? t.n(get(c.abbr)) : zero}</td>)}
                        <td className="px-3 py-2.5 text-end tnum">{other ? t.n(other) : zero}</td>
                        <td className="px-4 py-2.5 text-end tnum text-muted">{t.n(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        })()}
        {t.en ? (
          <p className="text-[12.5px] text-muted leading-relaxed">
            By the members recorded in Parliament’s database for the general (constituency) seats; the reserved seats for women are left out. Because of by-elections and incomplete records, the numbers for some parliaments may differ slightly from the official results; the “Recorded” column shows this. The database has no records for the 1st to 3rd and the 6th parliaments.
          </p>
        ) : (
          <p className="text-[12.5px] text-muted leading-relaxed">
            সাধারণ (আসনভিত্তিক) আসনে সংসদের তথ্যভান্ডারে নথিভুক্ত সদস্য অনুযায়ী; সংরক্ষিত নারী আসন বাদ। উপনির্বাচন ও অসম্পূর্ণ রেকর্ডের কারণে
            কোনো কোনো সংসদে সংখ্যা সরকারি ফলের সঙ্গে সামান্য ভিন্ন হতে পারে; “নথিভুক্ত” কলামে সেটি দেখা যায়। ১ম থেকে ৩য় ও ৬ষ্ঠ সংসদের রেকর্ড সেখানে নেই।
          </p>
        )}
      </section>

      <section id="jela" className="mt-10 pb-14 flex flex-col gap-5 scroll-mt-24">
        <SectionHead title={t('জেলা অনুযায়ী আসন', 'Seats by district')} note={t.count(districts.length, ' জেলা', 'district', 'districts')} />
        <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
          {districts.map((d) => (
            <Card key={d.bn} className="p-5 mb-4 flex flex-col gap-3 break-inside-avoid">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="display text-[18px] font-bold">{d.name}</h3>
                <span className="text-[13px] text-muted tnum">{t.count(d.list.length, ' আসন', 'seat', 'seats')}</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[14.5px]">
                {d.list.map((seat) => {
                  const m = seat.memberId ? getMemberById(seat.memberId) : undefined;
                  const won = winnerOf(seat.no);
                  return (
                    <li key={seat.no}>
                      <Link href={`/ason/${seat.slug}`} className="flex items-center gap-2 hover:text-brand">
                        <PartyDot abbr={m?.party?.abbr} />
                        <span className="font-medium shrink-0">{t.en ? seatName(seat, 'en') : seat.nameBn}</span>
                        <span className="text-muted truncate">{t.en ? (m ? personName(m, 'en') : undefined) : m?.nameBn ?? m?.nameEn}</span>
                        {won && <span className="ms-auto shrink-0 tnum text-[12.5px] text-muted">{t.group(won.votes)}{t(' ভোট', ' votes')}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          {t('তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ | হালনাগাদ ', 'Source: Parliament of Bangladesh | Updated ')}{t.date(meta.syncedAt)}
        </p>
      </section>
    </Page>
  );
}
