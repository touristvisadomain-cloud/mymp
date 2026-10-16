/**
 * What the House is doing: sittings, circulars, notices and the presiding
 * officers, all from parliament.gov.bd and refreshed by the same sync that
 * brings the members. Read from the committed snapshot like everything else.
 */
import activityJson from '../../data/activity.json';
import { bn } from './data';
import type { Lang } from '@/i18n/core';
import { HOUSE_ROLE, ordinalWord } from '@/i18n/names';

export interface Sitting {
  id: string;
  titleBn: string | null;
  date: string | null;
  pdfUrl: string | null;
}

export interface Circular {
  id: string;
  no: number | null;
  titleBn: string | null;
  date: string | null;
  pdfUrl: string | null;
}

export interface Session {
  id: string;
  titleBn: string | null;
  titleEn: string | null;
  startDate: string | null;
  endDate: string | null;
  circulars: Circular[];
  /** Orders of the day, one per sitting, newest first. */
  sittings: Sitting[];
}

export interface Notice {
  id: string;
  type: 'NOC_GO' | 'COMMITTEE' | 'GENERAL' | string;
  category: string | null;
  date: string | null;
  titleBn: string | null;
  titleEn: string | null;
  pdfUrl: string | null;
  memberId: string | null;
  committeeId: string | null;
}

export interface Officer {
  role: string;
  nameBn: string | null;
  nameEn: string | null;
  tenureBn: string | null;
  memberId: string | null;
}

export const activity = activityJson as {
  parliament: {
    no: number;
    electionDate: string | null;
    oathDate: string | null;
    gazetteDate: string | null;
    endDate: string | null;
  };
  speakers: Officer[];
  sessions: Session[];
  notices: Notice[];
};

export const parliament = activity.parliament;
export const sessions = activity.sessions;
export const officers = activity.speakers;

export const ROLE_LABELS: Record<string, string> = {
  SPEAKER: 'স্পিকার',
  DEPUTY_SPEAKER: 'ডেপুটি স্পিকার',
  LEADER_OF_HOUSE: 'সংসদ নেতা',
  OPPOSITION_LEADER: 'বিরোধীদলীয় নেতা',
  CHIEF_WHIP: 'চিফ হুইপ',
  WHIP: 'হুইপ',
};

/** Every office the source lists for a member, in Bengali (or English). */
export const rolesOf = (memberId: string, lang: Lang = 'bn') =>
  officers.filter((o) => o.memberId === memberId).map((o) => (lang === 'en' ? HOUSE_ROLE[o.role]?.en : ROLE_LABELS[o.role]) ?? o.role);

const ORDINALS = ['', 'প্রথম', 'দ্বিতীয়', 'তৃতীয়', 'চতুর্থ', 'পঞ্চম', 'ষষ্ঠ', 'সপ্তম', 'অষ্টম', 'নবম', 'দশম'];

/** The secretariat's notice categories, for readers. */
export const NOTICE_CATEGORY_BN: Record<string, string> = { NOC: 'অনাপত্তিপত্র', GO: 'সরকারি আদেশ', notification: 'প্রজ্ঞাপন' };
export const NOTICE_CATEGORY_EN: Record<string, string> = { NOC: 'No-objection certificate', GO: 'Government order', notification: 'Notification' };

/** "সেশন ৩" and "সেশন-১" both become "তৃতীয় অধিবেশন" / "প্রথম অধিবেশন". */
export function sessionLabel(s: Session, lang: Lang = 'bn'): string {
  const raw = (s.titleBn ?? s.titleEn ?? '').match(/[০-৯\d]+/)?.[0] ?? '';
  const n = Number(raw.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))));
  if (lang === 'en') return n ? `${ordinalWord(n, 'en')} session` : s.titleEn ?? 'Session';
  if (!n) return s.titleBn ?? s.titleEn ?? 'অধিবেশন';
  return `${ORDINALS[n] ?? `${bn(n)}তম`} অধিবেশন`;
}

const byDateDesc = <T extends { date: string | null }>(a: T, b: T) => (b.date ?? '').localeCompare(a.date ?? '');

/** The most recent session. The source does not close sessions, so "current" is the latest. */
export const latestSession = () => sessions[0] ?? null;

export const latestSitting = () => sessions.flatMap((s) => s.sittings).sort(byDateDesc)[0] ?? null;

export const totalSittings = () => sessions.reduce((n, s) => n + s.sittings.length, 0);

export const noticesForMember = (id: string) => activity.notices.filter((n) => n.memberId === id);
export const noticesForCommittee = (id: string) => activity.notices.filter((n) => n.committeeId === id);
export const generalNotices = () => activity.notices.filter((n) => !n.memberId && !n.committeeId);
export const memberNoticeCount = () => activity.notices.filter((n) => n.memberId).length;

/** Whole days between an ISO date and today, or null when the date is missing. */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}
