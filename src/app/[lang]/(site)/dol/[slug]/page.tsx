import type { Metadata } from 'next';
import Link from 'next/link';
import { shareGraph, shareTwitter, cardImage } from '@/lib/seo';
import { notFound } from 'next/navigation';
import {
  parties, getParty, membersOfParty, getMemberById, bn, dateBn, partyColor, initial, statistics, OFFICE_LABELS, GENERAL_SEATS, type Party, type Member,
} from '@/lib/data';
import { rolesOf, officers, ROLE_LABELS } from '@/lib/activity';
import { Page, PageHead, Card, Stat, MemberRow, Breadcrumb, PartyMark, LogoCredit } from '@/components/ui';
import MemberPhoto from '@/components/MemberPhoto';
import ShareButtons from '@/components/ShareButtons';
import { partyLogo } from '@/lib/partyLogos';
import { partyProfile, foundedYear, paragraphs, type ResolvedProfile } from '@/lib/partyProfiles';
import { partyBn, charCount, DESCRIPTION_MAX } from '@/lib/seo/mpDescription';
import { siteUrl } from '@/lib/site';

export function generateStaticParams() {
  return parties.map((p) => ({ slug: p.slug }));
}

/**
 * A party's members: the first dozen, the rest one tap away. All stay in the
 * page for search engines; a phone no longer scrolls past 246 cards.
 */
function MemberList({ list }: { list: Member[] }) {
  const SHOWN = 12;
  const grid = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3';
  return (
    <>
      <ul className={grid}>{list.slice(0, SHOWN).map((m) => <li key={m.id}><MemberRow m={m} /></li>)}</ul>
      {list.length > SHOWN && (
        <details className="group flex flex-col">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer self-start inline-flex items-center gap-2 h-11 px-5 rounded-full border border-ink font-semibold text-[15px] hover:bg-surface transition-colors">
            <span className="group-open:hidden">আরও {bn(list.length - SHOWN)} জন দেখুন</span>
            <span className="hidden group-open:inline">কম দেখুন</span>
          </summary>
          <ul className={`${grid} mt-3`}>{list.slice(SHOWN).map((m) => <li key={m.id}><MemberRow m={m} /></li>)}</ul>
        </details>
      )}
    </>
  );
}

/** "১ সেপ্টেম্বর ১৯৭৮", or "১৯৭৮ সাল" when only the year is on record. */
const foundedBn = (on: string) => (/^\d{4}$/.test(on) ? `${bn(on)} সাল` : dateBn(on) ?? on);

/** The party's preview card (/api/og/party/[slug]); independents keep the site's image. */
const shareCard = (p: { abbr: string; slug: string; nameBn: string | null }) =>
  p.abbr === 'Ind'
    ? null
    : cardImage(`/api/og/party/${p.slug}`, p.nameBn ?? p.abbr);

export async function generateMetadata({ params }: PageProps<'/[lang]/dol/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const p = getParty(slug);
  if (!p) return { title: 'দল পাওয়া যায়নি' };
  const name = partyBn(p)?.name ?? p.nameBn ?? p.abbr;
  const profile = partyProfile(p);
  const year = foundedYear(profile);
  const tail = `ত্রয়োদশ জাতীয় সংসদে দলটির ${bn(p.seats)}টি আসন; সব সংসদ সদস্যের নাম, আসন ও ছবি এই পাতায়।`;
  // Founding and the current head first, when the whole sentence still fits the length search engines show.
  const full = year
    ? `${name} ${bn(year)} সালে প্রতিষ্ঠিত${profile?.leaderNameBn ? `; ${profile.leaderTitleBn ?? 'প্রধান'} ${profile.leaderNameBn}` : ''}। ${tail}`
    : null;
  const short = year ? `${name} ${bn(year)} সালে প্রতিষ্ঠিত। ${tail}` : null;
  const description =
    p.abbr === 'Ind'
      ? `ত্রয়োদশ জাতীয় সংসদে ${bn(p.seats)} জন স্বতন্ত্র সংসদ সদস্য আছেন। তাঁদের নাম, আসন, জেলা ও ছবিসহ তালিকা এই পাতায়।`
      : [full, short].find((d) => d && charCount(d) <= DESCRIPTION_MAX) ??
        `${name} ত্রয়োদশ জাতীয় সংসদে ${bn(p.seats)}টি আসনে প্রতিনিধিত্ব করছে। দলের সব সংসদ সদস্যের নাম, আসন, জেলা ও ছবিসহ তালিকা এই পাতায়।`;
  const card = shareCard(p);
  return {
    title: p.nameBn ?? p.abbr,
    alternates: { canonical: `/dol/${p.slug}` },
    openGraph: shareGraph(`/dol/${p.slug}`, card),
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

/** The party's head: photo, office in the party, and any office in the House, linked when they are a member. */
function LeaderCard({ profile, color }: { profile: ResolvedProfile; color: string }) {
  if (!profile.leaderNameBn) return null;
  const m = profile.leaderMemberId ? getMemberById(profile.leaderMemberId) : undefined;
  const roles = m ? [...new Set([...m.offices.map((o) => OFFICE_LABELS[o] ?? o), ...rolesOf(m.id)])] : [];
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
          {profile.leaderNameBn.replace(/^(মাওলানা|সৈয়দ|মুফতি)\s+/, '').charAt(0)}
        </span>
      )}
      <span className="flex flex-col gap-1 min-w-0">
        <span className="text-[12px] font-bold tracking-[1px] text-muted">দলপ্রধান, {profile.leaderTitleBn ?? 'প্রধান'}</span>
        <span className="display text-[19px] leading-snug">{profile.leaderNameBn}</span>
        {roles.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <span key={r} className="px-2 py-0.5 rounded-full bg-ink text-white text-[11.5px] font-bold">{r}</span>
            ))}
          </span>
        )}
        {m?.seat && (
          <span className="text-[13px] text-muted">
            {m.seat.reserved ? 'সংরক্ষিত নারী আসনের সংসদ সদস্য' : `${m.seat.nameBn} আসনের সংসদ সদস্য`}
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

const sourceLabel = (url: string) =>
  url.includes('bn.wikipedia.org') ? 'বাংলা উইকিপিডিয়া' : url.includes('en.wikipedia.org') ? 'ইংরেজি উইকিপিডিয়া' : new URL(url).hostname;

const HOUSE_ROLES = ['SPEAKER', 'DEPUTY_SPEAKER', 'LEADER_OF_HOUSE', 'OPPOSITION_LEADER'];
const ALL_OF = ['', '', 'দুজনই', 'তিনজনই', 'চারজনই'];

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
  const held = HOUSE_ROLES.filter((role) =>
    officers.some((o) => o.role === role && !!o.memberId && getMemberById(o.memberId)?.party?.abbr === p.abbr),
  ).map((role) => ROLE_LABELS[role] ?? role);
  const offices =
    held.length === 1
      ? `${held[0]} এই দলের।`
      : held.length > 1
        ? `${held.slice(0, -1).join(', ')} ও ${held[held.length - 1]} ${ALL_OF[held.length]} এই দলের।`
        : '';
  return [seats, offices, 'দলের সব সদস্যের তালিকা ও আসন নিচে।'].filter(Boolean).join(' ');
}

/** Who founded the party, when and how, what it has done since, who leads it now, and where it stands in this House. */
function ProfileSection({ profile, color, party }: { profile: ResolvedProfile; color: string; party: Party }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    ...(profile.foundedOn ? [{ label: 'প্রতিষ্ঠা', value: foundedBn(profile.foundedOn) }] : []),
    ...(profile.founderBn ? [{ label: 'প্রতিষ্ঠাতা', value: profile.founderBn }] : []),
    ...(profile.symbolBn ? [{ label: 'নির্বাচনী প্রতীক', value: profile.symbolBn }] : []),
    ...(profile.secretaryNameBn
      ? [{ label: profile.secretaryTitleBn ?? 'দ্বিতীয় পদ', value: <Person name={profile.secretaryNameBn} memberId={profile.secretaryMemberId} /> }]
      : []),
    ...(profile.headquartersBn ? [{ label: 'প্রধান কার্যালয়', value: profile.headquartersBn }] : []),
    ...(profile.website
      ? [{
          label: 'ওয়েবসাইট',
          value: (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline break-all">
              {profile.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          ),
        }]
      : []),
  ];
  const story = paragraphs(profile.originBn);
  const inParliament = inParliamentBn(party, statistics().majority);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 items-start">
      <Card className="p-6 sm:p-8 flex flex-col gap-4">
        <h2 className="display text-[22px] sm:text-[24px] flex items-center gap-2.5">
          <span aria-hidden="true" className="w-1.5 h-[0.85em] rounded-full shrink-0" style={{ background: color }} />
          দলের পরিচিতি
        </h2>
        {profile.summaryBn && (
          <p className="text-[17px] sm:text-[18.5px] leading-relaxed font-semibold text-ink text-pretty">
            {profile.summaryBn} ত্রয়োদশ সংসদে দলটির সদস্য {bn(party.seats)} জন।
          </p>
        )}
        {story.map((t, i) => (
          <p key={i} className="text-[15.5px] sm:text-[16.5px] leading-[1.9] text-inksoft text-pretty">{t}</p>
        ))}
        <div className="flex flex-col gap-2 pt-1">
          <h3 className="display text-[18px] sm:text-[19.5px]">ত্রয়োদশ সংসদে</h3>
          <p className="text-[15.5px] sm:text-[16.5px] leading-[1.9] text-inksoft text-pretty">{inParliament}</p>
        </div>
        <p className="mt-1 pt-4 border-t border-rulesoft text-[12.5px] text-muted leading-relaxed">
          সূত্র:{' '}
          {profile.sources.map((u, i) => (
            <span key={u}>
              {i > 0 && ', '}
              <a href={u} target="_blank" rel="noopener noreferrer" className="underline decoration-rule underline-offset-2 hover:text-brand">
                {sourceLabel(u)}
              </a>
            </span>
          ))}
          {profile.sources.length > 0 && ' (দলের ইতিহাস); '}
          <a href="https://www.parliament.gov.bd/" target="_blank" rel="noopener noreferrer" className="underline decoration-rule underline-offset-2 hover:text-brand">
            বাংলাদেশ জাতীয় সংসদ
          </a>{' '}
          (বর্তমান সদস্য ও পদ)।
          {profile.checked && <> সর্বশেষ যাচাই {dateBn(profile.checked)}।</>}
          {profile.edited && <> কিছু তথ্য আমার এমপির সম্পাদক হালনাগাদ করেছেন।</>}
        </p>
      </Card>

      <div className="flex flex-col gap-4">
        <LeaderCard profile={profile} color={color} />
        {rows.length > 0 && (
          <Card className="p-5 sm:p-6">
            <h3 className="text-[12px] font-bold tracking-[1px] text-muted mb-3">এক নজরে</h3>
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

  const list = membersOfParty(party.abbr);
  const territorial = list.filter((m) => m.seat && !m.seat.reserved);
  const reserved = list.filter((m) => m.seat?.reserved);
  const logo = partyLogo(party.abbr);
  const profile = party.abbr === 'Ind' ? null : partyProfile(party);
  const color = partyColor(party.abbr);
  const name = party.nameBn ?? party.abbr;

  // A party is a PoliticalParty to search engines; independents are not a party, so they get none.
  const founders = profile?.founderBn
    ? profile.founderBn.split(' ও ').map((n) =>
        profile.founderKind === 'org' ? { '@type': 'Organization', name: n } : { '@type': 'Person', name: n.replace(/\s*\(.*\)$/, '') },
      )
    : null;
  const partyLd =
    party.abbr === 'Ind'
      ? null
      : {
          '@context': 'https://schema.org',
          '@type': 'PoliticalParty',
          name: partyBn(party)?.name ?? name,
          alternateName: [party.nameBn, party.nameEn, party.abbr].filter(Boolean),
          url: `${siteUrl}/dol/${party.slug}`,
          ...(logo?.kind === 'logo' ? { logo: `${siteUrl}${logo.src}` } : {}),
          ...(profile?.foundedOn ? { foundingDate: profile.foundedOn } : {}),
          ...(founders ? { founder: founders } : {}),
          ...(profile?.summaryBn ? { description: profile.summaryBn } : {}),
          ...(profile?.website ? { sameAs: [profile.website] } : {}),
        };

  return (
    <Page>
      {partyLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(partyLd) }} />}
      <Breadcrumb items={[{ href: '/', label: 'হোম' }, { href: '/dol', label: 'দল' }, { label: name }]} />

      <PageHead
        eyebrow="ত্রয়োদশ জাতীয় সংসদ"
        title={name}
        lede={party.nameEn ?? undefined}
        mark={<PartyMark abbr={party.abbr} size={76} />}
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Stat label="মোট আসন" value={bn(party.seats)} />
            <Stat label="নির্বাচিত" value={bn(party.seatsTerritorial)} />
            <Stat label="সংরক্ষিত" value={bn(party.seatsReserved)} />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}/dol/${party.slug}`}
          title={`${name} | আমার এমপি`}
          text={
            profile?.summaryBn
              ? `${name}: ${profile.summaryBn}`
              : `${name}: ত্রয়োদশ জাতীয় সংসদে ${bn(party.seats)}টি আসন`
          }
        />
      </div>

      <div className="mt-6 h-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />

      <div className="pt-8 pb-14 flex flex-col gap-10">
        {profile && <ProfileSection profile={profile} color={color} party={party} />}
        {party.abbr === 'Ind' && (
          <p className="text-[15.5px] text-inksoft leading-relaxed max-w-[720px]">
            স্বতন্ত্র কোনো রাজনৈতিক দল নয়: এই সংসদ সদস্যরা কোনো দলের প্রার্থী হিসেবে নির্বাচিত হননি, তাই এখানে দলের পরিচিতি নেই।
          </p>
        )}

        {territorial.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="display text-[24px] font-bold">
              আসন থেকে নির্বাচিত <span className="text-muted font-semibold text-[19px]">({bn(territorial.length)})</span>
            </h2>
            <MemberList list={territorial} />
          </section>
        )}

        {reserved.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="display text-[24px] font-bold">
              সংরক্ষিত নারী আসন <span className="text-muted font-semibold text-[19px]">({bn(reserved.length)})</span>
            </h2>
            <MemberList list={reserved} />
          </section>
        )}

        {logo && (
          <p className="text-[13px] text-muted">
            {logo.kind === 'flag' ? 'দলের পতাকা' : 'দলের লোগো'}: <LogoCredit abbr={party.abbr} />
          </p>
        )}
      </div>
    </Page>
  );
}

export const dynamicParams = false;
