import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('পাতা পাওয়া যায়নি', 'Page not found'),
    robots: { index: false, follow: true },
  };
}

/** Any address that matches nothing: a plain message in the page's language and the way back. */
export default async function NotFound() {
  const t = await getT();
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[13px] font-bold tracking-[2px] text-muted">{t('৪০৪', '404')}</p>
      <h1 className="display text-[28px] sm:text-[34px]">{t('পাতাটি পাওয়া যায়নি', 'Page not found')}</h1>
      <p className="max-w-[440px] text-[15.5px] leading-relaxed text-inksoft">
        {t(
          'ঠিকানাটি ভুল হতে পারে, অথবা পাতাটি সরিয়ে নেওয়া হয়েছে। নিচের যেকোনো জায়গা থেকে আবার খুঁজুন।',
          'The address may be wrong, or the page has been removed. Start again from one of the places below.',
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link href="/" className="h-11 px-5 inline-flex items-center rounded-lg bg-brand text-white font-semibold hover:bg-branddark">{t('হোম', 'Home')}</Link>
        <Link href="/mp" className="h-11 px-5 inline-flex items-center rounded-lg border border-rule font-semibold hover:border-brand hover:text-brand">{t('সব সংসদ সদস্য', 'All MPs')}</Link>
      </div>
    </main>
  );
}
