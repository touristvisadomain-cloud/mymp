import Link from 'next/link';
import PartyBadge from './PartyBadge';
import StoryThumb from './StoryThumb';
import When from './When';
import type { StoryView } from '@/lib/newsView';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const duration = (s: number | null | undefined) =>
  s ? `${bn(Math.floor(s / 60))}:${bn(String(s % 60).padStart(2, '0'))}` : null;

/**
 * One news story: the lead headline linking to its outlet, the other outlets
 * that ran the same story as small links, and the members it is about. Reads
 * no site data, so the news page's client-side filter renders it too.
 *
 * The picture, when the outlet's feed named one, is loaded from the outlet's
 * own server and nothing is copied here. A story without one keeps its shape:
 * most headlines arrive from a sitemap, which carries no picture at all.
 */
export default function StoryCard({ s, showMember = true, showDate = true }: { s: StoryView; showMember?: boolean; showDate?: boolean }) {
  const video = s.kind === 'video';
  const people = s.members?.length ? s.members : s.member ? [s.member] : [];

  return (
    <article className="reveal h-full bg-surface border border-rule rounded-card shadow-card p-4 sm:p-5 flex gap-4 hover:border-brandring transition-colors">
      {(s.thumbnail || video) && (
        <a
          href={s.lead.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-hidden="true"
          tabIndex={-1}
          className="shrink-0 w-[104px] sm:w-[148px] aspect-video rounded-lg bg-paper border border-rulesoft overflow-hidden relative grid place-items-center"
        >
          {/* The placeholder sits underneath: if the outlet's picture 404s, the
              thumbnail removes itself and this is what stays. */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-muted" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          {s.thumbnail && <StoryThumb src={s.thumbnail} />}
          {video && (
            <span className="absolute inset-0 grid place-items-center bg-ink/25">
              <span className="w-9 h-9 rounded-full bg-white/90 grid place-items-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-ink" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </span>
          )}
          {duration(s.durationSeconds) && (
            <span className="absolute bottom-1 end-1 px-1.5 rounded bg-ink/80 text-white text-[11px] tnum">{duration(s.durationSeconds)}</span>
          )}
        </a>
      )}

      <div className="min-w-0 grow flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[13px] text-muted">
          <span className="flex items-center gap-2 min-w-0">
            {video && <span className="shrink-0 px-1.5 py-px rounded border border-brandring text-brand text-[11.5px] font-semibold">ভিডিও</span>}
            {s.kind === 'press' && <span className="shrink-0 px-1.5 py-px rounded border border-rule text-[11.5px] font-semibold">প্রজ্ঞাপন</span>}
            <span className="font-semibold text-inksoft truncate">{s.lead.source}</span>
          </span>
          {/* "১৭ অক্টোবর ২০২৬, রাত ১১:২৫ · ৩ ঘণ্টা আগে": the date and time on every story. */}
          {s.publishedAt ? <When iso={s.publishedAt} withDate={showDate} /> : showDate && <span>{s.dateLabel}</span>}
        </div>

        <a
          href={s.lead.url}
          target="_blank"
          rel="noopener noreferrer"
          className="display text-[16.5px] sm:text-[17.5px] leading-snug hover:text-brand transition-colors"
        >
          {s.lead.title}
        </a>

        {s.also.length > 0 && (
          <div className="flex flex-col gap-2 pt-3 border-t border-rulesoft">
            <span className="text-[13px] text-muted">একই খবর আরও {bn(s.also.length)}টি সংবাদমাধ্যমে</span>
            <div className="flex flex-wrap gap-1.5">
              {s.also.map((a) => (
                <a
                  key={a.url}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={a.title}
                  className="px-2.5 py-1 rounded-full border border-rule bg-paper text-[13px] font-medium text-inksoft hover:border-brand hover:text-brand transition-colors"
                >
                  {a.source}
                </a>
              ))}
            </div>
          </div>
        )}

        {showMember && people.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {people.slice(0, 3).map((m) => (
              <Link key={m.slug} href={`/mp/${m.slug}`} className="flex items-center gap-2 text-[13.5px] font-semibold text-brand hover:underline">
                <PartyBadge abbr={m.party} color={m.color} />
                {m.name}
              </Link>
            ))}
            {people.length > 3 && <span className="text-[13px] text-muted">আরও {bn(people.length - 3)} জন</span>}
          </div>
        )}
      </div>
    </article>
  );
}
