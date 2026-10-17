/**
 * The news page's figures: today's headlines, videos and outlets, everything
 * since the feed began, each month's, and how many outlets the site reads.
 * Counted by the database, so they are the real totals. Five minutes at the edge.
 */
import { meta } from '@/lib/data';
import { newsCounts } from '@/lib/app/news';
import { appJson, appLang, LIVE } from '@/lib/app/respond';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  return appJson(req, { version: meta.builtAt, lang: appLang(req), ...(await newsCounts()) }, { cache: LIVE });
}
