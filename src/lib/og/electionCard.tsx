/**
 * The election page's link-preview image, 1200x630: the map of Bangladesh in
 * the centre square that WhatsApp keeps, each district in the colour of the
 * party that holds most of its seats (the map's "জেলার রং"), the election's
 * name on the left and the seats each party holds on the right, which
 * Facebook and X show in full.
 *
 * The outlines are public/geo/overview.json, the map's own; the seats are the
 * sitting members of the 300 territorial seats. Bangla is shaped by HarfBuzz
 * (src/lib/og/banglaText.ts). Drawn in either language: the English card is
 * /api/og/pages/nirbachon/en.
 */
import { ImageResponse } from 'next/og';
import overview from '../../../public/geo/overview.json';
import { districtOf, getMemberById, seats } from '@/lib/data';
import { bnTextImage } from '@/lib/og/banglaText';
import { OG_BRAND, OG_DARK, ogPartyColour } from '@/lib/og/colours';
import { Mark, Text, W, H, SAFE } from '@/lib/og/frame';
import { isIndependent } from '@/lib/seo/mpDescription';
import { partyShort } from '@/i18n/names';
import { makeT, type Lang } from '@/i18n/core';

type District = { slug: string; polys: number[][][] };
const VACANT = '#b8c4bd';
const MAP = 520;
const SIDE = (W - SAFE) / 2 - 64;
const CACHE = { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' };

/** Who holds each territorial seat now: the party's code, or null for a vacant seat. */
function holders() {
  const out: { district: string; party: string | null; label: (lang: Lang) => string }[] = [];
  for (const s of seats) {
    if (s.reserved) continue;
    const d = districtOf(s);
    if (!d) continue;
    const m = s.memberId && !s.vacantSince ? getMemberById(s.memberId) : undefined;
    const ind = m ? isIndependent(m) : false;
    const party = m ? (ind ? 'Ind' : m.party?.abbr ?? null) : null;
    out.push({
      district: d.slug,
      party,
      label: (lang) => (ind ? (lang === 'en' ? 'Independent' : 'স্বতন্ত্র') : m?.party ? partyShort(m.party, lang) : ''),
    });
  }
  return out;
}

/** The map as an SVG data URL: every district filled with its leading party's colour, white borders. */
function mapImage(lead: Map<string, string | null>): string {
  const districts = (overview as { districts: District[] }).districts;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const d of districts) for (const p of d.polys) for (const [x, y] of p) {
    minX = Math.min(minX, x!); maxX = Math.max(maxX, x!); minY = Math.min(minY, y!); maxY = Math.max(maxY, y!);
  }
  // Longitude shortened by the cosine of the latitude, so the country keeps its shape.
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = (maxX - minX) * k;
  const h = maxY - minY;
  const scale = (MAP - 8) / Math.max(w, h);
  const ox = (MAP - w * scale) / 2;
  const oy = (MAP - h * scale) / 2;
  const pt = ([x, y]: number[]) => `${(ox + (x! - minX) * k * scale).toFixed(1)},${(oy + (maxY - y!) * scale).toFixed(1)}`;
  const paths = districts
    .map((d) => {
      const party = lead.get(d.slug);
      const fill = party === undefined ? VACANT : party === null ? VACANT : ogPartyColour(party);
      const dPath = d.polys.map((p) => `M${p.map(pt).join('L')}Z`).join('');
      return `<path d="${dPath}" fill="${fill}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP}" height="${MAP}" viewBox="0 0 ${MAP} ${MAP}">${paths}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function electionCard(lang: Lang): Promise<Response> {
  const t = makeT(lang);
  const all = holders();

  // Each district's leading party, and the House's seats by party, largest first.
  const byDistrict = new Map<string, Map<string | null, number>>();
  const tally = new Map<string, { label: string; colour: string; n: number }>();
  for (const h of all) {
    const d = byDistrict.get(h.district) ?? new Map<string | null, number>();
    d.set(h.party, (d.get(h.party) ?? 0) + 1);
    byDistrict.set(h.district, d);
    if (h.party) {
      const e = tally.get(h.party) ?? { label: h.label(lang), colour: ogPartyColour(h.party), n: 0 };
      e.n++;
      tally.set(h.party, e);
    }
  }
  const lead = new Map<string, string | null>();
  for (const [slug, counts] of byDistrict) {
    const [top] = [...counts.entries()].filter(([p]) => p !== null).sort((a, b) => b[1] - a[1]);
    lead.set(slug, top ? top[0] : null);
  }
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
          {/* On a light panel: the governing party's green would vanish into the card's. */}
          <div style={{ width: MAP + 40, height: MAP + 40, borderRadius: 32, background: '#f4f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={mapImage(lead)} width={MAP} height={MAP} />
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
