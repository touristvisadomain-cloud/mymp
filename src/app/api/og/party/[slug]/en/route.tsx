/** A party's link-preview image in English, for shares of the English page (src/lib/og/partyCard.tsx). */
import { partyCard } from '@/lib/og/partyCard';

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return partyCard(slug, 'en');
}
