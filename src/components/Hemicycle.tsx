/**
 * The House as it sits: every seat a dot on a half circle, rows from the
 * floor outward, the largest party from the left, each in its colour. The
 * majority mark runs from the centre to the seat that makes it. Plain SVG,
 * drawn on the server.
 */
import { getT } from '@/i18n/server';

interface Bloc {
  key: string;
  label: string;
  seats: number;
  /** A CSS colour or colour token: "var(--color-pbnp)". */
  color: string;
}

const W = 420;
const H = 226;
const CX = W / 2;
const CY = 212;
const R_IN = 86;
const R_OUT = 200;

/** Seats per row, in proportion to each row's length, adding up to the total. */
function rowsFor(total: number, rows: number): { r: number; n: number }[] {
  const radii = Array.from({ length: rows }, (_, i) => R_IN + ((R_OUT - R_IN) * i) / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.floor((total * r) / sum));
  // The seats the rounding lost go to the outer rows, which have the most room.
  for (let i = rows - 1, left = total - counts.reduce((a, b) => a + b, 0); left > 0; i = (i - 1 + rows) % rows, left--) counts[i]!++;
  return radii.map((r, i) => ({ r, n: counts[i]! }));
}

export default async function Hemicycle({ blocs, total, majority }: { blocs: Bloc[]; total: number; majority: number }) {
  const t = await getT();
  const rows = rowsFor(total, 11);
  const gap = (R_OUT - R_IN) / 10;
  const dot = gap * 0.4;
  // Every seat's place, then ordered left to right by angle so each party is one wedge.
  const places = rows
    .flatMap(({ r, n }) => Array.from({ length: n }, (_, j) => {
      const a = Math.PI - (Math.PI * j) / Math.max(n - 1, 1);
      return { a, x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
    }))
    .sort((p, q) => q.a - p.a);
  const colours: { color: string; key: string }[] = blocs.flatMap((b) => Array.from({ length: b.seats }, () => ({ color: b.color, key: b.key })));
  const markAngle = places[majority - 1]?.a ?? Math.PI / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={blocs.map((b) => `${b.label} ${b.seats}`).join(', ')}>
      {places.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={dot.toFixed(2)} style={{ fill: colours[i]?.color ?? 'var(--color-rule)' }} />
      ))}
      <line
        x1={CX}
        y1={CY}
        x2={(CX + (R_OUT + 8) * Math.cos(markAngle)).toFixed(1)}
        y2={(CY - (R_OUT + 8) * Math.sin(markAngle)).toFixed(1)}
        strokeDasharray="3 3"
        strokeWidth={1.2}
        style={{ stroke: 'var(--color-ink)' }}
      />
      <text x={CX} y={CY - 34} textAnchor="middle" className="display" style={{ fill: 'var(--color-ink)', fontSize: 40, fontWeight: 800 }}>
        {t.n(total)}
      </text>
      <text x={CX} y={CY - 12} textAnchor="middle" style={{ fill: 'var(--color-muted)', fontSize: 12.5 }}>
        {t('আসন · সংখ্যাগরিষ্ঠতা ', 'seats · majority ')}{t.n(majority)}
      </text>
    </svg>
  );
}
