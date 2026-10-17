/**
 * The app's নির্বাচন screen: the 2026 election and the House it produced, from
 * the same snapshot the site's /nirbachon and /parisonkhan pages read. Nothing
 * here is computed that those pages do not already publish, apart from the vote
 * totals and margins, which are sums over the same per-seat results.
 */
import {
  members, parties, seats, meta, ecs, statistics, partyShortBn, getMember, getMemberById, committeeCounts, GENERAL_SEATS, AGE_BAND_EN,
} from '@/lib/data';
import { parliament } from '@/lib/activity';
import { experienceStats, resultForSeat, parliamentsWithRecords, partySeatsOf, parliamentLabel } from '@/lib/history';
import { pinSeats } from '@/lib/electionMap';
import { brief, partyLabel, partyLabelBn } from '@/lib/app/payload';
import { enOnly } from '@/lib/app/respond';
import { inLang } from '@/i18n/content';
import { makeT, type Lang } from '@/i18n/core';
import { partyByAbbr, partyShort, seatName } from '@/i18n/names';
import overview from '../../../public/geo/overview.json';

/** Where each seat's pin sits on the map of the country: [longitude, latitude], by seat slug. */
const PINS = (overview as unknown as { seats: Record<string, [number, number]> }).seats;

/**
 * Every territorial seat as the map of the country (/nirbachon) shows it, with
 * its place on the map: the sitting member (none while the seat is vacant),
 * the winner's votes, the margin and the runner-up.
 */
function mapSeats(lang: Lang) {
  return pinSeats(makeT(lang)).map((p) => {
    const m = p.member ? getMember(p.member.slug) : undefined;
    const r = resultForSeat(p.no, 13);
    const second = r ? [...r.candidates].sort((a, b) => b.votes - a.votes)[1] : undefined;
    const pin = PINS[p.slug];
    return {
      no: p.no,
      slug: p.slug,
      seatBn: lang === 'en' ? enOnly(p.seat) : p.seat,
      districtSlug: p.district,
      districtBn: p.districtName,
      lon: pin?.[0] ?? null,
      lat: pin?.[1] ?? null,
      member: m ? brief(m, lang) : null,
      party: p.party,
      votes: p.votes,
      margin: p.margin,
      // The page leaves out a runner-up whose name the results give only in Bangla.
      runnerUp: p.runnerUp && second ? { name: p.runnerUp.name, party: second.party, partyBn: partyLabel(second.party, lang), votes: p.runnerUp.votes } : null,
    };
  });
}

/** Seats by party in each earlier parliament the House's database records (general seats only). */
function earlier(lang: Lang) {
  return parliamentsWithRecords()
    .filter((p) => partySeatsOf(p.no).length > 0)
    .map((p) => {
      const rows = partySeatsOf(p.no);
      return {
        parliamentNo: p.no,
        labelBn: parliamentLabel(p.no, lang),
        /** Members recorded for the general seats: by-elections and gaps in the records can make it differ from the official result. */
        recorded: rows.reduce((n, x) => n + x.territorial, 0),
        parties: rows
          .filter((x) => x.territorial > 0)
          .map((x) => ({ abbr: x.abbr, labelBn: lang === 'en' ? enOnly(partyByAbbr(x.abbr, x.nameBn, 'en', true)) : x.nameBn ?? x.abbr, seats: x.territorial }))
          .sort((a, b) => b.seats - a.seats),
      };
    });
}

export function election(lang: Lang = 'bn') {
  const en = lang === 'en';
  const s = statistics();
  const x = experienceStats(lang);

  // Per-seat results: vote totals by party, and each winner's margin over the runner-up.
  const votesByParty = new Map<string, number>();
  let counted = 0;
  let totalVotes = 0;
  const margins: { seatNo: number; margin: number; winnerVotes: number; runnerUpParty: string | null }[] = [];
  for (const seat of seats) {
    if (seat.reserved) continue;
    const r = resultForSeat(seat.no, meta.parliamentNo);
    if (!r || !r.candidates.length) continue;
    counted++;
    for (const c of r.candidates) {
      totalVotes += c.votes;
      const party = c.party ?? 'Ind';
      votesByParty.set(party, (votesByParty.get(party) ?? 0) + c.votes);
    }
    const [top, second] = [...r.candidates].sort((a, b) => b.votes - a.votes);
    // An exact tie is a transcription error in the source (Tangail-3 as read), not a result to headline.
    if (top && second && top.votes > second.votes) margins.push({ seatNo: seat.no, margin: top.votes - second.votes, winnerVotes: top.votes, runnerUpParty: second.party ? partyLabel(second.party, lang) : null });
  }

  // The parties named on their own are those with a certain Bangla name, in either language.
  const ranked = [...votesByParty].sort((a, b) => b[1] - a[1]);
  const shown = ranked.filter(([abbr]) => partyLabelBn(abbr)).slice(0, 6);
  const other = totalVotes - shown.reduce((n, [, v]) => n + v, 0);
  const voteShare = [
    ...shown.map(([abbr, votes]) => ({ abbr, labelBn: partyLabel(abbr, lang) ?? abbr, votes })),
    ...(other > 0 ? [{ abbr: 'other', labelBn: en ? 'Other' : 'অন্যান্য', votes: other }] : []),
  ];

  const seatRow = (m: (typeof margins)[number]) => {
    const seat = seats.find((z) => z.no === m.seatNo)!;
    const member = seat.memberId ? getMemberById(seat.memberId) : undefined;
    return {
      seatNo: m.seatNo,
      seatBn: en ? enOnly(seatName(seat, 'en')) : seat.nameBn,
      margin: m.margin,
      winnerVotes: m.winnerVotes,
      runnerUpParty: m.runnerUpParty,
      member: member ? brief(member, lang) : null,
    };
  };
  const byMargin = [...margins].sort((a, b) => a.margin - b.margin);

  // The commonest professions, as the statistics page shows them; on English, one with no English yet has a null label.
  const professions = s.professions.slice(0, 8).map((p) => ({ label: inLang(p.label, lang), count: p.count }));
  const cc = committeeCounts();

  return {
    version: meta.builtAt,
    lang,
    parliamentNo: meta.parliamentNo,
    dates: {
      election: parliament.electionDate ?? null,
      gazette: parliament.gazetteDate ?? null,
      oath: parliament.oathDate ?? null,
      end: parliament.endDate ?? null,
    },
    house: {
      total: s.total,
      generalSeats: GENERAL_SEATS,
      territorial: s.territorial,
      reserved: s.reserved,
      majority: s.majority,
      parties: parties
        .filter((p) => members.some((m) => m.party?.abbr === p.abbr))
        .map((p) => ({
          abbr: p.abbr,
          labelBn: en ? partyShort(p, 'en') : partyShortBn(p) ?? p.abbr,
          seats: members.filter((m) => m.party?.abbr === p.abbr).length,
          seatsTerritorial: p.seatsTerritorial,
        }))
        .sort((a, b) => b.seats - a.seats),
    },
    voters: {
      registered: ecs.national.registeredVoters,
      male: ecs.national.maleVoters,
      female: ecs.national.femaleVoters,
      /** Women's share of the registered voters, in per cent to one decimal, as the page shows it. */
      womenShare: Number(((ecs.national.femaleVoters / ecs.national.registeredVoters) * 100).toFixed(1)),
      pollingCentres: ecs.national.pollingCentres,
      registeredParties: ecs.national.registeredParties,
      sourceBn: en ? ecs.source : 'বাংলাদেশ নির্বাচন কমিশন',
      sourceUrl: ecs.sourceUrl,
      readOn: ecs.readOn,
    },
    results: {
      seatsCounted: counted,
      totalVotes,
      voteShare,
      closest: byMargin.slice(0, 5).map(seatRow),
      widest: byMargin.slice(-5).reverse().map(seatRow),
      sourceBn: en
        ? 'Seat-by-seat results published by The Business Standard and Wikipedia; not yet checked against the Election Commission’s gazette.'
        : 'দ্য বিজনেস স্ট্যান্ডার্ড ও উইকিপিডিয়ায় প্রকাশিত আসনভিত্তিক ফল; নির্বাচন কমিশনের গেজেটের সঙ্গে এখনো মিলিয়ে দেখা হয়নি।',
    },
    members: {
      women: s.women,
      womenTerritorial: s.womenTerritorial,
      womenReserved: s.womenReserved,
      medianAge: s.medianAge,
      youngest: s.youngest ? { age: s.youngest.age, member: brief(s.youngest.m, lang) } : null,
      oldest: s.oldest ? { age: s.oldest.age, member: brief(s.oldest.m, lang) } : null,
      ageBands: s.ageBands.map((b) => ({ label: en ? AGE_BAND_EN[b.label] ?? b.label : b.label, count: b.count })),
      professions,
      /** Members whose profession is on record: the professions' shares are of this. */
      withProfession: s.withProfession,
      freedomFighters: s.freedomFighters,
      firstTime: x.firstTime,
      returning: x.returning,
      experience: x.bands,
      /** Those elected most often, as the statistics page lists them. */
      mostTerms: x.most.map(({ m, terms }) => ({ member: brief(m, lang), terms })),
    },
    committees: { total: cc.total, current: cc.current },
    /** Every territorial seat, for the map and the district cards. */
    seats: mapSeats(lang),
    /** Seats by party in earlier parliaments. */
    earlier: earlier(lang),
  };
}
