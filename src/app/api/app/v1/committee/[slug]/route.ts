/** One committee: what it does, its members and its notices (/committee/<slug>). `?lang=en` for English. */
import { committeeDetail, committeeSlugs } from '@/lib/app/house';
import { appJson, appLang, notFound } from '@/lib/app/respond';

export const revalidate = 3600;

export function generateStaticParams() {
  return committeeSlugs().map((slug) => ({ slug }));
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const committee = committeeDetail(slug, appLang(req));
  return committee ? appJson(req, committee) : notFound(req);
}
