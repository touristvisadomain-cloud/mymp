import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminPage, Panel, Notice } from '@/app/admin/ui';
import PasswordForm from './PasswordForm';

export const metadata: Metadata = { title: 'পাসওয়ার্ড' };

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ recovered?: string }> }) {
  const me = await requireAdmin();
  const { recovered } = await searchParams;
  return (
    <AdminPage title="পাসওয়ার্ড বদলান" lede={`${me.email} অ্যাকাউন্টের পাসওয়ার্ড। বদলানোর পর অন্য ডিভাইসে আবার লগইন লাগবে।`}>
      {recovered && (
        <Notice tone="good">রিসেট লিংক কাজ করেছে, আপনি লগইন আছেন। এখানে নতুন পাসওয়ার্ড দিন, পরের বার সেটি দিয়েই ঢুকবেন।</Notice>
      )}
      <Panel>
        <PasswordForm />
      </Panel>
    </AdminPage>
  );
}
