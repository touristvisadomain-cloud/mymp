/**
 * A party's link-preview image, 1200x630.
 *
 * The whole centre 630x630 square is one column — symbol, name, seats in this
 * parliament, its head — because WhatsApp shows a link as a square cut from the
 * middle, and a symbol alone says less than a symbol with a name under it. The
 * wide card that Facebook and X show adds the site's mark on the left and the
 * address on the right, outside that square, so nothing is lost either way.
 *
 * Bangla is shaped by HarfBuzz (src/lib/og/banglaText.ts). Drawn on first
 * request and cached for a day.
 *
 * Drawn in either language: the English card (/api/og/party/<slug>/en) is for
 * the English page's shares. Noto Sans Bengali has Latin letters too.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getParty, bn } from '@/lib/data';
import { bnTextImage } from '@/lib/og/banglaText';
import { partyProfile, foundedYear } from '@/lib/partyProfiles';
import { partyName } from '@/i18n/names';
import type { Lang } from '@/i18n/core';
import { OG_BRAND, OG_DARK, ogPartyColour } from '@/lib/og/colours';


const W = 1200;
const H = 630;
const SAFE = 630;
const TEXT_WIDTH = SAFE - 90;

// The logo files are white squares, so each must sit wholly inside its disc:
// side ≤ disc / √2.
const DISC = 220;
const LOGO_SIZE = 150;

// One literal path per logo, so the build bundles exactly these files with the
// function; a computed path makes Turbopack trace the whole project.
const LOGO: Record<string, () => Buffer> = {
  BNP: () => readFileSync(join(process.cwd(), 'public/party/og/bnp.jpg')),
  BJEI: () => readFileSync(join(process.cwd(), 'public/party/og/bjei.jpg')),
  NCP: () => readFileSync(join(process.cwd(), 'public/party/og/ncp.jpg')),
  BKM: () => readFileSync(join(process.cwd(), 'public/party/og/bkm.jpg')),
  IMB: () => readFileSync(join(process.cwd(), 'public/party/og/imb.jpg')),
  GOP: () => readFileSync(join(process.cwd(), 'public/party/og/gop.jpg')),
  BJP: () => readFileSync(join(process.cwd(), 'public/party/og/bjp.jpg')),
  KM: () => readFileSync(join(process.cwd(), 'public/party/og/km.jpg')),
  PSM: () => readFileSync(join(process.cwd(), 'public/party/og/psm.jpg')),
  JAGPA: () => readFileSync(join(process.cwd(), 'public/party/og/jagpa.jpg')),
};

/** The card for a party, in the given language; 404 for an unknown party or one without a logo. */
export async function partyCard(slug: string, lang: Lang): Promise<Response> {
  const en = lang === 'en';
  const p = getParty(slug);
  const read = p ? LOGO[p.abbr] : undefined;
  if (!p || !read) return new Response('Not found', { status: 404 });

  const profile = partyProfile(p, lang);
  const year = foundedYear(profile);
  const leader = profile?.leaderName ? `${profile.leaderTitle ?? (en ? 'Leader' : 'প্রধান')}${en ? ': ' : ' '}${profile.leaderName}` : null;
  const logo = `data:image/jpeg;base64,${read().toString('base64')}`;
  const accent = ogPartyColour(p.abbr);

  const white = { color: '#ffffff' };
  const [name, seats, lead, founded] = await Promise.all([
    bnTextImage(en ? partyName(p, 'en') : p.nameBn ?? p.abbr, { ...white, weight: 'bold', maxSize: 50, minSize: 30, maxWidth: TEXT_WIDTH, maxLines: 2, leading: 1.2, align: 'center' }),
    bnTextImage(en ? `${p.seats} ${p.seats === 1 ? 'seat' : 'seats'} in the 13th Parliament` : `ত্রয়োদশ সংসদে ${bn(p.seats)}টি আসন`, { ...white, weight: 'bold', maxSize: 28, minSize: 21, maxWidth: TEXT_WIDTH - 48, maxLines: 1 }),
    leader ? bnTextImage(leader, { ...white, weight: 'regular', maxSize: 27, minSize: 20, maxWidth: TEXT_WIDTH, maxLines: 1, opacity: 0.9 }) : null,
    year ? bnTextImage(en ? `Founded ${year}` : `প্রতিষ্ঠা ${bn(year)}`, { ...white, weight: 'regular', maxSize: 24, minSize: 19, maxWidth: TEXT_WIDTH, maxLines: 1, opacity: 0.75 }) : null,
  ]);

  /* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
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
        {/* The party's colour as a band down the left edge of the whole card. */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, display: 'flex', background: accent }} />

        <div style={{ position: 'absolute', left: 54, top: 46, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 14, height: 14, borderRadius: 9999, display: 'flex', background: OG_BRAND }} />
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.9)', letterSpacing: 1 }}>MY MP</div>
        </div>

        <div
          style={{
            width: SAFE,
            height: SAFE,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 15,
          }}
        >
          <div
            style={{
              width: DISC,
              height: DISC,
              borderRadius: 9999,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 18px 44px rgba(0,0,0,0.3)',
            }}
          >
            <img src={logo} width={LOGO_SIZE} height={LOGO_SIZE} style={{ objectFit: 'contain' }} />
          </div>

          <img src={name.src} width={name.width} height={name.height} />

          <div style={{ display: 'flex', padding: '8px 20px', borderRadius: 9999, background: 'rgba(255,255,255,0.15)' }}>
            <img src={seats.src} width={seats.width} height={seats.height} />
          </div>

          {lead && <img src={lead.src} width={lead.width} height={lead.height} />}
          {founded && <img src={founded.src} width={founded.width} height={founded.height} />}
        </div>

        <div style={{ position: 'absolute', right: 54, bottom: 46, display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 }}>
          mymp.bd
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' },
    },
  );
  /* eslint-enable @next/next/no-img-element, jsx-a11y/alt-text */
}
