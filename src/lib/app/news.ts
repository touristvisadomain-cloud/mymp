/**
 * The news and videos, as the app's সংবাদ screen reads them: the stories the
 * website's /songbad draws, and on an English response everything around a
 * headline in English. The headline itself is the outlet's own words: on an
 * English response `title` carries its machine translation when there is one
 * (`titleTranslated: true`, show "Translated automatically from Bangla"), the
 * outlet's Bangla when there is none yet, and `titleOriginal` always the
 * outlet's own, as the English website does.
 */
import { getMember } from '@/lib/data';
import { dayLabel, type StoryView, type StoryMember, type StoryLink } from '@/lib/newsView';
import { siteCounts } from '@/lib/feed/store';
import { isMissingTable } from '@/lib/posts/db';
import { personName, outletName } from '@/i18n/names';
import type { Lang } from '@/i18n/core';
import { enOnly } from '@/lib/app/respond';
import { NEWS_SOURCES } from '../../../config/news-sources';

/** A story's member on an English response: `name` is the English name, null when there is none. */
const memberIn = (m: StoryMember): Omit<StoryMember, 'name'> & { name: string | null } => {
  const own = getMember(m.slug);
  return { ...m, name: enOnly(m.nameEn ?? (own ? personName(own, 'en') : null)), nameEn: m.nameEn ?? (own ? personName(own, 'en') : undefined) };
};

/** One headline on an English response: the English when there is some, and the outlet's own beside it. */
export function headlineIn(title: string, titleEn: string | null | undefined) {
  const en = titleEn ?? null;
  return { title: en ?? title, titleOriginal: title, titleEn: en, titleTranslated: !!en && en !== title };
}

/** A headline's link on an English response: the headline as above, the outlet's English name (null when the site has none yet). */
const linkIn = (l: StoryLink) => ({ ...l, ...headlineIn(l.title, l.titleEn), source: enOnly(outletName(l.source, 'en')) });

/** A story in the response's language; on Bangla exactly as the website's news page has it. */
export function storyIn(s: StoryView, lang: Lang) {
  if (lang === 'bn') return s;
  return {
    ...s,
    dateLabel: dayLabel(s.date, 'en'),
    lead: linkIn(s.lead),
    also: s.also.map(linkIn),
    member: s.member ? memberIn(s.member) : null,
    ...(s.members ? { members: s.members.map(memberIn) } : {}),
  };
}

/** The news page's figures: today's, everything's and each month's, and how many outlets the site reads. */
export async function newsCounts() {
  try {
    return { ...(await siteCounts()), outletCount: NEWS_SOURCES.length };
  } catch (e) {
    // Before the feed's tables exist there is nothing to count; the screen says so rather than breaking.
    if (!isMissingTable(e)) throw e;
    return { today: { news: 0, video: 0, outlets: 0 }, total: { news: 0, video: 0 }, months: [], outletCount: NEWS_SOURCES.length, unavailable: true as const };
  }
}

type FeedItemLike = {
  title?: string;
  titleEn?: string | null;
  summary?: string | null;
  summaryEn?: string | null;
  outletName?: string | null;
  alsoIn?: { outletName: string | null }[];
};

/**
 * A member's feed (/api/feed/<slug>) for an English reader: each outlet under
 * its English name, null when the site has none for it yet; the headline and
 * summary in English where they have been translated (`titleTranslated`,
 * `summaryTranslated`), the outlet's own words otherwise, and the outlet's own
 * always in `titleOriginal` and `summaryOriginal`.
 */
export function feedInEnglish<B extends Record<string, unknown>>(body: B): B {
  const outlet = (name: string | null | undefined) => (name ? enOnly(outletName(name, 'en')) : null);
  const item = (i: FeedItemLike) => {
    const summaryEn = i.summaryEn ?? null;
    return {
      ...i,
      ...(typeof i.title === 'string' ? headlineIn(i.title, i.titleEn) : {}),
      summary: summaryEn ?? i.summary ?? null,
      summaryOriginal: i.summary ?? null,
      summaryEn,
      summaryTranslated: !!summaryEn && summaryEn !== i.summary,
      outletName: outlet(i.outletName),
      alsoIn: (i.alsoIn ?? []).map((a) => ({ ...a, outletName: outlet(a.outletName) })),
    };
  };
  const out: Record<string, unknown> = { ...body, lang: 'en' };
  for (const k of ['pinned', 'items'] as const) if (Array.isArray(body[k])) out[k] = (body[k] as FeedItemLike[]).map(item);
  if (Array.isArray(body.outlets)) out.outlets = (body.outlets as string[]).map(outlet);
  return out as B;
}
