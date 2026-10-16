import type { Lang } from '@/i18n/core';

/**
 * How a cited address is named on a page: "উইকিপিডিয়া (বাংলা)" rather than a
 * percent-encoded URL a reader cannot read.
 */
export function sourceLabel(url: string, lang: Lang = 'bn'): string {
  const en = lang === 'en';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const wiki = host.match(/^(\w+)\.wikipedia\.org$/);
    if (wiki) {
      if (en) return `Wikipedia (${wiki[1] === 'bn' ? 'Bangla' : wiki[1] === 'en' ? 'English' : wiki[1]})`;
      return `উইকিপিডিয়া (${wiki[1] === 'bn' ? 'বাংলা' : wiki[1] === 'en' ? 'ইংরেজি' : wiki[1]})`;
    }
    if (host.endsWith('parliament.gov.bd')) return en ? 'Parliament of Bangladesh' : 'জাতীয় সংসদ';
    if (host.endsWith('cabinet.gov.bd')) return en ? 'Cabinet Division' : 'মন্ত্রিপরিষদ বিভাগ';
    if (host.endsWith('.gov.bd')) return host;
    return host;
  } catch {
    return url;
  }
}

/** A space- or line-separated list of addresses, with anything that is not one dropped. */
export const sourceList = (raw: string | null | undefined): string[] =>
  (raw ?? '').split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
