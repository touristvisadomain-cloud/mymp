import type { Metadata } from 'next';
import { langAlternates, shareGraph, shareTwitter } from '@/lib/seo';
import Link from '@/i18n/Link';
import { notFound } from 'next/navigation';
import {
  seats, getSeat, getMemberById, districtOf, bn, bnGroup, initial, dateBn, meta, partyColor, nameEnDisplay,
} from '@/lib/data';
import { Page, Card, Breadcrumb, Empty, PartyDot, TranslatedNote } from '@/components/ui';
import type { Seat } from '@/lib/data';
import MemberPhoto from '@/components/MemberPhoto';
import SeatMap from '@/components/SeatMap';
import { ResultCard } from '@/components/results';
import { seatHolders, resultsForSeat, resultForSeat, parliamentLabel, SAME_AREA_SINCE, electionYear } from '@/lib/history';
import { getT } from '@/i18n/server';
import { hrefIn, makeT, type Lang } from '@/i18n/core';
import { districtName, noParty, partyByAbbr, partyName, personName, seatName, titleCaseName } from '@/i18n/names';
import { inLang, translated } from '@/i18n/content';

/**
 * What people actually type, and what a seat page has to answer in its first
 * line: "ঢাকা-১৪ আসনের এমপি" (Search Console, 28 days to 21 September 2026:
 * 209 such queries, 1,040 impressions, 27 clicks). The title, the description,
 * the visible lede and the Q&A all say it the same way.
 */
function seatAnswer(s: Seat & { memberId: string | null }, lang: Lang = 'bn') {
  const m = s.memberId && !s.vacantSince ? getMemberById(s.memberId) : undefined;
  if (lang === 'en') return seatAnswerEn(s, m);
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

/** The same answer in English: "Who is the MP for Dhaka-14?" */
function seatAnswerEn(s: Seat, m: ReturnType<typeof getMemberById>) {
  const t = makeT('en');
  const seat = seatName(s, 'en');
  const name = m ? personName(m, 'en') || null : null;
  const where = s.reserved ? seat : `the ${seat} constituency`;
  const question = s.reserved ? `Who is the Member of Parliament for ${seat}?` : `Who is the MP for ${seat}?`;
  if (!name) {
    const label = s.reserved ? seat : `The ${seat} seat`;
    return {
      m, name, where, question,
      title: s.reserved ? (s.vacantSince ? `${seat} (vacant)` : seat) : s.vacantSince ? `${seat} seat (vacant)` : `${seat} seat`,
      sentence: `${label} ${s.vacantSince ? `has been vacant since ${t.date(s.vacantSince)}` : 'is vacant at present'}; it has no member in the 13th Parliament.`,
    };
  }
  const party = m?.party ? partyName(m.party, 'en') : null;
  return {
    m, name, where, question,
    title: s.reserved ? `Member of Parliament for ${seat}: ${name}` : `MP for ${seat}: ${name}`,
    sentence: `In the 13th Parliament, the Member of Parliament for ${where} is ${name}${party ? `, ${party}` : ''}.`,
  };
}

export function generateStaticParams() {
  return seats.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/ason/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  const s = getSeat(slug);
  if (!s) return { title: t('আসন পাওয়া যায়নি', 'Seat not found') };
  // A seat whose member resigned is vacant: it shares as vacant, not as the former member.
  const m = s.memberId && !s.vacantSince ? getMemberById(s.memberId) : undefined;
  const name = m ? (t.en ? personName(m, 'en') : m.nameBn ?? m.nameEn) : null;
  // The seat shares as its member: name in the title, party and this election's votes in the description,
  // and the member's card as the image. A vacant seat says so and keeps the site image.
  const r = m && !s.reserved ? resultForSeat(s.no, meta.parliamentNo) : null;
  const top = r ? [...r.candidates].sort((a, b) => b.votes - a.votes)[0] : undefined;
  const year = electionYear(meta.parliamentNo);
  const seatEn = seatName(s, 'en');
  const won = top && m && top.name === m.nameBn
    ? t(
      ` ${year ? `${bn(year)} সালের` : 'এই'} নির্বাচনে ${bnGroup(top.votes)} ভোট পেয়ে নির্বাচিত।`,
      ` Elected in the ${year ? `${year}` : 'same'} election with ${t.group(top.votes)} votes.`,
    )
    : '';
  const where = s.reserved ? s.nameBn : `${s.nameBn} আসন`;
  const card = m
    ? { url: `/api/og/mp/${m.slug}`, width: 1200, height: 630, type: 'image/png', alt: t(`${where}, ${name}`, `${s.reserved ? seatEn : `${seatEn} constituency`}, ${name}`) }
    : null;
  const party = m?.party ? (t.en ? partyName(m.party, 'en') : m.party.nameBn) : null;
  return {
    title: seatAnswer(s, t.lang).title,
    alternates: langAlternates(t.lang, `/ason/${s.slug}`),
    openGraph: shareGraph(`/ason/${s.slug}`, card, t.lang),
    twitter: { ...shareTwitter(card), ...(card ? { card: 'summary_large_image' as const } : {}) },
    description: t.en
      ? name
        ? `The Member of Parliament for ${seatEn} is ${name}${party ? `, ${party}` : ''}.${won} ${s.reserved ? 'Party and parliamentary information.' : "Candidates' votes, earlier Members of Parliament and the seat's area."}`
        : `${s.reserved ? seatEn : `The ${seatEn} seat`} ${s.vacantSince ? `has been vacant since ${t.date(s.vacantSince)}` : 'is vacant at present'}. 13th Parliament; the seat's election results and earlier Members of Parliament.`
      : name
        ? `${s.reserved ? `${s.nameBn}-এর` : `${s.nameBn} আসনের`} সংসদ সদস্য ${name}${m?.party?.nameBn ? `, ${m.party.nameBn}` : ''}।${won} ${s.reserved ? 'দল ও সংসদের তথ্য।' : 'প্রার্থীদের ভোট, আগের সংসদ সদস্য ও আসনের এলাকা।'}`
        : `${where} ${s.vacantSince ? `${dateBn(s.vacantSince)} থেকে শূন্য` : 'এখন শূন্য'}। ত্রয়োদশ জাতীয় সংসদ; আসনের নির্বাচনী ফল ও আগের সংসদ সদস্য।`,
  };
}

export default async function SeatPage({ params }: PageProps<'/[lang]/ason/[slug]'>) {
  const { slug } = await params;
  const t = await getT();
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

  const answer = seatAnswer(seat, t.lang);
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: answer.question, acceptedAnswer: { '@type': 'Answer', text: answer.sentence } }],
  };

  const idx = seats.findIndex((s) => s.no === seat.no);
  const prev = seats[idx - 1];
  const next = seats[idx + 1];

  /** A seat's name in the page's language, as the Bangla page has always written it. */
  const nameOf = (s: Seat) => (t.en ? seatName(s, 'en') : s.nameBn);
  const districtLabel = district ? districtName(district, t.lang) : '';
  const bnPath = hrefIn('bn', `/ason/${seat.slug}`);
  const boundary = translated(seat.boundaryBn, t.lang);
  const profession = member ? inLang(member.professionBn, t.lang) : null;

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Breadcrumb
        items={[
          { href: '/', label: t('হোম', 'Home') },
          { href: '/ason', label: t('সব আসন', 'All seats') },
          ...(district ? [{ href: `/jela/${district.slug}`, label: districtLabel }] : []),
          { label: nameOf(seat) ?? '' },
        ]}
      />

      <header className="pt-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-bold tracking-[1.5px] text-brand">
            {t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
          </span>
          <h1 className="display text-[38px] sm:text-[50px] leading-[1.08] font-extrabold">
            {nameOf(seat)}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-[16px] text-inksoft">
            {/* The seat's name in the other language under the heading. */}
            {t.en ? seat.nameBn && <span lang="bn">{seat.nameBn}</span> : seat.nameEn && <span>{seat.nameEn}</span>}
            {seat.reserved
              ? <span className="px-3 py-1 rounded-full border border-rule text-[13px] font-semibold">{t('সংরক্ষিত নারী আসন', 'Reserved seat for women')}</span>
              : district && <Link href={`/jela/${district.slug}`} className="hover:text-brand">{t(`${district.bn} জেলা`, `${districtLabel} district`)}</Link>}
          </div>
          <p className="max-w-[640px] text-[16.5px] leading-relaxed text-inksoft text-pretty">{answer.sentence}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {prev && (
            <Link href={`/ason/${prev.slug}`} className="flex items-center gap-2 h-11 px-4 border border-rule rounded-full bg-surface text-[14px] font-semibold hover:border-brand">
              <span aria-hidden="true" className="text-muted">‹</span> {nameOf(prev)}
            </Link>
          )}
          {next && (
            <Link href={`/ason/${next.slug}`} className="flex items-center gap-2 h-11 px-4 border border-rule rounded-full bg-surface text-[14px] font-semibold hover:border-brand">
              {nameOf(next)} <span aria-hidden="true" className="text-muted">›</span>
            </Link>
          )}
        </div>
      </header>

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-10 items-start">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="display text-[24px] font-bold">
              {seat.vacantSince || !member ? t('আসনটি শূন্য', 'The seat is vacant') : t('বর্তমান সংসদ সদস্য', 'Current Member of Parliament')}
            </h2>
            {seat.vacantSince && member && (
              <p className="text-[15px] text-inksoft leading-relaxed -mt-1">
                {t.en
                  ? `${personName(member, 'en')}, elected for this seat, resigned on ${t.date(seat.vacantSince)} (according to the Parliament Secretariat). A new member will be shown here once elected.`
                  : <>এই আসনে নির্বাচিত {member.nameBn ?? member.nameEn} {dateBn(seat.vacantSince)} তারিখে পদত্যাগ করেছেন (সংসদ সচিবালয়ের তথ্য অনুযায়ী)। নতুন সদস্য নির্বাচিত হলে এখানে দেখা যাবে।</>}
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
                    {t.en ? personName(member, 'en') : member.nameBn ?? member.nameEn}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-inksoft">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <PartyDot abbr={member.party?.abbr} />
                      {t.en ? (member.party ? partyName(member.party, 'en') : null) : member.party?.nameBn ?? member.party?.abbr}
                    </span>
                    {profession && <span>{profession}</span>}
                  </span>
                </span>
                <span className="hidden sm:inline text-[14px] font-semibold text-brand shrink-0">{t('প্রোফাইল →', 'Profile →')}</span>
              </Link>
            ) : (
              <Empty
                title={t('সংসদের সদস্য তালিকায় এই আসনের কোনো সদস্য নেই।', "Parliament's list of members has no member for this seat.")}
                body={t(
                  'সংসদ সচিবালয় এই আসনে কাউকে সদস্য হিসেবে তালিকাভুক্ত করেনি; কারণ তাদের তথ্যভান্ডারে লেখা নেই। সদস্য যুক্ত হলে এখানে দেখা যাবে।',
                  'The Parliament Secretariat has not listed anyone as the member for this seat; its database does not give the reason. A member will be shown here once one is added.',
                )}
              />
            )}
          </section>

          {seat.boundaryBn && (
            <section className="flex flex-col gap-4">
              <h2 className="display text-[24px] font-bold">{t('আসনের এলাকা', 'Area of the seat')}</h2>
              <Card className="p-5">
                {boundary ? (
                  <p className="text-[15.5px] leading-relaxed">{boundary.text}</p>
                ) : (
                  <p className="text-[15.5px] leading-relaxed">
                    The Election Commission&apos;s description of this seat&apos;s area is available in Bangla.{' '}
                    <a href={bnPath} hrefLang="bn" className="font-semibold text-brand hover:underline">
                      Read it on the Bangla page
                    </a>
                  </p>
                )}
                {boundary?.translated && <TranslatedNote bnHref={bnPath} className="mt-3" />}
              </Card>
              {!seat.reserved && district && (
                <SeatMap
                  geoUrl={`/geo/${district.slug}.json`}
                  seat={{ slug: seat.slug, color: partyColor(member?.party?.abbr) }}
                  title={(t.en ? seatName(seat, 'en') : seat.nameBn ?? seat.nameEn) ?? ''}
                  seatNames={Object.fromEntries(
                    seats
                      .filter((x) => districtOf(x)?.slug === district.slug)
                      .map((x) => [x.slug, (t.en ? seatName(x, 'en') : x.nameBn ?? x.nameEn) || x.slug]),
                  )}
                />
              )}
            </section>
          )}

          {!seat.reserved && (
            <section className="flex flex-col gap-4">
              <h2 className="display text-[24px]">
                {t('এই আসনের আগের সদস্যরা', 'Earlier members for this seat')}
                {holders.length > 0 && <span className="ms-2 text-[15px] font-semibold text-muted tnum">({t.n(holders.length)})</span>}
              </h2>
              {holders.length ? (
                <>
                  <Card className="divide-y divide-rulesoft">
                    {holders.map((h) => {
                      const cur = h.memberId ? getMemberById(h.memberId) : undefined;
                      // A sitting member is shown under the name the site uses for them; the
                      // source's own spelling for that year stays underneath.
                      const name = t.en
                        ? (cur ? personName(cur, 'en') : titleCaseName(h.nameEn)) || 'Name not recorded'
                        : cur?.nameBn ?? h.nameBn ?? h.nameEn ?? 'নাম নেই';
                      const sub = t.en
                        ? cur ? titleCaseName(h.nameEn) : null
                        : cur ? (nameEnDisplay(h.nameEn) ?? h.nameBn) : h.nameBn ? nameEnDisplay(h.nameEn) : null;
                      return (
                        <div key={`${h.parliamentNo}-${name}`} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                          {/* On a phone the parliament and party share a small line above the name, which then has the full width. */}
                          <span className="sm:w-[190px] sm:shrink-0 flex items-center justify-between gap-3">
                            <span className="text-[12.5px] sm:text-[13.5px] text-muted leading-snug">{parliamentLabel(h.parliamentNo, t.lang)}</span>
                            <span className="sm:hidden flex items-center gap-1.5 text-[12.5px] font-semibold text-inksoft">
                              <PartyDot abbr={h.partyAbbr} size={16} />
                              {t.en ? partyByAbbr(h.partyAbbr, h.partyNameBn, 'en', true) || noParty('en') : h.partyAbbr ?? 'দল নেই'}
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
                            {t.en ? partyByAbbr(h.partyAbbr, h.partyNameBn, 'en') || noParty('en') : h.partyNameBn ?? h.partyAbbr ?? 'দল নেই'}
                          </span>
                        </div>
                      );
                    })}
                  </Card>
                  <p className="text-[12.5px] text-muted leading-relaxed">
                    {t(
                      'সংসদের তথ্যভান্ডারে ৪র্থ, ৫ম ও ৭ম থেকে ১২শ সংসদের রেকর্ড আছে; ১ম থেকে ৩য় ও ৬ষ্ঠ সংসদের তালিকা সেখানে নেই।',
                      "Parliament's database has the records of the 4th, 5th and 7th to 12th Parliaments; the lists of the 1st to 3rd and the 6th Parliaments are not in it.",
                    )}
                    {oldBoundary && t(
                      ' ২০০৮ সালের সীমানা পুনর্নির্ধারণের আগের আসনগুলো একই নম্বরের হলেও এলাকা ভিন্ন হতে পারে।',
                      ' Seats from before the 2008 redrawing of constituency boundaries may have covered a different area, even under the same number.',
                    )}
                  </p>
                </>
              ) : (
                <Empty
                  title={t('সংসদের তথ্যভান্ডারে এই আসনের আগের সদস্যদের রেকর্ড পাওয়া যায়নি।', "No record of earlier members for this seat was found in Parliament's database.")}
                  body={t(
                    'আসনটি একই জেলায় একই নম্বরে থাকলে তবেই আগের সংসদের সদস্যকে এখানে দেখানো হয়।',
                    'A member of an earlier Parliament is shown here only when the seat had the same number in the same district.',
                  )}
                />
              )}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="display text-[24px]">{t('নির্বাচনের ফল', 'Election results')}</h2>
            {results.length ? (
              results.map((r) => <ResultCard key={r.parliamentNo} r={r} />)
            ) : (
              <Empty
                title={t('এই আসনের প্রার্থী তালিকা ও ভোটের সংখ্যা এখনো যোগ করা হয়নি।', 'The list of candidates and the vote counts for this seat have not been added yet.')}
                body={t(
                  'সংসদের তথ্যভান্ডারে ভোটের সংখ্যা নেই। নির্বাচন কমিশনের গেজেট থেকে প্রার্থী ও প্রাপ্ত ভোট যাচাই করে যোগ করা হয়; যাচাই করা সংখ্যা ছাড়া কিছু দেখানো হবে না।',
                  "Parliament's database has no vote counts. Candidates and the votes they received are added after checking them against the Election Commission's gazette; nothing is shown without checked figures.",
                )}
              />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[19px] font-bold">{t('আসন তথ্য', 'About the seat')}</h2>
            <div className="flex flex-col gap-2 text-[15px]">
              <div className="flex justify-between gap-3 py-1.5 border-b border-rulesoft">
                <span className="text-muted">{t('আসন নম্বর', 'Seat number')}</span>
                <span className="font-medium tnum">{t.n(seat.no)}</span>
              </div>
              {district && (
                <div className="flex justify-between gap-3 py-1.5 border-b border-rulesoft">
                  <span className="text-muted">{t('জেলা', 'District')}</span>
                  <Link href={`/jela/${district.slug}`} className="font-medium hover:text-brand">{districtLabel}</Link>
                </div>
              )}
              <div className="flex justify-between gap-3 py-1.5">
                <span className="text-muted">{t('ধরন', 'Type')}</span>
                <span className="font-medium">{seat.reserved ? t('সংরক্ষিত নারী আসন', 'Reserved seat for women') : t('সাধারণ আসন', 'General seat')}</span>
              </div>
            </div>
          </Card>

          {neighbours.length > 0 && (
            <Card className="p-5 flex flex-col gap-3">
              <h2 className="display text-[19px] font-bold">{t(`${district?.bn} জেলার আসন`, `Seats in ${districtLabel} district`)}</h2>
              <ul className="flex flex-col gap-2 text-[15px]">
                {neighbours.map((s) => {
                  const holder = s.memberId ? getMemberById(s.memberId) : undefined;
                  const holderParty = holder?.party ? (t.en ? partyName(holder.party, 'en') : holder.party.nameBn) : null;
                  return (
                    <li key={s.no}>
                      <Link href={`/ason/${s.slug}`} className="flex justify-between items-center gap-3 hover:text-brand">
                        <span className="shrink-0">{nameOf(s)}</span>
                        {holder && (
                          <span className="min-w-0 flex items-center justify-end gap-2 text-muted" title={holderParty ?? undefined}>
                            <span className="truncate">{t.en ? personName(holder, 'en') : holder.nameBn}</span>
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
            <span className="text-[14.5px] font-bold text-branddark">{t('তথ্যসূত্র', 'Source')}</span>
            <span className="text-[13px] leading-relaxed text-brand">
              {t(`বাংলাদেশ জাতীয় সংসদ। হালনাগাদ ${t.date(meta.syncedAt)}।`, `Parliament of Bangladesh. Updated ${t.date(meta.syncedAt)}.`)}
            </span>
          </div>
        </aside>
      </div>
    </Page>
  );
}

export const dynamicParams = false;
