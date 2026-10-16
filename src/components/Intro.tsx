import { LOCKUP_PARTS as L } from './Brand';
import { getT } from '@/i18n/server';

/*
 * The logo intro (owner, 2026-09-11): the mark rises, the green drop falls in,
 * "mymp" wipes in and the bar underlines it, then the whole thing fades to the
 * page. It plays on the first page of a visit only, never for someone who has
 * asked their device for less motion, and never without JavaScript. The page
 * is fully rendered underneath the whole time.
 *
 * The script runs while the HTML is still being read, before the overlay below
 * is drawn, so a repeat visit never sees even a flash of it.
 */
const SCRIPT = `(function(){try{var d=document.documentElement;if(sessionStorage.getItem('mymp-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;sessionStorage.setItem('mymp-intro','1');d.classList.add('intro-play');setTimeout(function(){d.classList.remove('intro-play')},1900)}catch(e){}})();`;

export default async function Intro() {
  const t = await getT();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <div className="intro" aria-hidden="true">
        <div className="intro-glow" />
        <svg className="intro-logo" viewBox={`0 0 ${L.w} ${L.h}`} width={300} height={Math.round((300 * L.h) / L.w)}>
          <path className="intro-icon" fill="var(--color-ink)" d={L.icon} />
          <path className="intro-dot" fill="var(--color-logo)" d={L.dot} />
          <path className="intro-word" fill="var(--color-ink)" fillRule="evenodd" d={L.word} />
          <rect className="intro-bar" x={L.bar.x} y={L.bar.y} width={L.bar.w} height={L.bar.h} fill="var(--color-logo)" />
        </svg>
        <p className="intro-tag">{t('আমার এমপি', 'My MP')}</p>
      </div>
    </>
  );
}
