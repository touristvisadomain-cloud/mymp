/**
 * The House for the app: its sessions and sittings (/odhibeshon), its
 * committees (/committee, /committee/x) and the parties (/dol/x), each with
 * the facts the website's page shows.
 */
import {
  meta, parties, committees, getCommittee, getMemberById, getParty, membersOfParty, committeeCounts, bnText, partyColor, partyShortBn,
} from '@/lib/data';
import {
  sessions, officers, parliament, sessionLabel, generalNotices, noticesForCommittee, latestSitting, totalSittings, ROLE_LABELS,
  NOTICE_CATEGORY_BN, NOTICE_CATEGORY_EN,
} from '@/lib/activity';
import { weekdayOf, sittingTitleEn, circularTitleEn, tidyEn, officerNameEn, tenureEn } from '@/lib/sessionsView';
import { committeeDuty, committeeTitle, typeName, RULES_URL } from '@/lib/committeeDuties';
import { partyProfile, paragraphs } from '@/lib/partyProfiles';
import { partyLogo, logoLicence } from '@/lib/partyLogos';
import { siteUrl } from '@/lib/site';
import { sourceLabel } from '@/lib/sourceLabel';
import { brief } from '@/lib/app/payload';
import { enOnly, inResponse } from '@/lib/app/respond';
import { makeT, type Lang } from '@/i18n/core';
import { HOUSE_ROLE, committeeRole, partyName, partyShort } from '@/i18n/names';

/* ---------------- sessions ---------------- */

/** The sessions page (/odhibeshon): every session with its sittings and circulars, the general notices and the presiding officers. */
export function sessionsView(lang: Lang = 'bn') {
  const t = makeT(lang);
  const en = lang === 'en';
  return {
    version: meta.builtAt,
    lang,
    parliament: {
      no: parliament.no,
      electionDate: parliament.electionDate,
      gazetteDate: parliament.gazetteDate,
      oathDate: parliament.oathDate,
      endDate: parliament.endDate,
    },
    counts: { sessions: sessions.length, sittings: totalSittings() },
    lastSittingDate: latestSitting()?.date ?? null,
    /** Newest first; the first is the current session (the source does not close sessions). */
    sessions: sessions.map((s) => ({
      id: s.id,
      titleBn: sessionLabel(s, lang),
      startDate: s.startDate,
      endDate: s.endDate,
      /** Newest first: the n-th sitting of the session is sittings[length - n]. */
      sittings: s.sittings.map((o) => ({
        id: o.id,
        titleBn: en ? sittingTitleEn(t, o) : o.titleBn,
        date: o.date,
        weekdayBn: o.date ? weekdayOf(t, o.date) : null,
        pdfUrl: o.pdfUrl,
      })),
      circulars: s.circulars.map((c) => ({
        no: c.no,
        titleBn: en ? circularTitleEn(c) : c.titleBn ?? `পরিপত্র ${c.no ?? ''}`,
        date: c.date,
        pdfUrl: c.pdfUrl,
      })),
    })),
    /** The Parliament Secretariat's notices that name no member or committee, newest first. */
    generalNotices: generalNotices().map((n) => ({
      id: n.id,
      titleBn: en ? tidyEn(n.titleEn) || null : bnText(n.titleBn) ?? n.titleEn,
      date: n.date,
      categoryBn: n.category ? (en ? NOTICE_CATEGORY_EN : NOTICE_CATEGORY_BN)[n.category] ?? inResponse(n.category, lang) : null,
      pdfUrl: n.pdfUrl,
    })),
    /** The presiding officers, leaders and whips. */
    officers: officers.map((o) => {
      const m = o.memberId ? getMemberById(o.memberId) : undefined;
      return {
        role: o.role,
        roleBn: en ? HOUSE_ROLE[o.role]?.en ?? enOnly(o.role) : ROLE_LABELS[o.role] ?? o.role,
        member: m ? brief(m, lang) : null,
        nameBn: en ? enOnly(officerNameEn(o)) : o.nameBn ?? o.nameEn,
        tenureBn: en ? tenureEn(o.tenureBn) : o.tenureBn,
      };
    }),
  };
}

/* ---------------- committees ---------------- */

type CommitteeRow = (typeof committees)[number];

const committeeLabel = (c: CommitteeRow, lang: Lang) => (lang === 'en' ? enOnly(committeeTitle(c, 'en')) : c.nameBn ?? c.nameEn);

/** The committee list (/committee): up-to-date committees first, as the page has them. */
export function committeeList(lang: Lang = 'bn') {
  const cc = committeeCounts();
  const ordered = [...committees.filter((c) => c.rosterCurrent), ...committees.filter((c) => !c.rosterCurrent)];
  return {
    version: meta.builtAt,
    lang,
    total: cc.total,
    current: cc.current,
    /** MPs on at least one up-to-date committee. */
    membersOnCommittees: new Set(committees.filter((c) => c.rosterCurrent).flatMap((c) => c.members.map((m) => m.memberId))).size,
    committees: ordered.map((c) => {
      const chair = c.members.find((x) => x.role === 'Chairman');
      const chairMember = chair ? getMemberById(chair.memberId) : undefined;
      return {
        slug: c.slug,
        nameBn: committeeLabel(c, lang),
        nameEn: c.nameEn,
        type: c.type,
        typeBn: typeName(c.type, lang),
        /** False while the member list is still the previous parliament's. */
        rosterCurrent: c.rosterCurrent,
        memberCount: c.memberCount,
        startDate: c.startDate,
        chair: c.rosterCurrent && chairMember ? brief(chairMember, lang) : null,
        /** What the committee does, in a sentence or two, where the Rules of Procedure say. */
        summaryBn: committeeDuty(c, committees, lang)?.summary ?? null,
      };
    }),
  };
}

/** One committee (/committee/<slug>): its duty under the Rules of Procedure, its members and its notices. */
export function committeeDetail(slug: string, lang: Lang = 'bn') {
  const c = getCommittee(slug);
  if (!c) return null;
  const en = lang === 'en';
  const duty = committeeDuty(c, committees, lang);
  // The chair first, then the members in the source's order, as the page lists them.
  const rows = [...c.members.filter((x) => x.role === 'Chairman'), ...c.members.filter((x) => x.role !== 'Chairman')]
    .map((x) => ({ role: x.role, m: getMemberById(x.memberId) }))
    .filter((x): x is { role: string; m: NonNullable<ReturnType<typeof getMemberById>> } => !!x.m);
  return {
    version: meta.builtAt,
    lang,
    slug: c.slug,
    nameBn: committeeLabel(c, lang),
    nameEn: c.nameEn,
    type: c.type,
    typeBn: typeName(c.type, lang),
    rosterCurrent: c.rosterCurrent,
    memberCount: c.memberCount,
    startDate: c.startDate,
    previousStartDate: c.previousStartDate ?? null,
    duty: duty
      ? {
          summaryBn: duty.summary,
          dutiesBn: duty.duties,
          noteBn: duty.note ?? null,
          /** Where in the Rules of Procedure: "বিধি ২৩৩-২৩৪" / "Rules 233-234". */
          ruleBn: duty.rule,
          rulesUrl: RULES_URL,
          parent: duty.parent ? { slug: duty.parent.slug, nameBn: duty.parent.name } : null,
        }
      : null,
    /** The chair first. Empty while the list is still the previous parliament's: those are not this House's members (the page shows none). */
    members: (c.rosterCurrent ? rows : []).map(({ role, m }) => ({ role, roleBn: inResponse(committeeRole(role, lang), lang), member: brief(m, lang) })),
    notices: noticesForCommittee(c.id).map((n) => ({
      id: n.id,
      titleBn: en ? tidyEn(n.titleEn) || null : bnText(n.titleBn) ?? n.titleEn,
      date: n.date,
      pdfUrl: n.pdfUrl,
    })),
  };
}

/* ---------------- parties ---------------- */

/** One party (/dol/<slug>): its profile, logo, seats and members. */
export function partyDetail(slug: string, lang: Lang = 'bn') {
  const p = getParty(slug);
  if (!p) return null;
  const en = lang === 'en';
  const list = membersOfParty(p.abbr);
  const profile = p.abbr === 'Ind' ? null : partyProfile(p, lang);
  const logo = partyLogo(p.abbr);
  const person = (id: string | undefined) => {
    const m = id ? getMemberById(id) : undefined;
    return m ? brief(m, lang) : null;
  };
  return {
    version: meta.builtAt,
    lang,
    abbr: p.abbr,
    slug: p.slug,
    nameBn: en ? enOnly(partyName(p, 'en')) : p.nameBn,
    nameEn: p.nameEn,
    shortBn: en ? partyShort(p, 'en') : partyShortBn(p) ?? p.abbr,
    color: partyColor(p.abbr),
    seats: p.seats,
    seatsTerritorial: p.seatsTerritorial,
    seatsReserved: p.seatsReserved,
    profile: profile
      ? {
          summaryBn: profile.summary ?? null,
          /** The party's story, paragraph by paragraph. */
          originBn: paragraphs(profile.origin),
          /** YYYY-MM-DD, or YYYY when only the year is known. */
          foundedOn: profile.foundedOn ?? null,
          founderBn: profile.founder ?? null,
          founderKind: profile.founderKind ?? null,
          symbolBn: profile.symbol ?? null,
          leaderTitleBn: profile.leaderTitle ?? null,
          leaderNameBn: profile.leaderName ?? null,
          leader: person(profile.leaderMemberId),
          secretaryTitleBn: profile.secretaryTitle ?? null,
          secretaryNameBn: profile.secretaryName ?? null,
          secretary: person(profile.secretaryMemberId),
          headquartersBn: profile.headquarters ?? null,
          website: profile.website ?? null,
          sources: profile.sources.map((url) => ({ url, label: sourceLabel(url, lang) })),
          checked: profile.checked || null,
          /** An editor has changed the profile, so it is not all from the cited sources. */
          edited: profile.edited,
        }
      : null,
    logo: logo
      ? {
          url: `${siteUrl}${logo.src}`,
          width: logo.width,
          height: logo.height,
          kind: logo.kind,
          /** The file's page on Wikimedia: the credit link. */
          page: logo.page,
          licenceBn: logoLicence(logo, lang),
          licenceUrl: logo.licenceUrl ?? null,
          author: logo.author ?? null,
        }
      : null,
    /** Elected members in seat order, then the members for reserved seats. */
    members: [...list.filter((m) => m.seat && !m.seat.reserved), ...list.filter((m) => m.seat?.reserved)].map((m) => brief(m, lang)),
  };
}

/** Every party's slug and every committee's, for the routes' prerendering. */
export const partySlugs = () => parties.map((p) => p.slug);
export const committeeSlugs = () => committees.map((c) => c.slug);
