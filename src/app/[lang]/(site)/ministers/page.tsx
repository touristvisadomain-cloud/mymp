import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { shareGraph, langAlternates } from '@/lib/seo';
import { posts, currentPosts, getMemberById, bn, dateBn, initial, partyColor, postsCheckedOnBn, type PostEntry } from '@/lib/data';
import { ministryKey, normalizeName } from '@/lib/posts/names';
import { adviserForPost, adviserName, rankIn } from '@/lib/advisers';
import { Page, PageHead, Card } from '@/components/ui';
import Icon from '@/components/Icon';
import MinistersBrowser, { type MinisterGroup, type MinisterPerson } from '@/components/MinistersBrowser';
import { getT } from '@/i18n/server';
import { inLang } from '@/i18n/content';
import { govPost, partyName, personName, seatName } from '@/i18n/names';
import type { Lang, T } from '@/i18n/core';
import { CABINET_PAGE_FOR_READERS } from '../../../../../config/sync-sources';

const GROUPS = ['প্রধানমন্ত্রী', 'মন্ত্রী', 'প্রতিমন্ত্রী', 'উপমন্ত্রী', 'উপদেষ্টা'];
/** A line under each rank's tile. */
const RANK_SHORT: Record<string, string> = {
  প্রধানমন্ত্রী: 'সরকারপ্রধান',
  মন্ত্রী: 'মন্ত্রণালয়ের পূর্ণ দায়িত্বে',
  প্রতিমন্ত্রী: 'পদমর্যাদায় মন্ত্রীর পরে',
  উপমন্ত্রী: 'প্রতিমন্ত্রীর পরের ধাপ',
  উপদেষ্টা: 'প্রধানমন্ত্রীর পরামর্শক',
};
const RANK_SHORT_EN: Record<string, string> = {
  প্রধানমন্ত্রী: 'Head of government',
  মন্ত্রী: 'In full charge of a ministry',
  প্রতিমন্ত্রী: 'Next in rank below a minister',
  উপমন্ত্রী: 'The step below a state minister',
  উপদেষ্টা: 'Advises the Prime Minister',
};
/** The rank tiles' names in English, plural as the tiles count them. */
const GROUP_EN_PLURAL: Record<string, string> = {
  প্রধানমন্ত্রী: 'Prime Minister',
  মন্ত্রী: 'Ministers',
  প্রতিমন্ত্রী: 'State Ministers',
  উপমন্ত্রী: 'Deputy Ministers',
  উপদেষ্টা: 'Advisers',
};

/** The ranks' anchors on the English page, which keeps its addresses in English. */
const RANK_ID_EN: Record<string, string> = {
  প্রধানমন্ত্রী: 'prime-minister',
  মন্ত্রী: 'ministers',
  প্রতিমন্ত্রী: 'state-ministers',
  উপমন্ত্রী: 'deputy-ministers',
  উপদেষ্টা: 'advisers',
};

/** A rank's section in MinistersBrowser, so the rank tiles can jump to it. */
const rankId = (title: string, lang: Lang = 'bn') => `rank-${(lang === 'en' && RANK_ID_EN[title]) || title}`;

/** The list writes "জনাব" before most names; the site's names never carry it. */
const plainName = (name: string) => name.replace(/^জনাব\s+/, '').trim();
const firstLetter = (name: string) => (plainName(name).replace(/^(ড\.|ডাঃ|ডা\.|মোঃ|ব্রিগেডিয়ার জেনারেল \(অব:\))\s*/, '') || name).charAt(0);
/** The first letter of an English name, past its titles, for the photo's stand-in. */
const initialEn = (name: string) =>
  (name.replace(/^((Brigadier General|Dr\.?|Md\.?|Mst\.?|Barrister|Advocate|Alhaj)\s+)+/i, '') || name).charAt(0).toUpperCase();

/**
 * Someone on the list in the page's language. A member's name comes from
 * the member record; anyone else's from their profile or the list's own
 * English. With neither, the English page gives the Bangla, marked as such.
 */
function nameOf(r: Pick<PostEntry, 'memberId' | 'nameBn' | 'nameEn'>, lang: Lang): { name: string; nameLang?: 'bn'; initial: string } {
  const m = r.memberId ? getMemberById(r.memberId) : undefined;
  if (lang === 'bn') return { name: m?.nameBn ?? plainName(r.nameBn), initial: m ? initial(m) : firstLetter(r.nameBn) };
  if (m) {
    const en = personName(m, 'en');
    return /[ঀ-৿]/.test(en) ? { name: en, nameLang: 'bn', initial: initial(m) } : { name: en, initial: initialEn(en) };
  }
  const a = adviserForPost(r);
  const own = a ? adviserName(a, 'en') : r.nameEn ? { text: personName({ nameEn: r.nameEn }, 'en'), lang: 'en' as const } : null;
  if (own?.lang === 'en') return { name: own.text, initial: initialEn(own.text) };
  return { name: own?.text ?? plainName(r.nameBn), nameLang: 'bn', initial: firstLetter(r.nameBn) };
}

function cabinet(t: T) {
  const lang = t.lang;
  const people = new Map<string, MinisterPerson>();
  for (const r of currentPosts('government')) {
    const m = r.memberId ? getMemberById(r.memberId) : undefined;
    const key = `${r.title}|${r.memberId ?? normalizeName(r.nameBn)}`;
    let p = people.get(key);
    if (!p) {
      const who = nameOf(r, lang);
      p = {
        key,
        title: r.title,
        name: who.name,
        nameLang: who.nameLang,
        // Someone from outside parliament has a profile of their own.
        href: m ? `/mp/${m.slug}` : adviserForPost(r) ? `/ministers/${adviserForPost(r)!.slug}` : null,
        photo: m?.photoUrl ?? r.photoUrl,
        initial: who.initial,
        party: m?.party
          ? { abbr: m.party.abbr, name: lang === 'bn' ? m.party.nameBn ?? m.party.abbr : partyName(m.party, lang), color: partyColor(m.party.abbr) }
          : null,
        seat: lang === 'bn' ? m?.seat?.nameBn ?? null : m?.seat ? seatName(m.seat, lang) || null : null,
        rankNote: rankIn(r.rankNote, lang),
        isMp: !!m,
        pending: false,
        ministries: [],
        sourceUrl: r.sourceUrl,
      };
      people.set(key, p);
    }
    if (r.ministryBn) {
      p.ministries.push({ name: inLang(r.ministryBn, lang), key: ministryKey(r.ministryBn), since: lang === 'bn' ? dateBn(r.fromDate) : t.date(r.fromDate) });
    }
  }
  for (const x of posts.pending ?? []) {
    const key = `${x.title}|pending|${normalizeName(x.nameBn)}`;
    people.set(key, {
      key, title: x.title, name: plainName(x.nameBn), nameLang: lang === 'en' ? 'bn' : undefined, href: null, photo: null, initial: firstLetter(x.nameBn), party: null, seat: null,
      rankNote: null, isMp: false, pending: true, ministries: x.ministries.map((n) => ({ name: inLang(n, lang), key: ministryKey(n), since: null })),
      sourceUrl: CABINET_PAGE_FOR_READERS,
    });
  }
  const all = [...people.values()];
  const titles = [...GROUPS, ...new Set(all.map((p) => p.title).filter((t) => !GROUPS.includes(t)))];
  const groups: MinisterGroup[] = titles.map((title) => ({
    title,
    label: lang === 'en' ? GROUP_EN_PLURAL[title] ?? govPost(title, lang) : title,
    id: rankId(title, lang),
    people: all.filter((p) => p.title === title),
  }));

  // A ministry the English page has no name for yet cannot be offered in its filter.
  const ministries = new Map<string, { key: string; label: string | null; count: number }>();
  for (const p of all) {
    for (const m of new Map(p.ministries.map((x) => [x.key, x])).values()) {
      const e = ministries.get(m.key) ?? { key: m.key, label: m.name, count: 0 };
      e.label ??= m.name;
      e.count++;
      ministries.set(m.key, e);
    }
  }
  const named = [...ministries.values()].filter((m): m is { key: string; label: string; count: number } => !!m.label);
  return { groups, ministries: named.sort((a, b) => a.label.localeCompare(b.label, lang)) };
}

interface Change { date: string; name: string; nameLang?: 'bn'; href: string | null; text: string; kind: 'start' | 'end' | 'change' }

/** The last changes in the cabinet, from the posts' own dates: a start, an end, or both on one day. */
function changes(lang: Lang, limit = 20): Change[] {
  const byDay = new Map<string, { date: string; name: string; nameLang?: 'bn'; href: string | null; starts: PostEntry[]; ends: PostEntry[] }>();
  for (const r of posts.rows.filter((x) => x.type === 'government')) {
    const m = r.memberId ? getMemberById(r.memberId) : undefined;
    const person = r.memberId ?? normalizeName(r.nameBn);
    const add = (date: string, side: 'starts' | 'ends') => {
      const k = `${date}|${person}`;
      const who = nameOf(r, lang);
      const e = byDay.get(k) ?? { date, name: who.name, nameLang: who.nameLang, href: m ? `/mp/${m.slug}` : null, starts: [], ends: [] };
      e[side].push(r);
      byDay.set(k, e);
    };
    add(r.fromDate, 'starts');
    if (r.toDate) add(r.toDate, 'ends');
  }
  const label = (rows: PostEntry[]) => `${rows[0]!.title}${rows.some((r) => r.ministryBn) ? `, ${rows.map((r) => r.ministryBn).filter(Boolean).join(', ')}` : ''}`;
  /** In English: the post, and its ministries when every one of them has an English name. */
  const labelEn = (rows: PostEntry[]) => {
    const names = rows.map((r) => r.ministryBn).filter(Boolean).map((x) => inLang(x, 'en'));
    const post = govPost(rows[0]!.title, 'en');
    return names.length && names.every(Boolean) ? `${post}, ${names.join(', ')}` : post;
  };
  const textEn = (e: { starts: PostEntry[]; ends: PostEntry[] }) => {
    if (e.starts.length && e.ends.length) {
      const from = labelEn(e.ends);
      const to = labelEn(e.starts);
      return from === to ? `${to}: responsibilities changed` : `from ${from} to ${to}`;
    }
    return e.starts.length ? `${labelEn(e.starts)}: took office` : `${labelEn(e.ends)}: left office`;
  };
  return [...byDay.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((e) => ({
      date: e.date,
      name: e.name,
      nameLang: e.nameLang,
      href: e.href,
      kind: e.starts.length && e.ends.length ? 'change' : e.starts.length ? 'start' : 'end',
      text: lang === 'en'
        ? textEn(e)
        : e.starts.length && e.ends.length
          ? `${label(e.ends)} থেকে ${label(e.starts)}`
          : e.starts.length ? `${label(e.starts)}: দায়িত্ব পেলেন` : `${label(e.ends)}: দায়িত্ব শেষ`,
    }));
}

const countIn = (groups: MinisterGroup[], title: string) => groups.find((g) => g.title === title)?.people.length ?? 0;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const { groups } = cabinet(t);
  const count = (title: string) => countIn(groups, title);
  return {
    alternates: langAlternates(t.lang, '/ministers'),
    openGraph: shareGraph('/ministers', undefined, t.lang),
    title: t('মন্ত্রিসভা', 'Cabinet'),
    description: t.en
      ? `The Cabinet of Bangladesh: the Prime Minister, ${t.count(count('মন্ত্রী'), '', 'minister', 'ministers')}, ${t.count(count('প্রতিমন্ত্রী'), '', 'state minister', 'state ministers')} and ${t.count(count('উপদেষ্টা'), '', 'adviser', 'advisers')}, with their ministries and the date each took charge. Source: the Cabinet Division.`
      : `বাংলাদেশের মন্ত্রিসভা: প্রধানমন্ত্রী, ${bn(count('মন্ত্রী'))} জন মন্ত্রী, ${bn(count('প্রতিমন্ত্রী'))} জন প্রতিমন্ত্রী ও ${bn(count('উপদেষ্টা'))} জন উপদেষ্টা, মন্ত্রণালয় ও দায়িত্ব পাওয়ার তারিখসহ। সূত্র মন্ত্রিপরিষদ বিভাগ।`,
  };
}

export default async function MinistersPage() {
  const t = await getT();
  const data = cabinet(t);
  const count = (title: string) => countIn(data.groups, title);
  const checked = t.en ? t.date(posts.checkedAt) : postsCheckedOnBn();
  const log = changes(t.lang);
  return (
    <Page>
      <PageHead
        eyebrow={t('সরকার', 'Government')}
        title={t('মন্ত্রিসভা', 'Cabinet')}
        lede={t(
          'কে কোন মন্ত্রণালয়ের দায়িত্বে, কবে থেকে, আর কে কোন আসনের সংসদ সদস্য। তালিকাটি মন্ত্রিপরিষদ বিভাগের ওয়েবসাইট থেকে দিনে কয়েকবার মিলিয়ে নেওয়া হয়; কোনো নাম হাতে বসানো হয় না।',
          'Who is in charge of which ministry, since when, and which seat each one holds as a Member of Parliament. The list is checked against the Cabinet Division’s website several times a day; no name is entered by hand.',
        )}
      />

      <div className="pt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {GROUPS.map((g, i) =>
            count(g) ? (
              // Each rank jumps to its own list below (the group's id).
              <a
                key={g}
                href={`#${rankId(g, t.lang)}`}
                className={`group relative overflow-hidden rounded-card border border-rule bg-surface shadow-card px-4 pt-3.5 pb-4 flex flex-col gap-1.5 hover:border-brand hover:shadow-lift transition-all ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-inksoft group-hover:text-brand">
                  {t(g, GROUP_EN_PLURAL[g] ?? govPost(g, 'en'))}
                  <Icon name="arrow" size={14} className="text-brand opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </span>
                <span className="display text-[32px] font-bold leading-none tnum">{t.n(count(g))}</span>
                <span className="text-[12px] text-muted leading-snug">{t(RANK_SHORT[g]!, RANK_SHORT_EN[g]!)}</span>
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-brand/70 scale-x-0 group-hover:scale-x-100 origin-left transition-transform" />
              </a>
            ) : (
              <div key={g} className="rounded-card border border-dashed border-rule bg-surface/60 px-4 pt-3.5 pb-4 flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-muted">{t(g, GROUP_EN_PLURAL[g] ?? govPost(g, 'en'))}</span>
                <span className="display text-[32px] font-bold leading-none text-rule tnum">{t('০', '0')}</span>
                <span className="text-[12px] text-muted">{t('এখন কেউ নেই', 'None at present')}</span>
              </div>
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {checked && (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brandsoft text-branddark font-semibold">
              <Icon name="check" size={14} />
              {t('সর্বশেষ যাচাই', 'Last checked')} {checked}
            </span>
          )}
          <a
            href={CABINET_PAGE_FOR_READERS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-rule bg-surface text-inksoft hover:border-brand hover:text-brand transition-colors"
          >
            {t('সূত্র: মন্ত্রিপরিষদ বিভাগ', 'Source: Cabinet Division')}
            <Icon name="external" size={13} />
          </a>
          {(posts.pending?.length ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-warnsoft text-ink" title={t('তাঁদের নামের পাশে তা লেখা আছে', 'Marked beside their names')}>
              <Icon name="clock" size={14} />
              {t.en
                ? `${t.count(posts.pending!.length, '', 'person', 'people')} being checked for whether they are MPs`
                : `${bn(posts.pending!.length)} জন সংসদ সদস্য কিনা যাচাই হচ্ছে`}
            </span>
          )}
          <Link href="/mp" className="ms-auto inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            {t('সব সংসদ সদস্য', 'All MPs')}
            <Icon name="arrow" size={14} />
          </Link>
        </div>
      </div>

      <div className="pt-8 pb-10">
        <MinistersBrowser groups={data.groups} ministries={data.ministries} />
      </div>

      <section className="pb-14 flex flex-col gap-4" aria-labelledby="changes">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="changes" className="display text-[24px]">{t('পরিবর্তন', 'Changes')}</h2>
          <p className="text-[13.5px] text-muted">{t('মন্ত্রিপরিষদ বিভাগের তালিকায় যেদিন যা বদলেছে।', 'What changed on the Cabinet Division’s list, and when.')}</p>
        </div>
        <Card className="p-5 sm:p-6">
          {log.length === 0 ? (
            <p className="text-[14.5px] text-muted">{t('এখনো কোনো পরিবর্তন লেখা হয়নি।', 'No changes recorded yet.')}</p>
          ) : (
            <ol className="flex flex-col">
              {log.map((c, i) => (
                <li key={i} className="relative ps-6 pb-5 last:pb-0">
                  <span
                    aria-hidden="true"
                    className={`absolute start-0 top-[7px] w-2.5 h-2.5 rounded-full ${c.kind === 'end' ? 'bg-rule' : 'bg-brand'}`}
                  />
                  {i < log.length - 1 && <span aria-hidden="true" className="absolute start-[4.5px] top-[19px] bottom-0 w-px bg-rulesoft" />}
                  <span className="block text-[12.5px] text-muted">{t.en ? t.date(c.date) : dateBn(c.date)}</span>
                  <span className="block text-[14.5px] leading-relaxed">
                    {c.href ? (
                      <Link href={c.href} lang={c.nameLang} className="font-semibold hover:text-brand">{c.name}</Link>
                    ) : (
                      <span lang={c.nameLang} className="font-semibold">{c.name}</span>
                    )}
                    {', '}
                    <span className={c.kind === 'end' ? 'text-muted' : ''}>{c.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {t.en ? (
            <p className="mt-4 pt-3 border-t border-rule text-[12.5px] text-muted leading-relaxed">
              The date of taking charge is the date of allocation on the Cabinet Division’s list. When someone’s name leaves the list, the day that is
              noticed is taken as the day their responsibility ended.
            </p>
          ) : (
            <p className="mt-4 pt-3 border-t border-rule text-[12.5px] text-muted leading-relaxed">
              দায়িত্ব পাওয়ার তারিখ মন্ত্রিপরিষদ বিভাগের তালিকার বণ্টনের তারিখ। কারও নাম তালিকা থেকে সরে গেলে যেদিন তা ধরা পড়ে,
              সেদিনকে দায়িত্ব শেষের তারিখ ধরা হয়।
            </p>
          )}
        </Card>
      </section>

    </Page>
  );
}
