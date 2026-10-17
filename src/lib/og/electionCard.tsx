/**
 * The election page's link-preview image, 1200x630: the map of Bangladesh in
 * the centre square that WhatsApp keeps, each of the 300 seats in the colour
 * of the party that holds it, the election's name on the left and the seats
 * each party holds on the right, which Facebook and X show in full.
 *
 * The seats are drawn over a real map (OpenStreetMap, src/lib/og/basemap.ts)
 * so the country's towns and rivers show through; the outlines are the seat
 * map's own (src/lib/og/seatMap.ts) and the seats' holders the sitting
 * members of the 300 territorial seats. Bangla is shaped by HarfBuzz
 * (src/lib/og/banglaText.ts). Drawn in either language: the English card is
 * /api/og/pages/nirbachon/en.
 */
import { ImageResponse } from 'next/og';
import { districtOf, getMemberById, seats } from '@/lib/data';
import { bnTextImage } from '@/lib/og/banglaText';
import { OG_BRAND, OG_DARK, ogPartyColour } from '@/lib/og/colours';
import { Mark, Text, W, H, SAFE } from '@/lib/og/frame';
import { isIndependent } from '@/lib/seo/mpDescription';
import { AREAS, boxOf, seatOf } from '@/lib/og/seatMap';
import { basemap, BASEMAP_CREDIT, fitZoom } from '@/lib/og/basemap';
import { partyShort } from '@/i18n/names';
import { makeT, type Lang } from '@/i18n/core';

const VACANT = '#b8c4bd';
const MAP = SAFE - 30;
const SIDE = (W - SAFE) / 2 - 64;
const CACHE = { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' };

/** Who holds each territorial seat now: the party's code, or null for a vacant seat. */
function holders() {
  const out: { seat: string; district: string; party: string | null; label: (lang: Lang) => string }[] = [];
  for (const s of seats) {
    if (s.reserved) continue;
    const d = districtOf(s);
    if (!d) continue;
    const m = s.memberId && !s.vacantSince ? getMemberById(s.memberId) : undefined;
    const ind = m ? isIndependent(m) : false;
    const party = m ? (ind ? 'Ind' : m.party?.abbr ?? null) : null;
    out.push({
      seat: s.slug,
      district: d.slug,
      party,
      label: (lang) => (ind ? (lang === 'en' ? 'Independent' : 'স্বতন্ত্র') : m?.party ? partyShort(m.party, lang) : ''),
    });
  }
  return out;
}

export async function electionCard(lang: Lang): Promise<Response> {
  const t = makeT(lang);
  const all = holders();

  // The House's seats by party, largest first.
  const tally = new Map<string, { label: string; colour: string; n: number }>();
  for (const h of all) {
    if (h.party) {
      const e = tally.get(h.party) ?? { label: h.label(lang), colour: ogPartyColour(h.party), n: 0 };
      e.n++;
      tally.set(h.party, e);
    }
  }
  const partyOfSeat = new Map(all.map((h) => [h.seat, h.party]));
  // The real map under the centre square, the country fitted inside it.
  const box = boxOf(AREAS);
  const base = await basemap((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, fitZoom(box, MAP - 24, MAP - 24, 8), MAP, MAP);
  const shape = (ring: number[][]) => `M${ring.map(([x, y]) => base.project(x!, y!).map((v) => v.toFixed(1)).join(',')).join('L')}Z`;
  const fills = AREAS.map((a) => {
    const seat = seatOf(a);
    const party = seat ? partyOfSeat.get(seat) : null;
    return `<path d="${a.r.map(shape).join('')}" fill="${party ? ogPartyColour(party) : VACANT}" fill-opacity="0.72" fill-rule="evenodd"/>`;
  }).join('');
  const borders = AREAS.map((a) => a.r.map(shape).join('')).join('');
  const overlay = `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP}" height="${MAP}" viewBox="0 0 ${MAP} ${MAP}">${fills}<path d="${borders}" fill="none" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.8"/></svg>`,
  ).toString('base64')}`;
  const rows = [...tally.values()].sort((a, b) => b.n - a.n);
  const shown = rows.slice(0, 4);
  const rest = rows.slice(4).reduce((n, r) => n + r.n, 0);

  const white = { color: '#ffffff' };
  const [kicker, title, sub, ...labels] = await Promise.all([
    bnTextImage(t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament'), { ...white, weight: 'regular', maxSize: 24, minSize: 18, maxWidth: SIDE, maxLines: 1, opacity: 0.9 }),
    bnTextImage(t('নির্বাচন ২০২৬', 'Election 2026'), { ...white, weight: 'bold', maxSize: 54, minSize: 36, maxWidth: SIDE, maxLines: 2, leading: 1.15 }),
    bnTextImage(t('আসনভিত্তিক ফলাফল ও মানচিত্র', 'Results seat by seat, on the map'), { ...white, weight: 'regular', maxSize: 24, minSize: 18, maxWidth: SIDE, maxLines: 2, leading: 1.3, opacity: 0.9 }),
    ...shown.map((r) => bnTextImage(`${r.label} ${t.n(r.n)}`, { ...white, weight: 'bold', maxSize: 28, minSize: 18, maxWidth: SIDE - 34, maxLines: 1 })),
    ...(rest ? [bnTextImage(t(`অন্যান্য ${t.n(rest)}`, `Others ${rest}`), { ...white, weight: 'regular', maxSize: 24, minSize: 18, maxWidth: SIDE - 34, maxLines: 1, opacity: 0.9 })] : []),
  ]);
  // The smaller parties share one colour on the map, so they share it here too.
  const legend = [...shown.map((r) => r.colour), ...(rest ? [ogPartyColour('OTHER')] : [])];

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: `linear-gradient(135deg, ${OG_BRAND} 0%, ${OG_DARK} 100%)` }}>
        <div style={{ position: 'absolute', left: 54, top: 46, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Mark size={34} />
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.9)', letterSpacing: 1 }}>MY MP</div>
        </div>

        {/* Left: what this is. */}
        <div style={{ position: 'absolute', left: 54, top: 0, bottom: 0, width: SIDE, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          <Text t={kicker} />
          <Text t={title} />
          <Text t={sub} />
        </div>

        {/* Centre: the map, in the square WhatsApp keeps. */}
        <div style={{ position: 'absolute', left: (W - SAFE) / 2, top: 0, width: SAFE, height: SAFE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* The real map in a rounded frame, the seats in their holders' colours over it. */}
          <div style={{ width: MAP, height: MAP, borderRadius: 28, overflow: 'hidden', position: 'relative', display: 'flex', background: '#aad3df', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
            {base.tiles.map((tl) => (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img key={`${tl.left},${tl.top}`} src={tl.src} width={tl.size} height={tl.size} style={{ position: 'absolute', left: tl.left, top: tl.top }} />
            ))}
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={overlay} width={MAP} height={MAP} style={{ position: 'absolute', left: 0, top: 0 }} />
            <div style={{ position: 'absolute', right: 8, bottom: 6, display: 'flex', fontSize: 12, color: '#3d4a43', padding: '1px 6px', background: 'rgba(255,255,255,0.8)', borderRadius: 4 }}>
              {BASEMAP_CREDIT}
            </div>
          </div>
        </div>

        {/* Right: the seats each party holds. */}
        <div style={{ position: 'absolute', right: 54, top: 0, bottom: 0, width: SIDE, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          {labels.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: legend[i], border: '2px solid rgba(255,255,255,0.8)', display: 'flex' }} />
              <Text t={l} />
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', right: 54, bottom: 46, display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 }}>mymp.bd</div>
      </div>
    ),
    { width: W, height: H, headers: CACHE },
  );
}
