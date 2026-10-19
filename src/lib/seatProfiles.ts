/**
 * Each constituency told in a few paragraphs (data/seat-profiles.json, by the
 * seat's slug): the upazilas, thanas, wards and unions it is made of, as the
 * Election Commission's boundary text has them; the district and division;
 * each place's people, work and landmarks; and who has held the seat. Kept
 * per seat, not per member, so a new member inherits it. Bangla only, with the
 * sources it was written from.
 */
import profiles from '../../data/seat-profiles.json';

export interface SeatProfile { bn: string; sources: string[] }

const table = profiles as Record<string, SeatProfile>;

/** The seat's profile; null when none has been written yet. */
export const seatProfile = (slug: string | null | undefined): SeatProfile | null => (slug ? table[slug] ?? null : null);
