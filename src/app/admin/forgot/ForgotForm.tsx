'use client';

import { useActionState } from 'react';
import { requestPasswordReset, type ActionState } from '@/app/admin/actions';
import { inputClass } from '@/app/admin/ui';

export default function ForgotForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestPasswordReset, {});

  if (state.ok) {
    return (
      <div className="bg-surface border border-rule rounded-card shadow-lift p-6 flex flex-col gap-3">
        <h1 className="display text-[22px]">ইমেইল পাঠানো হয়েছে</h1>
        <p className="text-[14.5px] leading-relaxed">{state.ok}</p>
        <p className="text-[13.5px] text-muted leading-relaxed">
          লিংকটি এক ঘণ্টা কাজ করে, আর এই ব্রাউজারেই খুলতে হবে। ইমেইল না এলে স্প্যাম ফোল্ডার দেখুন।
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="bg-surface border border-rule rounded-card shadow-lift p-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1 pb-1">
        <h1 className="display text-[22px]">পাসওয়ার্ড ভুলে গেছেন?</h1>
        <p className="text-[13.5px] text-muted">অ্যাডমিন ইমেইলটি দিন, নতুন পাসওয়ার্ড সেট করার লিংক পাঠানো হবে।</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">ইমেইল</span>
        <input name="email" type="email" autoComplete="username" required className={inputClass} />
      </label>
      {state.error && (
        <p role="alert" className="px-3.5 py-2.5 rounded-lg bg-dangersoft text-danger text-[14px]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-brand text-white font-semibold text-[14.5px] hover:bg-branddark disabled:opacity-60 transition-colors"
      >
        {pending ? 'পাঠানো হচ্ছে…' : 'রিসেট লিংক পাঠান'}
      </button>
    </form>
  );
}
