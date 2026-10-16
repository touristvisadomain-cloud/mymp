import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'পাতা পাওয়া যায়নি',
  robots: { index: false, follow: true },
};

/** Any address that matches nothing: a plain Bangla message and the way back. */
export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[13px] font-bold tracking-[2px] text-muted">৪০৪</p>
      <h1 className="display text-[28px] sm:text-[34px]">পাতাটি পাওয়া যায়নি</h1>
      <p className="max-w-[440px] text-[15.5px] leading-relaxed text-inksoft">
        ঠিকানাটি ভুল হতে পারে, অথবা পাতাটি সরিয়ে নেওয়া হয়েছে। নিচের যেকোনো জায়গা থেকে আবার খুঁজুন।
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link href="/" className="h-11 px-5 inline-flex items-center rounded-lg bg-brand text-white font-semibold hover:bg-branddark">হোম</Link>
        <Link href="/mp" className="h-11 px-5 inline-flex items-center rounded-lg border border-rule font-semibold hover:border-brand hover:text-brand">সব সংসদ সদস্য</Link>
      </div>
    </main>
  );
}
