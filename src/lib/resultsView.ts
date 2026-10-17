/**
 * An election result as a reader is shown it, in either language: who
 * published the numbers, a candidate's name, the note beside the result. The
 * result card (components/results.tsx) and the mobile app's API both read
 * these, so the two never word a result differently.
 */
import { allMembers, getMemberById, seats } from '@/lib/data';
import type { SeatResult } from '@/lib/history';
import type { Lang } from '@/i18n/core';
import { personName } from '@/i18n/names';
import { inLang } from '@/i18n/content';

/** Who published the numbers, named from the source link; an editor's own entry is the gazette. */
export function sourceOf(url: string, lang: Lang = 'bn'): { name: string; link: string; by: string } {
  const en = lang === 'en';
  if (/wikipedia\.org/i.test(url)) {
    return en
      ? { name: 'Wikipedia', link: 'Wikipedia', by: 'according to Wikipedia' }
      : { name: 'উইকিপিডিয়া', link: 'উইকিপিডিয়া', by: 'উইকিপিডিয়া অনুযায়ী' };
  }
  if (/tbsnews\.net/i.test(url)) {
    return en
      ? { name: 'The Business Standard', link: 'Original page', by: "according to The Business Standard's count" }
      : { name: 'দ্য বিজনেস স্ট্যান্ডার্ড', link: 'মূল পাতা', by: 'দ্য বিজনেস স্ট্যান্ডার্ডের হিসাব অনুযায়ী' };
  }
  return en
    ? { name: 'Election Commission gazette', link: 'Gazette', by: "according to the Election Commission's gazette" }
    : { name: 'নির্বাচন কমিশনের গেজেট', link: 'গেজেট', by: 'নির্বাচন কমিশনের গেজেট অনুযায়ী' };
}

const BANGLA = /[ঀ-৿]/;
/** A name without its punctuation and spaces: the results write "ড, আবদুল মঈন খান" where the member list has "ড. আবদুল মঈন খান". */
const bare = (s: string) => s.normalize('NFC').replace(/[\s.,‌‍]/g, '');

/**
 * A candidate's name on an English page. The results give the winners' names
 * in Bangla (the other candidates' are already in English letters); a winner
 * who is the seat's member, or the only member of that Bangla name, is shown
 * under the member's English name. Null when no English name is known.
 */
export function candidateNameEn(name: string, seatNo: number): string | null {
  if (!BANGLA.test(name)) return name;
  const seat = seats.find((s) => s.no === seatNo);
  const own = seat?.memberId ? getMemberById(seat.memberId) : undefined;
  if (own?.nameBn && bare(own.nameBn) === bare(name)) return personName(own, 'en') || null;
  const same = allMembers.filter((m) => m.nameBn && bare(m.nameBn) === bare(name));
  return same.length === 1 ? personName(same[0], 'en') || null : null;
}

/**
 * The note shown under a result, in the page's language. Notes written by the
 * results job open with their own "উৎস: …।" line, which is dropped: the card
 * names its source already. On an English page, the note's translation (the
 * note as shown, or the whole note less its source line); none, no note.
 */
export function resultNote(r: Pick<SeatResult, 'sourceNote'>, lang: Lang): string | null {
  const opensWithSource = /^উৎস:[^।]*।\s*/.test(r.sourceNote ?? '');
  const noteBn = r.sourceNote?.replace(/^উৎস:[^।]*।\s*/, '') || null;
  return lang === 'en'
    ? inLang(noteBn, 'en') ??
        ((opensWithSource ? inLang(r.sourceNote, 'en')?.replace(/^Source:[^.]*\.\s*/, '') : inLang(r.sourceNote, 'en')) || null)
    : noteBn;
}
