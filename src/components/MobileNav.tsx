'use client';

import { useEffect, useState } from 'react';
import Link from '@/i18n/Link';
import { usePathname } from 'next/navigation';
import { useT } from '@/i18n/client';
import { stripLang } from '@/i18n/core';
import Icon from './Icon';
import LangSwitch from './LangSwitch';

/**
 * The menu button and full-height sheet used below the lg breakpoint.
 * Links close the sheet themselves, so no effect has to watch the route.
 */
export default function MobileNav({
  items,
  more,
}: {
  items: { href: string; label: string }[];
  more: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  // The page's own path without /en, to compare with the menu's plain paths.
  const pathname = stripLang(usePathname() || '/');

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Escape closes the menu, as a keyboard user expects of anything that opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="h-10 w-10 grid place-items-center rounded-lg border border-rule bg-surface text-ink hover:border-brand"
      >
        <Icon name={open ? 'x' : 'menu'} size={20} />
        <span className="sr-only">{t('মেনু', 'Menu')}</span>
      </button>

      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 top-[60px] bottom-0 z-40 bg-surface overflow-y-auto border-t border-rule">
          <nav aria-label={t('প্রধান', 'Main')} className="px-5 py-3 flex flex-col">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between py-3.5 border-b border-rulesoft text-[17px] font-semibold ${active(it.href) ? 'text-brand' : ''}`}
              >
                {it.label}
                <Icon name="arrow" size={18} className="text-muted" />
              </Link>
            ))}
          </nav>
          <div className="px-5 py-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-muted">
            {more.map((it) => (
              <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="hover:text-brand">
                {it.label}
              </Link>
            ))}
          </div>
          <div className="px-5 pb-6">
            <LangSwitch variant="menu" onPick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
