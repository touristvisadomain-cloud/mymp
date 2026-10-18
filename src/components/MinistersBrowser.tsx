'use client';

import { useState } from 'react';
import { useQueryParam } from '@/lib/useQueryParam';
import Link from '@/i18n/Link';
import { useT } from '@/i18n/client';
import { matchTier } from '@/lib/search';
import MemberPhoto from './MemberPhoto';
import PartyBadge from './PartyBadge';
import Icon from './Icon';

export interface MinisterPerson {
  key: string;
  title: string;
  /** In the page's language. */
  name: string;
  /** 'bn' on an English page for a name that has no English yet: the Bangla is shown, marked as Bangla. */
  nameLang?: 'bn';
  href: string | null;
  photo: string | null;
  initial: string;
  party: { abbr: string; name: string; color: string } | null;
  seat: string | null;
  rankNote: string | null;
  isMp: boolean;
  /** On the cabinet list, not yet placed by an editor as an MP or not. */
  pending: boolean;
  /**
   * Each ministry's name in the page's language; null on an English page while
   * it has no English. `aliases`: what people type for it ("ICT", "তথ্য"), for the search only.
   */
  ministries: { name: string | null; key: string; since: string | null; aliases?: string[] }[];
  /** The rank as people type it ("Prime Minister", "prodhan montri"): for the search only. */
  titleAliases?: string[];
  sourceUrl: string | null;
}

export interface MinisterGroup {
  /** The rank as the cabinet list writes it (Bangla), the group's key. */
  title: string;
  /** The rank in the page's language. */
  label: string;
  /** The section's anchor, which the rank tiles above link to. */
  id: string;
  people: MinisterPerson[];
}

/** One line under each rank, so a reader knows what the rank means. */
const RANK_NOTE: Record<string, string> = {
  প্রধানমন্ত্রী: 'সরকারপ্রধান, মন্ত্রিসভার সভাপতি।',
  মন্ত্রী: 'মন্ত্রণালয়ের পূর্ণ দায়িত্বে।',
  প্রতিমন্ত্রী: 'মন্ত্রীর সঙ্গে বা একাই কোনো মন্ত্রণালয়ের দায়িত্বে, পদমর্যাদায় মন্ত্রীর পরে।',
  উপমন্ত্রী: 'প্রতিমন্ত্রীর পরের ধাপ।',
  উপদেষ্টা: 'নির্দিষ্ট বিষয়ে প্রধানমন্ত্রীকে পরামর্শ দেন; বেশিরভাগ উপদেষ্টা সংসদ সদস্য নন।',
};
const RANK_NOTE_EN: Record<string, string> = {
  প্রধানমন্ত্রী: 'Head of government, who chairs the Cabinet.',
  মন্ত্রী: 'In full charge of a ministry.',
  প্রতিমন্ত্রী: 'In charge of a ministry with a minister or alone; next in rank below a minister.',
  উপমন্ত্রী: 'The step below a state minister.',
  উপদেষ্টা: 'Advises the Prime Minister on particular matters; most advisers are not Members of Parliament.',
};

/** Whoever is not an MP shares one grey in the composition bar. */
const OUTSIDE = { key: 'outside', name: 'সংসদ সদস্য নন', nameEn: 'Not an MP', color: 'var(--color-muted)' };

/** The photo in a ring of the party's colour, so a page of faces reads by party at a glance. */
function Portrait({ p, size }: { p: MinisterPerson; size: number }) {
  return (
    <span
      className="shrink-0 rounded-full p-[3px]"
      style={{ background: p.party?.color ?? 'var(--color-rule)' }}
      aria-hidden="true"
      lang={p.nameLang}
    >
      <span className="block rounded-full bg-surface p-[2px]">
        <MemberPhoto src={p.photo} alt="" initial={p.initial} size={size} />
      </span>
    </span>
  );
}

function Who({ p }: { p: MinisterPerson }) {
  const t = useT();
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
      {p.party && (
        <span className="flex items-center gap-1.5 font-semibold text-inksoft">
          <PartyBadge abbr={p.party.abbr} color={p.party.color} size={16} />
          {p.party.name}
        </span>
      )}
      {p.seat && <span className="tnum">{p.seat}</span>}
      {!p.isMp && (
        <span className="px-1.5 py-px rounded border border-rule text-[12px]">
          {p.pending ? t('সংসদ সদস্য কিনা যাচাই হচ্ছে', 'Being checked: MP or not') : t('সংসদ সদস্য নন', 'Not an MP')}
        </span>
      )}
      {p.rankNote && <span>{p.rankNote}</span>}
    </span>
  );
}

function Source({ p }: { p: MinisterPerson }) {
  const t = useT();
  if (!p.sourceUrl) return null;
  return (
    <a
      href={p.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 text-[12px] text-muted hover:text-brand"
      title={t('মন্ত্রিপরিষদ বিভাগের তালিকা', 'The Cabinet Division’s list')}
    >
      {t('সূত্র', 'Source')} ↗
    </a>
  );
}

/** The head of government: the whole width, a larger portrait and every portfolio side by side. */
function LeaderCard({ p, label }: { p: MinisterPerson; label: string }) {
  const t = useT();
  return (
    <div className="relative overflow-hidden rounded-card border border-brandring bg-surface shadow-card">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brandsoft via-surface to-surface" />
      <div className="relative p-5 sm:p-7 flex flex-col sm:flex-row gap-5 sm:gap-7 items-start">
        <Portrait p={p} size={112} />
        <div className="grow min-w-0 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-[12px] font-bold tracking-[0.6px] text-brand">{label}</span>
              {p.href ? (
                <Link href={p.href} lang={p.nameLang} className="display text-[28px] sm:text-[34px] font-bold leading-tight hover:text-brand">{p.name}</Link>
              ) : (
                <span lang={p.nameLang} className="display text-[28px] sm:text-[34px] font-bold leading-tight">{p.name}</span>
              )}
              <Who p={p} />
            </div>
            <Source p={p} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-muted">{t.count(p.ministries.length, 'টি দায়িত্ব', 'responsibility', 'responsibilities')}</span>
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {p.ministries.filter((m) => m.name).map((m) => (
                <li key={m.key} className="rounded-lg border border-rule bg-surface/80 px-3 py-2 flex flex-col gap-0.5">
                  <span className="font-semibold text-[14.5px] leading-snug">{m.name}</span>
                  {m.since && <span className="text-[12.5px] text-muted">{t.en ? `Since ${m.since}` : `${m.since} থেকে`}</span>}
                </li>
              ))}
            </ul>
            <Unnamed p={p} />
          </div>
          {p.href && (
            <Link href={p.href} className="self-start inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-branddark transition-colors">
              {t('পুরো পরিচিতি, সংবাদ ও ভিডিও', 'Full profile, news and videos')}
              <Icon name="arrow" size={15} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * On an English page, the ministries that have no English name yet: counted,
 * with the way to the Bangla page that names them, rather than left out silently.
 */
function Unnamed({ p }: { p: MinisterPerson }) {
  const t = useT();
  const n = p.ministries.filter((m) => !m.name).length;
  if (!t.en || !n) return null;
  const all = n === p.ministries.length;
  return (
    <span className="text-[12.5px] text-muted leading-snug">
      {all ? (n === 1 ? 'Ministry' : `${n} ministries`) : n === 1 ? 'One more ministry' : `${n} more ministries`}, named so far only on the{' '}
      {/* The Bangla page is another root layout (<html lang>), so a full page load, not a client navigation. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/ministers" hrefLang="bn" className="underline hover:text-brand">Bangla page</a>
    </span>
  );
}

function PersonCard({ p }: { p: MinisterPerson }) {
  const t = useT();
  const accent = p.party?.color ?? 'var(--color-rule)';
  return (
    <div className="h-full bg-surface border border-rule rounded-card shadow-card p-4 sm:p-5 flex flex-col gap-3.5 transition-shadow hover:shadow-lift">
      <div className="flex items-start gap-3.5">
        <Portrait p={p} size={56} />
        <div className="grow min-w-0 flex flex-col gap-1">
          {p.href ? (
            <Link href={p.href} lang={p.nameLang} className="display text-[17px] font-bold leading-snug hover:text-brand">{p.name}</Link>
          ) : (
            <span lang={p.nameLang} className="display text-[17px] font-bold leading-snug">{p.name}</span>
          )}
          <Who p={p} />
        </div>
        <Source p={p} />
      </div>
      <ul className="flex flex-col gap-2 border-s-[3px] ps-3" style={{ borderColor: accent }}>
        {p.ministries.filter((m) => m.name).map((m) => (
          <li key={m.key} className="flex flex-col leading-snug">
            <span className="font-semibold text-[14.5px]">{m.name}</span>
            {m.since && <span className="text-[12.5px] text-muted">{t.en ? `Since ${m.since}` : `${m.since} থেকে`}</span>}
          </li>
        ))}
        {p.ministries.some((m) => !m.name) && <li className="flex"><Unnamed p={p} /></li>}
        {p.ministries.length === 0 && <li className="text-[13.5px] text-muted">{t('মন্ত্রণালয় লেখা নেই', 'No ministry listed')}</li>}
      </ul>
    </div>
  );
}

/** The whole cabinet by party, one bar, so its make-up is plain before the names. */
function Composition({ people }: { people: MinisterPerson[] }) {
  const t = useT();
  const outside = { key: OUTSIDE.key, name: t(OUTSIDE.name, OUTSIDE.nameEn), color: OUTSIDE.color };
  const parts = new Map<string, { key: string; name: string; color: string; n: number }>();
  for (const p of people) {
    const k = p.isMp && p.party ? { key: p.party.abbr, name: p.party.name, color: p.party.color } : outside;
    const e = parts.get(k.key) ?? { ...k, n: 0 };
    e.n++;
    parts.set(k.key, e);
  }
  const list = [...parts.values()].sort((a, b) => (a.key === 'outside' ? 1 : b.key === 'outside' ? -1 : b.n - a.n));
  const total = people.length || 1;
  return (
    <div className="rounded-card border border-rule bg-surface px-4 sm:px-5 py-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold">{t('মন্ত্রিসভা দল অনুযায়ী', 'The Cabinet by party')}</h2>
        <span className="text-[13px] text-muted tnum">{t.count(people.length, ' জন', 'person', 'people')}</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-rulesoft" role="img" aria-label={list.map((x) => `${x.name} ${t.n(x.n)}`).join(', ')}>
        {list.map((x) => (
          <span key={x.key} className="h-full" style={{ width: `${(100 * x.n) / total}%`, background: x.color, opacity: x.key === 'outside' ? 0.45 : 1 }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-inksoft">
        {list.map((x) => (
          <li key={x.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: x.color, opacity: x.key === 'outside' ? 0.45 : 1 }} aria-hidden="true" />
            {x.name} <span className="text-muted tnum">{t.n(x.n)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The cabinet by rank, with a ministry filter. Plain props only: it reads no site data. */
export default function MinistersBrowser({
  groups,
  ministries,
}: {
  groups: MinisterGroup[];
  ministries: { key: string; label: string; count: number }[];
}) {
  const t = useT();
  const [ministry, setMinistry] = useQueryParam('ministry');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  /**
   * A name, a ministry or a seat, as typed: any part of any matches. A
   * ministry is also found by its shortcuts ("ICT", "তথ্য", "LGRD"), and a rank
   * by its own ("Prime Minister", "prodhan montri"): config/ministry-aliases.ts,
   * which the page sends with each card. Each card gets a tier (matchTier), and
   * only the best tier among the cards is shown: "prime" is the Prime Minister,
   * not also the primary-education ministers that fold to look like it.
   */
  const tierOf = (p: MinisterPerson): number => {
    if (!q) return 1;
    const plain = p.name.toLowerCase().includes(q) || p.ministries.some((m) => (m.name ?? '').toLowerCase().includes(q)) || (p.seat ?? '').toLowerCase().includes(q);
    const tier = matchTier(query, [p.name, p.title, ...(p.titleAliases ?? []), p.seat ?? '', ...p.ministries.flatMap((m) => [m.name ?? '', ...(m.aliases ?? [])])]);
    return Math.max(plain ? 3 : 0, tier);
  };
  const inMinistry = (p: MinisterPerson) => !ministry || p.ministries.some((m) => m.key === ministry);
  const tiers = new Map(groups.flatMap((g) => g.people).filter(inMinistry).map((p) => [p.key, tierOf(p)]));
  const best = Math.max(0, ...tiers.values());
  const matches = (p: MinisterPerson) => !q || (best > 0 && (tiers.get(p.key) ?? 0) === best);
  const shown = groups.map((g) => ({
    ...g,
    people: g.people.filter((p) => inMinistry(p) && matches(p)),
  }));
  const filtering = !!ministry || !!q;
  const total = shown.reduce((n, g) => n + g.people.length, 0);
  const label = ministries.find((m) => m.key === ministry)?.label;
  const everyone = groups.flatMap((g) => g.people);

  // The head of government gets the whole width; everyone else shares a grid.
  const pm = shown[0]?.title === 'প্রধানমন্ত্রী' ? shown[0] : null;
  const rest = pm ? shown.slice(1) : shown;

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-col gap-3">
        <div className="rounded-card border border-rule bg-surface shadow-card p-3 sm:p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-center">
          <label className="relative flex items-center min-w-0">
            <Icon name="search" size={17} className="absolute start-3 text-muted pointer-events-none" />
            <span className="sr-only">{t('নাম, মন্ত্রণালয় বা আসন খুঁজুন', 'Search by name, ministry or seat')}</span>
            <input
              id="cabinet-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('নাম, মন্ত্রণালয় বা আসন…', 'Name, ministry or seat…')}
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-rule bg-paper ps-9 pe-3 text-[14.5px] outline-none focus:border-brand focus:ring-4 focus:ring-brandring"
            />
          </label>
          <label className="flex items-center min-w-0">
            <span className="sr-only">{t('মন্ত্রণালয় বা বিভাগ', 'Ministry or division')}</span>
            <select
              id="cabinet-ministry"
              aria-label={t('মন্ত্রণালয় বা বিভাগ', 'Ministry or division')}
              value={ministry}
              onChange={(e) => setMinistry(e.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-rule bg-paper px-3 text-[14.5px] outline-none focus:border-brand focus:ring-4 focus:ring-brandring"
            >
              <option value="">{t('সব মন্ত্রণালয় ও বিভাগ', 'All ministries and divisions')}</option>
              {ministries.map((m) => <option key={m.key} value={m.key}>{m.label} ({t.n(m.count)})</option>)}
            </select>
          </label>
          <p className="flex items-center gap-3 justify-between md:justify-end text-[14px] text-muted whitespace-nowrap" aria-live="polite">
            <span>
              {ministry && label ? <>{label}: </> : null}
              {t.en ? (
                <><b className="text-ink tnum">{t.n(total)}</b> {total === 1 ? 'person' : 'people'}</>
              ) : (
                <><b className="text-ink tnum">{t.n(total)}</b> জন</>
              )}
            </span>
            {filtering && (
              <button type="button" onClick={() => { setMinistry(''); setQuery(''); }} className="h-9 px-3 rounded-lg border border-rule font-semibold text-brand hover:border-brand">
                {t('সবাইকে দেখুন', 'Show everyone')}
              </button>
            )}
          </p>
        </div>
        {!filtering && <Composition people={everyone} />}
      </div>

      {pm && pm.people.length > 0 && (
        <section id={pm.id} className="flex flex-col gap-3 scroll-mt-24">
          {pm.people.map((p) => <LeaderCard key={p.key} p={p} label={pm.label} />)}
        </section>
      )}

      {filtering && total === 0 && (
        <p className="text-[14.5px] text-muted rounded-card border border-dashed border-rule bg-surface/60 px-4 py-6 text-center">
          {t.en ? (
            <>Nobody found for “{query.trim() || label}”. Try another spelling or the ministry’s name.</>
          ) : (
            <>“{query.trim() || label}” দিয়ে কাউকে পাওয়া যায়নি। অন্য বানানে বা মন্ত্রণালয়ের নামে খুঁজে দেখুন।</>
          )}
        </p>
      )}

      {rest.map((g) =>
        !filtering || g.people.length ? (
          <section key={g.title} id={g.id} className="flex flex-col gap-3.5 scroll-mt-24">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule pb-2.5">
              <h2 className="display text-[22px] flex items-baseline gap-2.5">
                {g.label}
                <span className="text-[13px] font-semibold text-brand bg-brandsoft rounded-full px-2.5 py-0.5 tnum">{t.count(g.people.length, ' জন', 'person', 'people')}</span>
              </h2>
              <p className="text-[13.5px] text-muted">{t.pick(RANK_NOTE[g.title], RANK_NOTE_EN[g.title])}</p>
            </div>
            {g.people.length === 0 ? (
              <p className="text-[14.5px] text-muted rounded-card border border-dashed border-rule bg-surface/60 px-4 py-5">
                {t.en ? <>The Cabinet Division’s list has no {g.label.toLowerCase()} at present.</> : <>মন্ত্রিপরিষদ বিভাগের তালিকায় এখন কোনো {g.title} নেই।</>}
              </p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
                {g.people.map((p) => <li key={p.key}><PersonCard p={p} /></li>)}
              </ul>
            )}
          </section>
        ) : null,
      )}
    </div>
  );
}
