import type { Lang } from '@/i18n/core';

/**
 * Each party's logo, copied into public/party/ from Wikimedia so the site never
 * hotlinks it. The parliament's own data has no logos at all. `licence` is what
 * the file's page states; the CC BY ones must name their author wherever the
 * logos are credited (the party pages do). Two logos are non-free on Bangla
 * Wikipedia and are shown, as there, only to identify the party.
 */
export type PartyLogo = {
  src: string;
  width: number;
  height: number;
  /** JAGPA has no logo on record, only its flag. */
  kind: 'logo' | 'flag';
  /** The file's page on Wikimedia, which is the credit link. */
  page: string;
  licence: string;
  licenceUrl?: string;
  author?: string;
};

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
const bnWiki = (file: string) => `https://bn.wikipedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;

const PD = 'পাবলিক ডোমেইন';
const NON_FREE = 'অ-মুক্ত লোগো, দল চেনানোর জন্য';
const CC0 = { licence: 'CC0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' };
const BY = { licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' };
const BY_SA = { licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' };

/** The two licences written in words, in English; the Creative Commons names read the same in both languages. */
const LICENCE_EN: Record<string, string> = {
  [PD]: 'Public domain',
  [NON_FREE]: 'Non-free logo, used to identify the party',
};

/** A logo's licence in the page's language. */
export const logoLicence = (logo: PartyLogo, lang: Lang) => (lang === 'en' ? LICENCE_EN[logo.licence] ?? logo.licence : logo.licence);

/** Keyed by party abbreviation, as in parties.json and every member's party. */
export const PARTY_LOGOS: Record<string, PartyLogo> = {
  BNP: { src: '/party/bnp.webp', width: 256, height: 256, kind: 'logo', page: commons('BNP logo.png'), ...CC0 },
  BJEI: { src: '/party/bjei.svg', width: 501, height: 523, kind: 'logo', page: commons('Bangladesh Jamaat-e-Islami Emblem.svg'), licence: PD },
  NCP: { src: '/party/ncp.svg', width: 846, height: 846, kind: 'logo', page: commons('জাতীয় নাগরিক পার্টির লোগো.svg'), licence: PD },
  BKM: { src: '/party/bkm.webp', width: 256, height: 232, kind: 'logo', page: bnWiki('বাংলাদেশ খেলাফত মজলিসের লোগো.png'), licence: NON_FREE },
  IMB: { src: '/party/imb.webp', width: 238, height: 256, kind: 'logo', page: bnWiki('ইসলামী আন্দোলন বাংলাদেশের লোগো.jpg'), licence: NON_FREE },
  GOP: { src: '/party/gop.svg', width: 572, height: 772, kind: 'logo', page: commons('গণঅধিকার পরিষদের লোগো.svg'), licence: PD },
  BJP: { src: '/party/bjp.webp', width: 256, height: 256, kind: 'logo', page: commons('Bangladesh Jatiya Party Naizur.png'), ...BY_SA, author: 'Darkedgeblood' },
  KM: { src: '/party/km.webp', width: 256, height: 254, kind: 'logo', page: commons('Khelafat Majlis Official Logo.png'), ...BY, author: 'Emad.najid' },
  PSM: { src: '/party/psm.svg', width: 415, height: 416, kind: 'logo', page: commons('গণসংহতি আন্দোলন.svg'), ...BY_SA, author: 'NahidHossain' },
  JAGPA: { src: '/party/jagpa.svg', width: 290, height: 150, kind: 'flag', page: commons('Flag of Jagpa.svg'), licence: PD },
};

/**
 * The 2026 results (TBS, Wikipedia) spell two parties differently from the
 * parliament: Islami Andolan is "IAB" (Barguna-1's winner is IMB's member) and
 * Ganosamhati "GSA" (Zonayed Saki's Brahmanbaria-6 result).
 */
const RESULT_ALIASES: Record<string, string> = { IAB: 'IMB', GSA: 'PSM' };

export function partyLogo(abbr: string | null | undefined): PartyLogo | null {
  return (abbr && PARTY_LOGOS[RESULT_ALIASES[abbr] ?? abbr]) || null;
}
