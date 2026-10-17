/** One district: its seats and members, and a paragraph about it (/jela/<slug>). `?lang=en` for English. */
import { districtDetail, districtSlugs } from '@/lib/app/places';
import { appJson, appLang, notFound } from '@/lib/app/respond';

export const revalidate = 3600;

export function generateStaticParams() {
  return districtSlugs().map((slug) => ({ slug }));
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const district = districtDetail(slug, appLang(req));
  return district ? appJson(req, district) : notFound(req);
}
