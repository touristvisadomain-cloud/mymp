import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminConfigured, adminIdentity } from '@/lib/admin/auth';
import { Mark } from '@/components/Brand';
import ForgotForm from './ForgotForm';

export const metadata: Metadata = { title: 'পাসওয়ার্ড ভুলে গেছেন' };

/** What /admin/recover sends people back here with. */
const REASONS: Record<string, string> = {
  expired: 'লিংকটির মেয়াদ শেষ। নতুন একটি পাঠাতে ইমেইল দিন।',
  browser: 'লিংকটি যে ব্রাউজার থেকে অনুরোধ করেছিলেন সেখানেই খুলতে হয়। এখান থেকে আবার পাঠান।',
  link: 'লিংকটি কাজ করেনি, হয়তো আগেই ব্যবহার হয়ে গেছে। নতুন একটি পাঠান।',
};

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!adminConfigured()) redirect('/admin/setup');
  if (await adminIdentity()) redirect('/admin/password');
  const { error } = await searchParams;
  const reason = error ? REASONS[error] : undefined;

  return (
    <div className="grow flex items-center justify-center px-5 py-12 bg-[radial-gradient(ellipse_at_top,_var(--color-brandsoft),_var(--color-paper)_60%)]">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Mark size={36} />
          <span className="flex flex-col leading-none gap-1">
            <span className="display text-[22px] text-brand">আমার এমপি</span>
            <span className="text-[10px] font-bold tracking-[2.2px] text-muted">ADMIN PANEL</span>
          </span>
        </div>

        {reason && (
          <p className="px-4 py-3 rounded-lg bg-warnsoft border-s-[3px] border-warn text-[14px] text-warn">{reason}</p>
        )}
        <ForgotForm />

        <p className="text-center text-[13px] text-muted">
          <Link href="/admin/login" className="hover:text-brand">← লগইনে ফিরে যান</Link>
        </p>
      </div>
    </div>
  );
}
