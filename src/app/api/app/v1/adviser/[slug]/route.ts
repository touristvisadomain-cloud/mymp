/** An adviser from outside parliament, as the app's profile screen draws them. `?lang=en` for English. */
import { adviserDetail } from '@/lib/app/payload';
import { allAdvisers } from '@/lib/advisers';
import { appJson, appLang, notFound } from '@/lib/app/respond';

export const revalidate = 3600;

export function generateStaticParams() {
  return allAdvisers().map((a) => ({ slug: a.slug }));
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const adviser = adviserDetail(slug, appLang(req));
  return adviser ? appJson(req, adviser) : notFound(req);
}
