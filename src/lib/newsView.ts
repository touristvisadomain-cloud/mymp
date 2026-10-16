import { publishedNews, getMemberById, partyColor, dateBn, bnText } from './data';
import { groupStories } from './newsStories';
import { makeT, type Lang } from '@/i18n/core';
import { personName } from '@/i18n/names';

/**
 * Published news as stories, shaped for the pages: plain values only, so the
 * news page's filter (a client component) can take them as props without
 * pulling the site's data files into the browser.
 */
export interface StoryLink {
  title: string;
  source: string;
  url: string;
}

/** `name` is the Bangla name; `nameEn`, when the producer filled it, the English one for English pages. */
export interface StoryMember { slug: string; name: string; nameEn?: string; party: string | null; color: string }

export interface StoryView {
  id: string;
  /** yyyy-mm-dd of the lead headline. */
  date: string;
  /** "শুক্রবার, ১২ সেপ্টেম্বর ২০২৬", always in Bangla (stories are shared by both languages); English pages use dayLabel(date, 'en'). */
  dateLabel: string;
  /** When the lead headline was published, ISO; a bare date when the source gave no clock. */
  publishedAt?: string;
  lead: StoryLink;
  also: StoryLink[];
  member: StoryMember | null;
  /** A headline unless the feed says otherwise; the news page shows videos too. */
  kind?: 'news' | 'video' | 'press';
  /** The outlet's own picture, left on the outlet's server. */
  thumbnail?: string | null;
  durationSeconds?: number | null;
  /** Everyone the story names. `member` is the first of them. */
  members?: StoryMember[];
}

const WEEKDAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

/** "শুক্রবার, ১২ সেপ্টেম্বর ২০২৬" / "Friday, 12 September 2026". */
export const dayLabel = (iso: string, lang: Lang = 'bn') => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  if (lang === 'en') {
    const t = makeT('en');
    return `${t.weekday(d.getUTCDay())}, ${t.date(iso.slice(0, 10))}`;
  }
  return `${WEEKDAYS[d.getUTCDay()]}, ${dateBn(iso.slice(0, 10))}`;
};

const nameWords = (id: string) => {
  const m = getMemberById(id);
  return m ? `${m.nameBn ?? ''} ${m.nameEn ?? ''}`.toLowerCase().split(/\s+/).filter(Boolean) : [];
};

let cache: StoryView[] | null = null;

/** Every published headline, folded into stories, newest first. */
export function allStories(): StoryView[] {
  if (cache) return cache;
  cache = groupStories(publishedNews(), nameWords).map(({ lead, also }) => {
    const m = lead.memberId ? getMemberById(lead.memberId) : undefined;
    const link = (n: typeof lead): StoryLink => ({ title: bnText(n.titleBn) ?? n.titleBn, source: n.sourceName, url: n.sourceUrl });
    return {
      id: lead.id,
      date: lead.publishedOn.slice(0, 10),
      dateLabel: dayLabel(lead.publishedOn),
      publishedAt: lead.publishedOn,
      lead: link(lead),
      also: also.map(link),
      member: m
        ? { slug: m.slug, name: m.nameBn ?? m.nameEn ?? '', nameEn: personName(m, 'en'), party: m.party?.abbr ?? null, color: partyColor(m.party?.abbr) }
        : null,
    };
  });
  return cache;
}

export const storiesForMember = (slug: string) => allStories().filter((s) => s.member?.slug === slug);
