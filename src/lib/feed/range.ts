/**
 * The news page's stories for a span of days, a page of 300 at a time:
 * `?from=2026-10-10&to=2026-10-15`, and `&before=` the previous page's `next`.
 * Read by /api/news/range (the website's news page) and by the mobile app's
 * /api/app/v1/news, which answer the same question the same way.
 */
import { rangeCounts, rangeLatest } from '@/lib/feed/store';
import { toStory } from '@/lib/feed/storyView';
import { isMissingTable } from '@/lib/posts/db';
import type { StoryView } from '@/lib/newsView';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type RangeAnswer =
  | { ok: false }
  | { ok: true; from: string; to: string; stories: StoryView[]; next: string | null; counts: { news: number; video: number } | null; unavailable?: true };

/** A span's stories from the query string, or `ok: false` when the span is not a valid one. */
export async function newsRange(params: URLSearchParams): Promise<RangeAnswer> {
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const before = params.get('before') ?? undefined;
  if (!DAY.test(from) || !DAY.test(to) || from > to || (before !== undefined && Number.isNaN(Date.parse(before)))) return { ok: false };
  try {
    // The span's own totals come with its first page, for the line above the list.
    const [{ items, next }, counts] = await Promise.all([rangeLatest(from, to, before), before ? null : rangeCounts(from, to)]);
    return { ok: true, from, to, stories: items.map(toStory), next, counts };
  } catch (e) {
    if (isMissingTable(e)) return { ok: true, from, to, stories: [], next: null, counts: null, unavailable: true };
    throw e;
  }
}
