'use client';

import { bnText } from '@/lib/bnText';

import { useEffect, useState } from 'react';
import Link from '@/i18n/Link';
import { useT } from '@/i18n/client';
import { outletName } from '@/i18n/names';
import { englishHeadline, MACHINE_TITLE } from '@/lib/headline';

/** `titleEn`: the headline in English (machine-translated), for the English pages; null until translated. */
export type TickerItem = { id: string; titleBn: string; titleEn?: string | null; sourceName: string; sourceUrl: string };

// The news job adds headlines every 30 minutes; the site rebuilds only every three hours.
const REFRESH_MS = 5 * 60_000;

/*
 * The latest published headlines under the header, sliding right to left
 * (owner, 2026-09-11). The page arrives with the headlines of its build; the
 * browser then asks /api/news/latest, which is at most five minutes old, and
 * asks again every five minutes while the tab is open. Each headline links to
 * the outlet that published it; hovering or focusing stops the slide.
 */
export default function NewsTicker({ initial }: { initial: TickerItem[] }) {
  const t = useT();
  const [items, setItems] = useState(initial);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/news/latest')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { items?: TickerItem[] } | null) => {
          if (alive && d?.items?.length) setItems(d.items);
        })
        .catch(() => {});
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!items.length) return null;

  // English pages: the English headline once translated, the Bangla (marked) until then.
  const head = (n: TickerItem) => (t.en ? englishHeadline(bnText(n.titleBn) ?? n.titleBn, n.titleEn) : null);

  // A steady reading speed whatever the number of headlines: about 6.5 characters a second.
  const chars = items.reduce((n, i) => n + (head(i)?.text ?? i.titleBn).length + 6, 0);
  const duration = Math.max(25, Math.round(chars / 6.5));

  const row = (copy: boolean) => (
    // The headlines are the outlets' own, in Bangla; on the English pages, in English once translated.
    <ul className="ticker-row flex shrink-0" aria-hidden={copy || undefined} lang={t.en ? undefined : 'bn'}>
      {items.map((n) => (
        <li key={n.id} className="flex items-center whitespace-nowrap">
          <a
            href={n.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            tabIndex={copy ? -1 : undefined}
            lang={head(n)?.lang}
            title={head(n)?.machine ? MACHINE_TITLE : undefined}
            className="hover:text-brand"
          >
            {t.en ? head(n)!.text : bnText(n.titleBn)}
            <span className="ms-1.5 text-[12.5px] font-normal text-muted" lang={t.lang}>({outletName(n.sourceName, t.lang)})</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label={t('সর্বশেষ সংবাদ', 'Latest news')} className="ticker bg-surface border-b border-rule">
      <div className="mx-auto max-w-[1200px] ps-4 sm:ps-5 flex items-center h-10 gap-3">
        <Link
          href="/songbad"
          className="shrink-0 inline-flex items-center gap-2 h-8 px-3 rounded-md bg-live text-white text-[13px] font-bold hover:bg-danger transition-colors"
        >
          <span className="live-dot" aria-hidden="true" />
          {t('সর্বশেষ', 'Latest')}
        </Link>
        <div className="ticker-viewport grow min-w-0 overflow-hidden no-scrollbar">
          <div className="ticker-track text-[14px] font-semibold text-ink" style={{ '--ticker-duration': `${duration}s` } as React.CSSProperties}>
            {row(false)}
            {row(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
