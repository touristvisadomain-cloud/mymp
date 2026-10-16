import { permanentRedirect } from 'next/navigation';

/** These profiles lived here for a day before moving under /ministers, with the rest of the cabinet. */
export default async function OldAdviserAddress({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/ministers/${slug}`);
}
