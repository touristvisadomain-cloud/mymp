/**
 * The 2026 election seat by seat, as the map of the country draws it
 * (/nirbachon) and the mobile app's election screen lists it: each seat with
 * its sitting member, the winner's votes, the margin and the runner-up.
 */
import { seats, getMemberById, districtOf, partyShortBn, partyColor, initial, type Member } from '@/lib/data';
import { resultForSeat } from '@/lib/history';
import type { PinSeat } from '@/components/ElectionMap';
import type { T } from '@/i18n/core';
import { districtName, partyByAbbr, partyName, partyShort, personName, seatName } from '@/i18n/names';
import { inLang } from '@/i18n/content';

// Seats of this parliament with a published result, and each seat's winner.
export const winnerOf = (seatNo: number) => {
  const r = resultForSeat(seatNo, 13);
  if (!r) return null;
  const [top] = [...r.candidates].sort((a, b) => b.votes - a.votes);
  return top ? { votes: top.votes } : null;
};
export const publishedSeats = seats.filter((s) => !s.reserved && winnerOf(s.no)).length;

/** The letter in place of a missing photo, from the English name, past the titles initial() also skips in Bangla. */
export const initialEn = (m: Member) => {
  const name = personName(m, 'en').trim();
  const stripped = name.replace(/^(Md\.?|Barrister|Dr\.?|Advocate)\s*/i, '');
  return (stripped || name).charAt(0).toUpperCase();
};

/** Every seat for the map of the country: where it is comes from public/geo (ElectionMap), the rest from here, in the page's language. */
export function pinSeats(t: T): PinSeat[] {
  const out: PinSeat[] = [];
  for (const seat of seats) {
    if (seat.reserved) continue;
    const d = districtOf(seat);
    if (!d) continue;
    const m = seat.memberId ? getMemberById(seat.memberId) : undefined;
    const sitting = m && !m.resignedOn ? m : undefined;
    const r = resultForSeat(seat.no, 13);
    const [a, b] = r ? [...r.candidates].sort((x, y) => y.votes - x.votes) : [];
    // A runner-up's name the results give only in Bangla is left off the English page.
    const runnerUp = b && !(t.en && /[ঀ-৿]/.test(b.name)) ? b : undefined;
    out.push({
      no: seat.no,
      seat: t.en ? seatName(seat, 'en') : seat.nameBn ?? seat.nameEn ?? '',
      slug: seat.slug,
      district: d.slug,
      districtName: districtName(d, t.lang),
      member: sitting
        ? {
            name: t.en ? personName(sitting, 'en') : sitting.nameBn ?? sitting.nameEn ?? '',
            slug: sitting.slug,
            photo: sitting.photoUrl,
            initial: t.en ? initialEn(sitting) : initial(sitting),
            profession: inLang(sitting.professionBn, t.lang),
          }
        : null,
      party: sitting?.party?.abbr ?? null,
      partyShort: sitting ? (t.en ? (sitting.party ? partyShort(sitting.party, 'en') : null) : partyShortBn(sitting.party)) : null,
      partyFull: t.en ? (sitting?.party ? partyName(sitting.party, 'en') : null) : sitting?.party?.nameBn ?? null,
      color: sitting ? partyColor(sitting.party?.abbr) : 'var(--color-rule)',
      votes: a?.votes ?? null,
      margin: a && b ? a.votes - b.votes : null,
      runnerUp: runnerUp
        ? { name: runnerUp.name, party: t.en ? partyByAbbr(runnerUp.party, null, 'en', true) || null : runnerUp.party, votes: runnerUp.votes }
        : null,
    });
  }
  return out;
}

/** The districts' English names by slug, for the map's labels and cards on the English page. */
export function districtNamesEn(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seat of seats) {
    const d = districtOf(seat);
    if (d) out[d.slug] = districtName(d, 'en');
  }
  return out;
}
