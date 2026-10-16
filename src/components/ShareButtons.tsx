'use client';

import { useState, useSyncExternalStore, type MouseEvent } from 'react';
import Icon from './Icon';
import BrandIcon, { type Brand } from './BrandIcon';
import { useT } from '@/i18n/client';

/** Whether the browser has a share sheet; false while rendering on the server. */
const noSubscribe = () => () => {};
const useCanShare = () =>
  useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  );

const MESSENGER_WEB = 'https://www.messenger.com/';

/**
 * Share this page: the phone's own share sheet where the browser has one,
 * and plain share links for Facebook, Messenger and WhatsApp (the owner
 * dropped X and the copy-link button, 2026-10-17).
 * No third-party script is loaded; each network's own share address does the
 * work, and what the post shows comes from the page's share tags (photo,
 * name, seat).
 *
 * Messenger has a share address only inside its app, so the button opens the
 * app's send screen on Android and iPhone. On a computer the only share
 * address needs a Facebook app id, which the site does not have: there the
 * button copies the link and opens messenger.com to paste it into a chat.
 */
export default function ShareButtons({ url, title, text }: { url: string; title: string; text: string }) {
  const t = useT();
  const canShare = useCanShare();
  const [copied, setCopied] = useState<'messenger' | null>(null);

  const u = encodeURIComponent(url);

  function toMessenger(e: MouseEvent<HTMLAnchorElement>) {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) {
      e.preventDefault();
      // Falls back to messenger.com when no app handles the link.
      window.location.assign(`intent://share/?link=${u}#Intent;scheme=fb-messenger;S.browser_fallback_url=${encodeURIComponent(MESSENGER_WEB)};end`);
    } else if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      e.preventDefault();
      window.location.assign(`fb-messenger://share/?link=${u}`);
    } else {
      // The link itself opens messenger.com in a new tab.
      void copy();
    }
  }

  const links: { key: Brand; label: string; href: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void }[] = [
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: 'messenger', label: 'Messenger', href: MESSENGER_WEB, onClick: toMessenger },
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}` },
  ];

  /** The link to the clipboard, for Messenger on a computer, which has no share address. */
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers: a hidden field and the copy command.
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'absolute';
      field.style.left = '-9999px';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopied('messenger');
    window.setTimeout(() => setCopied(null), 6000);
  }

  const button =
    // On a phone the networks are icons in one row (their names stay for screen readers); words from sm up.
    'inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:h-8 sm:w-auto sm:px-3 rounded-lg border border-rule bg-surface text-[13px] font-semibold hover:border-brand hover:text-brand transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('এই পাতা শেয়ার করুন', 'Share this page')}>
      <span className="hidden sm:inline text-[12.5px] font-semibold text-muted me-0.5">{t('শেয়ার করুন', 'Share')}</span>
      {canShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title, text, url }).catch(() => {})}
          className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3.5 sm:px-3 rounded-lg bg-brand text-white text-[13px] font-semibold hover:bg-branddark transition-colors"
        >
          <Icon name="share" size={14} />
          {t('শেয়ার', 'Share')}
        </button>
      )}
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={l.onClick}
          className={button}
          aria-label={
            t.en
              ? l.key === 'messenger' ? 'Send on Messenger' : `Share on ${l.label}`
              : l.key === 'messenger' ? 'Messenger-এ পাঠান' : `${l.label}-এ শেয়ার করুন`
          }
          title={
            l.key === 'messenger'
              ? t(
                  'ফোনে Messenger অ্যাপে খোলে। কম্পিউটারে লিংক কপি হয় আর messenger.com খোলে; চ্যাটে পেস্ট করুন।',
                  'Opens the Messenger app on a phone. On a computer the link is copied and messenger.com opens; paste it into a chat.',
                )
              : undefined
          }
        >
          <BrandIcon name={l.key} size={16} />
          <span className="hidden sm:inline">{l.key === 'messenger' && copied === 'messenger' ? t('লিংক কপি হয়েছে, চ্যাটে পেস্ট করুন', 'Link copied, paste it into a chat') : l.label}</span>
        </a>
      ))}
      <span className="sr-only" role="status">
        {copied === 'messenger'
          ? t(
              'লিংক কপি হয়েছে। Messenger খুলেছে, যাকে পাঠাতে চান তার চ্যাটে পেস্ট করুন।',
              'Link copied. Messenger has opened; paste the link into the chat of the person you want to send it to.',
            )
          : ''}
      </span>
    </div>
  );
}
