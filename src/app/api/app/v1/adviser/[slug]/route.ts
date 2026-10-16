/** An adviser from outside parliament, as the app's profile screen draws them. */
import { NextResponse } from 'next/server';
import { adviserDetail } from '@/lib/app/payload';
import { allAdvisers } from '@/lib/advisers';
import { gzipJson } from '@/lib/gzipJson';

export const revalidate = 3600;

export function generateStaticParams() {
  return allAdvisers().map((a) => ({ slug: a.slug }));
}

async function handle(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const adviser = adviserDetail(slug);
  if (!adviser) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(adviser, {
    headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400', 'access-control-allow-origin': '*' },
  });
}

/** The JSON, gzipped for a browser that accepts it (lib/gzipJson). */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return gzipJson(req, await handle(req, ctx));
}
