/**
 * The link-preview image, 1200x630, in Bangla, of a cabinet member from
 * outside parliament (/ministers/[slug]); drawn by src/lib/og/adviserCard.tsx,
 * which says how. The English card is ./en.
 */
import { adviserCard } from '@/lib/og/adviserCard';

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return adviserCard(slug, 'bn');
}
