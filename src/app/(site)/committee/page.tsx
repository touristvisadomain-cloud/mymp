import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import Link from 'next/link';
import { committees, getMemberById, bn, dateBn, meta } from '@/lib/data';
import { Page, PageHead, Stat, Notice, PartyDot } from '@/components/ui';
import { committeeDuty, typeBn } from '@/lib/committeeDuties';

const currentCommittees = committees.filter((c) => c.rosterCurrent).length;
export const metadata: Metadata = {
  alternates: { canonical: '/committee' },
  openGraph: shareGraph('/committee'),
  title: 'সংসদীয় কমিটি',
  description: `ত্রয়োদশ জাতীয় সংসদের ${bn(currentCommittees)}টি সংসদীয় কমিটির তালিকা: প্রতিটি কমিটির সভাপতি, সদস্য ও বৈঠকের বিজ্ঞপ্তি, সংসদ সচিবালয়ের প্রকাশিত তথ্য থেকে।`,
};

export default function CommitteesPage() {
  const current = committees.filter((c) => c.rosterCurrent);
  const pending = committees.filter((c) => !c.rosterCurrent);

  const byType = new Map<string, number>();
  for (const c of committees) {
    const t = typeBn(c.type) ?? 'অন্যান্য';
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const summaryOf = (c: (typeof committees)[number]) => committeeDuty(c, committees)?.summary;

  return (
    <Page>
      <PageHead
        eyebrow="ত্রয়োদশ জাতীয় সংসদ"
        title="সংসদীয় কমিটি"
        lede={`মোট ${bn(committees.length)}টি কমিটি: ${[...byType].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${bn(n)}টি`).join(', ')}। প্রতিটি কমিটি কী কাজ করে, তা নামের নিচে লেখা; বিস্তারিত কমিটির পাতায়।`}
        aside={
          <div className="grid grid-cols-2 gap-3">
            <Stat label="তালিকা হালনাগাদ" value={bn(current.length)} />
            {pending.length > 0 ? (
              <Stat label="অপেক্ষমাণ" value={bn(pending.length)} />
            ) : (
              <Stat label="কমিটিতে সদস্য" value={bn(new Set(current.flatMap((c) => c.members.map((m) => m.memberId))).size)} />
            )}
          </div>
        }
      />

      <div className="pt-8 pb-14 flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="display text-[24px] font-bold">
            হালনাগাদ কমিটি <span className="text-muted font-semibold text-[19px]">({bn(current.length)})</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {current.map((c) => {
              const chair = c.members.find((x) => x.role === 'Chairman');
              const chairMember = chair ? getMemberById(chair.memberId) : undefined;
              return (
                <li key={c.id}>
                  <Link
                    href={`/committee/${c.slug}`}
                    className="reveal bg-surface border border-rule rounded-xl p-5 flex flex-col sm:flex-row gap-4 sm:items-center hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
                  >
                    <span className="grow min-w-0 flex flex-col gap-2">
                      <span className="flex items-center gap-2.5 flex-wrap">
                        <span className="display text-[18px] font-bold leading-snug">{c.nameBn ?? c.nameEn}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-brandsoft text-brand text-[11.5px] font-bold shrink-0">
                          হালনাগাদ
                        </span>
                      </span>
                      <span className="text-[13.5px] text-muted">
                        {c.nameEn}
                        {c.startDate ? `, গঠিত ${dateBn(c.startDate)}` : ''}
                      </span>
                      {summaryOf(c) && <span className="text-[14.5px] leading-relaxed text-inksoft text-pretty">{summaryOf(c)}</span>}
                      {chairMember && (
                        <span className="flex items-start gap-2 text-[14px]">
                          <span className="text-muted shrink-0">সভাপতি</span>
                          <PartyDot abbr={chairMember.party?.abbr} />
                          {/* Name and seat wrap as one run of text, so a long name never strands the seat on its own. */}
                          <span className="min-w-0 leading-snug">
                            <span className="font-semibold">{chairMember.nameBn ?? chairMember.nameEn}</span>
                            {chairMember.seat?.nameBn && <span className="text-muted">, {chairMember.seat.nameBn}</span>}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0.5 shrink-0">
                      <span className="display tnum text-[24px] font-extrabold leading-none">{bn(c.members.length)}</span>
                      <span className="text-[12.5px] text-muted">সদস্য</span>
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
            <h2 className="display text-[22px] font-bold">যেসব কমিটির তালিকা এখনো হালনাগাদ হয়নি</h2>
            <span className="px-3 py-0.5 rounded-full bg-warnsoft text-warn text-[12px] font-bold tnum shrink-0">
              {bn(pending.length)}টি
            </span>
            <span className="grow h-px bg-rule" aria-hidden="true" />
          </div>

          <Notice title="এই কমিটিগুলোর সদস্য তালিকায় এখনো দ্বাদশ সংসদের সদস্যদের নাম আছে">
            সংসদের তথ্যভান্ডারে {bn(committees.length)}টির মধ্যে {bn(pending.length)}টি কমিটির সদস্য তালিকা
            ত্রয়োদশ সংসদের জন্য এখনো হালনাগাদ হয়নি। যাঁরা এখন আর সংসদ সদস্য নন, তাঁদের নাম বর্তমান কমিটির
            সদস্য হিসেবে আমরা দেখাই না। তালিকা হালনাগাদ হলে সদস্যরা আপনাআপনি যুক্ত হবে।
          </Notice>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pending.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/committee/${c.slug}`}
                  className="reveal h-full bg-surface border border-rule rounded-card shadow-card p-5 flex flex-col gap-1.5 hover:border-brand hover:shadow-lift transition-all"
                >
                  <span className="display text-[16px] font-bold leading-snug">{c.nameBn ?? c.nameEn}</span>
                  <span className="text-[13px] text-muted">{c.nameEn}</span>
                  {summaryOf(c) && <span className="text-[14px] leading-relaxed text-inksoft text-pretty">{summaryOf(c)}</span>}
                  <span className="text-[13px] font-semibold text-warn mt-auto pt-1">
                    সদস্য তালিকা হালনাগাদের অপেক্ষায়
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        )}

        <p className="text-[13px] text-muted">
          তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ | হালনাগাদ {dateBn(meta.syncedAt)}
        </p>
      </div>
    </Page>
  );
}
