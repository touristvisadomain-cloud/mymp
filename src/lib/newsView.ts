import { publishedNews, getMemberById, partyColor, dateBn, bnText } from './data';
import { groupStories } from './newsStories';

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

export interface StoryMember { slug: string; name: string; party: string | null; color: string }

export interface StoryView {
  id: string;
  /** yyyy-mm-dd of the lead headline. */
  date: string;
  /** "শুক্রবার, ১২ সেপ্টেম্বর ২০২৬" */
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

export const dayLabel = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : `${WEEKDAYS[d.getUTCDay()]}, ${dateBn(iso.slice(0, 10))}`;
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
        ? { slug: m.slug, name: m.nameBn ?? m.nameEn ?? '', party: m.party?.abbr ?? null, color: partyColor(m.party?.abbr) }
        : null,
    };
  });
  return cache;
}

export const storiesForMember = (slug: string) => allStories().filter((s) => s.member?.slug === slug);
