'use client';

import Link from '@/i18n/Link';
import { useT } from '@/i18n/client';

/** A page that failed while rendering: a plain message in the page's language, a retry, and the way back. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[13px] font-bold tracking-[2px] text-muted">{t('৫০০', '500')}</p>
      <h1 className="display text-[28px] sm:text-[34px]">{t('পাতাটি দেখানো যায়নি', 'The page could not be shown')}</h1>
      <p className="max-w-[440px] text-[15.5px] leading-relaxed text-inksoft">
        {t(
          'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন, অথবা নিচের যেকোনো জায়গা থেকে আবার খুঁজুন।',
          'Something went wrong. Try again, or start again from one of the places below.',
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button type="button" onClick={reset} className="h-11 px-5 inline-flex items-center rounded-lg bg-brand text-white font-semibold hover:bg-branddark">
          {t('আবার চেষ্টা করুন', 'Try again')}
        </button>
        <Link href="/" className="h-11 px-5 inline-flex items-center rounded-lg border border-rule font-semibold hover:border-brand hover:text-brand">{t('হোম', 'Home')}</Link>
        <Link href="/mp" className="h-11 px-5 inline-flex items-center rounded-lg border border-rule font-semibold hover:border-brand hover:text-brand">{t('সব সংসদ সদস্য', 'All MPs')}</Link>
      </div>
    </main>
  );
}
