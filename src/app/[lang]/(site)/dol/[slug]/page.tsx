import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { shareGraph, shareTwitter, cardImage, langAlternates } from '@/lib/seo';
import { notFound } from 'next/navigation';
import {
  parties, getParty, membersOfParty, getMemberById, bn, partyColor, initial, statistics, OFFICE_LABELS, GENERAL_SEATS, type Party, type Member,
} from '@/lib/data';
import { rolesOf, officers, ROLE_LABELS } from '@/lib/activity';
import { getT } from '@/i18n/server';
import type { T } from '@/i18n/core';
import { partyName, seatName, OFFICE, HOUSE_ROLE } from '@/i18n/names';
import { Page, PageHead, Card, Stat, MemberRow, Breadcrumb, PartyMark, LogoCredit } from '@/components/ui';
import MemberPhoto from '@/components/MemberPhoto';
import ShareButtons from '@/components/ShareButtons';
import { partyLogo } from '@/lib/partyLogos';
import { partyProfile, foundedYear, founderList, paragraphs, type ResolvedProfile } from '@/lib/partyProfiles';
import { partyBn, charCount, DESCRIPTION_MAX } from '@/lib/seo/mpDescription';
import { siteUrl } from '@/lib/site';

export function generateStaticParams() {
  return parties.map((p) => ({ slug: p.slug }));
}

/**
 * A party's members: the first dozen, the rest one tap away. All stay in the
 * page for search engines; a phone no longer scrolls past 246 cards.
 */
function MemberList({ list, t }: { list: Member[]; t: T }) {
  const SHOWN = 12;
  const grid = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3';
  return (
    <>
      <ul className={grid}>{list.slice(0, SHOWN).map((m) => <li key={m.id}><MemberRow m={m} /></li>)}</ul>
      {list.length > SHOWN && (
        <details className="group flex flex-col">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer self-start inline-flex items-center gap-2 h-11 px-5 rounded-full border border-ink font-semibold text-[15px] hover:bg-surface transition-colors">
            <span className="group-open:hidden">{t(`আরও ${t.n(list.length - SHOWN)} জন দেখুন`, `Show ${list.length - SHOWN} more`)}</span>
            <span className="hidden group-open:inline">{t('কম দেখুন', 'Show fewer')}</span>
          </summary>
          <ul className={`${grid} mt-3`}>{list.slice(SHOWN).map((m) => <li key={m.id}><MemberRow m={m} /></li>)}</ul>
        </details>
      )}
    </>
  );
}

/** "১ সেপ্টেম্বর ১৯৭৮" / "1 September 1978", or "১৯৭৮ সাল" / "1978" when only the year is on record. */
const founded = (on: string, t: T) => (/^\d{4}$/.test(on) ? t(`${t.n(on)} সাল`, on) : t.date(on) ?? on);

/** The party's preview card (/api/og/party/[slug], or its English twin /en); independents keep the site's image. */
const shareCard = (p: Party, t: T) =>
  p.abbr === 'Ind'
    ? null
    : cardImage(`/api/og/party/${p.slug}${t.en ? "/en" : ""}`, t.en ? partyName(p, 'en') : p.nameBn ?? p.abbr);

/** The party's name as a sentence starts with it: the Bangla without its abbreviation, the English in full. */
const nameOf = (p: Party, t: T) => (t.en ? partyName(p, 'en') : partyBn(p)?.name ?? p.nameBn ?? p.abbr);

export async function generateMetadata({ params }: PageProps<'/[lang]/dol/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  const p = getParty(slug);
  if (!p) return { title: t('দল পাওয়া যায়নি', 'Party not found') };
  const name = nameOf(p, t);
  const profile = partyProfile(p, t.lang);
  const year = foundedYear(profile);
  const seats = t.count(p.seats, 'টি আসন', 'seat', 'seats');
  const tail = t(
    `ত্রয়োদশ জাতীয় সংসদে দলটির ${t.n(p.seats)}টি আসন; সব সংসদ সদস্যের নাম, আসন ও ছবি এই পাতায়।`,
    `It holds ${seats} in the 13th Parliament; the names, seats and photos of all its MPs are on this page.`,
  );
  // Founding and the current head first, when the whole sentence still fits the length search engines show.
  const head = profile?.leaderName ? `${profile.leaderTitle ?? t('প্রধান', '')} ${profile.leaderName}`.trim() : null;
  const full = year
    ? t(
        `${name} ${t.n(year)} সালে প্রতিষ্ঠিত${head ? `; ${head}` : ''}। ${tail}`,
        `${name} was founded in ${year}${head ? `; it is led by ${head}` : ''}. ${tail}`,
      )
    : null;
  const short = year ? t(`${name} ${t.n(year)} সালে প্রতিষ্ঠিত। ${tail}`, `${name} was founded in ${year}. ${tail}`) : null;
  const description =
    p.abbr === 'Ind'
      ? t(
          `ত্রয়োদশ জাতীয় সংসদে ${t.n(p.seats)} জন স্বতন্ত্র সংসদ সদস্য আছেন। তাঁদের নাম, আসন, জেলা ও ছবিসহ তালিকা এই পাতায়।`,
          `The 13th Parliament has ${t.count(p.seats, '', 'independent member', 'independent members')}. A list with their names, seats, districts and photos is on this page.`,
        )
      : [full, short].find((d) => d && charCount(d) <= DESCRIPTION_MAX) ??
        t(
          `${name} ত্রয়োদশ জাতীয় সংসদে ${t.n(p.seats)}টি আসনে প্রতিনিধিত্ব করছে। দলের সব সংসদ সদস্যের নাম, আসন, জেলা ও ছবিসহ তালিকা এই পাতায়।`,
          `${name} holds ${seats} in the 13th Parliament. A list of all the party's MPs with their names, seats, districts and photos is on this page.`,
        );
  const card = shareCard(p, t);
  return {
    title: partyName(p, t.lang),
    alternates: langAlternates(t.lang, `/dol/${p.slug}`),
    openGraph: shareGraph(`/dol/${p.slug}`, card, t.lang),
    twitter: { ...shareTwitter(card), ...(card ? { card: 'summary_large_image' as const } : {}) },
    description,
  };
}

/** A name, linked to the member's page when that person sits in this parliament. */
function Person({ name, memberId }: { name: string; memberId?: string }) {
  const m = memberId ? getMemberById(memberId) : undefined;
  return m ? (
    <Link href={`/mp/${m.slug}`} className="font-semibold text-brand hover:underline">{name}</Link>
  ) : (
    <span className="font-semibold">{name}</span>
  );
}

/** The leader's initial, without an honorific in front of the name. */
const leaderInitial = (name: string, t: T) =>
  t.en
    ? name.replace(/^(Maulana|Syed|Mufti|Dr\.?|Barrister)\s+/, '').charAt(0)
    : name.replace(/^(মাওলানা|সৈয়দ|মুফতি)\s+/, '').charAt(0);

/** The party's head: photo, office in the party, and any office in the House, linked when they are a member. */
function LeaderCard({ profile, color, t }: { profile: ResolvedProfile; color: string; t: T }) {
  if (!profile.leaderName) return null;
  const m = profile.leaderMemberId ? getMemberById(profile.leaderMemberId) : undefined;
  const roles = m
    ? [...new Set([...m.offices.map((o) => (t.en ? OFFICE[o]?.en : OFFICE_LABELS[o]) ?? o), ...rolesOf(m.id, t.lang)])]
    : [];
  const body = (
    <>
      {m ? (
        <MemberPhoto src={m.photoUrl} alt="" initial={initial(m)} size={68} />
      ) : (
        <span
          aria-hidden="true"
          className="display shrink-0 w-[68px] h-[68px] rounded-full grid place-items-center text-[26px] font-bold text-white"
          style={{ background: color }}
        >
          {leaderInitial(profile.leaderName, t)}
        </span>
      )}
      <span className="flex flex-col gap-1 min-w-0">
        <span className="text-[12px] font-bold tracking-[1px] text-muted">
          {t(`দলপ্রধান, ${profile.leaderTitle ?? 'প্রধান'}`, `Party leader${profile.leaderTitle ? `, ${profile.leaderTitle}` : ''}`)}
        </span>
        <span className="display text-[19px] leading-snug">{profile.leaderName}</span>
        {roles.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <span key={r} className="px-2 py-0.5 rounded-full bg-ink text-white text-[11.5px] font-bold">{r}</span>
            ))}
          </span>
        )}
        {m?.seat && (
          <span className="text-[13px] text-muted">
            {m.seat.reserved
              ? t('সংরক্ষিত নারী আসনের সংসদ সদস্য', 'Member of Parliament for a reserved seat for women')
              : t(`${m.seat.nameBn} আসনের সংসদ সদস্য`, `Member of Parliament for ${seatName(m.seat, 'en')}`)}
          </span>
        )}
      </span>
    </>
  );
  return m ? (
    <Link
      href={`/mp/${m.slug}`}
      className="reveal bg-surface border border-rule rounded-card shadow-card p-5 flex items-center gap-4 hover:border-brand hover:shadow-lift transition-all"
    >
      {body}
    </Link>
  ) : (
    <Card className="p-5 flex items-center gap-4">{body}</Card>
  );
}

const sourceLabel = (url: string, t: T) =>
  url.includes('bn.wikipedia.org')
    ? t('বাংলা উইকিপিডিয়া', 'Bangla Wikipedia')
    : url.includes('en.wikipedia.org')
      ? t('ইংরেজি উইকিপিডিয়া', 'English Wikipedia')
      : new URL(url).hostname;

const HOUSE_ROLES = ['SPEAKER', 'DEPUTY_SPEAKER', 'LEADER_OF_HOUSE', 'OPPOSITION_LEADER'];
const ALL_OF = ['', '', 'দুজনই', 'তিনজনই', 'চারজনই'];

/** The House offices this party's members hold. */
const houseRolesOf = (p: Party) =>
  HOUSE_ROLES.filter((role) =>
    officers.some((o) => o.role === role && !!o.memberId && getMemberById(o.memberId)?.party?.abbr === p.abbr),
  );

/**
 * "ত্রয়োদশ সংসদে", in the owner's words for BNP (2026-09-12), built from the
 * parliament's data for every party so it stays true after a by-election:
 * seats held now (not a claim about election night, which the data cannot
 * confirm), the majority where it is passed, and the House offices held.
 */
function inParliamentBn(p: Party, majority: number): string {
  const t = p.seatsTerritorial;
  const r = p.seatsReserved;
  const n = p.seats;
  const beyond = n >= majority ? `, যা সংখ্যাগরিষ্ঠতার জন্য প্রয়োজনীয় ${bn(majority)}-এর ${n - majority >= 30 ? 'অনেক ' : ''}বেশি` : '';
  const seats =
    t > 0
      ? `${bn(GENERAL_SEATS)}টি নির্বাচনী আসনের মধ্যে ${bn(t)}টি এখন দলটির${r > 0 ? `; সংরক্ষিত নারী আসন যোগ করে সংসদে দলের মোট সদস্য ${bn(n)} জন` : ''}${beyond}।`
      : `দলটির কোনো নির্বাচনী আসন নেই; সংরক্ষিত নারী আসনে দলের সদস্য ${bn(r)} জন।`;
  const held = houseRolesOf(p).map((role) => ROLE_LABELS[role] ?? role);
  const offices =
    held.length === 1
      ? `${held[0]} এই দলের।`
      : held.length > 1
        ? `${held.slice(0, -1).join(', ')} ও ${held[held.length - 1]} ${ALL_OF[held.length]} এই দলের।`
        : '';
  return [seats, offices, 'দলের সব সদস্যের তালিকা ও আসন নিচে।'].filter(Boolean).join(' ');
}

/** The same paragraph in English. */
function inParliamentEn(p: Party, majority: number): string {
  const t = p.seatsTerritorial;
  const r = p.seatsReserved;
  const n = p.seats;
  const beyond = n >= majority ? `, ${n - majority >= 30 ? 'well ' : ''}above the ${majority} needed for a majority` : '';
  const seats =
    t > 0
      ? `The party now holds ${t} of the ${GENERAL_SEATS} constituency seats${r > 0 ? `; with the reserved seats for women, it has ${n} members in Parliament in all` : ''}${beyond}.`
      : `The party holds no constituency seat; it has ${r === 1 ? '1 member in a reserved seat' : `${r} members in reserved seats`} for women.`;
  const held = houseRolesOf(p).map((role, i) => `${i === 0 ? 'The' : 'the'} ${HOUSE_ROLE[role]?.en ?? role}`);
  const list = held.length > 1 ? `${held.slice(0, -1).join(', ')} and ${held[held.length - 1]}` : held[0];
  const offices =
    held.length === 1
      ? `${list} is from this party.`
      : held.length > 1
        ? `${list} are ${held.length === 2 ? 'both' : 'all'} from this party.`
        : '';
  return [seats, offices, "All the party's members and their seats are listed below."].filter(Boolean).join(' ');
}

/** Who founded the party, when and how, what it has done since, who leads it now, and where it stands in this House. */
function ProfileSection({ profile, color, party, t }: { profile: ResolvedProfile; color: string; party: Party; t: T }) {
  const founders = profile.founder ? founderList(profile.founder, t.lang) : [];
  const rows: { label: string; value: React.ReactNode }[] = [
    ...(profile.foundedOn ? [{ label: t('প্রতিষ্ঠা', 'Founded'), value: founded(profile.foundedOn, t) }] : []),
    ...(profile.founder ? [{ label: t('প্রতিষ্ঠাতা', founders.length > 1 ? 'Founders' : 'Founder'), value: profile.founder }] : []),
    ...(profile.symbol ? [{ label: t('নির্বাচনী প্রতীক', 'Electoral symbol'), value: profile.symbol }] : []),
    ...(profile.secretaryName
      ? [{ label: profile.secretaryTitle ?? t('দ্বিতীয় পদ', 'Second-ranking office'), value: <Person name={profile.secretaryName} memberId={profile.secretaryMemberId} /> }]
      : []),
    ...(profile.headquarters ? [{ label: t('প্রধান কার্যালয়', 'Headquarters'), value: profile.headquarters }] : []),
    ...(profile.website
      ? [{
          label: t('ওয়েবসাইট', 'Website'),
          value: (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline break-all">
              {profile.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          ),
        }]
      : []),
  ];
  const story = paragraphs(profile.origin);
  const majority = statistics().majority;
  const inParliament = t.en ? inParliamentEn(party, majority) : inParliamentBn(party, majority);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 items-start">
      <Card className="p-6 sm:p-8 flex flex-col gap-4">
        <h2 className="display text-[22px] sm:text-[24px] flex items-center gap-2.5">
          <span aria-hidden="true" className="w-1.5 h-[0.85em] rounded-full shrink-0" style={{ background: color }} />
          {t('দলের পরিচিতি', 'About the party')}
        </h2>
        {profile.summary && (
          <p className="text-[17px] sm:text-[18.5px] leading-relaxed font-semibold text-ink text-pretty">
            {profile.summary}{' '}
            {t(
              `ত্রয়োদশ সংসদে দলটির সদস্য ${t.n(party.seats)} জন।`,
              `It has ${t.count(party.seats, '', 'member', 'members')} in the 13th Parliament.`,
            )}
          </p>
        )}
        {story.map((s, i) => (
          <p key={i} className="text-[15.5px] sm:text-[16.5px] leading-[1.9] text-inksoft text-pretty">{s}</p>
        ))}
        <div className="flex flex-col gap-2 pt-1">
          <h3 className="display text-[18px] sm:text-[19.5px]">{t('ত্রয়োদশ সংসদে', 'In the 13th Parliament')}</h3>
          <p className="text-[15.5px] sm:text-[16.5px] leading-[1.9] text-inksoft text-pretty">{inParliament}</p>
        </div>
        <p className="mt-1 pt-4 border-t border-rulesoft text-[12.5px] text-muted leading-relaxed">
          {t('সূত্র:', 'Sources:')}{' '}
          {profile.sources.map((u, i) => (
            <span key={u}>
              {i > 0 && ', '}
              <a href={u} target="_blank" rel="noopener noreferrer" className="underline decoration-rule underline-offset-2 hover:text-brand">
                {sourceLabel(u, t)}
              </a>
            </span>
          ))}
          {profile.sources.length > 0 && t(' (দলের ইতিহাস); ', ' (party history); ')}
          <a href="https://www.parliament.gov.bd/" target="_blank" rel="noopener noreferrer" className="underline decoration-rule underline-offset-2 hover:text-brand">
            {t('বাংলাদেশ জাতীয় সংসদ', 'Parliament of Bangladesh')}
          </a>{' '}
          {t('(বর্তমান সদস্য ও পদ)।', '(current members and offices).')}
          {profile.checked && <> {t(`সর্বশেষ যাচাই ${t.date(profile.checked)}।`, `Last checked ${t.date(profile.checked)}.`)}</>}
          {profile.edited && <> {t('কিছু তথ্য আমার এমপির সম্পাদক হালনাগাদ করেছেন।', "Some of this information has been updated by My MP's editors.")}</>}
        </p>
      </Card>

      <div className="flex flex-col gap-4">
        <LeaderCard profile={profile} color={color} t={t} />
        {rows.length > 0 && (
          <Card className="p-5 sm:p-6">
            <h3 className="text-[12px] font-bold tracking-[1px] text-muted mb-3">{t('এক নজরে', 'At a glance')}</h3>
            <dl className="flex flex-col divide-y divide-rulesoft text-[14.5px]">
              {rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-muted shrink-0">{r.label}</dt>
                  <dd className="text-end min-w-0">{r.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>
    </section>
  );
}

export default async function PartyPage({ params }: PageProps<'/[lang]/dol/[slug]'>) {
  const { slug } = await params;
  const party = getParty(slug);
  if (!party) notFound();
  const t = await getT();

  const list = membersOfParty(party.abbr);
  const territorial = list.filter((m) => m.seat && !m.seat.reserved);
  const reserved = list.filter((m) => m.seat?.reserved);
  const logo = partyLogo(party.abbr);
  const profile = party.abbr === 'Ind' ? null : partyProfile(party, t.lang);
  const color = partyColor(party.abbr);
  const name = partyName(party, t.lang);

  // A party is a PoliticalParty to search engines; independents are not a party, so they get none.
  const founders = profile?.founder
    ? founderList(profile.founder, t.lang).map((n) =>
        profile.founderKind === 'org' ? { '@type': 'Organization', name: n } : { '@type': 'Person', name: n.replace(/\s*\(.*\)$/, '') },
      )
    : null;
  const partyLd =
    party.abbr === 'Ind'
      ? null
      : {
          '@context': 'https://schema.org',
          '@type': 'PoliticalParty',
          name: nameOf(party, t),
          alternateName: [party.nameBn, party.nameEn, party.abbr].filter(Boolean),
          url: `${siteUrl}${t.href(`/dol/${party.slug}`)}`,
          ...(logo?.kind === 'logo' ? { logo: `${siteUrl}${logo.src}` } : {}),
          ...(profile?.foundedOn ? { foundingDate: profile.foundedOn } : {}),
          ...(founders ? { founder: founders } : {}),
          ...(profile?.summary ? { description: profile.summary } : {}),
          ...(profile?.website ? { sameAs: [profile.website] } : {}),
        };

  return (
    <Page>
      {partyLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(partyLd) }} />}
      <Breadcrumb items={[{ href: '/', label: t('হোম', 'Home') }, { href: '/dol', label: t('দল', 'Parties') }, { label: name }]} />

      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={name}
        lede={t.en ? undefined : party.nameEn ?? undefined}
        mark={<PartyMark abbr={party.abbr} size={76} />}
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('মোট আসন', 'Total seats')} value={t.n(party.seats)} />
            <Stat label={t('নির্বাচিত', 'Elected')} value={t.n(party.seatsTerritorial)} />
            <Stat label={t('সংরক্ষিত', 'Reserved')} value={t.n(party.seatsReserved)} />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href(`/dol/${party.slug}`)}`}
          title={`${name} | ${t('আমার এমপি', 'My MP')}`}
          text={
            profile?.summary
              ? `${name}: ${profile.summary}`
              : t(
                  `${name}: ত্রয়োদশ জাতীয় সংসদে ${t.n(party.seats)}টি আসন`,
                  `${name}: ${t.count(party.seats, '', 'seat', 'seats')} in the 13th Parliament`,
                )
          }
        />
      </div>

      <div className="mt-6 h-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />

      <div className="pt-8 pb-14 flex flex-col gap-10">
        {profile && <ProfileSection profile={profile} color={color} party={party} t={t} />}
        {party.abbr === 'Ind' && (
          <p className="text-[15.5px] text-inksoft leading-relaxed max-w-[720px]">
            {t(
              'স্বতন্ত্র কোনো রাজনৈতিক দল নয়: এই সংসদ সদস্যরা কোনো দলের প্রার্থী হিসেবে নির্বাচিত হননি, তাই এখানে দলের পরিচিতি নেই।',
              'Independents are not a political party: these Members of Parliament were not elected as the candidates of any party, so there is no party profile here.',
            )}
          </p>
        )}

        {territorial.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="display text-[24px] font-bold">
              {t('আসন থেকে নির্বাচিত', 'Elected from constituencies')}{' '}
              <span className="text-muted font-semibold text-[19px]">({t.n(territorial.length)})</span>
            </h2>
            <MemberList list={territorial} t={t} />
          </section>
        )}

        {reserved.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="display text-[24px] font-bold">
              {t('সংরক্ষিত নারী আসন', 'Reserved seats for women')}{' '}
              <span className="text-muted font-semibold text-[19px]">({t.n(reserved.length)})</span>
            </h2>
            <MemberList list={reserved} t={t} />
          </section>
        )}

        {logo && (
          <p className="text-[13px] text-muted">
            {logo.kind === 'flag' ? t('দলের পতাকা', 'Party flag') : t('দলের লোগো', 'Party logo')}: <LogoCredit abbr={party.abbr} />
          </p>
        )}
      </div>
    </Page>
  );
}

export const dynamicParams = false;
