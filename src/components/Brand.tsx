import Link from '@/i18n/Link';

/*
 * The mymp logo, redrawn as vectors from the owner's artwork (Downloads/MY MP,
 * 2026-09-11): straight edges made exactly straight, curves fitted to the
 * source to within a pixel. Ink follows the text colour (currentColor), so the
 * same paths serve light and dark backgrounds; the green is the logo's own
 * (--color-logo). The static icons in src/app and public were rendered from
 * these same paths.
 */
const ICON = { w: 145.5, h: 100 };
const ICON_INK = 'M 0,0.1 L 47.2,39.3 L 96.3,0 L 96.3,24.3 L 47.9,63 L 17.6,37.8 L 17.6,89.7 L 0,81.2 Z M 26.7,55.1 L 44.2,69.6 L 44.2,99.2 L 26.7,92.2 Z M 77.8,50.4 L 96.3,35.6 L 96.3,60.9 L 104.1,60.9 C 116.2,60.9 124.1,57.1 127,49.1 C 136.4,47.1 139.2,44.3 144.9,39.1 L 145.5,39.1 L 145.5,49.7 C 145.5,53.6 139.6,77.8 110.1,77.8 L 96.3,77.8 L 96.3,92.7 L 77.8,100 Z';
const ICON_DOT = 'M 109.1,25.4 C 109.1,33.1 114.2,42.3 125.6,42.3 C 136.2,42.3 142.6,34.1 142.6,26 C 142.6,14.7 133.8,7 120,7 C 115.6,7 111.8,8.5 110,9.1 Q 109.1,9.5 109.1,10.6 Z';

const LOCKUP = { w: 470.6, h: 100 };
const LOCKUP_INK = 'M 0.1,-0.3 L 47.6,39.1 L 97,-0.4 L 97,24.1 L 48.3,63 L 17.7,37.6 L 17.7,89.9 L 0.1,81.4 Z M 26.9,55 L 44.5,69.6 L 44.5,99.4 L 26.9,92.4 Z M 78.4,50.3 L 97,35.4 L 97,60.9 L 104.9,60.9 C 117,60.9 124.9,57.1 127.9,49 C 137.3,47 140.1,44.2 145.9,38.9 L 146.5,38.9 L 146.5,49.6 C 146.5,53.5 140.5,77.9 110.8,77.9 L 97,77.9 L 97,92.9 L 78.4,100.2 Z M 198.2,23.1 C 196.5,23.6 194.1,24.9 192.8,25.9 C 189.9,28.2 189.8,28.2 189.8,25.5 C 189.8,23.3 189.8,23.3 182,23.3 L 174.2,23.3 174.2,49 L 174.2,74.6 182.6,74.6 L 190.9,74.6 191.1,58.8 C 191.4,39.1 192.3,37.1 200.1,37.1 C 206.9,37.1 207.9,40.1 207.9,59.8 L 207.9,74.6 216.4,74.6 L 224.8,74.6 224.8,59.3 C 224.8,47.6 225,43.4 225.6,41.9 C 227.8,36.6 234.1,35.3 238.4,39.2 L 240.7,41.4 240.9,58 L 241.1,74.6 249.4,74.4 L 257.6,74.3 257.8,58 C 258.1,34.8 257,30.3 249.7,25.5 C 242.3,20.5 226.8,21.8 221.3,27.8 C 220.3,28.9 220.2,28.9 218,27 C 213.1,22.7 204.7,21 198.2,23.1 M 343.9,23 C 342.1,23.5 340.5,23.9 340.3,23.9 C 340,23.9 338.7,25 337.3,26.2 L 334.8,28.5 334.8,25.9 L 334.8,23.3 327.3,23.3 L 319.8,23.3 319.9,48.8 L 320.1,74.3 328.2,74.3 L 336.4,74.3 336.7,58 C 337,43.3 337.1,41.6 338.2,40 C 341.2,35.5 349,36.3 351.4,41.2 C 352.1,42.8 352.3,46.2 352.3,58.9 L 352.3,74.6 360.7,74.6 L 369.2,74.6 369.2,59.8 C 369.3,50.1 369.5,44 370,42.4 C 372,36 381.5,35.1 385,41 C 385.5,42 385.8,47.3 386,58.3 L 386.4,74.3 394.3,74.4 L 402.3,74.6 402.3,56.7 C 402.3,35.5 401.9,33.2 397.5,28.4 C 390.4,20.5 375.1,20.1 367.1,27.6 C 365.4,29.2 365.4,29.2 363.4,27.2 C 359,23 350.4,21.1 343.9,23 M 435.4,22.8 C 433.9,23.1 431.3,24 429.6,24.9 C 425.9,26.8 426,26.8 426,24.9 C 426,23.3 426,23.3 417.9,23.3 L 409.8,23.3 409.8,57.4 L 409.8,91.5 418.2,91.5 L 426.7,91.5 426.7,82.1 C 426.7,76.9 426.9,72.7 427.2,72.7 C 427.5,72.7 429,73.4 430.6,74.3 C 437.1,77.9 448.5,77.8 456.3,73.9 C 475.1,64.7 475.3,34.9 456.6,25.5 C 450.6,22.5 442.4,21.4 435.4,22.8 M 257.9,23.7 C 257.9,24.2 276.5,66 278.8,70.7 C 280,73.2 280,73.3 278.9,74.5 C 277.2,76.4 271.5,78.3 267.6,78.3 L 264.2,78.3 264.2,85.5 L 264.2,92.7 268.1,92.7 C 281.3,92.7 290.4,87 296.3,75.1 C 299,69.6 305.8,52.7 312.8,33.9 C 314.6,29.3 316.2,25 316.4,24.4 C 316.8,23.4 316,23.3 308.1,23.3 L 299.4,23.3 294.5,37.6 C 291.8,45.4 289.3,52.5 289,53.3 C 288.5,54.7 288.1,54.1 286,48 C 284.7,44.3 282.1,37.1 280.3,32.3 L 277,23.3 267.5,23.3 C 262.2,23.3 257.9,23.5 257.9,23.7 M 436.2,36.6 C 427.4,38.1 422.6,48.8 427.5,55.9 C 435.2,67.3 454.7,61.6 453.4,48.3 C 452.6,39.9 445.3,35 436.2,36.6';
const LOCKUP_DOT = 'M 109.8,25.1 C 109.8,32.9 114.9,42.1 126.4,42.1 C 137.2,42.1 143.6,33.9 143.6,25.7 C 143.6,14.3 134.7,6.6 120.9,6.6 C 116.4,6.6 112.6,8.1 110.7,8.8 Q 109.8,9.2 109.8,10.3 Z';
const LOCKUP_BAR = { x: 432.3, y: 82.3, w: 33.5, h: 7.9 };

/** The lockup in its parts, for the intro that builds it piece by piece: the "mymp" letters start at "m". */
const WORD_START = LOCKUP_INK.indexOf(' M 198.2,23.1');
export const LOCKUP_PARTS = {
  ...LOCKUP,
  icon: LOCKUP_INK.slice(0, WORD_START),
  word: LOCKUP_INK.slice(WORD_START + 1),
  dot: LOCKUP_DOT,
  bar: LOCKUP_BAR,
};

type Tone = 'dark' | 'light';
const ink = (tone: Tone) => (tone === 'light' ? 'text-white' : 'text-ink');

/** The icon alone (M with the green drop). `size` is its height in pixels. */
export function Mark({ size = 32, tone = 'dark', className = '' }: { size?: number; tone?: Tone; className?: string }) {
  return (
    <svg
      width={Math.round((size * ICON.w) / ICON.h)}
      height={size}
      viewBox={`0 0 ${ICON.w} ${ICON.h}`}
      aria-hidden="true"
      className={`shrink-0 ${ink(tone)} ${className}`}
    >
      <path fill="currentColor" d={ICON_INK} />
      <path fill="var(--color-logo)" d={ICON_DOT} />
    </svg>
  );
}

/** Icon + "mymp" wordmark, as in the owner's lockup. `height` in pixels; CSS may override. */
export function Lockup({ height = 28, tone = 'dark', className = '' }: { height?: number; tone?: Tone; className?: string }) {
  return (
    <svg
      width={Math.round((height * LOCKUP.w) / LOCKUP.h)}
      height={height}
      viewBox={`0 0 ${LOCKUP.w} ${LOCKUP.h}`}
      aria-hidden="true"
      className={`shrink-0 ${ink(tone)} ${className}`}
    >
      <path fill="currentColor" fillRule="evenodd" d={LOCKUP_INK} />
      <path fill="var(--color-logo)" d={LOCKUP_DOT} />
      <rect x={LOCKUP_BAR.x} y={LOCKUP_BAR.y} width={LOCKUP_BAR.w} height={LOCKUP_BAR.h} fill="var(--color-logo)" />
    </svg>
  );
}

/** The logo as the link home. `label` is its accessible name, in the page's language. */
export default function Brand({ tone = 'dark', href = '/', label = 'আমার এমপি (mymp), হোম' }: { tone?: Tone; href?: string; label?: string }) {
  return (
    <Link href={href} className="flex items-center shrink-0" aria-label={label}>
      <Lockup tone={tone} className="h-[25px] w-auto sm:h-[28px] lg:h-[30px]" />
    </Link>
  );
}
