/**
 * The seats as the place finder needs them: name, district, boundary text and
 * the sitting member, nothing else, so the list sent to the browser stays small.
 */
import { seats, getMemberById, districtOf, partyColor, partyShortBn } from '@/lib/data';
import type { FinderSeat } from './findSeat';

export function finderSeats(): FinderSeat[] {
  return seats
    .filter((s) => !s.reserved)
    .map((s) => {
      const d = districtOf(s);
      const m = s.memberId ? getMemberById(s.memberId) : undefined;
      const sitting = m && !m.resignedOn ? m : undefined;
      return {
        no: s.no,
        seat: s.nameBn ?? s.nameEn ?? '',
        seatEn: s.nameEn,
        slug: s.slug,
        district: d?.bn ?? '',
        districtEn: d?.en ?? null,
        boundary: s.boundaryBn,
        member: sitting
          ? {
              name: sitting.nameBn ?? sitting.nameEn ?? '',
              slug: sitting.slug,
              party: sitting.party?.abbr ?? null,
              partyBn: partyShortBn(sitting.party),
              color: partyColor(sitting.party?.abbr),
              photo: sitting.photoUrl,
            }
          : null,
      };
    });
}
