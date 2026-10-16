/**
 * One member, as the app's profile screen draws it: the same facts the
 * member's page on mymp.bd shows, and no others. The news and videos come
 * separately, from /api/feed/[slug], which the app reads too. Members who
 * have resigned are here too (the bootstrap's `former`). `?lang=en` for English.
 */
import { memberDetail } from '@/lib/app/payload';
import { allMembers } from '@/lib/data';
import { appJson, appLang, notFound } from '@/lib/app/respond';

export const revalidate = 3600;

export function generateStaticParams() {
  return allMembers.map((m) => ({ slug: m.slug }));
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const member = memberDetail(slug, appLang(req));
  return member ? appJson(req, member) : notFound(req);
}
