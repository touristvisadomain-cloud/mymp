import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import { notFound } from 'next/navigation';
import { committees, getCommittee, getMemberById, bn, dateBn, meta, bnText } from '@/lib/data';
import { noticesForCommittee } from '@/lib/activity';
import Link from 'next/link';
import { Page, PageHead, Card, Breadcrumb, Notice, MemberRow, Empty, DocLink } from '@/components/ui';
import { committeeDuty, typeBn, RULES_URL, type CommitteeDuty } from '@/lib/committeeDuties';
import { charCount, DESCRIPTION_MAX } from '@/lib/seo/mpDescription';

export function generateStaticParams() {
  return committees.map((c) => ({ slug: c.slug }));
}

/** "{committee}: … সভাপতি {name}, সদস্য {n} জন; …" from the committee's roster. */
function committeeDescription(c: NonNullable<ReturnType<typeof getCommittee>>): string {
  const name = c.nameBn ?? c.nameEn ?? 'কমিটি';
  const chairId = c.members.find((x) => x.role === 'Chairman')?.memberId;
  const chair = chairId ? getMemberById(chairId) : undefined;
  const count = c.members.length;
  const who = [chair ? `সভাপতি ${chair.nameBn ?? chair.nameEn}` : null, count ? `সদস্য ${bn(count)} জন` : null].filter(Boolean).join(', ');
  // What the committee does comes first, while the whole sentence still fits what search engines show.
  const duty = committeeDuty(c, committees)?.summary;
  const withDuty = duty ? `${name}: ${duty}${who ? ` ${who}।` : ''}` : null;
  if (withDuty && charCount(withDuty) <= DESCRIPTION_MAX) return withDuty;
  if (duty && charCount(`${name}: ${duty}`) <= DESCRIPTION_MAX) return `${name}: ${duty}`;
  return `${name}: ত্রয়োদশ জাতীয় সংসদের একটি সংসদীয় কমিটি।${who ? ` ${who};` : ''} সদস্যদের তালিকা ও বৈঠকের বিজ্ঞপ্তি এই পাতায়।`;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/committee/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const c = getCommittee(slug);
  if (!c) return { title: 'কমিটি পাওয়া যায়নি' };
  return {
    // "সরকারি হিসাব কমিটির কাজ কি" is how the committee is searched for
    // (Search Console, September 2026), so a committee with a duty on record
    // says so in its title.
    title: committeeDuty(c, committees) ? `${c.nameBn ?? c.nameEn}: কাজ ও সদস্য` : (c.nameBn ?? c.nameEn ?? 'কমিটি'),
    alternates: { canonical: `/committee/${c.slug}` },
    openGraph: shareGraph(`/committee/${c.slug}`),
    description: committeeDescription(c),
  };
}

/** What the committee is for, from the parliament's Rules of Procedure. */
function DutySection({ duty }: { duty: CommitteeDuty }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="display text-[22px] flex items-center gap-2.5">
        <span aria-hidden="true" className="w-1.5 h-[0.85em] rounded-full bg-gradient-to-b from-logo to-brand shrink-0" />
        কমিটির কাজ
      </h2>
      <Card className="p-5 sm:p-6 flex flex-col gap-4">
        <p className="text-[16.5px] sm:text-[17.5px] leading-relaxed font-semibold text-ink text-pretty">{duty.summary}</p>
        {duty.parent && (
          <p className="text-[14.5px] text-inksoft">
            মূল কমিটি:{' '}
            <Link href={`/committee/${duty.parent.slug}`} className="font-semibold text-brand hover:underline">{duty.parent.nameBn}</Link>
          </p>
        )}
        <ul className="flex flex-col gap-2.5">
          {duty.duties.map((d) => (
            <li key={d} className="flex gap-3 text-[15.5px] leading-relaxed text-inksoft">
              <span aria-hidden="true" className="mt-[0.6em] w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
              <span className="text-pretty">{d}</span>
            </li>
          ))}
        </ul>
        {duty.note && <p className="text-[14px] leading-relaxed text-muted border-t border-rulesoft pt-3">{duty.note}</p>}
        <p className="text-[12.5px] text-muted">
          সূত্র:{' '}
          <a href={RULES_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-rule underline-offset-2 hover:text-brand">
            জাতীয় সংসদের কার্যপ্রণালী বিধি
          </a>
          , {duty.rule}
        </p>
      </Card>
    </section>
  );
}

const ROLE_BN: Record<string, string> = {
  Chairman: 'সভাপতি',
  Member: 'সদস্য',
};

export default async function CommitteePage({ params }: PageProps<'/[lang]/committee/[slug]'>) {
  const { slug } = await params;
  const c = getCommittee(slug);
  if (!c) notFound();

  const chair = c.members.find((x) => x.role === 'Chairman');
  const chairMember = chair ? getMemberById(chair.memberId) : undefined;
  const rest = c.members
    .filter((x) => x.role !== 'Chairman')
    .map((x) => ({ role: x.role, m: getMemberById(x.memberId) }))
    .filter((x): x is { role: string; m: NonNullable<ReturnType<typeof getMemberById>> } => !!x.m);
  const notices = noticesForCommittee(c.id);
  const duty = committeeDuty(c, committees);
  // The duty as a question and answer, for search engines that show one.
  const faqLd = duty
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${c.nameBn ?? c.nameEn}-এর কাজ কী?`, acceptedAnswer: { '@type': 'Answer', text: [duty.summary, ...duty.duties].join(' ') } },
        ],
      }
    : null;
  const type = typeBn(c.type);

  return (
    <Page>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <Breadcrumb
        items={[
          { href: '/', label: 'হোম' },
          { href: '/committee', label: 'কমিটি' },
          { label: c.nameBn ?? c.nameEn ?? '' },
        ]}
      />

      <PageHead
        eyebrow={type ?? undefined}
        title={c.nameBn ?? c.nameEn ?? ''}
        lede={[c.nameEn, c.startDate ? `গঠিত ${dateBn(c.startDate)}` : null].filter(Boolean).join(', ')}
      />

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div className="flex flex-col gap-8 min-w-0">
          {duty && <DutySection duty={duty} />}
          {!c.rosterCurrent ? (
            <Notice title="এই কমিটির সদস্য তালিকা ত্রয়োদশ সংসদের জন্য এখনো হালনাগাদ হয়নি">
              সংসদের তথ্যভান্ডারে এই কমিটির তালিকায় এখনো দ্বাদশ সংসদের সদস্যদের নাম রয়েছে। যাঁরা এখন আর
              সংসদ সদস্য নন, তাঁদের বর্তমান সদস্য হিসেবে দেখানো ভুল হবে, তাই তালিকা হালনাগাদ না হওয়া
              পর্যন্ত আমরা সদস্যদের নাম দেখাচ্ছি না।
            </Notice>
          ) : (
            <>
              {chairMember && (
                <section className="flex flex-col gap-4">
                  <h2 className="display text-[22px]">সভাপতি</h2>
                  <MemberRow m={chairMember} />
                </section>
              )}

              {rest.length > 0 && (
                <section className="flex flex-col gap-4">
                  <h2 className="display text-[22px]">
                    সদস্য <span className="text-muted font-semibold text-[17px] tnum">({bn(rest.length)})</span>
                  </h2>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rest.map(({ role, m }) => (
                      <li key={m.id} className="relative">
                        <MemberRow m={m} />
                        {role !== 'Member' && (
                          <span className="absolute top-2 end-10 px-2 py-0.5 rounded-full bg-brandsoft text-brand text-[11px] font-bold">
                            {ROLE_BN[role] ?? role}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="display text-[22px]">
              বৈঠক ও বিজ্ঞপ্তি
              {notices.length > 0 && <span className="ms-2 text-[15px] font-semibold text-muted tnum">({bn(notices.length)})</span>}
            </h2>
            {notices.length ? (
              <Card className="divide-y divide-rulesoft">
                {notices.map((n) => (
                  <div key={n.id} className="px-5 py-3.5 flex items-start gap-4">
                    <span className="grow min-w-0 flex flex-col gap-0.5">
                      <span className="text-[14.5px] font-medium wrap-anywhere">{bnText(n.titleBn) ?? n.titleEn}</span>
                      <span className="text-[12.5px] text-muted">{dateBn(n.date) ?? 'তারিখ নেই'}</span>
                    </span>
                    {n.pdfUrl && <DocLink href={n.pdfUrl}>বিজ্ঞপ্তি</DocLink>}
                  </div>
                ))}
              </Card>
            ) : (
              <Empty
                title="এই কমিটির কোনো বৈঠকের বিজ্ঞপ্তি সংসদ সচিবালয় এখনো প্রকাশ করেনি।"
                body="কমিটির বৈঠক ডাকা হলে সংসদ সচিবালয়ের বিজ্ঞপ্তি প্রতিদিন এখানে যুক্ত হয়।"
              />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-2">
            <span className="display text-[16.5px]">কমিটি তথ্য</span>
            <div className="flex flex-col text-[14.5px]">
              {type && (
                <div className="flex justify-between gap-3 py-2 border-b border-rulesoft">
                  <span className="text-muted">ধরন</span><span className="font-medium text-end">{type}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 py-2 border-b border-rulesoft">
                <span className="text-muted">তালিকাভুক্ত সদস্য</span>
                <span className="font-medium tnum">{bn(c.memberCount)}</span>
              </div>
              <div className="flex justify-between gap-3 py-2 border-b border-rulesoft">
                <span className="text-muted">বৈঠকের বিজ্ঞপ্তি</span>
                <span className="font-medium tnum">{bn(notices.length)}</span>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <span className="text-muted">তথ্যসূত্র</span>
                <span className="font-medium text-end">বাংলাদেশ জাতীয় সংসদ, {dateBn(meta.syncedAt)}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </Page>
  );
}

export const dynamicParams = false;
