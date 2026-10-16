/**
 * What the mobile app is given.
 *
 * The app is a reader, so this is a read-only, unauthenticated, versioned view
 * of exactly what mymp.bd already publishes on its own pages — no more. A
 * member's home address and mobile number are in the source data and on
 * neither; they are not here either, and the shaping below is the only place
 * that decides so.
 *
 * `version` is the build stamp. The app keeps the last bootstrap it fetched and
 * only replaces it when this changes, so a phone on a slow connection opens
 * instantly and a corrected name still reaches it within the hour.
 *
 * Every function takes the response's language. The field names are the ones
 * the first app versions read (`nameBn`, `seatBn`…): on an English response
 * they hold the English, and a text with no English yet is null, never the
 * Bangla in its place (lib/app/respond.ts, docs/app-api.md).
 */
import {
  members, resignedMembers, parties, meta, getMember, getSeat, committeesOfMember, governmentPostsOf, committeeCounts,
  districtOf, partyColor, partyShortBn, currentPosts, posts, bnText, OFFICE_LABELS, type Member, type PostEntry,
} from '@/lib/data';
import { districtList } from '@/lib/districts';
import { priorTermsOf, socialsOf, facebookNotice, parliamentLabel, type SeatResult } from '@/lib/history';
import { officers, noticesForMember, NOTICE_CATEGORY_BN, NOTICE_CATEGORY_EN } from '@/lib/activity';
import { adviserForPost, getAdviser, adviserPosts, adviserName, adviserRole, rankIn } from '@/lib/advisers';
import { sourceList, sourceLabel } from '@/lib/sourceLabel';
import { nameOf, changes } from '@/lib/cabinet';
import { memberRoles, memberText, postBadges, postEn } from '@/lib/memberProfile';
import { candidateNameEn, resultNote, sourceOf } from '@/lib/resultsView';
import { inLang, translated } from '@/i18n/content';
import {
  personName, seatName, districtName, districtNameEn, partyName, partyShort, partyByAbbr, committeeName, committeeRole,
  OFFICE, HOUSE_ROLE, govPost, titleCaseName,
} from '@/i18n/names';
import type { Lang } from '@/i18n/core';
import { enOnly, inResponse } from '@/lib/app/respond';
import { CABINET_PAGE_FOR_READERS } from '../../../config/sync-sources';
import upazilaEn from '../../../data/upazila-en.json';

export interface AppParty {
  abbr: string;
  slug: string;
  nameBn: string | null;
  nameEn: string | null;
  color: string;
  seats: number;
  /** "বিএনপি": what a chip on a phone has room for. */
  shortBn: string;
}

export interface AppMemberBrief {
  id: string;
  slug: string;
  nameBn: string;
  nameEn: string | null;
  photoUrl: string | null;
  gender: string | null;
  party: string | null;
  /** The party's short Bengali name, because a Bengali app should not read "BNP". */
  partyBn: string | null;
  seatNo: number | null;
  seatBn: string | null;
  seatSlug: string | null;
  /** "Dhaka-17", for a reader who searches in English. */
  seatEn: string | null;
  districtBn: string | null;
  districtEn: string | null;
  /** The district's page (/jela/<slug>) and the app's district screen. */
  districtSlug: string | null;
  /** The upazilas and wards the seat covers, so a search for one finds its member. Bangla in both languages: never shown. */
  areaBn: string | null;
  /** "প্রধানমন্ত্রী", "স্পিকার", a ministry — whatever the site shows beside the name. */
  officeBn: string | null;
  reserved: boolean;
  /** English answers only: the Bangla name, seat and district beside the English ones, so a search in either script finds the member. */
  nameAlt?: string | null;
  seatAlt?: string | null;
  districtAlt?: string | null;
}

/** "a, b and c" / "ক, খ এবং গ" */
const listOf = (items: string[], lang: Lang) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')}${lang === 'en' ? ' and ' : ' এবং '}${items[items.length - 1]}` : (items[0] ?? '');

/**
 * What the member holds, in Bengali: a House office first (the source stores
 * those as codes, "pm", "speaker"), then a post on the cabinet list, then an
 * editor's entry. A code must never reach a reader: the app once showed "pm".
 *
 * A minister's post names the ministry, as Bangla readers say it: "পানি সম্পদ
 * প্রতিমন্ত্রী", "শিল্প, বস্ত্র ও পাট এবং বাণিজ্য মন্ত্রী". A bare "প্রতিমন্ত্রী" left
 * the reader asking of what. In English: "State Minister, Ministry of Water
 * Resources", the member page's badge.
 */
const office = (m: Member, lang: Lang): string | null => {
  if (lang === 'en') {
    const house = (m.offices ?? []).map((o) => OFFICE[o]?.en).find(Boolean);
    if (house) return house;
    const held = governmentPostsOf(m.id);
    if (held.length) return postTitleEn(held);
    return enOnly(govPost(m.govPost, 'en'));
  }
  const house = (m.offices ?? []).map((o) => OFFICE_LABELS[o]).find(Boolean);
  if (house) return house;
  const held = governmentPostsOf(m.id);
  if (held.length) return postTitle(held);
  return m.govPost ?? null;
};

export function postTitle(posts: { title: string; ministryBn?: string | null }[]): string {
  const title = posts[0]!.title;
  // An adviser's "ministry" is the kind of adviser: "রাজনৈতিক উপদেষ্টা".
  if (/উপদেষ্টা/.test(title)) return posts.find((p) => p.ministryBn?.includes('উপদেষ্টা'))?.ministryBn ?? title;
  const names = [...new Set(posts.filter((p) => p.title === title).map((p) => p.ministryBn?.trim()).filter((x): x is string => !!x))]
    .map((n) => n.replace(/\s*মন্ত্রণালয়$/, ''));
  if (!names.length) return title;
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} এবং ${names[names.length - 1]}`;
  // "সেতু বিভাগ" takes the possessive: "সেতু বিভাগের প্রতিমন্ত্রী".
  return /বিভাগ$/.test(list) ? `${list}ের ${title}` : `${list} ${title}`;
}

/**
 * The same post in English: "State Minister, Ministry of Water Resources";
 * every ministry of that rank, when each has an English name, else the rank
 * alone. Null when even the rank has no English.
 */
function postTitleEn(posts: { title: string; ministryBn: string | null }[]): string | null {
  const title = posts[0]!.title;
  if (/উপদেষ্টা/.test(title)) {
    const adviser = posts.find((p) => p.ministryBn?.includes('উপদেষ্টা'));
    return enOnly((adviser && postEn(adviser)) || govPost(title, 'en'));
  }
  const rank = enOnly(govPost(title, 'en'));
  if (!rank) return null;
  const names = [...new Set(posts.filter((p) => p.title === title).map((p) => p.ministryBn?.trim()).filter((x): x is string => !!x))].map((n) =>
    inLang(n, 'en'),
  );
  return names.length && names.every(Boolean) ? `${rank}, ${listOf(names as string[], 'en')}` : rank;
}

/**
 * Parties on the 2026 ballot that won no seat carry codes the party list does
 * not know. Named here where the name is certain; any other code is shown as
 * the source gives it rather than guessed.
 */
const BALLOT_PARTY_BN: Record<string, string> = {
  IAB: 'ইসলামী আন্দোলন',
  'JP(ERSHAD)': 'জাতীয় পার্টি',
  JUIB: 'জমিয়তে উলামায়ে ইসলাম',
  LDP: 'এলডিপি',
  CPB: 'সিপিবি',
  AB: 'এবি পার্টি',
  JSD: 'জাসদ',
  'Bangladesh JaSad': 'জাসদ',
  'Jatiya Samajtantrik Dal-JASAD': 'জাসদ',
  Basad: 'বাসদ',
  'Socialist Party of Bangladesh (Marxist)': 'বাসদ (মার্কসবাদী)',
  'Bangladesh Labour Party': 'বাংলাদেশ লেবার পার্টি',
  'Bangladesh Muslim League': 'বাংলাদেশ মুসলিম লীগ',
  'Bangladesh Congress': 'বাংলাদেশ কংগ্রেস',
  IOJ: 'ইসলামী ঐক্যজোট',
  'Janotar Dol': 'জনতার দল',
  'Amjanatar Dol': 'আমজনতার দল',
};

/** A ballot party's Bengali name, or null when it is not certain. */
export const partyLabelBn = (abbr: string | null | undefined): string | null => {
  if (!abbr) return null;
  const known = parties.find((p) => p.abbr === abbr);
  return known ? partyShortBn(known) ?? abbr : BALLOT_PARTY_BN[abbr] ?? null;
};

/**
 * A ballot party's short name in the response's language: the Bangla above,
 * or the English the result card shows ("BNP", "Islami Andolan"; a code the
 * site has no name for is shown as the source writes it).
 */
export const partyLabel = (abbr: string | null | undefined, lang: Lang): string | null =>
  lang === 'en' ? (abbr ? enOnly(partyByAbbr(abbr, null, 'en', true)) : null) : partyLabelBn(abbr);

export const brief = (m: Member, lang: Lang = 'bn'): AppMemberBrief => {
  const d = m.seat ? districtOf(m.seat) : null;
  const en = lang === 'en';
  return {
    id: m.id,
    slug: m.slug,
    nameBn: en ? personName(m, 'en') : m.nameBn ?? m.nameEn ?? '',
    nameEn: m.nameEn,
    photoUrl: m.photoUrl,
    gender: m.gender,
    party: m.party?.abbr ?? null,
    partyBn: en ? (m.party ? enOnly(partyShort(m.party, 'en')) : null) : partyShortBn(m.party),
    seatNo: m.seat?.no ?? null,
    seatBn: en ? (m.seat ? enOnly(seatName(m.seat, 'en')) : null) : m.seat?.nameBn ?? null,
    seatSlug: m.seat?.slug ?? null,
    seatEn: m.seat?.nameEn ?? null,
    districtBn: en ? (d ? districtName(d, 'en') : null) : d?.bn ?? null,
    districtEn: d?.en ?? null,
    districtSlug: d?.slug ?? null,
    // For search only, so it stays in Bangla, which is what a reader types for a place.
    areaBn: m.seat?.boundaryBn ?? null,
    officeBn: office(m, lang),
    // A member for one of the fifty seats reserved for women (or, as before, one the source lists with no seat).
    reserved: !m.seat || m.seat.reserved,
    ...(en ? { nameAlt: m.nameBn ?? null, seatAlt: m.seat?.nameBn ?? null, districtAlt: d?.bn ?? null } : {}),
  };
};

/** A member's brief with the date they resigned, for the bootstrap's `former` list. */
const formerBrief = (m: Member, lang: Lang) => ({ ...brief(m, lang), resignedOn: m.resignedOn ?? null });

/** Everything the app holds offline: the member list, the parties, the districts. */
export function bootstrap(lang: Lang = 'bn') {
  const en = lang === 'en';
  const seatsByParty = new Map<string, number>();
  for (const m of members) if (m.party?.abbr) seatsByParty.set(m.party.abbr, (seatsByParty.get(m.party.abbr) ?? 0) + 1);

  const named = members.map((m) => (m.seat ? districtOf(m.seat) : null)).filter((x): x is NonNullable<typeof x> => !!x);
  const districts = [...new Set(named.map((d) => (en ? districtName(d, 'en') : d.bn)))].sort((a, b) => a.localeCompare(b, lang));

  return {
    version: meta.builtAt,
    lang,
    parliamentNo: meta.parliamentNo,
    counts: meta.counts,
    parties: parties.map<AppParty>((p) => ({
      abbr: p.abbr,
      slug: p.slug,
      nameBn: en ? enOnly(partyName(p, 'en')) : p.nameBn,
      nameEn: p.nameEn,
      color: partyColor(p.abbr),
      seats: seatsByParty.get(p.abbr) ?? 0,
      shortBn: en ? partyShort(p, 'en') : partyShortBn(p) ?? p.abbr,
    })),
    districts,
    /** The districts in seat order, with their slugs for /api/app/v1/district/<slug>. */
    districtList: districtList().map((d) => ({ slug: d.slug, nameBn: en ? districtName(d, 'en') : d.bn, nameEn: districtNameEn(d.en), seats: d.seats.length })),
    members: members.map((m) => brief(m, lang)),
    /** Members who have resigned: not in the House, but their profiles stay readable. */
    former: resignedMembers.map((m) => formerBrief(m, lang)),
    leaders: leaders(lang),
    /** Upazila names, [English, Bangla], so an English search for an upazila finds its seat. */
    upazilaEn: upazilaEn as [string, string][],
  };
}

/**
 * The House's senior office holders, in the order a reader looks for them:
 * the Prime Minister, the Speaker and Deputy, the Leader of the Opposition,
 * the Chief Whip. The app shows these above the member list.
 */
function leaders(lang: Lang) {
  const order = ['LEADER_OF_HOUSE', 'SPEAKER', 'DEPUTY_SPEAKER', 'OPPOSITION_LEADER', 'CHIEF_WHIP'];
  const out: { roleBn: string; memberId: string }[] = [];
  for (const role of order) {
    for (const o of officers.filter((x) => x.role === role && x.memberId)) {
      const m = members.find((x) => x.id === o.memberId);
      if (!m || out.some((x) => x.memberId === m.id)) continue;
      // The Leader of the House is the Prime Minister, the title readers know; it fits a card's pill.
      const pm = role === 'LEADER_OF_HOUSE' && (m.offices ?? []).includes('pm');
      const roleBn = pm ? OFFICE.pm![lang] : HOUSE_ROLE[role]![lang];
      out.push({ roleBn, memberId: m.id });
    }
  }
  return out;
}

/** Someone on the cabinet list in the response's language; null when their name has no English yet. */
const listedName = (r: Pick<PostEntry, 'memberId' | 'nameBn' | 'nameEn'>, lang: Lang): string | null => {
  const who = nameOf(r, lang);
  return lang === 'en' && who.nameLang === 'bn' ? null : who.name;
};

/** The cabinet, in the order the site's মন্ত্রিসভা page uses. */
export function cabinet(lang: Lang = 'bn') {
  const en = lang === 'en';
  return {
    version: meta.builtAt,
    lang,
    /** When the list was last checked against the Cabinet Division's (ISO instant). */
    checkedAt: posts.checkedAt,
    sourceUrl: CABINET_PAGE_FOR_READERS,
    posts: currentPosts('government').map((p) => {
      const m = p.memberId ? members.find((x) => x.id === p.memberId) : null;
      return {
        title: en ? enOnly(govPost(p.title, 'en')) : p.title,
        ministryBn: inLang(p.ministryBn, lang),
        fromDate: p.fromDate ?? null,
        member: m ? brief(m, lang) : null,
        holderBn: en ? listedName(p, 'en') : p.nameBn,
        photoUrl: m ? m.photoUrl : p.photoUrl ?? null,
        adviserSlug: adviserForPost(p)?.slug ?? null,
        rankNoteBn: rankIn(p.rankNote, lang),
        sourceUrl: p.sourceUrl ?? null,
      };
    }),
    /** On the Cabinet Division's list but not yet placed as an MP or not by an editor. */
    pending: (posts.pending ?? []).map((x) => ({
      titleBn: en ? enOnly(govPost(x.title, 'en')) : x.title,
      // The list writes these names in Bangla only.
      nameBn: en ? null : x.nameBn.replace(/^জনাব\s+/, '').trim(),
      ministries: x.ministries.map((n) => inLang(n, lang)),
    })),
    /** What changed on the list and when, newest first (the page's পরিবর্তন). */
    changes: changes(lang).map((c) => ({
      date: c.date,
      nameBn: en && c.nameLang === 'bn' ? null : c.name,
      memberSlug: c.href?.startsWith('/mp/') ? c.href.slice(4) : null,
      kind: c.kind,
      textBn: inResponse(c.text, lang),
    })),
  };
}

/** A notice in the member's name from the Parliament Secretariat, as the member page lists it. */
const noticeRow = (n: ReturnType<typeof noticesForMember>[number], lang: Lang) => ({
  id: n.id,
  titleBn: lang === 'en' ? enOnly(n.titleEn) : bnText(n.titleBn) ?? n.titleEn,
  date: n.date,
  categoryBn: n.category ? (lang === 'en' ? NOTICE_CATEGORY_EN : NOTICE_CATEGORY_BN)[n.category] ?? inResponse(n.category, lang) : null,
  pdfUrl: n.pdfUrl,
});

/** One member's page, with the same facts the website shows and no others. */
export function memberDetail(slug: string, lang: Lang = 'bn') {
  const m = getMember(slug);
  if (!m) return null;
  const en = lang === 'en';
  const d = m.seat ? districtOf(m.seat) : null;
  const text = memberText(m, lang);
  const bio = translated(m.bioBn, lang);
  const summary = translated(m.summaryBn, lang);
  const boundary = translated(m.seat?.boundaryBn, lang);

  return {
    version: meta.builtAt,
    lang,
    ...brief(m, lang),
    professionBn: inLang(m.professionBn, lang),
    educationBn: inLang(m.educationBn, lang),
    birthPlaceBn: inLang(m.birthPlaceBn, lang),
    dateOfBirth: m.dateOfBirth,
    fatherBn: en ? titleCaseName(m.fatherEn) ?? inLang(m.fatherBn, 'en') : m.fatherBn,
    motherBn: en ? titleCaseName(m.motherEn) ?? inLang(m.motherBn, 'en') : m.motherBn,
    isFreedomFighter: m.isFreedomFighter,
    email: m.email,
    bioBn: bio?.text ?? null,
    bioTranslated: !!bio?.translated,
    /** English response only: a biography exists, in Bangla, with no English yet. */
    bioOnlyInBangla: text.bioOnlyInBangla,
    summaryBn: summary?.text ?? null,
    summaryTranslated: !!summary?.translated,
    /** Whether the page shows the summary (it does not when it repeats the biography). */
    showSummary: text.showSummary,
    /** The page's opening sentences, the same ones search results and link previews show. */
    leadBn: text.lead,
    /** For a member with neither a biography nor a summary: an introduction put together from the record. */
    introBn: text.intro,
    bioSource: m.bioSource ?? null,
    bioSources: sourceList(m.bioSources),
    /** The same sources, each named as the page names it ("Wikipedia (Bangla)"). */
    bioSourceLinks: sourceList(m.bioSources).map((url) => ({ url, label: sourceLabel(url, lang) })),
    bioFromWiki: m.bioFromWiki ?? null,
    term: m.term,
    termsCount: m.termsCount ?? null,
    status: m.status,
    resignedOn: m.resignedOn ?? null,
    partyRoleBn: inLang(m.partyRoleBn, lang),
    ministryBn: inLang(m.ministryBn, lang),
    partyNameBn: m.party ? (en ? enOnly(partyName(m.party, 'en')) : m.party.nameBn) : null,
    districtEn: d?.en ?? null,
    seat: m.seat
      ? {
          no: m.seat.no,
          slug: m.seat.slug,
          nameBn: en ? enOnly(seatName(m.seat, 'en')) : m.seat.nameBn,
          reserved: m.seat.reserved,
          districtSlug: d?.slug ?? null,
          districtBn: d ? (en ? districtName(d, 'en') : d.bn) : null,
          boundaryBn: boundary?.text ?? null,
          boundaryTranslated: !!boundary?.translated,
          // The member record's copy of the seat does not carry this; the seat list does.
          vacantSince: getSeat(m.seat.slug)?.vacantSince ?? null,
        }
      : null,
    offices: m.offices ?? [],
    /** Every office in the House, whips included, as the page's badges show them. */
    rolesBn: memberRoles(m, lang).roles,
    /** The government posts as the page's badges show them ("State Minister, Ministry of …"). */
    postBadgesBn: postBadges(m, lang),
    /** When the government posts were last checked against the Cabinet Division's list (ISO instant). */
    postsCheckedAt: posts.checkedAt,
    // Each link carries unverified: true for a Facebook page still being checked;
    // facebookNotice replaces the link while the page is in dispute.
    socials: socialsOf(m, lang),
    facebookNotice: facebookNotice(m, lang),
    /** The Wikipedia article(s) the links were read from, space-separated; null when an editor added them. */
    socialSource: m.socialSource ?? null,
    governmentPosts: governmentPostsOf(m.id).map((p) => ({
      title: en ? enOnly(govPost(p.title, 'en')) : p.title,
      ministryBn: inLang(p.ministryBn, lang),
      fromDate: p.fromDate ?? null,
    })),
    committees: committeesOfMember(m.id).map((c) => ({
      slug: c.slug,
      nameBn: en ? enOnly(committeeName(c, 'en')) : c.nameBn,
      role: ((r) => (r ? inResponse(committeeRole(r, lang), lang) : null))(c.members.find((x) => x.memberId === m.id)?.role),
    })),
    /** Parliament's committees, and how many have a member list updated for this parliament. */
    committeeCounts: { total: committeeCounts().total, current: committeeCounts().current },
    priorTerms: priorTermsOf(m.id).map((pt) => ({
      ...pt,
      seatNameBn: en ? (pt.seatNameEn ? enOnly(seatName({ nameEn: titleCaseName(pt.seatNameEn), nameBn: pt.seatNameBn }, 'en')) : null) : pt.seatNameBn,
      partyNameBn: en ? (pt.partyAbbr ? enOnly(partyByAbbr(pt.partyAbbr, pt.partyNameBn, 'en')) : null) : pt.partyNameBn,
      labelBn: parliamentLabel(pt.parliamentNo, lang),
    })),
    result: seatResult(m, lang),
    notices: noticesForMember(m.id).map((n) => noticeRow(n, lang)),
  };
}

/** A seat's result, every candidate by votes, as the result card shows it. */
export function resultRow(r: SeatResult, lang: Lang) {
  const en = lang === 'en';
  return {
    parliamentNo: r.parliamentNo,
    labelBn: parliamentLabel(r.parliamentNo, lang),
    totalVotes: r.totalVotes,
    turnout: r.turnout,
    candidates: [...r.candidates]
      .sort((a, b) => b.votes - a.votes)
      .map((c) => ({ name: en ? candidateNameEn(c.name, r.seatNo) : c.name, party: c.party, partyBn: partyLabel(c.party, lang), votes: c.votes })),
    sourceUrl: r.sourceUrl ?? null,
    /** Who published the numbers ("The Business Standard"). */
    sourceBn: sourceOf(r.sourceUrl, lang).name,
    /** The note shown under the result, less its own source line. */
    noteBn: resultNote(r, lang),
  };
}

/** The seat's 2026 result, every candidate by votes, where one has been published. */
function seatResult(m: Member, lang: Lang) {
  if (!m.seat || m.seat.reserved) return null;
  const { result: r, wonThisResult } = memberText(m, lang);
  if (!r || !r.candidates.length) return null;
  const row = resultRow(r, lang);
  return {
    candidates: row.candidates,
    sourceUrl: row.sourceUrl,
    // The note as the source wrote it on a Bangla response (the first app versions show it as is).
    sourceNote: lang === 'en' ? row.noteBn : r.sourceNote ?? null,
    sourceBn: row.sourceBn,
    noteBn: row.noteBn,
    /** Whether this member won it: after a by-election the general election's winner is someone else. */
    won: wonThisResult,
  };
}

/** An adviser from outside parliament, for the app's profile screen. */
export function adviserDetail(slug: string, lang: Lang = 'bn') {
  const a = getAdviser(slug);
  if (!a) return null;
  const en = lang === 'en';
  const { rows, photoUrl } = adviserPosts(a);
  const bio = translated(a.bioBn, lang);
  const name = adviserName(a, lang);
  return {
    version: meta.builtAt,
    lang,
    ...a,
    // The cabinet list's own spelling, by which a post finds the profile: Bangla only.
    postNameBn: en ? null : a.postNameBn,
    nameBn: en && name.lang === 'bn' ? null : name.text,
    roleBn: adviserRole(a, lang),
    rankBn: rankIn(a.rankBn, lang),
    bioBn: bio?.text ?? null,
    bioTranslated: !!bio?.translated,
    professionBn: inLang(a.professionBn, lang),
    educationBn: inLang(a.educationBn, lang),
    birthPlaceBn: inLang(a.birthPlaceBn, lang),
    partyRoleBn: inLang(a.partyRoleBn, lang),
    sourceLinks: a.sources.map((url) => ({ url, label: sourceLabel(url, lang) })),
    photoUrl,
    posts: rows.map((r) => ({ title: en ? enOnly(govPost(r.title, 'en')) : r.title, ministryBn: inLang(r.ministryBn, lang), fromDate: r.fromDate ?? null })),
  };
}
