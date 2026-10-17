/**
 * The link-preview image, 1200x630, of a cabinet member from outside
 * parliament (/ministers/[slug]): the member card's layout (src/lib/og/mpCard.tsx)
 * with the photo the cabinet list carries, the post, the name, and the
 * ministries where a member card has a seat and party.
 *
 * Bangla is shaped by HarfBuzz (src/lib/og/banglaText.ts). Drawn in either
 * language: the English card (/api/og/ministers/<slug>/en) is for the English
 * page's shares; a name or ministry with no English yet is drawn as the
 * English page shows it (src/lib/advisers.ts).
 */
import { getAdviser, adviserPosts, adviserName, adviserRole, rankIn } from '@/lib/advisers';
import { bnTextImage } from '@/lib/og/banglaText';
import { card, Photo, photoData, Pill, Text, TEXT_WIDTH } from '@/lib/og/frame';
import { inLang } from '@/i18n/content';
import type { Lang } from '@/i18n/core';

const PHOTO = 200;

/** The card for a cabinet member from outside parliament, in the given language; 404 for an unknown one. */
export async function adviserCard(slug: string, lang: Lang): Promise<Response> {
  const a = getAdviser(slug);
  if (!a) return new Response('Not found', { status: 404 });

  const { rows, photoUrl } = adviserPosts(a);
  // The ministries in the card's language; on the English card, those with no English yet are left out, as on the page.
  const ministries = [...new Set(rows.map((r) => inLang(r.ministryBn, lang)).filter((x): x is string => !!x))];
  const detail = ministries.length ? ministries.join('; ') : rankIn(a.rankBn, lang);
  const white = { color: '#ffffff' };

  const [role, name, more, photo] = await Promise.all([
    bnTextImage(adviserRole(a, lang), { ...white, weight: 'bold', maxSize: 26, minSize: 18, maxWidth: TEXT_WIDTH - 40, maxLines: 1 }),
    bnTextImage(adviserName(a, lang).text, { ...white, weight: 'bold', maxSize: 58, minSize: 32, maxWidth: TEXT_WIDTH, maxLines: 2, leading: 1.18, align: 'center' }),
    detail ? bnTextImage(detail, { ...white, weight: 'regular', maxSize: 25, minSize: 19, maxWidth: TEXT_WIDTH, maxLines: 3, leading: 1.3, align: 'center', opacity: 0.9 }) : null,
    photoData(photoUrl),
  ]);

  return card(
    <>
      <Photo src={photo} size={PHOTO} />
      <Pill t={role} />
      <Text t={name} />
      {more && <Text t={more} />}
    </>,
    { gap: 18 },
  );
}
