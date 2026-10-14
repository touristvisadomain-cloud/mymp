import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminConfigured, adminIdentity, currentUser } from '@/lib/admin/auth';
import { signOut } from '@/app/admin/actions';
import { Mark } from '@/components/Brand';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'লগইন' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  if (!adminConfigured()) redirect('/admin/setup');
  const { denied } = await searchParams;

  // Signed in and an admin: straight through.
  const me = await adminIdentity();
  if (me) redirect('/admin');

  // Signed in but not on the admin list: say so, offer sign-out, never a form loop.
  const user = await currentUser();

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

        {user ? (
          <div className="bg-surface border border-rule rounded-card shadow-lift p-6 flex flex-col gap-4">
            <p className="text-[14.5px] leading-relaxed">
              <strong>{user.email}</strong> হিসেবে লগইন আছেন, কিন্তু এই ঠিকানাটি অ্যাডমিন তালিকায় নেই।
              একজন সুপার অ্যাডমিন আপনাকে যোগ করলে ঢুকতে পারবেন।
            </p>
            <form action={signOut}>
              <button type="submit" className="h-11 px-5 rounded-lg bg-surface border border-rule font-semibold text-[14.5px] hover:border-brand">
                লগআউট
              </button>
            </form>
          </div>
        ) : (
          <>
            {denied && (
              <p className="px-4 py-3 rounded-lg bg-warnsoft border-s-[3px] border-warn text-[14px] text-warn">
                এই পাতাটি দেখতে লগইন লাগবে।
              </p>
            )}
            <LoginForm />
            <p className="text-center text-[13.5px]">
              <Link href="/admin/forgot" className="text-muted hover:text-brand">পাসওয়ার্ড ভুলে গেছেন?</Link>
            </p>
          </>
        )}

        <p className="text-center text-[13px] text-muted">
          <Link href="/" className="hover:text-brand">← সাইটে ফিরে যান</Link>
        </p>
      </div>
    </div>
  );
}
