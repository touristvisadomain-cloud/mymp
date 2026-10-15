/**
 * The live feed, in the shape the news page already draws.
 *
 * /songbad was built on the engine's published headlines, a snapshot taken at
 * build time. The collectors now bring in far more than that snapshot ever
 * held, and videos besides, so the page reads them here. The older snapshot is
 * not thrown away: its stories are merged in, and anything the feed has not
 * seen keeps its place on the page.
 */
import { getMemberById, partyColor } from '@/lib/data';
import { allStories, dayLabel, type StoryView, type StoryMember } from '@/lib/newsView';
import { latestItems, canonicalUrl, type LatestEntry } from './store';
import { isMissingTable } from '@/lib/posts/db';
import { FEED_FROM } from './window';
import { fixJoiners } from '@/lib/joiners.mjs';
import { allMembers } from '@/lib/data';

/** Slugs of members who have left the House: their news is not on the news page. */
const LEFT_SLUGS = new Set(allMembers.filter((m) => m.resignedOn).map((m) => m.slug));

const member = (id: string): StoryMember | null => {
  const m = getMemberById(id);
  return m ? { slug: m.slug, name: m.nameBn ?? m.nameEn ?? '', party: m.party?.abbr ?? null, color: partyColor(m.party?.abbr) } : null;
};

/** The day a story belongs to is the day it was published in Dhaka. */
const dhakaDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

export function toStory(item: LatestEntry): StoryView {
  const members = item.mpIds.map(member).filter((m): m is StoryMember => !!m);
  const date = dhakaDay(item.publishedAt);
  return {
    id: `feed-${item.id}`,
    date,
    dateLabel: dayLabel(date),
    publishedAt: item.publishedAt,
    lead: { title: fixJoiners(item.title), source: item.outletName ?? '', url: item.url },
    also: item.alsoIn.map((a) => ({ title: fixJoiners(item.title), source: a.outletName ?? '', url: a.url })),
    member: members[0] ?? null,
    members,
    kind: item.type === 'video' ? 'video' : item.type === 'press' ? 'press' : 'news',
    thumbnail: item.thumbnailUrl,
    durationSeconds: item.durationSeconds,
  };
}

/**
 * Everything the news page shows, newest first: the feed, then whatever the
 * build-time snapshot holds that the feed has never seen. A story is the same
 * story when its address is, so nothing appears twice.
 */
export async function newsPageStories(limit = 400): Promise<{ stories: StoryView[]; live: boolean }> {
  let live: StoryView[] = [];
  let reachable = true;
  try {
    live = (await latestItems({ limit })).map(toStory);
  } catch (e) {
    // Before the migration is run, or if Supabase is unreachable, the page
    // still has the snapshot: it shows what it has rather than an error.
    if (!isMissingTable(e)) console.error('the feed could not be read for /songbad', e);
    reachable = false;
  }

  const seen = new Set(live.flatMap((s) => [s.lead.url, ...s.also.map((a) => a.url)].map(canonicalUrl)));
  // The build-time snapshot keeps to the same window and the sitting House.
  const older = allStories().filter(
    (s) => !seen.has(canonicalUrl(s.lead.url)) && s.date >= FEED_FROM && !(s.member && LEFT_SLUGS.has(s.member.slug)),
  );

  const stories = [...live, ...older].sort((a, b) => b.date.localeCompare(a.date));
  return { stories: stories.slice(0, limit), live: reachable };
}

/** The newest member videos from the live feed, for the home page; none when the feed cannot be read. */
export async function latestVideos(limit = 8): Promise<StoryView[]> {
  try {
    return (await latestItems({ limit, type: 'video' })).map(toStory);
  } catch (e) {
    if (!isMissingTable(e)) console.error('the feed could not be read for the home page videos', e);
    return [];
  }
}
