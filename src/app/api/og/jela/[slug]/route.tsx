/**
 * A district's link-preview image, 1200x630, in Bangla; drawn by
 * src/lib/og/districtCard.tsx, which says how. The English card is ./en.
 */
import { districtCard } from '@/lib/og/districtCard';

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return districtCard(slug, 'bn');
}
