import type { Metadata } from 'next';
import { shareGraph, shareTwitter } from '@/lib/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  seats, getSeat, getMemberById, districtOf, bn, bnGroup, initial, dateBn, meta, partyColor, nameEnDisplay,
} from '@/lib/data';
import { Page, Card, Breadcrumb, Empty, PartyDot } from '@/components/ui';
import type { Seat } from '@/lib/data';
import MemberPhoto from '@/components/MemberPhoto';
import SeatMap from '@/components/SeatMap';
import { ResultCard } from '@/components/results';
import { seatHolders, resultsForSeat, resultForSeat, parliamentLabel, SAME_AREA_SINCE, electionYear } from '@/lib/history';

/**
 * What people actually type, and what a seat page has to answer in its first
 * line: "ঢাকা-১৪ আসনের এমপি" (Search Console, 28 days to 21 September 2026:
 * 209 such queries, 1,040 impressions, 27 clicks). The title, the description,
 * the visible lede and the Q&A all say it the same way.
 */
function seatAnswer(s: Seat & { memberId: string | null }) {
  const m = s.memberId && !s.vacantSince ? getMemberById(s.memberId) : undefined;
  const name = m ? m.nameBn ?? m.nameEn : null;
  const where = s.reserved ? `${s.nameBn}-এর` : `${s.nameBn} আসনের`;
  const question = s.reserved ? `${s.nameBn}-এর সংসদ সদস্য কে?` : `${s.nameBn} আসনের এমপি কে?`;
  if (!name) {
    return {
      m, name, where, question,
      title: s.vacantSince ? `${s.nameBn} আসন (শূন্য)` : `${s.nameBn} আসন`,
      sentence: `${where} আসনটি ${s.vacantSince ? `${dateBn(s.vacantSince)} থেকে শূন্য` : 'এখন শূন্য'}; ত্রয়োদশ জাতীয় সংসদে এখানে কোনো সদস্য নেই।`,
    };
  }
  const party = m?.party?.nameBn ?? m?.party?.abbr;
  return {
    m, name, where, question,
    title: s.reserved ? `${s.nameBn}-এর সংসদ সদস্য ${name}` : `${s.nameBn} আসনের এমপি ${name}`,
    sentence: `ত্রয়োদশ জাতীয় সংসদে ${where} সংসদ সদস্য ${name}${party ? `, ${party}` : ''}।`,
  };
}

export function generateStaticParams() {
  return seats.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/ason/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const s = getSeat(slug);
  if (!s) return { title: 'আসন পাওয়া যায়নি' };
  // A seat whose member resigned is vacant: it shares as vacant, not as the former member.
  const m = s.memberId && !s.vacantSince ? getMemberById(s.memberId) : undefined;
  const name = m ? (m.nameBn ?? m.nameEn) : null;
  // The seat shares as its member: name in the title, party and this election's votes in the description,
  // and the member's card as the image. A vacant seat says so and keeps the site image.
  const r = m && !s.reserved ? resultForSeat(s.no, meta.parliamentNo) : null;
  const top = r ? [...r.candidates].sort((a, b) => b.votes - a.votes)[0] : undefined;
  const year = electionYear(meta.parliamentNo);
  const won = top && m && top.name === m.nameBn ? ` ${year ? `${bn(year)} সালের` : 'এই'} নির্বাচনে ${bnGroup(top.votes)} ভোট পেয়ে নির্বাচিত।` : '';
  const where = s.reserved ? s.nameBn : `${s.nameBn} আসন`;
  // The sitting member's preview image (/api/og/mp/[slug]); a vacant seat keeps the site's.
  const card = m ? { url: `/api/og/mp/${m.slug}`, width: 1200, height: 630, type: 'image/png', alt: `${where}, ${name}` } : null;
  return {
    title: seatAnswer(s).title,
    alternates: { canonical: `/ason/${s.slug}` },
    openGraph: shareGraph(`/ason/${s.slug}`, card),
    twitter: { ...shareTwitter(card), ...(card ? { card: 'summary_large_image' as const } : {}) },
    description: name
      ? `${s.reserved ? `${s.nameBn}-এর` : `${s.nameBn} আসনের`} সংসদ সদস্য ${name}${m?.party?.nameBn ? `, ${m.party.nameBn}` : ''}।${won} ${s.reserved ? 'দল ও সংসদের তথ্য।' : 'প্রার্থীদের ভোট, আগের সংসদ সদস্য ও আসনের এলাকা।'}`
      : `${where} ${s.vacantSince ? `${dateBn(s.vacantSince)} থেকে শূন্য` : 'এখন শূন্য'}। ত্রয়োদশ জাতীয় সংসদ; আসনের নির্বাচনী ফল ও আগের সংসদ সদস্য।`,
  };
}

export default async function SeatPage({ params }: PageProps<'/[lang]/ason/[slug]'>) {
  const { slug } = await params;
  const seat = getSeat(slug);
  if (!seat) notFound();

  const member = seat.memberId ? getMemberById(seat.memberId) : undefined;
  const district = districtOf(seat);
  const neighbours = district
    ? seats.filter((s) => s.no !== seat.no && districtOf(s)?.en === district.en)
    : [];

  const holders = seat.reserved ? [] : seatHolders(seat.no);
  const results = seat.reserved ? [] : resultsForSeat(seat.no);
  const oldBoundary = holders.some((h) => h.parliamentNo < SAME_AREA_SINCE);

  const answer = seatAnswer(seat);
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: answer.question, acceptedAnswer: { '@type': 'Answer', text: answer.sentence } }],
  };

  const idx = seats.findIndex((s) => s.no === seat.no);
  const prev = seats[idx - 1];
  const next = seats[idx + 1];

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Breadcrumb
        items={[
          { href: '/', label: 'হোম' },
          { href: '/ason', label: 'সব আসন' },
          ...(district ? [{ href: `/jela/${district.slug}`, label: district.bn }] : []),
          { label: seat.nameBn ?? '' },
        ]}
      />

      <header className="pt-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-bold tracking-[1.5px] text-brand">
            ত্রয়োদশ জাতীয় সংসদ
          </span>
          <h1 className="display text-[38px] sm:text-[50px] leading-[1.08] font-extrabold">
            {seat.nameBn}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-[16px] text-inksoft">
            {seat.nameEn && <span>{seat.nameEn}</span>}
            {seat.reserved
              ? <span className="px-3 py-1 rounded-full border border-rule text-[13px] font-semibold">সংরক্ষিত নারী আসন</span>
              : district && <Link href={`/jela/${district.slug}`} className="hover:text-brand">{district.bn} জেলা</Link>}
          </div>
          <p className="max-w-[640px] text-[16.5px] leading-relaxed text-inksoft text-pretty">{answer.sentence}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {prev && (
            <Link href={`/ason/${prev.slug}`} className="flex items-center gap-2 h-11 px-4 border border-rule rounded-full bg-surface text-[14px] font-semibold hover:border-brand">
              <span aria-hidden="true" className="text-muted">‹</span> {prev.nameBn}
            </Link>
          )}
          {next && (
            <Link href={`/ason/${next.slug}`} className="flex items-center gap-2 h-11 px-4 border border-rule rounded-full bg-surface text-[14px] font-semibold hover:border-brand">
              {next.nameBn} <span aria-hidden="true" className="text-muted">›</span>
            </Link>
          )}
        </div>
      </header>

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-10 items-start">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="display text-[24px] font-bold">{seat.vacantSince || !member ? 'আসনটি শূন্য' : 'বর্তমান সংসদ সদস্য'}</h2>
            {seat.vacantSince && member && (
              <p className="text-[15px] text-inksoft leading-relaxed -mt-1">
                এই আসনে নির্বাচিত {member.nameBn ?? member.nameEn} {dateBn(seat.vacantSince)} তারিখে পদত্যাগ করেছেন (সংসদ সচিবালয়ের তথ্য অনুযায়ী)। নতুন সদস্য নির্বাচিত হলে এখানে দেখা যাবে।
              </p>
            )}
            {member ? (
              <Link
                href={`/mp/${member.slug}`}
                className="bg-surface border-[1.5px] rounded-xl p-4 sm:p-6 flex items-center gap-4 sm:gap-5 hover:shadow-sm transition-shadow"
                style={{ borderColor: partyColor(member.party?.abbr) }}
              >
                <MemberPhoto src={member.photoUrl} alt="" initial={initial(member)} size={88} sizeClass="w-[72px] h-[72px] sm:w-[88px] sm:h-[88px]" />
                <span className="grow min-w-0 flex flex-col gap-1.5 sm:gap-2">
                  <span className="display text-[21px] sm:text-[28px] font-extrabold leading-tight">
                    {member.nameBn ?? member.nameEn}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-inksoft">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <PartyDot abbr={member.party?.abbr} />
                      {member.party?.nameBn ?? member.party?.abbr}
                    </span>
                    {member.professionBn && <span>{member.professionBn}</span>}
                  </span>
                </span>
                <span className="hidden sm:inline text-[14px] font-semibold text-brand shrink-0">প্রোফাইল →</span>
              </Link>
            ) : (
              <Empty
                title="সংসদের সদস্য তালিকায় এই আসনের কোনো সদস্য নেই।"
                body="সংসদ সচিবালয় এই আসনে কাউকে সদস্য হিসেবে তালিকাভুক্ত করেনি; কারণ তাদের তথ্যভান্ডারে লেখা নেই। সদস্য যুক্ত হলে এখানে দেখা যাবে।"
              />
            )}
          </section>

          {seat.boundaryBn && (
            <section className="flex flex-col gap-4">
              <h2 className="display text-[24px] font-bold">আসনের এলাকা</h2>
              <Card className="p-5">
                <p className="text-[15.5px] leading-relaxed">{seat.boundaryBn}</p>
              </Card>
              {!seat.reserved && district && (
                <SeatMap
                  geoUrl={`/geo/${district.slug}.json`}
                  seat={{ slug: seat.slug, color: partyColor(member?.party?.abbr) }}
                  title={seat.nameBn ?? seat.nameEn ?? ''}
                  seatNames={Object.fromEntries(seats.filter((x) => districtOf(x)?.slug === district.slug).map((x) => [x.slug, x.nameBn ?? x.nameEn ?? x.slug]))}
                />
              )}
            </section>
          )}

          {!seat.reserved && (
            <section className="flex flex-col gap-4">
              <h2 className="display text-[24px]">
                এই আসনের আগের সদস্যরা
                {holders.length > 0 && <span className="ms-2 text-[15px] font-semibold text-muted tnum">({bn(holders.length)})</span>}
              </h2>
              {holders.length ? (
                <>
                  <Card className="divide-y divide-rulesoft">
                    {holders.map((h) => {
                      const cur = h.memberId ? getMemberById(h.memberId) : undefined;
                      // A sitting member is shown under the name the site uses for them; the
                      // source's own spelling for that year stays underneath.
                      const name = cur?.nameBn ?? h.nameBn ?? h.nameEn ?? 'নাম নেই';
                      const sub = cur ? (nameEnDisplay(h.nameEn) ?? h.nameBn) : h.nameBn ? nameEnDisplay(h.nameEn) : null;
                      return (
                        <div key={`${h.parliamentNo}-${name}`} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                          {/* On a phone the parliament and party share a small line above the name, which then has the full width. */}
                          <span className="sm:w-[190px] sm:shrink-0 flex items-center justify-between gap-3">
                            <span className="text-[12.5px] sm:text-[13.5px] text-muted leading-snug">{parliamentLabel(h.parliamentNo)}</span>
                            <span className="sm:hidden flex items-center gap-1.5 text-[12.5px] font-semibold text-inksoft">
                              <PartyDot abbr={h.partyAbbr} size={16} />
                              {h.partyAbbr ?? 'দল নেই'}
                            </span>
                          </span>
                          <span className="grow min-w-0 flex flex-col">
                            {cur ? (
                              <Link href={`/mp/${cur.slug}`} className="font-semibold text-brand hover:underline wrap-anywhere">{name}</Link>
                            ) : (
                              <span className="font-semibold wrap-anywhere">{name}</span>
                            )}
                            {sub && sub !== name && <span className="text-[12.5px] text-muted wrap-anywhere">{sub}</span>}
                          </span>
                          <span className="hidden sm:flex shrink-0 items-center gap-2 text-[13px] font-semibold text-inksoft">
                            <PartyDot abbr={h.partyAbbr} />
                            {h.partyNameBn ?? h.partyAbbr ?? 'দল নেই'}
                          </span>
                        </div>
                      );
                    })}
                  </Card>
                  <p className="text-[12.5px] text-muted leading-relaxed">
                    সংসদের তথ্যভান্ডারে ৪র্থ, ৫ম ও ৭ম থেকে ১২শ সংসদের রেকর্ড আছে; ১ম থেকে ৩য় ও ৬ষ্ঠ সংসদের তালিকা সেখানে নেই।
                    {oldBoundary && ' ২০০৮ সালের সীমানা পুনর্নির্ধারণের আগের আসনগুলো একই নম্বরের হলেও এলাকা ভিন্ন হতে পারে।'}
                  </p>
                </>
              ) : (
                <Empty
                  title="সংসদের তথ্যভান্ডারে এই আসনের আগের সদস্যদের রেকর্ড পাওয়া যায়নি।"
                  body="আসনটি একই জেলায় একই নম্বরে থাকলে তবেই আগের সংসদের সদস্যকে এখানে দেখানো হয়।"
                />
              )}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="display text-[24px]">নির্বাচনের ফল</h2>
            {results.length ? (
              results.map((r) => <ResultCard key={r.parliamentNo} r={r} />)
            ) : (
              <Empty
                title="এই আসনের প্রার্থী তালিকা ও ভোটের সংখ্যা এখনো যোগ করা হয়নি।"
                body="সংসদের তথ্যভান্ডারে ভোটের সংখ্যা নেই। নির্বাচন কমিশনের গেজেট থেকে প্রার্থী ও প্রাপ্ত ভোট যাচাই করে যোগ করা হয়; যাচাই করা সংখ্যা ছাড়া কিছু দেখানো হবে না।"
              />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[19px] font-bold">আসন তথ্য</h2>
            <div className="flex flex-col gap-2 text-[15px]">
              <div className="flex justify-between gap-3 py-1.5 border-b border-rulesoft">
                <span className="text-muted">আসন নম্বর</span>
                <span className="font-medium tnum">{bn(seat.no)}</span>
              </div>
              {district && (
                <div className="flex justify-between gap-3 py-1.5 border-b border-rulesoft">
                  <span className="text-muted">জেলা</span>
                  <Link href={`/jela/${district.slug}`} className="font-medium hover:text-brand">{district.bn}</Link>
                </div>
              )}
              <div className="flex justify-between gap-3 py-1.5">
                <span className="text-muted">ধরন</span>
                <span className="font-medium">{seat.reserved ? 'সংরক্ষিত নারী আসন' : 'সাধারণ আসন'}</span>
              </div>
            </div>
          </Card>

          {neighbours.length > 0 && (
            <Card className="p-5 flex flex-col gap-3">
              <h2 className="display text-[19px] font-bold">{district?.bn} জেলার আসন</h2>
              <ul className="flex flex-col gap-2 text-[15px]">
                {neighbours.map((s) => {
                  const holder = s.memberId ? getMemberById(s.memberId) : undefined;
                  return (
                    <li key={s.no}>
                      <Link href={`/ason/${s.slug}`} className="flex justify-between items-center gap-3 hover:text-brand">
                        <span className="shrink-0">{s.nameBn}</span>
                        {holder && (
                          <span className="min-w-0 flex items-center justify-end gap-2 text-muted" title={holder.party?.nameBn ?? undefined}>
                            <span className="truncate">{holder.nameBn}</span>
                            <PartyDot abbr={holder.party?.abbr} size={18} />
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <div className="p-4 rounded-xl bg-brandsoft flex flex-col gap-2">
            <span className="text-[14.5px] font-bold text-branddark">তথ্যসূত্র</span>
            <span className="text-[13px] leading-relaxed text-brand">
              বাংলাদেশ জাতীয় সংসদ। হালনাগাদ {dateBn(meta.syncedAt)}।
            </span>
          </div>
        </aside>
      </div>
    </Page>
  );
}

export const dynamicParams = false;
