import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'পাতা পাওয়া যায়নি · Page not found',
  robots: { index: false, follow: true },
};

/**
 * An address that no part of the app answers (each language's pages have
 * their own 404 inside the site; this is for the rest, such as a wrong
 * /admin address). It stands outside every layout, so it says it in both.
 */
export default function GlobalNotFound() {
  return (
    <html lang="bn">
      <body className="min-h-full flex flex-col bg-paper">
        <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-[13px] font-bold tracking-[2px] text-muted">৪০৪ · 404</p>
          <h1 className="text-[28px] font-bold">পাতাটি পাওয়া যায়নি</h1>
          <p className="text-[17px] text-inksoft" lang="en">Page not found</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/" className="h-11 px-5 inline-flex items-center rounded-lg bg-brand text-white font-semibold">হোম</Link>
            <Link href="/en" lang="en" className="h-11 px-5 inline-flex items-center rounded-lg border border-rule font-semibold">Home (English)</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
