/** One seat: its member, area, earlier members and results (/ason/<slug>). `?lang=en` for English. */
import { seatDetail, seatSlugs } from '@/lib/app/places';
import { appJson, appLang, notFound } from '@/lib/app/respond';

export const revalidate = 3600;

export function generateStaticParams() {
  return seatSlugs().map((slug) => ({ slug }));
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const seat = seatDetail(slug, appLang(req));
  return seat ? appJson(req, seat) : notFound(req);
}
