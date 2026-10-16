'use client';

import { usePathname } from 'next/navigation';
import { useLang } from '@/i18n/client';
import { hrefIn } from '@/i18n/core';
import Icon from './Icon';

/**
 * The same page in the other language: "English" on a Bangla page, "বাংলা"
 * on an English one. It sits in the dark date bar above the header (the
 * header has no room for it beside the English menu and the search box) and
 * in the phone menu. The page's query and anchor go along, so a filtered list
 * or a section stays where it was. A full load, since the two languages are
 * separate builds of each page.
 */
export default function LangSwitch({ variant = 'bar', onPick }: { variant?: 'bar' | 'menu'; onPick?: () => void }) {
  const lang = useLang();
  const path = usePathname() || '/';
  const other = lang === 'en' ? 'bn' : 'en';
  const href = hrefIn(other, path);
  const look =
    variant === 'bar'
      ? 'h-7 inline-flex items-center gap-1.5 px-2 -me-2 rounded font-semibold text-white hover:text-[#6ee79a] transition-colors'
      : 'h-11 inline-flex items-center gap-2 px-3.5 rounded-lg border border-rule text-[15px] font-semibold text-ink hover:border-brand hover:text-brand';
  return (
    <a
      href={href}
      hrefLang={other}
      lang={other}
      onClick={(e) => {
        e.preventDefault();
        onPick?.();
        window.location.assign(href + window.location.search + window.location.hash);
      }}
      title={other === 'en' ? 'Read this page in English' : 'এই পাতা বাংলায় পড়ুন'}
      className={look}
    >
      <Icon name="globe" size={variant === 'bar' ? 14 : 17} className={variant === 'bar' ? 'text-[#6ee79a]' : 'text-brand'} />
      {other === 'en' ? 'English' : 'বাংলা'}
    </a>
  );
}
