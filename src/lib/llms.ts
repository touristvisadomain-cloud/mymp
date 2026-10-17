import { members, parties, seats, meta, districtOf, GENERAL_SEATS, RESERVED_SEATS } from '@/lib/data';
import { districtGroups } from '@/lib/districts';
import { districtName, partyName, partyShort, personName, seatName } from '@/i18n/names';
import { siteUrl } from '@/lib/site';

/*
 * The site described for AI assistants, at /llms.txt (the llmstxt.org
 * convention): what the site is, how its addresses work, and the pages that
 * answer the common questions. /llms-full.txt adds every member, party and
 * district, one line each, so an assistant can find the right page without
 * crawling them all. Both are written from the same data as the pages.
 */

const bnUrl = (path: string) => `${siteUrl}${path === '/' ? '' : path}`;
const enUrl = (path: string) => `${siteUrl}/en${path === '/' ? '' : path}`;
const both = (label: string, path: string, note = '') =>
  `- [${label}](${bnUrl(path)}) ([English](${enUrl(path)}))${note ? `: ${note}` : ''}`;

function head(): string[] {
  const synced = new Date(meta.syncedAt).toISOString().slice(0, 10);
  return [
    '# আমার এমপি (My MP, mymp.bd)',
    '',
    `> Information on every Member of the 13th Parliament of Bangladesh (Jatiya Sangsad), elected in 2026: who holds each of the ${GENERAL_SEATS} constituencies and ${RESERVED_SEATS} seats reserved for women, their party, biography, election result, committees and posts. In Bangla at the plain addresses and in English under /en. Sources: the Parliament of Bangladesh (parliament.gov.bd), the Election Commission and the Cabinet Division. Data last updated ${synced}.`,
    '',
    'বাংলাদেশ জাতীয় সংসদের সব সংসদ সদস্যের তথ্য: কোন আসনের এমপি কে, দল, পরিচিতি, নির্বাচনী ফল, সংসদীয় কমিটি ও মন্ত্রিসভা। বাংলা ও ইংরেজিতে।',
    '',
    '## How the addresses work',
    '',
    `- A member: ${bnUrl('/mp/<slug>')} in Bangla, ${enUrl('/mp/<slug>')} in English`,
    `- A constituency: ${bnUrl('/ason/<district>-<number>')}, e.g. ${bnUrl('/ason/dhaka-17')} for Dhaka-17 (ঢাকা-১৭)`,
    `- A district: ${bnUrl('/jela/<district>')}, e.g. ${bnUrl('/jela/dhaka')}`,
    `- A party: ${bnUrl('/dol/<slug>')}; a committee: ${bnUrl('/committee/<slug>')}`,
    '- Every page has the same address in English with /en in front.',
    '',
    '## Main pages',
    '',
    both('All MPs / সব সংসদ সদস্য', '/mp', 'the full list, searchable by name, party, seat or district'),
    both('All constituencies / সব আসন', '/ason'),
    both('Districts / জেলা', '/jela', 'the seats and MPs of each district'),
    both('Reserved seats for women / সংরক্ষিত নারী আসন', '/sangrakkhito-ason'),
    both('Election 2026 results / নির্বাচন', '/nirbachon', 'votes seat by seat'),
    both('Political parties / দল', '/dol', 'seats by party'),
    both('Cabinet / মন্ত্রিসভা', '/ministers', 'ministers and state ministers'),
    both('Parliamentary committees / কমিটি', '/committee'),
    both('Statistics / পরিসংখ্যান', '/parisonkhan', 'age, education, women, first-time MPs'),
    both('Sessions of Parliament / অধিবেশন', '/odhibeshon'),
    both('Sources and method / সূত্র', '/sutro'),
    '',
  ];
}

export function llmsTxt(): string {
  return [
    ...head(),
    '## Optional',
    '',
    `- [Every member, party and district, one line each](${siteUrl}/llms-full.txt)`,
    `- [Sitemap](${siteUrl}/sitemap.xml)`,
    '',
  ].join('\n');
}

export function llmsFullTxt(): string {
  const sorted = [...members].sort((a, b) => (a.seat?.no ?? 999) - (b.seat?.no ?? 999));
  const memberLines = sorted.map((m) => {
    const seat = m.seat ? `${seatName(m.seat, 'en')} (${m.seat.nameBn ?? ''})` : '';
    const party = m.party ? `${partyName(m.party, 'en')} (${partyShort(m.party, 'bn')})` : '';
    const d = districtOf(m.seat);
    const about = [seat, party, d ? `${districtName(d, 'en')} district` : ''].filter(Boolean).join(', ');
    return `- ${personName(m, 'en')} / ${m.nameBn ?? ''}: ${about}. ${bnUrl(`/mp/${m.slug}`)} | ${enUrl(`/mp/${m.slug}`)}`;
  });
  const vacant = seats.filter((s) => !s.memberId || s.vacantSince);
  const partyLines = parties
    .map((p) => ({ p, n: members.filter((m) => m.party?.abbr === p.abbr).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ p, n }) => `- ${partyName(p, 'en')} / ${partyName(p, 'bn')}: ${n} members. ${bnUrl(`/dol/${p.slug}`)} | ${enUrl(`/dol/${p.slug}`)}`);
  const districtLines = [...districtGroups().values()]
    .sort((a, b) => a.en.localeCompare(b.en))
    .map(
      (d) =>
        `- ${districtName(d, 'en')} / ${d.bn}: ${d.seats.length} seats (${d.seats.map((s) => seatName(s, 'en')).join(', ')}). ${bnUrl(`/jela/${d.slug}`)} | ${enUrl(`/jela/${d.slug}`)}`,
    );
  return [
    ...head(),
    `## Members of the 13th Parliament (${members.length})`,
    '',
    'Name in English / Bangla: seat, party, district. Bangla page | English page.',
    '',
    ...memberLines,
    '',
    ...(vacant.length
      ? ['## Vacant seats', '', ...vacant.map((s) => `- ${seatName(s, 'en')} (${s.nameBn ?? ''}): vacant. ${bnUrl(`/ason/${s.slug}`)}`), '']
      : []),
    '## Parties in Parliament',
    '',
    ...partyLines,
    '',
    '## Districts',
    '',
    ...districtLines,
    '',
  ].join('\n');
}
