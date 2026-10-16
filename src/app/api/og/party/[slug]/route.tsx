/**
 * A party's link-preview image, 1200x630, in Bangla; drawn by
 * src/lib/og/partyCard.tsx, which says how. The English card is ./en.
 */
import { partyCard } from '@/lib/og/partyCard';

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return partyCard(slug, 'bn');
}
