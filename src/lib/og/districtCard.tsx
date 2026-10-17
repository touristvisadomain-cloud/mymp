/**
 * A district's link-preview image, 1200x630: its division, its name, how many
 * seats it sends to Parliament, and who holds them now, as one bar in the
 * parties' colours with each party's short name and count beneath. All of it
 * sits in the centre square that WhatsApp keeps (src/lib/og/frame.tsx).
 *
 * Bangla is shaped by HarfBuzz (src/lib/og/banglaText.ts). Drawn in either
 * language: the English card (/api/og/jela/<slug>/en) is for the English
 * page's shares.
 */
import { getMemberById } from '@/lib/data';
import { districtGroups } from '@/lib/districts';
import { divisionOf } from '@/lib/districtIntro';
import { bnTextImage } from '@/lib/og/banglaText';
import { ogPartyColour } from '@/lib/og/colours';
import { card, Pill, Text, TEXT_WIDTH } from '@/lib/og/frame';
import { isIndependent } from '@/lib/seo/mpDescription';
import { districtName, partyShort } from '@/i18n/names';
import { makeT, type Lang } from '@/i18n/core';

const INK = '#14231b';
const VACANT = '#b8c4bd';
const PANEL_PAD = 24;
const BAR = TEXT_WIDTH - 2 * PANEL_PAD;
const BAR_HEIGHT = 34;
const BAR_GAP = 4;

interface Holding {
  label: string;
  colour: string;
  seats: number;
}

/** Who holds the district's seats now, largest first; vacant seats last. */
function holdings(seats: { memberId: string | null; vacantSince?: string | null }[], lang: Lang): Holding[] {
  const by = new Map<string, Holding>();
  let vacant = 0;
  for (const s of seats) {
    const m = s.memberId && !s.vacantSince ? getMemberById(s.memberId) : undefined;
    if (!m) {
      vacant++;
      continue;
    }
    // The source writes an independent two ways; both are one group, in the independents' colour.
    const abbr = isIndependent(m) ? 'Ind' : m.party?.abbr ?? '';
    const label = abbr === 'Ind' ? (lang === 'en' ? 'Independent' : 'স্বতন্ত্র') : m.party ? partyShort(m.party, lang) : lang === 'en' ? 'No party' : 'দল নেই';
    const h = by.get(abbr) ?? { label, colour: ogPartyColour(abbr), seats: 0 };
    h.seats++;
    by.set(abbr, h);
  }
  const list = [...by.values()].sort((a, b) => b.seats - a.seats);
  if (vacant) list.push({ label: lang === 'en' ? 'Vacant' : 'শূন্য', colour: VACANT, seats: vacant });
  return list;
}

/** The card for a district, in the given language; 404 for an unknown district. */
export async function districtCard(slug: string, lang: Lang): Promise<Response> {
  const en = lang === 'en';
  const t = makeT(lang);
  const d = districtGroups().get(slug);
  if (!d) return new Response('Not found', { status: 404 });

  const n = d.seats.length;
  const division = divisionOf(d, lang);
  const held = holdings(d.seats, lang);
  const white = { color: '#ffffff' };
  const ink = { color: INK };

  const [kicker, name, count, caption, legend] = await Promise.all([
    division ? bnTextImage(en ? `${division} Division` : `${division} বিভাগ`, { ...white, weight: 'regular', maxSize: 24, minSize: 19, maxWidth: TEXT_WIDTH - 48, maxLines: 1, opacity: 0.92 }) : null,
    bnTextImage(en ? `${districtName(d, 'en')} District` : `${d.bn} জেলা`, { ...white, weight: 'bold', maxSize: 76, minSize: 44, maxWidth: TEXT_WIDTH, maxLines: 1 }),
    bnTextImage(en ? `${t.count(n, '', 'parliamentary seat', 'parliamentary seats')}` : `${t.n(n)}টি সংসদীয় আসন`, { ...white, weight: 'bold', maxSize: 30, minSize: 22, maxWidth: TEXT_WIDTH - 48, maxLines: 1 }),
    bnTextImage(en ? 'Seats by party in the 13th Parliament' : 'ত্রয়োদশ সংসদে দলভিত্তিক আসন', { ...ink, weight: 'regular', maxSize: 21, minSize: 17, maxWidth: BAR, maxLines: 1, opacity: 0.7 }),
    Promise.all(held.map((h) => bnTextImage(`${h.label} ${t.n(h.seats)}`, { ...ink, weight: 'bold', maxSize: 22, minSize: 17, maxWidth: BAR - 24, maxLines: 1 }))),
  ]);

  // Each party's share of the bar, in whole pixels; the last segment takes what rounding leaves.
  const room = BAR - BAR_GAP * (held.length - 1);
  const widths = held.map((h) => Math.floor((room * h.seats) / n));
  widths[widths.length - 1] += room - widths.reduce((a, b) => a + b, 0);

  return card(
    <>
      {kicker && <Pill t={kicker} />}
      <Text t={name} />
      <Pill t={count} strong />
      <div
        style={{
          width: TEXT_WIDTH,
          marginTop: 10,
          padding: PANEL_PAD,
          borderRadius: 22,
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 18px 44px rgba(0,0,0,0.25)',
        }}
      >
        <Text t={caption} />
        <div style={{ display: 'flex', gap: BAR_GAP, width: BAR, height: BAR_HEIGHT }}>
          {held.map((h, i) => (
            <div
              key={h.label}
              style={{
                display: 'flex',
                width: widths[i],
                height: BAR_HEIGHT,
                background: h.colour,
                borderTopLeftRadius: i === 0 ? 10 : 3,
                borderBottomLeftRadius: i === 0 ? 10 : 3,
                borderTopRightRadius: i === held.length - 1 ? 10 : 3,
                borderBottomRightRadius: i === held.length - 1 ? 10 : 3,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 22, rowGap: 8 }}>
          {held.map((h, i) => (
            <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 9999, display: 'flex', background: h.colour }} />
              <Text t={legend[i]!} />
            </div>
          ))}
        </div>
      </div>
    </>,
    { accent: held[0]?.colour, gap: 16 },
  );
}
