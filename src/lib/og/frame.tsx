/**
 * What every drawn share card has in common, for the cards that came after
 * the member and party cards (districts, committees, cabinet members outside
 * parliament, and the list pages): the 1200x630 green ground, an accent band
 * down the left edge, the site's mark top left, the address bottom right, and
 * a centre 630x630 column for everything that matters, because WhatsApp shows
 * a link as a square cut from the middle. The look is the member card's
 * (src/lib/og/mpCard.tsx).
 */
import { Fragment, isValidElement, type ReactNode } from 'react';
import { ImageResponse } from 'next/og';
import type { TextImage } from '@/lib/og/banglaText';
import { OG_BRAND, OG_DARK } from '@/lib/og/colours';

export const W = 1200;
export const H = 630;
export const SAFE = 630;
/** The width text may take inside the centre square. */
export const TEXT_WIDTH = SAFE - 90;

/** Drawn on first request; a crawler and the CDN keep it a day. */
const CACHE = { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' };

/** A remote photo as a data URL, or null when it cannot be had in eight seconds. */
export async function photoData(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const type = r.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

/** A line of shaped text (src/lib/og/banglaText.ts) at its own size. */
export const Text = ({ t }: { t: TextImage }) => <img src={t.src} width={t.width} height={t.height} />;

/** Text in a translucent pill, as the member card shows a seat. */
export const Pill = ({ t, strong = false }: { t: TextImage; strong?: boolean }) => (
  <div
    style={{
      display: 'flex',
      padding: '8px 20px',
      borderRadius: 9999,
      background: strong ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.12)',
      border: strong ? 'none' : '1px solid rgba(255,255,255,0.3)',
    }}
  >
    <Text t={t} />
  </div>
);

/** The site's mark, the white rounded square with a green dot, at any size; `inverse` draws it green on white. */
export const Mark = ({ size, inverse = false }: { size: number; inverse?: boolean }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.26, background: inverse ? OG_BRAND : '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: size * 0.41, height: size * 0.41, borderRadius: 9999, display: 'flex', background: inverse ? '#ffffff' : OG_BRAND }} />
  </div>
);

/** A white disc in the member card's shadow, holding a photo, a symbol or the mark. */
export const Disc = ({ size, children }: { size: number; children?: ReactNode }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 9999,
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxShadow: '0 18px 44px rgba(0,0,0,0.3)',
    }}
  >
    {children}
  </div>
);

/** A round photo in a white ring, or a pale disc where there is none. */
export const Photo = ({ src, size, ring = 5 }: { src: string | null; size: number; ring?: number }) => (
  <Disc size={size + 2 * ring}>
    {src ? (
      <img src={src} width={size} height={size} style={{ borderRadius: 9999, objectFit: 'cover' }} />
    ) : (
      <div style={{ width: size, height: size, borderRadius: 9999, display: 'flex', background: '#e8efe9' }} />
    )}
  </Disc>
);

/* eslint-enable @next/next/no-img-element, jsx-a11y/alt-text */

/** The whole card around a centre column; `accent` colours the band down the left edge. */
export function card(content: ReactNode, { accent = OG_BRAND, gap = 16 }: { accent?: string; gap?: number } = {}): Response {
  // ImageResponse lays a fragment out as one box in a row; its children belong in the column itself.
  const children = isValidElement<{ children?: ReactNode }>(content) && content.type === Fragment ? content.props.children : content;
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: `linear-gradient(135deg, ${OG_BRAND} 0%, ${OG_DARK} 100%)`,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, display: 'flex', background: accent }} />

        <div style={{ position: 'absolute', left: 54, top: 46, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Mark size={34} />
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.9)', letterSpacing: 1 }}>MY MP</div>
        </div>

        <div style={{ width: SAFE, height: SAFE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap }}>
          {children}
        </div>

        <div style={{ position: 'absolute', right: 54, bottom: 46, display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 }}>
          mymp.bd
        </div>
      </div>
    ),
    { width: W, height: H, headers: CACHE },
  );
}
