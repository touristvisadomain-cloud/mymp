import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminConfigured } from '@/lib/admin/auth';

export const metadata: Metadata = { title: 'প্রথম সেটআপ' };

/** Shown until the Supabase environment variables exist. Reads nothing. */
export default function SetupPage() {
  if (adminConfigured()) redirect('/admin/login');

  const vars = [
    ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase → Project Settings → API → Project URL'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'একই পাতায় → anon public key'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'একই পাতায় → service_role key (গোপন, Secret হিসেবে দিন)'],
    ['ADMIN_BOOTSTRAP_EMAIL', 'প্রথম অ্যাডমিনের ইমেইল। Supabase → Authentication → Users → Add user দিয়ে আগে ব্যবহারকারীটি তৈরি করুন'],
    ['MYMP_DEPLOY_TOKEN', 'GitHub → Settings → Developer settings → Fine-grained token: শুধু mymp রিপো, Contents: Read and write। রিপোর prod এনভায়রনমেন্টের সিক্রেট হিসেবে দিন'],
    ['CRON_SECRET', 'যেকোনো লম্বা এলোমেলো স্ট্রিং; /api/cron/* রুটগুলো এটি দিয়ে যাচাই হয়'],
  ];

  return (
    <div className="grow flex items-start justify-center px-5 py-16">
      <div className="w-full max-w-[720px] flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold tracking-[1.5px] text-brand">অ্যাডমিন প্যানেল</span>
          <h1 className="display text-[30px] font-extrabold">ডেটাবেস এখনো যুক্ত হয়নি</h1>
          <p className="text-[15px] text-inksoft leading-relaxed">
            অ্যাডমিন প্যানেল চালু হতে একটি Supabase প্রজেক্ট লাগে। প্রথমে <code className="bg-sunk px-1.5 rounded">supabase/schema.sql</code> ফাইলটি
            Supabase-এর SQL Editor-এ চালান, তারপর নিচের পরিবেশ-ভ্যারিয়েবলগুলো VPS-এর .env-এ (GitHub সিক্রেট DEPLOY_ENV_FILE_B64) দিয়ে আবার ডিপ্লয় করুন।
            জনসাধারণের সাইট এতে কোনোভাবে প্রভাবিত হয় না, সেটি আগের মতোই চলছে।
          </p>
        </div>
        <div className="bg-surface border border-rule rounded-xl divide-y divide-rulesoft">
          {vars.map(([k, how]) => (
            <div key={k} className="px-5 py-3.5 flex flex-col gap-1">
              <code className="text-[13.5px] font-bold">{k}</code>
              <span className="text-[13.5px] text-muted">{how}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
