/**
 * Seats and districts for the app: the seat list (/ason), one seat (/ason/x),
 * one district (/jela/x) and the reserved seats for women
 * (/sangrakkhito-ason), each with the facts the website's page shows.
 */
import { seats, meta, getSeat, getMemberById, districtOf, statistics, RESERVED_SEATS, type Seat } from '@/lib/data';
import { districtGroups } from '@/lib/districts';
import { districtIntro } from '@/lib/districtIntro';
import { seatHolders, resultsForSeat, parliamentLabel, SAME_AREA_SINCE } from '@/lib/history';
import { reservedMembers, reservedByParty, reservedQuestions } from '@/lib/reservedSeats';
import { brief, resultRow } from '@/lib/app/payload';
import { enOnly } from '@/lib/app/respond';
import { translated } from '@/i18n/content';
import { makeT, type Lang } from '@/i18n/core';
import { districtName, districtNameEn, partyByAbbr, partyName, personName, seatName } from '@/i18n/names';

type SeatRow = Seat & { memberId: string | null };

/** A seat's name in the response's language. */
const seatLabel = (s: SeatRow, lang: Lang) => (lang === 'en' ? enOnly(seatName(s, 'en')) : s.nameBn);

/** The member sitting for a seat: none while it is vacant (its member resigned) or nobody is listed. */
const sitting = (s: SeatRow) => (s.memberId && !s.vacantSince ? getMemberById(s.memberId) : undefined);

/** A seat as a list row: its place, whether it is filled, and its area in the response's language. */
function seatRow(s: SeatRow, lang: Lang) {
  const d = districtOf(s);
  const area = translated(s.boundaryBn, lang);
  return {
    no: s.no,
    slug: s.slug,
    nameBn: seatLabel(s, lang),
    nameEn: s.nameEn,
    reserved: s.reserved,
    districtSlug: d?.slug ?? null,
    districtBn: d ? (lang === 'en' ? districtName(d, 'en') : d.bn) : null,
    memberId: s.memberId,
    /** No sitting member: the seat's member resigned (vacantSince) or none is listed. */
    vacant: !sitting(s),
    vacantSince: s.vacantSince ?? null,
    boundaryBn: area?.text ?? null,
    boundaryTranslated: !!area?.translated,
    // English answers: the Bangla names beside, so a search in either script finds the seat.
    ...(lang === 'en' ? { nameAlt: s.nameBn, districtAlt: d?.bn ?? null } : {}),
  };
}

/** Every seat, territorial then reserved, in the source's order. */
export function seatList(lang: Lang = 'bn') {
  return { version: meta.builtAt, lang, seats: seats.map((s) => seatRow(s, lang)) };
}

/** One seat, as its page (/ason/<slug>) shows it. */
export function seatDetail(slug: string, lang: Lang = 'bn') {
  const seat = getSeat(slug);
  if (!seat) return null;
  const en = lang === 'en';
  const listed = seat.memberId ? getMemberById(seat.memberId) : undefined;
  const member = sitting(seat);
  const d = districtOf(seat);
  const holders = seat.reserved ? [] : seatHolders(seat.no);
  return {
    version: meta.builtAt,
    lang,
    seat: seatRow(seat, lang),
    member: member ? brief(member, lang) : null,
    /** The member elected for the seat who has since resigned, while it is vacant. */
    resignedMember: !member && listed?.resignedOn ? { ...brief(listed, lang), resignedOn: listed.resignedOn } : null,
    /** Who held the seat in earlier parliaments, newest first (territorial seats only). */
    holders: holders.map((h) => {
      const cur = h.memberId ? getMemberById(h.memberId) : undefined;
      return {
        parliamentNo: h.parliamentNo,
        labelBn: parliamentLabel(h.parliamentNo, lang),
        nameBn: en ? enOnly((cur ? personName(cur, 'en') : personName(h, 'en')) || null) : cur?.nameBn ?? h.nameBn ?? h.nameEn,
        nameEn: enOnly(h.nameEn),
        partyAbbr: h.partyAbbr,
        partyBn: en ? (h.partyAbbr ? enOnly(partyByAbbr(h.partyAbbr, h.partyNameBn, 'en')) : null) : h.partyNameBn ?? h.partyAbbr,
        /** Set when the holder is in the 13th Parliament: their profile. */
        member: cur ? brief(cur, lang) : null,
      };
    }),
    /** Some earlier holders sat for a seat of the same number before the 2008 redrawing, which may have covered other ground. */
    oldBoundary: holders.some((h) => h.parliamentNo < SAME_AREA_SINCE),
    /** Every published result for the seat, newest first. */
    results: seat.reserved ? [] : resultsForSeat(seat.no).map((r) => resultRow(r, lang)),
    /** The other seats of the district. */
    neighbours: d
      ? seats
          .filter((s) => s.no !== seat.no && districtOf(s)?.en === d.en)
          .map((s) => {
            const m = s.memberId ? getMemberById(s.memberId) : undefined;
            return { no: s.no, slug: s.slug, nameBn: seatLabel(s, lang), member: m ? brief(m, lang) : null };
          })
      : [],
  };
}

/** One district, as its page (/jela/<slug>) shows it. */
export function districtDetail(slug: string, lang: Lang = 'bn') {
  const d = districtGroups().get(slug);
  if (!d) return null;
  const en = lang === 'en';
  const rows = d.seats.map((s) => ({ seat: s, m: s.memberId ? getMemberById(s.memberId) : undefined }));
  const parties = new Map<string, number>();
  for (const r of rows) if (r.m?.party) parties.set(r.m.party.abbr, (parties.get(r.m.party.abbr) ?? 0) + 1);
  return {
    version: meta.builtAt,
    lang,
    slug: d.slug,
    nameBn: en ? districtName(d, 'en') : d.bn,
    nameEn: districtNameEn(d.en),
    /** The district in a paragraph, from the site's own records. */
    introBn: districtIntro(d, lang).text,
    seats: rows.map(({ seat, m }) => ({
      no: seat.no,
      slug: seat.slug,
      nameBn: seatLabel(seat, lang),
      vacant: !sitting(seat),
      /** The member the page lists for the seat (one who resigned stays until the seat is filled; see `vacant`). */
      member: m ? brief(m, lang) : null,
    })),
    parties: [...parties.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([abbr, n]) => {
        const party = rows.find((r) => r.m?.party?.abbr === abbr)?.m?.party;
        return { abbr, nameBn: en ? enOnly(partyName(party, 'en')) ?? abbr : party?.nameBn ?? abbr, seats: n };
      }),
  };
}

/** The fifty seats reserved for women, as /sangrakkhito-ason shows them. */
export function reservedSeats(lang: Lang = 'bn') {
  const en = lang === 'en';
  const s = statistics();
  return {
    version: meta.builtAt,
    lang,
    total: RESERVED_SEATS,
    filled: reservedMembers.length,
    women: s.women,
    womenTerritorial: s.womenTerritorial,
    parties: reservedByParty.map(({ party, held }) => ({
      abbr: party.abbr,
      slug: party.slug,
      nameBn: en ? enOnly(partyName(party, 'en')) : party.nameBn ?? party.abbr,
      held,
    })),
    members: reservedMembers.map((m) => brief(m, lang)),
    questions: reservedQuestions(makeT(lang)).map((x) => ({ questionBn: x.q, answerBn: x.a })),
    sourceBn: en
      ? "The Constitution of the People's Republic of Bangladesh, Article 65; members' names and parties from the Parliament of Bangladesh."
      : 'গণপ্রজাতন্ত্রী বাংলাদেশের সংবিধান, ৬৫ অনুচ্ছেদ; সদস্যদের নাম ও দল বাংলাদেশ জাতীয় সংসদের তথ্য থেকে।',
  };
}

/** Every seat's slug, for the seat route's prerendering. */
export const seatSlugs = () => seats.map((s) => s.slug);
/** Every district's slug. */
export const districtSlugs = () => [...districtGroups().keys()];
