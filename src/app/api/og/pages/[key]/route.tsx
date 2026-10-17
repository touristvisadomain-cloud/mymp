/**
 * A list page's link-preview image, 1200x630, in Bangla, by the page's key
 * (/mp is "mp"); drawn by src/lib/og/pageCard.tsx, which says how. The
 * English card is ./en.
 */
import { pageCard } from '@/lib/og/pageCard';

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return pageCard(key, 'bn');
}
