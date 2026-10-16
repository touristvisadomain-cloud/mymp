'use client';

import Link from 'next/link';

/** A page that failed while rendering: a plain Bangla message, a retry, and the way back. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[13px] font-bold tracking-[2px] text-muted">৫০০</p>
      <h1 className="display text-[28px] sm:text-[34px]">পাতাটি দেখানো যায়নি</h1>
      <p className="max-w-[440px] text-[15.5px] leading-relaxed text-inksoft">
        কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন, অথবা নিচের যেকোনো জায়গা থেকে আবার খুঁজুন।
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button type="button" onClick={reset} className="h-11 px-5 inline-flex items-center rounded-lg bg-brand text-white font-semibold hover:bg-branddark">
          আবার চেষ্টা করুন
        </button>
        <Link href="/" className="h-11 px-5 inline-flex items-center rounded-lg border border-rule font-semibold hover:border-brand hover:text-brand">হোম</Link>
        <Link href="/mp" className="h-11 px-5 inline-flex items-center rounded-lg border border-rule font-semibold hover:border-brand hover:text-brand">সব সংসদ সদস্য</Link>
      </div>
    </main>
  );
}
