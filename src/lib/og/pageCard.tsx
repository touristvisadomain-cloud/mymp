/**
 * A list page's link-preview image, 1200x630, by page key (src/lib/og/pages.ts):
 * the site's mark in a white disc where the other cards have a photo or a
 * symbol, the parliament (or the site) above, the page's name, and its one
 * figure in a pill, all in the centre square that WhatsApp keeps
 * (src/lib/og/frame.tsx).
 *
 * Bangla is shaped by HarfBuzz (src/lib/og/banglaText.ts). Drawn in either
 * language: the English card (/api/og/pages/<key>/en) is for the English
 * page's shares.
 */
import { bnTextImage } from '@/lib/og/banglaText';
import { card, Disc, Mark, Pill, Text, TEXT_WIDTH } from '@/lib/og/frame';
import { isPageKey, pageCardText } from '@/lib/og/pages';
import { makeT, type Lang } from '@/i18n/core';
import { electionCard } from '@/lib/og/electionCard';

const DISC = 190;

/** The card for a list page, in the given language; 404 for a key no page has. */
export async function pageCard(key: string, lang: Lang): Promise<Response> {
  if (!isPageKey(key)) return new Response('Not found', { status: 404 });
  // The election's card is its map (src/lib/og/electionCard.tsx).
  if (key === 'nirbachon') return electionCard(lang);
  const { kicker, title, figure } = pageCardText(key, makeT(lang));
  const white = { color: '#ffffff' };

  const [top, name, count] = await Promise.all([
    bnTextImage(kicker, { ...white, weight: 'regular', maxSize: 24, minSize: 19, maxWidth: TEXT_WIDTH - 48, maxLines: 1, opacity: 0.92 }),
    bnTextImage(title, { ...white, weight: 'bold', maxSize: 60, minSize: 36, maxWidth: TEXT_WIDTH, maxLines: 2, leading: 1.18, align: 'center' }),
    figure ? bnTextImage(figure, { ...white, weight: 'bold', maxSize: 30, minSize: 22, maxWidth: TEXT_WIDTH - 48, maxLines: 1 }) : null,
  ]);

  return card(
    <>
      <Disc size={DISC}>
        <Mark size={92} inverse />
      </Disc>
      <Pill t={top} />
      <Text t={name} />
      {count && <Pill t={count} strong />}
    </>,
    { gap: 18 },
  );
}
