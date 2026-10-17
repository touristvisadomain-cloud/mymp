/**
 * A member's link-preview image, 1200x630.
 *
 * Everything that identifies the person sits inside the centre 630x630 square,
 * because WhatsApp shows a link as a square cut from the middle: the photo in a
 * white ring, the office they hold, their name, their constituency, and their
 * party's symbol. The wide card that Facebook and X show adds the site's mark
 * on the left, and on the right the member's district with their seat's area
 * in the party's colour (src/lib/og/seatMap.ts), outside that square, so
 * nothing important is lost either way.
 *
 * The Bangla is shaped by HarfBuzz (src/lib/og/banglaText.ts) because
 * ImageResponse alone breaks Bangla conjuncts. Drawn on first request and
 * cached for a day.
 *
 * Drawn in either language: the English card (/api/og/mp/<slug>/en) carries
 * the English name, office, seat and party for the English page's shares.
 * Noto Sans Bengali has Latin letters, so the same shaping draws both.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getMember, currentPosts } from '@/lib/data';
import { AREAS, boxOf } from '@/lib/og/seatMap';
import { basemap, BASEMAP_CREDIT, fitZoom, type Basemap } from '@/lib/og/basemap';
import { bnTextImage } from '@/lib/og/banglaText';
import { constituencyBn, constituencyEn, isIndependent, partyBn } from '@/lib/seo/mpDescription';
import { personName, partyName, GOV_POST, HOUSE_ROLE } from '@/i18n/names';
import { english } from '@/i18n/content';
import type { Lang } from '@/i18n/core';
import { OG_BRAND, OG_DARK, ogPartyColour } from '@/lib/og/colours';
import { photoData } from '@/lib/og/frame';


const W = 1200;
const H = 630;
const SAFE = 630;

// The photo sits above the name rather than beside it: a Bangla name is long,
// and the square leaves only about 280px next to a portrait, which broke even
// "তারেক রহমান" onto two lines.
const PHOTO = 208;
const RING = 5;
const TEXT_WIDTH = SAFE - 96;

const SYMBOL = 44;

// The seat on the map: centred right of the square, fitted inside SEAT_W x SEAT_H.
const SEAT_AT = 1010;
const SEAT_W = 300;
const SEAT_H = 430;

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

const partySymbol = (abbr: string | null | undefined): string | null => {
  const read = abbr ? LOGO[abbr] : undefined;
  return read ? `data:image/jpeg;base64,${read().toString('base64')}` : null;
};

/** "পররাষ্ট্র মন্ত্রণালয়" is written "পররাষ্ট্রমন্ত্রী" when it names the person. */
function officeOf(id: string, lang: Lang): string | null {
  if (lang === 'en') return officeEn(id);
  const posts = currentPosts().filter((p) => p.memberId === id);
  if (!posts.length) return null;
  const gov = posts.find((p) => p.type === 'government');
  const house = posts.find((p) => p.type === 'parliament');
  if (gov) {
    // Only a subject ministry merges into the title: "পররাষ্ট্র মন্ত্রণালয়" +
    // "মন্ত্রী" is পররাষ্ট্রমন্ত্রী, while প্রধানমন্ত্রী is already the whole title.
    const mergeable = gov.title === 'মন্ত্রী' || gov.title === 'প্রতিমন্ত্রী' || gov.title === 'উপমন্ত্রী';
    const head = (gov.ministryBn ?? '').replace(/\s*(মন্ত্রণালয়|বিভাগ).*$/, '').trim();
    if (mergeable && head && !head.includes(' ') && !/বিভাগ$/.test(gov.ministryBn ?? '')) return `${head}${gov.title}`;
    return gov.title;
  }
  return house?.title ?? null;
}

/** The same office in English: "Minister for Foreign Affairs", "State Minister for Water Resources", "Prime Minister", "Whip". */
function officeEn(id: string): string | null {
  const posts = currentPosts().filter((p) => p.memberId === id);
  if (!posts.length) return null;
  const gov = posts.find((p) => p.type === 'government');
  const house = posts.find((p) => p.type === 'parliament');
  const post = gov ?? house;
  if (!post) return null;
  const title = GOV_POST[post.title.trim()] ?? Object.values(HOUSE_ROLE).find((r) => r.bn === post.title.trim())?.en ?? null;
  if (!title) return null;
  if (gov && ['Minister', 'State Minister', 'Deputy Minister'].includes(title)) {
    const ministry = english(gov.ministryBn);
    // "Ministry of Foreign Affairs" names the portfolio; a division (or none) leaves the bare title.
    const subject = ministry?.match(/^Ministry of (?:the )?(.+)$/)?.[1];
    if (subject && !/ and .* and /.test(subject)) return `${title} for ${subject}`;
  }
  return title;
}

/** The card for a member, in the given language; 404 for an unknown member. */
export async function mpCard(slug: string, lang: Lang): Promise<Response> {
  const en = lang === 'en';
  const m = getMember(slug);
  if (!m) return new Response('Not found', { status: 404 });

  const independent = isIndependent(m);
  const partyLabel = en ? (independent ? 'Independent' : m.party ? partyName(m.party, 'en') : null) : independent ? 'স্বতন্ত্র' : (partyBn(m.party)?.name ?? null);
  const symbol = independent ? null : partySymbol(m.party?.abbr);
  const accent = ogPartyColour(m.party?.abbr);
  const office = officeOf(m.id, lang);
  // Beside a symbol the party's name has less room.
  const partyWidth = TEXT_WIDTH - (symbol ? SYMBOL + 16 : 0);

  // Where the seat is, on a real map (src/lib/og/basemap.ts): the whole card
  // is the map around the seat, the seat outlined in the party's colour on
  // the right, and the member's details over a green panel that fades into it
  // across the centre square. A reserved seat has no area, so no map.
  const seatSlug = m.seat && !m.seat.reserved ? m.seat.slug : null;
  const own = seatSlug ? AREAS.filter((a) => a.s[seatSlug]) : [];
  let base: Basemap | null = null;
  let outline: string | null = null;
  if (own.length) {
    const box = boxOf(own);
    const zoom = fitZoom(box, SEAT_W, SEAT_H, 12.5);
    const got = await basemap((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, zoom, W, H, SEAT_AT, H / 2);
    if (got.tiles.length) {
      base = got;
      const d = own
        .map((ar) => ar.r.map((ring) => `M${ring.map(([x, y]) => got.project(x!, y!).map((v) => v.toFixed(1)).join(',')).join('L')}Z`).join(''))
        .join('');
      // Only the seat's outer edge: the strokes are masked off inside the seat, so the
      // borders between its upazilas or wards do not show.
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
        `<defs><mask id="out"><rect width="${W}" height="${H}" fill="#fff"/><path d="${d}" fill="#000"/></mask></defs>` +
        `<path d="${d}" fill="${accent}" fill-opacity="0.2"/>` +
        `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="16" stroke-linejoin="round" mask="url(#out)"/>` +
        `<path d="${d}" fill="none" stroke="${accent}" stroke-width="9" stroke-linejoin="round" mask="url(#out)"/></svg>`;
      outline = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }
  }
  const seatLabel = en ? constituencyEn(m) : m.seat?.nameBn;
  const areaCaption = base && seatLabel
    ? bnTextImage(en ? `${seatLabel} constituency` : `${seatLabel} আসনের এলাকা`, { weight: 'bold', maxSize: 22, minSize: 16, maxWidth: 300, maxLines: 1, color: '#ffffff' })
    : null;

  const [officeText, name, seat, party, photo, caption] = await Promise.all([
    office ? bnTextImage(office, { weight: 'bold', maxSize: 27, minSize: 20, maxWidth: TEXT_WIDTH - 48, maxLines: 1, color: '#ffffff' }) : null,
    bnTextImage(en ? personName(m, 'en') : m.nameBn ?? m.nameEn ?? '', { weight: 'bold', maxSize: 62, minSize: 34, maxWidth: TEXT_WIDTH, maxLines: 2, color: '#ffffff', leading: 1.18, align: 'center' }),
    bnTextImage((en ? constituencyEn(m) : constituencyBn(m)) ?? '', { weight: 'regular', maxSize: 30, minSize: 22, maxWidth: TEXT_WIDTH - 48, maxLines: 1, color: '#ffffff' }),
    partyLabel ? bnTextImage(partyLabel, { weight: 'regular', maxSize: 27, minSize: 19, maxWidth: partyWidth, maxLines: 1, color: '#ffffff', opacity: 0.92 }) : null,
    photoData(m.photoUrl),
    areaCaption,
  ]);

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

        {/* The real map, the seat on it, and the green fading into it so the words stay readable. */}
        {base?.tiles.map((tl) => (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img key={`${tl.left},${tl.top}`} src={tl.src} width={tl.size} height={tl.size} style={{ position: 'absolute', left: tl.left, top: tl.top }} />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        {outline && <img src={outline} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} />}
        {base && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: W,
              height: H,
              display: 'flex',
              background: `linear-gradient(90deg, ${OG_DARK} 0%, rgba(10,78,55,0.96) 58%, rgba(10,78,55,0.55) 70%, rgba(10,78,55,0) 80%)`,
            }}
          />
        )}
        {caption && (
          <div style={{ position: 'absolute', right: 40, top: 40, display: 'flex', padding: '8px 16px', borderRadius: 9999, background: 'rgba(10,78,55,0.9)', boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={caption.src} width={caption.width} height={caption.height} />
          </div>
        )}

        {/* Outside the square on the left: the site's mark, so a wide preview is branded. */}
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
            gap: 18,
          }}
        >
          <div
            style={{
              width: PHOTO + 2 * RING,
              height: PHOTO + 2 * RING,
              borderRadius: 9999,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 18px 44px rgba(0,0,0,0.3)',
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img src={photo} width={PHOTO} height={PHOTO} style={{ borderRadius: 9999, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: PHOTO, height: PHOTO, borderRadius: 9999, background: '#e8efe9' }} />
            )}
          </div>

          {officeText && (
            <div
              style={{
                display: 'flex',
                padding: '7px 18px',
                borderRadius: 9999,
                background: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.34)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={officeText.src} width={officeText.width} height={officeText.height} />
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={name.src} width={name.width} height={name.height} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {seat.width > 1 && (
              <div style={{ display: 'flex', padding: '8px 20px', borderRadius: 9999, background: 'rgba(255,255,255,0.15)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                <img src={seat.src} width={seat.width} height={seat.height} />
              </div>
            )}
          </div>

          {party && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {symbol && (
                <div
                  style={{
                    width: SYMBOL,
                    height: SYMBOL,
                    borderRadius: 9999,
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 16px rgba(0,0,0,0.24)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                  <img src={symbol} width={SYMBOL - 10} height={SYMBOL - 10} style={{ borderRadius: 9999, objectFit: 'contain' }} />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={party.src} width={party.width} height={party.height} />
            </div>
          )}
        </div>

        {/* Outside the square on the right: where the link goes, and whose map it is. */}
        <div
          style={{
            position: 'absolute',
            right: base ? 40 : 54,
            bottom: base ? 40 : 46,
            display: 'flex',
            fontSize: 24,
            color: base ? '#ffffff' : 'rgba(255,255,255,0.8)',
            letterSpacing: 0.5,
            ...(base ? { padding: '6px 16px', borderRadius: 9999, background: 'rgba(10,78,55,0.9)' } : {}),
          }}
        >
          mymp.bd
        </div>
        {base && (
          <div style={{ position: 'absolute', right: 6, bottom: 4, display: 'flex', fontSize: 13, color: '#3d4a43', padding: '1px 6px', background: 'rgba(255,255,255,0.75)', borderRadius: 4 }}>
            {BASEMAP_CREDIT}
          </div>
        )}
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' },
    },
  );
}
