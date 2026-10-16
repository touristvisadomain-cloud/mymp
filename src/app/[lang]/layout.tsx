import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Noto_Sans_Bengali } from 'next/font/google';
import '../globals.css';
import { siteUrl } from '@/lib/site';
import { baseOpenGraph, baseTwitter, siteDescription, siteName, siteTitle } from '@/lib/seo';
import { getLang } from '@/i18n/server';
import { LangProvider } from '@/i18n/client';
import { isLang } from '@/i18n/core';

/*
 * Noto Sans Bengali, as one variable file covering every weight. It is the
 * Bengali face of BBC Bangla, Google's own Bengali products and Android, so it
 * is what most readers already see as "normal" professional Bengali, and the
 * app will render the very same glyphs. Its Latin letters are Noto Sans, so
 * the English pages use the same face and the two languages look like one site.
 */
const notoBn = Noto_Sans_Bengali({
  variable: '--font-bn',
  subsets: ['bengali', 'latin'],
  weight: 'variable',
  display: 'swap',
});

/** Both languages are built ahead; Bangla at the plain addresses, English under /en. */
export async function generateStaticParams() {
  return [{ lang: 'bn' }, { lang: 'en' }];
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: siteTitle(lang), template: `%s | ${siteName(lang)}` },
    description: siteDescription(lang),
    openGraph: baseOpenGraph(lang),
    twitter: baseTwitter(lang),
  };
}

/**
 * The root layout of each language carries only fonts, global styles and the
 * language itself. The public site's header and footer live in the (site)
 * group, and the admin panel has its own root, so nothing here reads a session
 * and every public page stays static.
 * suppressHydrationWarning: the intro's script marks <html> before React arrives.
 */
export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={`${notoBn.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
