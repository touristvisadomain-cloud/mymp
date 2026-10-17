import type { Metadata } from 'next';
import { shareGraph, langAlternates } from '@/lib/seo';
import { notFound } from 'next/navigation';
import { committees, getCommittee, getMemberById, meta, bnText } from '@/lib/data';
import { noticesForCommittee } from '@/lib/activity';
import { tidyEn } from '@/lib/sessionsView';
import Link from '@/i18n/Link';
import { Page, PageHead, Card, Breadcrumb, Notice, MemberRow, Empty, DocLink } from '@/components/ui';
import { committeeDuty, committeeTitle, typeName, RULES_URL, type CommitteeDuty } from '@/lib/committeeDuties';
import { charCount, DESCRIPTION_MAX } from '@/lib/seo/mpDescription';
import { getT } from '@/i18n/server';
import type { Lang, T } from '@/i18n/core';
import { makeT, plural } from '@/i18n/core';
import { committeeRole, personName } from '@/i18n/names';

export function generateStaticParams() {
  return committees.map((c) => ({ slug: c.slug }));
}

/** "{committee}: … সভাপতি {name}, সদস্য {n} জন; …" from the committee's roster. */
function committeeDescription(c: NonNullable<ReturnType<typeof getCommittee>>, lang: Lang = 'bn'): string {
  const en = lang === 'en';
  const name = en ? committeeTitle(c, 'en') || 'Committee' : c.nameBn ?? c.nameEn ?? 'কমিটি';
  const chairId = c.members.find((x) => x.role === 'Chairman')?.memberId;
  const chair = chairId ? getMemberById(chairId) : undefined;
  const count = c.members.length;
  const who = en
    ? [chair ? `Chair ${personName(chair, 'en')}` : null, count ? `${count} ${plural(count, 'member', 'members')}` : null].filter(Boolean).join(', ')
    : [chair ? `সভাপতি ${chair.nameBn ?? chair.nameEn}` : null, count ? `সদস্য ${makeT('bn').n(count)} জন` : null].filter(Boolean).join(', ');
  // What the committee does comes first, while the whole sentence still fits what search engines show.
  const duty = committeeDuty(c, committees, lang)?.summary;
  const end = en ? '.' : '।';
  const withDuty = duty ? `${name}: ${duty}${who ? ` ${who}${end}` : ''}` : null;
  if (withDuty && charCount(withDuty) <= DESCRIPTION_MAX) return withDuty;
  if (duty && charCount(`${name}: ${duty}`) <= DESCRIPTION_MAX) return `${name}: ${duty}`;
  if (en) {
    return `${name}: a parliamentary committee of the 13th Parliament.${who ? ` ${who}.` : ''} The member list and meeting notices are on this page.`;
  }
  return `${name}: ত্রয়োদশ জাতীয় সংসদের একটি সংসদীয় কমিটি।${who ? ` ${who};` : ''} সদস্যদের তালিকা ও বৈঠকের বিজ্ঞপ্তি এই পাতায়।`;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/committee/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  const c = getCommittee(slug);
  if (!c) return { title: t('কমিটি পাওয়া যায়নি', 'Committee not found') };
  const name = t.en ? committeeTitle(c, 'en') : c.nameBn ?? c.nameEn;
  return {
    // "সরকারি হিসাব কমিটির কাজ কি" is how the committee is searched for
    // (Search Console, September 2026), so a committee with a duty on record
    // says so in its title.
    title: committeeDuty(c, committees) ? t(`${name}: কাজ ও সদস্য`, `${name}: duties and members`) : (name ?? t('কমিটি', 'Committee')),
    alternates: langAlternates(t.lang, `/committee/${c.slug}`),
    openGraph: shareGraph(`/committee/${c.slug}`, undefined, t.lang),
    description: committeeDescription(c, t.lang),
  };
}

/** What the committee is for, from the parliament's Rules of Procedure. */
function DutySection({ duty, t }: { duty: CommitteeDuty; t: T }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="display text-[22px] flex items-center gap-2.5">
        <span aria-hidden="true" className="w-1.5 h-[0.85em] rounded-full bg-gradient-to-b from-logo to-brand shrink-0" />
        {t('কমিটির কাজ', 'What the committee does')}
      </h2>
      <Card className="p-5 sm:p-6 flex flex-col gap-4">
        <p className="text-[16.5px] sm:text-[17.5px] leading-relaxed font-semibold text-ink text-pretty">{duty.summary}</p>
        {duty.parent && (
          <p className="text-[14.5px] text-inksoft">
            {t('মূল কমিটি:', 'Parent committee:')}{' '}
            <Link href={`/committee/${duty.parent.slug}`} className="font-semibold text-brand hover:underline">{duty.parent.name}</Link>
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
          {t('সূত্র:', 'Source:')}{' '}
          <a href={RULES_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-rule underline-offset-2 hover:text-brand">
            {t('জাতীয় সংসদের কার্যপ্রণালী বিধি', 'Rules of Procedure of Parliament')}
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
  const t = await getT();
  const c = getCommittee(slug);
  if (!c) notFound();

  const chair = c.members.find((x) => x.role === 'Chairman');
  const chairMember = chair ? getMemberById(chair.memberId) : undefined;
  const rest = c.members
    .filter((x) => x.role !== 'Chairman')
    .map((x) => ({ role: x.role, m: getMemberById(x.memberId) }))
    .filter((x): x is { role: string; m: NonNullable<ReturnType<typeof getMemberById>> } => !!x.m);
  const notices = noticesForCommittee(c.id);
  const duty = committeeDuty(c, committees, t.lang);
  const name = t.en ? committeeTitle(c, 'en') : (c.nameBn ?? c.nameEn);
  // The duty as a question and answer, for search engines that show one.
  const faqLd = duty
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: t(`${name}-এর কাজ কী?`, `What does the ${name} do?`),
            acceptedAnswer: { '@type': 'Answer', text: [duty.summary, ...duty.duties].join(' ') },
          },
        ],
      }
    : null;
  const type = typeName(c.type, t.lang);

  return (
    <Page>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <Breadcrumb
        items={[
          { href: '/', label: t('হোম', 'Home') },
          { href: '/committee', label: t('কমিটি', 'Committees') },
          { label: name ?? '' },
        ]}
      />

      <PageHead
        eyebrow={type ?? undefined}
        title={name ?? ''}
        lede={
          t.en
            ? (c.startDate ? `Formed ${t.date(c.startDate)}` : '')
            : [c.nameEn, c.startDate ? `গঠিত ${t.date(c.startDate)}` : null].filter(Boolean).join(', ')
        }
      />

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div className="flex flex-col gap-8 min-w-0">
          {duty && <DutySection duty={duty} t={t} />}
          {!c.rosterCurrent ? (
            <Notice
              title={t(
                'এই কমিটির সদস্য তালিকা ত্রয়োদশ সংসদের জন্য এখনো হালনাগাদ হয়নি',
                "This committee's member list has not yet been updated for the 13th Parliament",
              )}
            >
              {t.en ? (
                <>
                  In Parliament&apos;s database, this committee&apos;s list still carries the names of members of the 12th
                  Parliament. Showing people who are no longer Members of Parliament as current members would be wrong, so
                  we are not showing the members&apos; names until the list is updated.
                </>
              ) : (
                <>
              সংসদের তথ্যভান্ডারে এই কমিটির তালিকায় এখনো দ্বাদশ সংসদের সদস্যদের নাম রয়েছে। যাঁরা এখন আর
              সংসদ সদস্য নন, তাঁদের বর্তমান সদস্য হিসেবে দেখানো ভুল হবে, তাই তালিকা হালনাগাদ না হওয়া
              পর্যন্ত আমরা সদস্যদের নাম দেখাচ্ছি না।
                </>
              )}
            </Notice>
          ) : (
            <>
              {chairMember && (
                <section className="flex flex-col gap-4">
                  <h2 className="display text-[22px]">{committeeRole('Chairman', t.lang)}</h2>
                  <MemberRow m={chairMember} />
                </section>
              )}

              {rest.length > 0 && (
                <section className="flex flex-col gap-4">
                  <h2 className="display text-[22px]">
                    {t('সদস্য', 'Members')} <span className="text-muted font-semibold text-[17px] tnum">({t.n(rest.length)})</span>
                  </h2>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rest.map(({ role, m }) => (
                      <li key={m.id} className="relative">
                        <MemberRow m={m} />
                        {role !== 'Member' && (
                          <span className="absolute top-2 end-10 px-2 py-0.5 rounded-full bg-brandsoft text-brand text-[11px] font-bold">
                            {t.en ? committeeRole(role, 'en') : (ROLE_BN[role] ?? role)}
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
              {t('বৈঠক ও বিজ্ঞপ্তি', 'Meetings and notices')}
              {notices.length > 0 && <span className="ms-2 text-[15px] font-semibold text-muted tnum">({t.n(notices.length)})</span>}
            </h2>
            {notices.length ? (
              <Card className="divide-y divide-rulesoft">
                {notices.map((n) => (
                  <div key={n.id} className="px-5 py-3.5 flex items-start gap-4">
                    <span className="grow min-w-0 flex flex-col gap-0.5">
                      <span className="text-[14.5px] font-medium wrap-anywhere">
                        {t.en ? tidyEn(n.titleEn) || t('বিজ্ঞপ্তি', 'Notice') : (bnText(n.titleBn) ?? n.titleEn)}
                      </span>
                      <span className="text-[12.5px] text-muted">{t.date(n.date) ?? t('তারিখ নেই', 'No date')}</span>
                    </span>
                    {n.pdfUrl && <DocLink href={n.pdfUrl}>{t('বিজ্ঞপ্তি', 'Notice')}</DocLink>}
                  </div>
                ))}
              </Card>
            ) : (
              <Empty
                title={t(
                  'এই কমিটির কোনো বৈঠকের বিজ্ঞপ্তি সংসদ সচিবালয় এখনো প্রকাশ করেনি।',
                  'The Parliament Secretariat has not yet published any meeting notice for this committee.',
                )}
                body={t(
                  'কমিটির বৈঠক ডাকা হলে সংসদ সচিবালয়ের বিজ্ঞপ্তি প্রতিদিন এখানে যুক্ত হয়।',
                  "When a meeting of the committee is called, the Parliament Secretariat's notice appears here; the list is updated every day.",
                )}
              />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-2">
            <span className="display text-[16.5px]">{t('কমিটি তথ্য', 'About the committee')}</span>
            <div className="flex flex-col text-[14.5px]">
              {type && (
                <div className="flex justify-between gap-3 py-2 border-b border-rulesoft">
                  <span className="text-muted">{t('ধরন', 'Type')}</span><span className="font-medium text-end">{type}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 py-2 border-b border-rulesoft">
                <span className="text-muted">{t('তালিকাভুক্ত সদস্য', 'Members listed')}</span>
                <span className="font-medium tnum">{t.n(c.memberCount)}</span>
              </div>
              <div className="flex justify-between gap-3 py-2 border-b border-rulesoft">
                <span className="text-muted">{t('বৈঠকের বিজ্ঞপ্তি', 'Meeting notices')}</span>
                <span className="font-medium tnum">{t.n(notices.length)}</span>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <span className="text-muted">{t('তথ্যসূত্র', 'Source')}</span>
                <span className="font-medium text-end">{t('বাংলাদেশ জাতীয় সংসদ', 'Parliament of Bangladesh')}, {t.date(meta.syncedAt)}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </Page>
  );
}

export const dynamicParams = false;
