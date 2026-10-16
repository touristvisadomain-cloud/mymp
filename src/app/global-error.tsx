'use client';

import Link from 'next/link';

/**
 * The root layout itself failed, so nothing of the site's shell or fonts is
 * available: a bare page with the way back, in place of Next's English "500:
 * This page couldn't be loaded". It stands outside every layout and cannot
 * know the reader's language, so it says it in both, Bangla first (like
 * global-not-found.tsx).
 */
const BUTTON = { height: 44, padding: '0 20px', borderRadius: 8, border: '1px solid #dfe3dd', display: 'inline-flex', alignItems: 'center', color: '#17201b', fontWeight: 600, textDecoration: 'none' } as const;
const ENGLISH = { maxWidth: 440, lineHeight: 1.6, color: '#465049', margin: 0 } as const;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="bn">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f4f5f1', color: '#17201b' }}>
        <main style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: '#6c766f', margin: 0 }}>৫০০ · <span lang="en">500</span></p>
          <h1 style={{ fontSize: 28, margin: 0 }}>পাতাটি দেখানো যায়নি</h1>
          <p lang="en" style={{ ...ENGLISH, fontSize: 19, fontWeight: 600, color: '#17201b' }}>The page could not be shown</p>
          <p style={{ maxWidth: 440, lineHeight: 1.6, color: '#465049', margin: 0 }}>কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন, অথবা হোম পাতায় ফিরে যান।</p>
          <p lang="en" style={ENGLISH}>Something went wrong. Try again, or go back to the home page.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" onClick={reset} style={{ height: 44, padding: '0 20px', borderRadius: 8, border: 0, background: '#0f6a4b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              আবার চেষ্টা করুন · <span lang="en">Try again</span>
            </button>
            <Link href="/" style={BUTTON}>হোম</Link>
            <Link href="/mp" style={BUTTON}>সব সংসদ সদস্য</Link>
            <Link href="/en" lang="en" style={BUTTON}>Home (English)</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
