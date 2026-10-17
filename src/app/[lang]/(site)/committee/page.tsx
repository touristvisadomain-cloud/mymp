import type { Metadata } from 'next';
import { shareGraph, langAlternates } from '@/lib/seo';
import Link from '@/i18n/Link';
import { committees, getMemberById, meta } from '@/lib/data';
import { Page, PageHead, Stat, Notice, PartyDot } from '@/components/ui';
import { committeeDuty, committeeTitle, typeName } from '@/lib/committeeDuties';
import { getT } from '@/i18n/server';
import { plural } from '@/i18n/core';
import { committeeRole, personName, seatName } from '@/i18n/names';

const currentCommittees = committees.filter((c) => c.rosterCurrent).length;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/committee'),
    openGraph: shareGraph('/committee', undefined, t.lang),
    title: t('সংসদীয় স্থায়ী কমিটি: সভাপতি ও সদস্য', 'Parliamentary standing committees of Bangladesh'),
    description: t(
      `ত্রয়োদশ জাতীয় সংসদের ${t.n(currentCommittees)}টি সংসদীয় কমিটির তালিকা: প্রতিটি কমিটির সভাপতি, সদস্য ও বৈঠকের বিজ্ঞপ্তি, সংসদ সচিবালয়ের প্রকাশিত তথ্য থেকে।`,
      `The ${currentCommittees} parliamentary committees of the 13th Parliament: each committee's chair, members and meeting notices, from what the Parliament Secretariat publishes.`,
    ),
  };
}

/** A committee type counted in English: "26 parliamentary committees". */
const TYPE_COUNT_EN: Record<string, [string, string]> = {
  'Parliamentary Committee': ['parliamentary committee', 'parliamentary committees'],
  'Ministry Related Standing Committee': ['standing committee on a ministry', 'standing committees on ministries'],
};

export default async function CommitteesPage() {
  const t = await getT();
  const current = committees.filter((c) => c.rosterCurrent);
  const pending = committees.filter((c) => !c.rosterCurrent);

  const byType = new Map<string, number>();
  for (const c of committees) {
    const key = t.en ? (c.type ?? '') : (typeName(c.type) ?? 'অন্যান্য');
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  const typeCounts = [...byType].sort((a, b) => b[1] - a[1]);
  const typeCountEn = ([type, n]: [string, number]) => {
    const words = TYPE_COUNT_EN[type];
    return words ? `${n} ${plural(n, ...words)}` : `${n} ${type ? (typeName(type, 'en') ?? type).toLowerCase() : 'other'}`;
  };
  const summaryOf = (c: (typeof committees)[number]) => committeeDuty(c, committees, t.lang)?.summary;
  const memberCount = new Set(current.flatMap((c) => c.members.map((m) => m.memberId))).size;

  return (
    <Page>
      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('সংসদীয় কমিটি', 'Parliamentary committees')}
        lede={t(
          `মোট ${t.n(committees.length)}টি কমিটি: ${typeCounts.map(([type, n]) => `${type} ${t.n(n)}টি`).join(', ')}। প্রতিটি কমিটি কী কাজ করে, তা নামের নিচে লেখা; বিস্তারিত কমিটির পাতায়।`,
          `${committees.length} committees in all: ${typeCounts.map(typeCountEn).join(', ')}. What each committee does is written under its name; the details are on the committee's page.`,
        )}
        aside={
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('তালিকা হালনাগাদ', 'Lists up to date')} value={t.n(current.length)} />
            {pending.length > 0 ? (
              <Stat label={t('অপেক্ষমাণ', 'Pending')} value={t.n(pending.length)} />
            ) : (
              <Stat label={t('কমিটিতে সদস্য', 'MPs on committees')} value={t.n(memberCount)} />
            )}
          </div>
        }
      />

      <div className="pt-8 pb-14 flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="display text-[24px] font-bold">
            {t('হালনাগাদ কমিটি', 'Up-to-date committees')} <span className="text-muted font-semibold text-[19px]">({t.n(current.length)})</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {current.map((c) => {
              const chair = c.members.find((x) => x.role === 'Chairman');
              const chairMember = chair ? getMemberById(chair.memberId) : undefined;
              const formed = c.startDate ? t(`, গঠিত ${t.date(c.startDate)}`, `Formed ${t.date(c.startDate)}`) : '';
              return (
                <li key={c.id}>
                  <Link
                    href={`/committee/${c.slug}`}
                    className="reveal bg-surface border border-rule rounded-xl p-5 flex flex-col sm:flex-row gap-4 sm:items-center hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
                  >
                    <span className="grow min-w-0 flex flex-col gap-2">
                      <span className="flex items-center gap-2.5 flex-wrap">
                        <span className="display text-[18px] font-bold leading-snug">{t.en ? committeeTitle(c, 'en') : (c.nameBn ?? c.nameEn)}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-brandsoft text-brand text-[11.5px] font-bold shrink-0">
                          {t('হালনাগাদ', 'Up to date')}
                        </span>
                      </span>
                      {(t.en ? formed : true) && (
                        <span className="text-[13.5px] text-muted">
                          {t.en ? null : c.nameEn}
                          {formed}
                        </span>
                      )}
                      {summaryOf(c) && <span className="text-[14.5px] leading-relaxed text-inksoft text-pretty">{summaryOf(c)}</span>}
                      {chairMember && (
                        <span className="flex items-start gap-2 text-[14px]">
                          <span className="text-muted shrink-0">{committeeRole('Chairman', t.lang)}</span>
                          <PartyDot abbr={chairMember.party?.abbr} />
                          {/* Name and seat wrap as one run of text, so a long name never strands the seat on its own. */}
                          <span className="min-w-0 leading-snug">
                            <span className="font-semibold">{t.en ? personName(chairMember, 'en') : (chairMember.nameBn ?? chairMember.nameEn)}</span>
                            {chairMember.seat?.nameBn && (
                              <span className="text-muted">, {t.en ? seatName(chairMember.seat, 'en') : chairMember.seat.nameBn}</span>
                            )}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0.5 shrink-0">
                      <span className="display tnum text-[24px] font-extrabold leading-none">{t.n(c.members.length)}</span>
                      <span className="text-[12.5px] text-muted">{t('সদস্য', plural(c.members.length, 'member', 'members'))}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {pending.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <h2 className="display text-[22px] font-bold">
              {t('যেসব কমিটির তালিকা এখনো হালনাগাদ হয়নি', 'Committees whose member lists are not yet updated')}
            </h2>
            <span className="px-3 py-0.5 rounded-full bg-warnsoft text-warn text-[12px] font-bold tnum shrink-0">
              {t(`${t.n(pending.length)}টি`, String(pending.length))}
            </span>
            <span className="grow h-px bg-rule" aria-hidden="true" />
          </div>

          <Notice
            title={t(
              'এই কমিটিগুলোর সদস্য তালিকায় এখনো দ্বাদশ সংসদের সদস্যদের নাম আছে',
              'The member lists of these committees still carry the names of members of the 12th Parliament',
            )}
          >
            {t.en ? (
              <>
                In Parliament&apos;s database, the member lists of {pending.length} of the {committees.length} committees have
                not yet been updated for the 13th Parliament. We do not show people who are no longer Members of Parliament
                as members of a current committee. Once the lists are updated, the members will be added automatically.
              </>
            ) : (
              <>
            সংসদের তথ্যভান্ডারে {t.n(committees.length)}টির মধ্যে {t.n(pending.length)}টি কমিটির সদস্য তালিকা
            ত্রয়োদশ সংসদের জন্য এখনো হালনাগাদ হয়নি। যাঁরা এখন আর সংসদ সদস্য নন, তাঁদের নাম বর্তমান কমিটির
            সদস্য হিসেবে আমরা দেখাই না। তালিকা হালনাগাদ হলে সদস্যরা আপনাআপনি যুক্ত হবে।
              </>
            )}
          </Notice>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pending.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/committee/${c.slug}`}
                  className="reveal h-full bg-surface border border-rule rounded-card shadow-card p-5 flex flex-col gap-1.5 hover:border-brand hover:shadow-lift transition-all"
                >
                  <span className="display text-[16px] font-bold leading-snug">{t.en ? committeeTitle(c, 'en') : (c.nameBn ?? c.nameEn)}</span>
                  {!t.en && <span className="text-[13px] text-muted">{c.nameEn}</span>}
                  {summaryOf(c) && <span className="text-[14px] leading-relaxed text-inksoft text-pretty">{summaryOf(c)}</span>}
                  <span className="text-[13px] font-semibold text-warn mt-auto pt-1">
                    {t('সদস্য তালিকা হালনাগাদের অপেক্ষায়', 'Member list awaiting update')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        )}

        <p className="text-[13px] text-muted">
          {t('তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ | হালনাগাদ ', 'Source: Parliament of Bangladesh | Updated ')}
          {t.date(meta.syncedAt)}
        </p>
      </div>
    </Page>
  );
}
