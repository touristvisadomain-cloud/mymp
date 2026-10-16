'use client';

/**
 * The news page's months (/songbad), each a card that shows that month's
 * stories in the list below without leaving the page: it sets the list's
 * span (?d=first~last, which NewsBrowser reads) and brings the list into
 * view. The picked month is marked; a second tap shows the newest again.
 * The link still works without JavaScript, as a plain page load.
 */
import { useQueryParam } from '@/lib/useQueryParam';
import { useT } from '@/i18n/client';

export interface MonthCard {
  /** "2026-09" */
  month: string;
  label: string;
  /** "2026-09-01~2026-09-30" */
  span: string;
  current: boolean;
  /** Figures in the page's language, already formatted. */
  total: string;
  news: string;
  video: string;
  /** The bar's length, 3 to 100. */
  pct: number;
}

export default function MonthCards({ months, listId }: { months: MonthCard[]; listId: string }) {
  const t = useT();
  const [d, setD] = useQueryParam('d');
  const pick = (m: MonthCard) => {
    setD(d === m.span ? '' : m.span);
    requestAnimationFrame(() => document.getElementById(listId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {months.map((m) => {
        const on = d === m.span;
        return (
          <li key={m.month}>
            <a
              href={`?d=${m.span}`}
              onClick={(e) => { e.preventDefault(); pick(m); }}
              aria-current={on ? 'true' : undefined}
              className={`group h-full rounded-card shadow-card p-4 flex flex-col gap-1.5 transition-all ${
                on ? 'bg-brand text-white border border-brand shadow-lift' : `bg-surface border hover:border-brand hover:shadow-lift ${m.current ? 'border-brand' : 'border-rule'}`
              }`}
            >
              <span className={`text-[13px] font-semibold ${on ? 'text-white/85' : 'text-muted'}`}>
                {m.label}
                {m.current && <span className={`ms-1.5 ${on ? 'text-white' : 'text-brand'}`}>{t('· চলতি', '· current')}</span>}
              </span>
              <span className="display text-[26px] font-bold leading-none tnum">{m.total}</span>
              <span className={`h-1.5 rounded-full overflow-hidden ${on ? 'bg-white/25' : 'bg-rulesoft'}`} aria-hidden="true">
                <span className={`block h-full rounded-full ${on ? 'bg-white' : 'bg-brand'}`} style={{ width: `${m.pct}%` }} />
              </span>
              <span className={`text-[12.5px] tnum ${on ? 'text-white/90' : 'text-inksoft'}`}>
                {t.en ? `${m.news} news · ${m.video} ${m.video === '1' ? 'video' : 'videos'}` : <>{m.news} সংবাদ · {m.video} ভিডিও</>}
              </span>
              <span className={`text-[12px] font-semibold ${on ? 'text-white' : 'text-brand opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                {on ? t('দেখানো হচ্ছে · আবার চাপলে সব খবর', 'Showing · tap again for all news') : t('এই মাসের খবর দেখুন ↓', "See this month's news ↓")}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
