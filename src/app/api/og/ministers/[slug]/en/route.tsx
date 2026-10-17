/** The same cabinet member's link-preview image in English, for shares of the English page (src/lib/og/adviserCard.tsx). */
import { adviserCard } from '@/lib/og/adviserCard';

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return adviserCard(slug, 'en');
}
