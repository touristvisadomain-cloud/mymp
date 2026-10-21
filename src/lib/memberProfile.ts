/**
 * What a member's profile says about them beyond the bare record: their
 * offices, their government posts as badges, and the opening text (the lead
 * sentence, the biography or summary, or an introduction put together from
 * the record). The member page (/mp/[slug]) and the mobile app's profile
 * screen read the same functions, so the two never say different things.
 */
import { meta, OFFICE_LABELS, governmentPostsOf, type Member, type PostEntry } from '@/lib/data';
import { rolesOf } from '@/lib/activity';
import { resultForSeat, electionYear } from '@/lib/history';
import { introOf, resultSourceByEn } from '@/lib/intro';
import { mpDescription } from '@/lib/seo/mpDescription';
import { sourceOf } from '@/lib/resultsView';
import { inLang, translated } from '@/i18n/content';
import { OFFICE, govPost } from '@/i18n/names';
import type { Lang } from '@/i18n/core';

/** An adviser's responsibility as the cabinet list words it, where the translations do not have it yet. */
const ADVISER_EN: Record<string, string> = { 'রাজনৈতিক উপদেষ্টা': 'Political Adviser' };

/**
 * A government post as the English badge shows it: "State Minister, Ministry
 * of Water Resources". A ministry with no English on file yet leaves the post
 * alone ("State Minister"); a post whose title has no English is not shown.
 */
export function postEn(p: Pick<PostEntry, 'title' | 'ministryBn'>): string | null {
  const title = govPost(p.title, 'en');
  const titleOk = title && !/[ঀ-৿]/.test(title) ? title : null;
  if (!p.ministryBn) return titleOk;
  if (p.ministryBn.includes('উপদেষ্টা')) return inLang(p.ministryBn, 'en') ?? ADVISER_EN[p.ministryBn.trim()] ?? titleOk;
  const ministry = inLang(p.ministryBn, 'en');
  return titleOk && ministry ? `${titleOk}, ${ministry}` : titleOk;
}

/** A government post as the Bangla badge shows it: "প্রতিমন্ত্রী, পানি সম্পদ মন্ত্রণালয়". */
export const postLabelBn = (p: Pick<PostEntry, 'title' | 'ministryBn'>) =>
  !p.ministryBn ? p.title : p.ministryBn.includes('উপদেষ্টা') ? p.ministryBn : `${p.title}, ${p.ministryBn}`;

/**
 * Offices come from two places in the source: the term record (Speaker, PM…)
 * and the presiding-officers list (whips and leaders). Each is shown once.
 * `rolesBn` is always the Bangla; `roles` is in the page's language.
 */
export function memberRoles(m: Member, lang: Lang): { rolesBn: string[]; roles: string[] } {
  const rolesBn = [...new Set([...m.offices.map((o) => OFFICE_LABELS[o] ?? o), ...rolesOf(m.id)])];
  const roles = lang === 'en' ? [...new Set([...m.offices.map((o) => OFFICE[o]?.en ?? o), ...rolesOf(m.id, 'en')])] : rolesBn;
  return { rolesBn, roles };
}

/**
 * Government posts from the cabinet lists (the posts sync), as badges beside
 * the offices. The PM's title is already among the offices; an adviser's entry
 * is often a responsibility ("রাজনৈতিক উপদেষ্টা") rather than a ministry.
 */
export function postBadges(m: Member, lang: Lang): string[] {
  const { rolesBn, roles } = memberRoles(m, lang);
  const govPosts = governmentPostsOf(m.id).filter((p) => p.title !== 'প্রধানমন্ত্রী');
  return lang === 'en'
    ? // The same posts the Bangla page shows, each in English.
      [...new Set(govPosts.filter((p) => !rolesBn.includes(postLabelBn(p))).map(postEn).filter((b): b is string => !!b && !roles.includes(b)))]
    : [...new Set(govPosts.map(postLabelBn))].filter((b) => !roles.includes(b));
}

/**
 * The profile's opening text in the page's language. `lead` is the sentence
 * search results and link previews show. Then the biography (`paragraphs`),
 * or the source's summary, or, for a member with neither, an introduction
 * (`intro`) put together from the facts on the page.
 */
export function memberText(m: Member, lang: Lang) {
  const en = lang === 'en';
  const result = m.seat && !m.seat.reserved ? resultForSeat(m.seat.no, meta.parliamentNo) : null;
  // The seat's result is only "this member's votes" when they are its winner;
  // after a by-election the general-election winner is someone else.
  const wonThisResult = !!result && [...result.candidates].sort((a, b) => b.votes - a.votes)[0]?.name === m.nameBn;
  // The biography: the Bangla, or its English when that is on file.
  const bio = translated(m.bioBn, lang);
  // On an English page with no English biography yet, the page says the Bangla one exists and links to it.
  const bioOnlyInBangla = en && !!m.bioBn?.trim() && !bio;
  const paragraphs = (bio?.text ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  // A paragraph that is one line starting "### " is a sub-heading ("### রাজনৈতিক জীবন").
  const blocks = paragraphs.map((p) =>
    /^###\s+\S/.test(p) && !p.includes('\n') ? { heading: true, text: p.replace(/^###\s+/, '') } : { heading: false, text: p },
  );
  // The member's office and recent work: Bangla for now. The biography's "বর্তমান দায়িত্ব" (the post and
  // since when) said the same as this, so with a duties text that section opens it instead.
  const dutiesText = en ? null : m.dutiesBn?.trim() || null;
  const roleAt = dutiesText ? blocks.findIndex((b) => b.heading && /^বর্তমান দায়িত্ব/.test(b.text)) : -1;
  const roleEnd = roleAt < 0 ? -1 : blocks.findIndex((b, i) => i > roleAt && b.heading);
  const roleParas = roleAt < 0 ? [] : blocks.slice(roleAt + 1, roleEnd < 0 ? undefined : roleEnd).map((b) => b.text);
  const bioBlocks = roleAt < 0 ? blocks : [...blocks.slice(0, roleAt), ...(roleEnd < 0 ? [] : blocks.slice(roleEnd))];
  const duties = dutiesText ? [...roleParas, ...dutiesText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)] : [];
  const year = electionYear(meta.parliamentNo);
  // parliament.gov.bd writes a biography for the presiding officers only (and repeats it as the summary);
  // everyone else gets an introduction put together from the facts on this page.
  const bnParagraphs = (m.bioBn ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const summaryRepeatsBio =
    !!m.summaryBn && bnParagraphs.length > 0 && bnParagraphs.join('').replace(/\s/g, '').includes(m.summaryBn.replace(/\s/g, ''));
  const summary = translated(m.summaryBn, lang);
  const showSummary = !!summary && !(summaryRepeatsBio && paragraphs.length > 0);
  const intro =
    summary || paragraphs.length
      ? []
      : introOf(
          m,
          {
            roles: memberRoles(m, lang).roles,
            result: wonThisResult ? result : null,
            resultSourceBy: result ? (en ? resultSourceByEn(result.sourceUrl) : sourceOf(result.sourceUrl).by) : null,
            year,
            skipIdentity: true,
          },
          lang,
        );
  // The page opens with the same sentences search results and link previews show.
  const lead = mpDescription(m, lang);
  return { result, wonThisResult, year, bio, bioOnlyInBangla, paragraphs, blocks, bioBlocks, duties, summary, showSummary, intro, lead };
}
