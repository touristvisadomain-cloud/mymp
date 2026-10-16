import type { Metadata } from 'next';
import { Noto_Sans_Bengali } from 'next/font/google';
import '../globals.css';
import { siteUrl } from '@/lib/site';

/* The same face as the public site; the admin is a root layout of its own (the public site's is under /[lang]). */
const notoBn = Noto_Sans_Bengali({
  variable: '--font-bn',
  subsets: ['bengali', 'latin'],
  weight: 'variable',
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Each admin page names itself, so a row of admin tabs can be told apart.
  title: { default: 'অ্যাডমিন | আমার এমপি', template: '%s | অ্যাডমিন | আমার এমপি' },
  description: 'আমার এমপির সম্পাদকীয় প্যানেল: সংসদ সদস্য, আসন, দল, কমিটি, নির্বাচনের ফল ও সংবাদের তথ্য সম্পাদনা ও প্রকাশ।',
  robots: { index: false, follow: false },
  // Nothing here is meant to be shared; no link previews.
  openGraph: null,
  twitter: null,
};

/**
 * The admin's own root layout (the public site's is app/[lang]/layout.tsx).
 * Everything under /admin is rendered per request and hidden from search
 * engines. The signed-in shell lives one level down in the (auth) group so the
 * login and setup screens can render without a session.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${notoBn.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <div className="min-h-full flex flex-col bg-paper grow">{children}</div>
      </body>
    </html>
  );
}
