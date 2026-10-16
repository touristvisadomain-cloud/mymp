import Link from '@/i18n/Link';
import PartyBadge from './PartyBadge';
import { dayLabel, type StoryView } from '@/lib/newsView';
import { getT } from '@/i18n/server';
import type { T } from '@/i18n/core';
import { channelName, memberName } from './VideoStrip';

const duration = (s: number | null | undefined, t: T) =>
  s ? `${t.n(Math.floor(s / 60))}:${t.n(String(s % 60).padStart(2, '0'))}` : null;

/** A video's title is the channel's own words: marked as Bangla on an English page when it is. */
const titleLang = (title: string, t: T) => (t.en && /[\u0980-\u09FF]/.test(title) ? 'bn' : undefined);

function Play({ size }: { size: 'lg' | 'sm' }) {
  const box = size === 'lg' ? 'w-16 h-16' : 'w-9 h-9';
  const icon = size === 'lg' ? 26 : 14;
  return (
    <span className={`${box} rounded-full bg-white/95 shadow-lift grid place-items-center group-hover:scale-110 transition-transform`}>
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor" className="text-[#e62117] translate-x-[1px]" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
    </span>
  );
}

function People({ v, t, light = false }: { v: StoryView; t: T; light?: boolean }) {
  const people = v.members?.length ? v.members : v.member ? [v.member] : [];
  if (!people.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      {people.slice(0, 3).map((m) => (
        <Link
          key={m.slug}
          href={`/mp/${m.slug}`}
          className={`flex items-center gap-1.5 text-[13px] font-semibold hover:underline ${light ? 'text-white' : 'text-brand'}`}
        >
          <PartyBadge abbr={m.party} color={m.color} size={16} />
          {memberName(m, t)}
        </Link>
      ))}
    </div>
  );
}

/** A channel's hourly bulletin names the Prime Minister in passing; it is not a video about a member. */
const BULLETIN = /headlines|bulletin|শিরোনাম|সংবাদ\s*(সারাদিন|প্রতিদিন)|২৪\s*ঘণ্টা|\bnews at\b|\blive\b|সরাসরি/i;

/**
 * Newest first, but varied: videos about a member before bulletins, and no
 * more than two about the same member, so one busy day does not fill the row.
 */
function pick(videos: StoryView[], n: number): StoryView[] {
  const ordered = [...videos.filter((v) => !BULLETIN.test(v.lead.title)), ...videos.filter((v) => BULLETIN.test(v.lead.title))];
  const perMember = new Map<string, number>();
  const out: StoryView[] = [];
  for (const v of ordered) {
    const key = v.member?.slug ?? v.id;
    if ((perMember.get(key) ?? 0) >= 2) continue;
    perMember.set(key, (perMember.get(key) ?? 0) + 1);
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

/**
 * The newest videos about members on the home page: one large, the next few
 * in a list beside it. Each opens on the channel that published it; the site
 * links to a broadcaster's video and never hosts or embeds it.
 */
export default async function HomeVideos({ videos }: { videos: StoryView[] }) {
  const t = await getT();
  const picked = pick(videos.filter((v) => v.thumbnail), 5);
  if (!picked.length) return null;
  const [lead, ...side] = picked;
  const when = (v: StoryView) => (t.en ? dayLabel(v.date, 'en') : v.dateLabel);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4 items-stretch">
      <article className="reveal group relative rounded-card overflow-hidden bg-ink shadow-card flex flex-col lg:min-h-[420px]">
        <a href={lead!.lead.url} target="_blank" rel="noopener noreferrer" aria-label={lead!.lead.title} lang={titleLang(lead!.lead.title, t)} className="relative block aspect-video lg:aspect-auto lg:absolute lg:inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lead!.thumbnail!} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-500" />
          <span className="hidden lg:block absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
          <span className="absolute inset-0 grid place-items-center lg:pb-24"><Play size="lg" /></span>
          {duration(lead!.durationSeconds, t) && (
            <span className="absolute top-3 end-3 px-2 py-0.5 rounded bg-black/75 text-white text-[12px] tnum">{duration(lead!.durationSeconds, t)}</span>
          )}
        </a>
        <div className="relative lg:absolute lg:inset-x-0 lg:bottom-0 flex flex-col p-4 sm:p-6 gap-2.5 lg:pointer-events-none">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-white/80">
            <span className="px-1.5 py-px rounded bg-[#e62117] text-white text-[11px] font-bold tracking-wide">{t('ভিডিও', 'Video')}</span>
            <span className="font-semibold truncate">{channelName(lead!.lead.source, t)},</span>
            <span className="shrink-0">{when(lead!)}</span>
          </div>
          <a
            href={lead!.lead.url}
            target="_blank"
            rel="noopener noreferrer"
            lang={titleLang(lead!.lead.title, t)}
            className="pointer-events-auto display text-white text-[18px] sm:text-[23px] leading-snug line-clamp-3 hover:underline"
          >
            {lead!.lead.title}
          </a>
          <div className="pointer-events-auto"><People v={lead!} t={t} light /></div>
        </div>
      </article>

      {side.length > 0 && (
        <ul className="flex flex-col gap-3">
          {side.map((v) => (
            <li key={v.id} className="reveal bg-surface border border-rule rounded-card shadow-card p-3 flex gap-3.5 hover:border-brandring transition-colors">
              <a
                href={v.lead.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-hidden="true"
                tabIndex={-1}
                className="group shrink-0 w-[128px] sm:w-[150px] aspect-video rounded-lg overflow-hidden relative bg-paper"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnail!} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <span className="absolute inset-0 grid place-items-center bg-black/20"><Play size="sm" /></span>
                {duration(v.durationSeconds, t) && (
                  <span className="absolute bottom-1 end-1 px-1.5 rounded bg-black/80 text-white text-[11px] tnum">{duration(v.durationSeconds, t)}</span>
                )}
              </a>
              <div className="min-w-0 flex flex-col gap-1.5">
                <a href={v.lead.url} target="_blank" rel="noopener noreferrer" lang={titleLang(v.lead.title, t)} className="font-semibold text-[14.5px] leading-snug line-clamp-2 hover:text-brand transition-colors">
                  {v.lead.title}
                </a>
                <span className="text-[12.5px] text-muted truncate">{channelName(v.lead.source, t)}, {when(v)}</span>
                <People v={v} t={t} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
