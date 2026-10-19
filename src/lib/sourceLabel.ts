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

/**
 * Labels for a list of sources, a repeated label numbered so each link
 * still tells apart: "উইকিপিডিয়া (ইংরেজি) ১", "উইকিপিডিয়া (ইংরেজি) ২".
 */
export function sourceLabels(urls: string[], lang: Lang = 'bn'): string[] {
  const labels = urls.map((u) => sourceLabel(u, lang));
  const total = new Map<string, number>();
  for (const l of labels) total.set(l, (total.get(l) ?? 0) + 1);
  const seen = new Map<string, number>();
  return labels.map((l) => {
    if ((total.get(l) ?? 0) < 2) return l;
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    return `${l} ${lang === 'en' ? n : String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!)}`;
  });
}
