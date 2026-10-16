import { allMembers, getMemberById, partyColor, seats } from '@/lib/data';
import { parliamentLabel, type SeatResult } from '@/lib/history';
import { Card, DocLink, PartyDot } from './ui';
import { getT } from '@/i18n/server';
import type { Lang } from '@/i18n/core';
import { partyByAbbr, personName } from '@/i18n/names';
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
const bare = (s: string) => s.normalize('NFC').replace(/[\s.,\u200c\u200d]/g, '');

/**
 * A candidate's name on an English page. The results give the winners' names
 * in Bangla (the other candidates' are already in English letters); a winner
 * who is the seat's member, or the only member of that Bangla name, is shown
 * under the member's English name. Null when no English name is known.
 */
function candidateNameEn(name: string, seatNo: number): string | null {
  if (!BANGLA.test(name)) return name;
  const seat = seats.find((s) => s.no === seatNo);
  const own = seat?.memberId ? getMemberById(seat.memberId) : undefined;
  if (own?.nameBn && bare(own.nameBn) === bare(name)) return personName(own, 'en') || null;
  const same = allMembers.filter((m) => m.nameBn && bare(m.nameBn) === bare(name));
  return same.length === 1 ? personName(same[0], 'en') || null : null;
}

/**
 * One election's result for one seat: every candidate, votes and share,
 * with where it was read from. Rendered only from published rows.
 */
export async function ResultCard({ r, compact = false }: { r: SeatResult; compact?: boolean }) {
  const t = await getT();
  const sorted = [...r.candidates].sort((a, b) => b.votes - a.votes);
  const cast = r.totalVotes ?? sorted.reduce((n, c) => n + c.votes, 0);
  const top = sorted[0]?.votes ?? 1;
  const source = sourceOf(r.sourceUrl, t.lang);
  // Notes written by the results job open with their own "উৎস: …।" line; the footer names the source already.
  const opensWithSource = /^উৎস:[^।]*।\s*/.test(r.sourceNote ?? '');
  const noteBn = r.sourceNote?.replace(/^উৎস:[^।]*।\s*/, '') || null;
  // On an English page, the note's translation (the note as shown, or the whole note less its source line); none, no note.
  const note = t.en
    ? inLang(noteBn, 'en') ??
      ((opensWithSource ? inLang(r.sourceNote, 'en')?.replace(/^Source:[^.]*\.\s*/, '') : inLang(r.sourceNote, 'en')) || null)
    : noteBn;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-rulesoft flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="display text-[17px]">{parliamentLabel(r.parliamentNo, t.lang)}</span>
        <span className="text-[13px] text-muted tnum">
          {cast
            ? r.totalVotes
              ? t(`${t.group(cast)} ভোট`, `${t.group(cast)} votes`)
              : t(`প্রার্থীদের মোট ${t.group(cast)} ভোট`, `Candidates' total: ${t.group(cast)} votes`)
            : ''}
          {r.turnout != null ? t(`, ভোট পড়েছে ${t.n(r.turnout)}%`, `, turnout ${t.n(r.turnout)}%`) : ''}
        </span>
      </div>
      <ol className="divide-y divide-rulesoft">
        {(compact ? sorted.slice(0, 3) : sorted).map((c, i) => {
          const share = cast ? (c.votes / cast) * 100 : 0;
          const nameEn = t.en ? candidateNameEn(c.name, r.seatNo) : null;
          return (
            <li key={`${c.name}-${i}`} className="px-5 py-3 flex flex-col gap-1.5">
              {/* On a phone the name has a line of its own; party, votes and share follow on the next. */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span
                  lang={t.en && !nameEn ? 'bn' : undefined}
                  className={`w-full sm:w-auto sm:flex-1 sm:min-w-0 sm:truncate leading-snug ${i === 0 ? 'font-bold' : 'font-medium'}`}
                >
                  {t.en ? nameEn ?? c.name : c.name}
                </span>
                {/* The party's logo beside its short name; a colour dot where no logo is on record. */}
                {c.party && (
                  <span className="shrink-0 inline-flex items-center gap-1.5 ps-1.5 pe-2 py-0.5 rounded-full bg-sunk text-[12px] text-inksoft">
                    <PartyDot abbr={c.party} size={16} />
                    {t.en ? partyByAbbr(c.party, null, 'en', true) : c.party}
                  </span>
                )}
                {i === 0 && <span className="shrink-0 px-2 py-0.5 rounded-full bg-brandsoft text-brand text-[11px] font-bold">{t('বিজয়ী', 'Winner')}</span>}
                <span className="ms-auto tnum text-[14px] font-semibold shrink-0">{t.group(c.votes)}</span>
                <span className="tnum text-[12.5px] text-muted w-12 text-end shrink-0">{t.fixed(share, 1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-sunk overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(c.votes / top) * 100}%`, background: partyColor(c.party) }} />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="px-5 py-3 bg-paper/60 border-t border-rulesoft flex items-center justify-between gap-3 text-[12.5px] text-muted">
        <span>{t('উৎস:', 'Source:')} {source.name}{note ? t(`। ${note}`, `. ${note}`) : ''}</span>
        <DocLink href={r.sourceUrl}>{source.link}</DocLink>
      </div>
    </Card>
  );
}
