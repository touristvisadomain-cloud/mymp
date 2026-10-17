/** A list page's link-preview image in English, for shares of the English page (src/lib/og/pageCard.tsx). */
import { pageCard } from '@/lib/og/pageCard';

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return pageCard(key, 'en');
}
