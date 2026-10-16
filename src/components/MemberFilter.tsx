'use client';

import { useMemo, useState } from 'react';
import Link from '@/i18n/Link';
import { useT } from '@/i18n/client';
import { personName, seatName, partyShort } from '@/i18n/names';
import { normalise } from '@/lib/search';
import { RESERVED_HASH } from '@/lib/nav';
import { useQueryParam } from '@/lib/useQueryParam';
import MemberPhoto from './MemberPhoto';

export interface FilterMember {
  id: string;
  slug: string;
  nameBn: string | null;
  nameEn: string | null;
  photoUrl: string | null;
  party: string | null;
  partyBn: string | null;
  seatBn: string | null;
  seatEn?: string | null;
  seatSlug?: string | null;
  districtBn?: string | null;
  districtEn?: string | null;
  seatNo: number | null;
  reserved: boolean;
  gender: string | null;
}

const PARTY_COLOR: Record<string, string> = {
  BNP: 'var(--color-pbnp)',
  BJEI: 'var(--color-pjamaat)',
  Ind: 'var(--color-pind)',
  NCP: 'var(--color-pncp)',
};

const initialOf = (m: FilterMember) => {
  const name = (m.nameBn || m.nameEn || '?').trim();
  return (name.replace(/^(মোঃ|মো\.|ব্যারিস্টার|ড\.|অ্যাডভোকেট)\s*/, '') || name).charAt(0);
};
/** The same for an English name, past its titles. */
const initialEn = (name: string) =>
  (name.replace(/^((Md\.?|Mst\.?|Mohammad|Barrister|Dr\.?|Advocate|Adv\.?|Alhaj|Engr\.?|Prof\.?)\s+)+/i, '') || name).charAt(0).toUpperCase();
const BANGLA = /[ঀ-৿]/;

type SeatKind = 'all' | 'territorial' | 'reserved';

/** The home page once linked the reserved-seat filter as a hash; those links still work. */
const legacyKind = (hash: string) => (hash === RESERVED_HASH ? 'reserved' : null);

export default function MemberFilter({
  members,
  parties,
}: {
  members: FilterMember[];
  parties: { abbr: string; label: string; seats: number }[];
}) {
  const t = useT();
  // Every filter lives in the address, so a filtered list can be shared and comes back on back/forward.
  const [q, setQ] = useQueryParam('q');
  const [partyParam, setPartyParam] = useQueryParam('party');
  const party = partyParam || null;
  const setParty = (p: string | null) => setPartyParam(p ?? '');
  const [kindParam, setKindParam] = useQueryParam('kind', legacyKind);
  const kind: SeatKind = kindParam === 'territorial' || kindParam === 'reserved' ? kindParam : 'all';
  const setKind = (k: SeatKind) => setKindParam(k === 'all' ? '' : k);
  const [shown, setShown] = useState(60);

  // Match keys are built once for the whole list, then reused on every keystroke.
  const keyed = useMemo(
    () => members.map((m) => ({
      m,
      // "dhaka-17", "Dhaka 17" and "ঢাকা-১৭" must all find the member (QA-01,
      // 23 September 2026): the English seat, the district and the slug join
      // the key, and every part also appears without spaces, so a typed
      // "dhaka17" matches "dhaka 17".
      key: (() => {
        const parts = [m.nameBn, m.nameEn, m.seatBn, m.seatEn, m.seatSlug, m.districtBn, m.districtEn]
          .map((x) => normalise(x ?? ''))
          .filter(Boolean);
        return [...parts, ...parts.map((x) => x.replace(/ /g, ''))].join(' ');
      })(),
    })),
    [members],
  );

  const results = useMemo(() => {
    const nq = normalise(q);
    const words = nq.split(' ').filter(Boolean);
    return keyed
      .filter(({ m, key }) => {
        if (party && m.party !== party) return false;
        if (kind === 'territorial' && m.reserved) return false;
        if (kind === 'reserved' && !m.reserved) return false;
        if (!words.length) return true;
        return words.every((w) => key.includes(w));
      })
      .map((x) => x.m);
  }, [keyed, q, party, kind]);

  const visible = results.slice(0, shown);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex items-center gap-2.5 h-11 px-3.5 rounded-[10px] border border-rule bg-surface lg:w-[300px] focus-within:border-brand focus-within:ring-4 focus-within:ring-brandring">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setShown(60); }}
            type="search"
            placeholder={t('নাম বা আসন, বাংলা বা ইংরেজি', 'Name or seat, in English or Bangla')}
            aria-label={t('সদস্য খুঁজুন', 'Search members')}
            className="grow bg-transparent outline-none text-[14px] placeholder:text-muted"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {([['all', 'সব', 'All'], ['territorial', 'আসনভিত্তিক', 'Elected seats'], ['reserved', 'সংরক্ষিত', 'Reserved seats']] as const).map(([k, label, labelEn]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); setShown(60); }}
              aria-pressed={kind === k}
              className={`px-3.5 h-11 rounded-full text-[14px] font-medium border ${
                kind === k ? 'bg-brand text-white border-brand' : 'bg-surface border-rule'
              }`}
            >
              {t(label, labelEn)}
            </button>
          ))}
        </div>

        {/* One row that scrolls sideways on a phone, rather than three rows of party names. */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap lg:ms-auto">
          <button
            type="button"
            onClick={() => { setParty(null); setShown(60); }}
            aria-pressed={party === null}
            className={`shrink-0 px-3.5 h-11 rounded-full text-[14px] font-medium border ${
              party === null ? 'bg-brand text-white border-brand' : 'bg-surface border-rule'
            }`}
          >
            {t('সব দল', 'All parties')}
          </button>
          {parties.slice(0, 4).map((p) => (
            <button
              key={p.abbr}
              type="button"
              onClick={() => { setParty(p.abbr); setShown(60); }}
              aria-pressed={party === p.abbr}
              className={`shrink-0 px-3.5 h-11 rounded-full text-[14px] font-medium border flex items-center gap-2 ${
                party === p.abbr ? 'bg-brand text-white border-brand' : 'bg-surface border-rule'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: party === p.abbr ? '#fff' : (PARTY_COLOR[p.abbr] ?? 'var(--color-pother)') }}
              />
              {t.en ? partyShort({ abbr: p.abbr }, 'en') : p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[14px] text-muted tnum" aria-live="polite">
        {t.en ? (
          <>
            {t.count(results.length, '', 'member', 'members')}
            {results.length > visible.length ? `, showing ${visible.length}` : ''}
          </>
        ) : (
          <>
            {t.n(results.length)} জন সদস্য
            {results.length > visible.length ? `, ${t.n(visible.length)} জন দেখানো হচ্ছে` : ''}
          </>
        )}
      </p>

      {results.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">
          {t('কিছু পাওয়া যায়নি। নাম বাংলা বা ইংরেজি দুইভাবেই লেখা যায়।', 'Nothing found. Names can be typed in English or in Bangla.')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((m) => {
            const name = t.en ? personName(m, 'en') : m.nameBn || m.nameEn;
            // A member with no English name on record keeps the Bangla one, marked as Bangla.
            const nameLang = t.en && name && BANGLA.test(name) ? 'bn' : undefined;
            const seat = t.en ? (m.seatEn ? seatName({ nameEn: m.seatEn, nameBn: m.seatBn, reserved: m.reserved }, 'en') : null) : m.seatBn;
            const party = t.en ? (m.party ? partyShort({ abbr: m.party, nameBn: m.partyBn }, 'en') : null) : m.partyBn ?? m.party;
            return (
            <li key={m.id}>
              <Link
                href={`/mp/${m.slug}`}
                className="bg-surface border border-rule rounded-xl px-4 py-3 flex items-center gap-3.5 hover:border-brand transition-colors"
              >
                <span lang={nameLang} className="contents">
                  <MemberPhoto src={m.photoUrl} alt="" initial={t.en && !nameLang && name ? initialEn(name) : initialOf(m)} size={44} />
                </span>
                <span className="grow min-w-0 flex flex-col gap-0.5">
                  <span lang={nameLang} className="display text-[15.5px] font-bold truncate">{name}</span>
                  <span className="text-[13px] text-muted truncate">
                    {[seat, party].filter(Boolean).join(', ')}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: PARTY_COLOR[m.party ?? ''] ?? 'var(--color-pother)' }}
                />
              </Link>
            </li>
            );
          })}
        </ul>
      )}

      {results.length > visible.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + 90)}
          className="self-center px-6 h-12 rounded-full border border-ink font-semibold text-[15px] hover:bg-surface"
        >
          {t('আরও দেখুন', 'Show more')}
        </button>
      )}
    </div>
  );
}
