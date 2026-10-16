import { permanentRedirect } from 'next/navigation';
import { getT } from '@/i18n/server';

/** These profiles lived here for a day before moving under /ministers, with the rest of the cabinet. */
export default async function OldAdviserAddress({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getT();
  permanentRedirect(t.href(`/ministers/${slug}`));
}
