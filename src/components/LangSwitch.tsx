'use client';

import { usePathname } from 'next/navigation';
import { useLang } from '@/i18n/client';
import { hrefIn } from '@/i18n/core';
import Icon from './Icon';

/**
 * The same page in the other language: "English" on a Bangla page, "বাংলা"
 * on an English one. The page's query and anchor go along, so a filtered
 * list or a section stays where it was. A full load, since the two languages
 * are separate builds of each page.
 */
export default function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useLang();
  const path = usePathname() || '/';
  const other = lang === 'en' ? 'bn' : 'en';
  const href = hrefIn(other, path);
  return (
    <a
      href={href}
      hrefLang={other}
      lang={other}
      onClick={(e) => {
        e.preventDefault();
        window.location.assign(href + window.location.search + window.location.hash);
      }}
      title={other === 'en' ? 'Read this page in English' : 'এই পাতা বাংলায় পড়ুন'}
      className={`shrink-0 h-10 px-2.5 sm:px-3 inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface text-[13.5px] font-bold text-ink hover:border-brand hover:text-brand transition-colors ${className}`}
    >
      <Icon name="globe" size={16} className="text-brand" />
      <span className="sm:hidden">{other === 'en' ? 'EN' : 'বাং'}</span>
      <span className="hidden sm:inline">{other === 'en' ? 'English' : 'বাংলা'}</span>
    </a>
  );
}
