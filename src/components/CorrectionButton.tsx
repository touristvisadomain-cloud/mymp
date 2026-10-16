'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';
import { SITE_EMAIL } from '@/lib/site';
import { useT } from '@/i18n/client';

const FIELD_ERROR: Record<string, string> = {
  message: 'কী ভুল, তা অন্তত এক লাইনে লিখুন (১০ থেকে ১৫০০ অক্ষর)।',
  source: 'সূত্রের লিংক http:// বা https:// দিয়ে শুরু হতে হবে।',
  rate: 'অল্প সময়ে অনেকগুলো পাঠানো হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
};

const FIELD_ERROR_EN: Record<string, string> = {
  message: 'Write at least one line on what is wrong (10 to 1,500 characters).',
  source: 'The source link must start with http:// or https://.',
  rate: 'Too many reports have been sent in a short time. Please try again in a little while.',
};

/**
 * "সংশোধন জানান" on a member's page: a short form that lands in the admin
 * correction queue through /api/corrections. It asks for no name or email, as
 * the privacy policy promises; someone who wants a reply writes by email. The hidden "website" field and
 * the time since the form opened keep most bots out without a captcha.
 */
export default function CorrectionButton({ page, subject }: { page: string; subject: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const openedAt = useRef(0);

  function toggle() {
    if (!open) openedAt.current = Date.now();
    setOpen(!open);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('sending');
    setError(null);
    try {
      const r = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          message: f.get('message'),
          source: f.get('source'),
          website: f.get('website'),
          elapsed: Date.now() - openedAt.current,
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; field?: string };
      if (r.ok && d.ok) setState('done');
      else {
        setState('error');
        setError((t.en ? FIELD_ERROR_EN : FIELD_ERROR)[d.field ?? ''] ?? null);
      }
    } catch {
      setState('error');
    }
  }

  const input = 'w-full rounded-lg border border-rule bg-surface px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none';

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="self-start h-9 px-3.5 inline-flex items-center gap-2 rounded-full border border-rule bg-surface text-[13.5px] font-semibold text-inksoft hover:border-brand hover:text-brand transition-colors"
      >
        <Icon name="message" size={15} />
        {t('সংশোধন জানান', 'Report a correction')}
      </button>

      {open && (
        <div className="rounded-card border border-rule bg-paper/70 p-4 sm:p-5">
          {state === 'done' ? (
            <p className="text-[15px] leading-relaxed text-branddark">
              {t(
                'ধন্যবাদ। আপনার তথ্য পৌঁছেছে; সূত্র মিলিয়ে ২৪ ঘণ্টার মধ্যে যাচাই করে ঠিক করা হবে।',
                'Thank you. Your report has arrived; it will be checked against the sources and corrected within 24 hours.',
              )}
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <p className="text-[14px] text-inksoft leading-relaxed">
                {t.en
                  ? `What is wrong on ${subject}'s page, and what is correct? A link to a source lets us check it quickly.`
                  : `${subject}-এর পাতায় কোন তথ্য ভুল, আর সঠিক তথ্য কী? সূত্রের লিংক দিলে দ্রুত যাচাই করা যায়।`}
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">{t('কী ভুল, সঠিক তথ্য কী *', 'What is wrong, and what is correct *')}</span>
                <textarea name="message" required minLength={10} maxLength={1500} rows={4} className={input} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">{t('সূত্রের লিংক', 'Link to a source')}</span>
                <input name="source" type="url" maxLength={500} placeholder="https://" className={input} />
              </label>
              {/* People never see this; bots fill it in. */}
              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] w-px h-px opacity-0" />
              {state === 'error' && (
                <p className="text-[13.5px] text-danger" role="alert">
                  {error ?? t('পাঠানো গেল না।', 'It could not be sent.')} {t('চাইলে ইমেইলে লিখুন:', 'You can write by email instead:')} <a href={`mailto:${SITE_EMAIL}`} className="underline">{SITE_EMAIL}</a>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={state === 'sending'}
                  className="h-10 px-5 rounded-full bg-brand text-white text-[14.5px] font-semibold hover:bg-branddark disabled:opacity-60 transition-colors"
                >
                  {state === 'sending' ? t('পাঠানো হচ্ছে…', 'Sending…') : t('পাঠান', 'Send')}
                </button>
                <span className="text-[12.5px] text-muted">
                  {t.en ? (
                    <>
                      We do not ask for your name or email. If you would like a reply, write to{' '}
                      <a href={`mailto:${SITE_EMAIL}`} className="underline hover:text-brand">{SITE_EMAIL}</a>.
                    </>
                  ) : (
                    <>
                      নাম বা ইমেইল চাওয়া হয় না। উত্তর পেতে চাইলে <a href={`mailto:${SITE_EMAIL}`} className="underline hover:text-brand">{SITE_EMAIL}</a> ঠিকানায় লিখুন।
                    </>
                  )}
                </span>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
