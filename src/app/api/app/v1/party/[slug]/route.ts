/** One party: its profile, logo, seats and members (/dol/<slug>). `?lang=en` for English. */
import { partyDetail, partySlugs } from '@/lib/app/house';
import { appJson, appLang, notFound } from '@/lib/app/respond';

export const revalidate = 3600;

export function generateStaticParams() {
  return partySlugs().map((slug) => ({ slug }));
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const party = partyDetail(slug, appLang(req));
  return party ? appJson(req, party) : notFound(req);
}
