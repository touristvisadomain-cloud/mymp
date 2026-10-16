import Link from '@/i18n/Link';
import type { StoryMember, StoryView } from '@/lib/newsView';
import { getMember } from '@/lib/data';
import { getT } from '@/i18n/server';
import type { T } from '@/i18n/core';
import { outletName, personName } from '@/i18n/names';

const duration = (s: number | null | undefined, t: T) =>
  s ? `${t.n(Math.floor(s / 60))}:${t.n(String(s % 60).padStart(2, '0'))}` : null;

/** A member named under a video, in the page's language. */
export const memberName = (m: StoryMember, t: T) => (t.en ? m.nameEn || personName(getMember(m.slug), 'en') || m.name : m.name);

/**
 * Channel names the video feed writes that the shared outlet table
 * (outletName, src/i18n/names.ts) does not have yet: a few outlets' YouTube
 * channels name themselves differently from their newspapers. The same list
 * as StoryCard's, until the shared table has them.
 */
/** A video's channel in the page's language; the Bangla page shows it as the feed wrote it. */
export const channelName = (name: string, t: T) => outletName(name, t.lang);

/**
 * The newest videos, as a row that scrolls sideways on a phone and sits in a
 * grid on a desktop. Each opens on the channel it came from: the site links to
 * a broadcaster's video, it does not host or embed anyone's.
 */
export default async function VideoStrip({ videos, moreHref }: { videos: StoryView[]; moreHref: string }) {
  const t = await getT();
  if (!videos.length) return null;
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display text-[19px] font-bold flex items-baseline gap-2.5">
          {t('ভিডিও', 'Videos')}
          <span className="text-[13px] font-medium text-muted">{t.en ? `latest ${videos.length}` : `${t.n(videos.length)}টি সর্বশেষ`}</span>
        </h2>
        <Link href={moreHref} className="text-[14px] font-semibold text-brand hover:underline shrink-0">{t('সব ভিডিও', 'All videos')}</Link>
      </div>

      <ul className="flex gap-3.5 overflow-x-auto pb-2 -mx-1 px-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
        {videos.slice(0, 6).map((v) => (
          <li key={v.id} className="w-[230px] shrink-0 sm:w-auto">
            <a
              href={v.lead.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2.5 h-full"
            >
              <span className="block aspect-video rounded-xl border border-rule bg-paper overflow-hidden relative">
                {v.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : null}
                <span className="absolute inset-0 grid place-items-center bg-ink/25 group-hover:bg-ink/35 transition-colors">
                  <span className="w-11 h-11 rounded-full bg-white/90 grid place-items-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-ink" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </span>
                {duration(v.durationSeconds, t) && (
                  <span className="absolute bottom-1.5 end-1.5 px-1.5 rounded bg-ink/80 text-white text-[11.5px] tnum">{duration(v.durationSeconds, t)}</span>
                )}
              </span>
              <span className="font-semibold text-[14.5px] leading-snug line-clamp-2 group-hover:text-brand transition-colors" lang={t.en && /[\u0980-\u09FF]/.test(v.lead.title) ? 'bn' : undefined}>{v.lead.title}</span>
              <span className="text-[12.5px] text-muted flex flex-wrap items-center gap-x-2">
                <span>{channelName(v.lead.source, t)}</span>
                {v.member && <span className="truncate">{memberName(v.member, t)}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
