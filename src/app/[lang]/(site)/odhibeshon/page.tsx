import type { Metadata } from 'next';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import Link from '@/i18n/Link';
import { getMemberById, meta, bnText } from '@/lib/data';
import {
  sessions, officers, parliament, sessionLabel, latestSitting, totalSittings, generalNotices, ROLE_LABELS, daysSince,
} from '@/lib/activity';
import { weekdayOf, sittingTitleEn, circularTitleEn, tidyEn, officerNameEn, tenureEn } from '@/lib/sessionsView';
import { Page, PageHead, Card, Stat, Empty, PartyDot, DocLink } from '@/components/ui';
import Icon from '@/components/Icon';
import SessionCountdown from '@/components/SessionCountdown';
import { getT } from '@/i18n/server';
import { plural, type T } from '@/i18n/core';
import { HOUSE_ROLE } from '@/i18n/names';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/odhibeshon'),
    ...pageShare('odhibeshon', t),
    title: t('সংসদ অধিবেশন', 'Sessions of Parliament'),
    description: fitDescription(
      t(
        'ত্রয়োদশ জাতীয় সংসদের অধিবেশন, প্রতিটি বৈঠকের দিনের কার্যসূচি, পরিপত্র ও সংসদ সচিবালয়ের বিজ্ঞপ্তি, সংসদের প্রকাশনা থেকে সরাসরি।',
        'The sessions of the 13th Parliament: the order of the day for every sitting, circulars and Parliament Secretariat notices, as Parliament publishes them.',
      ),
    ),
  };
}

function Fact({ label, value, t }: { label: string; value: string | null; t: T }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[15px] font-semibold">{value ?? t('তথ্য নেই', 'Not available')}</span>
    </div>
  );
}

export default async function SessionsPage() {
  const t = await getT();
  const last = latestSitting();
  const ago = daysSince(last?.date ?? null);
  const notices = generalNotices();
  const current = sessions[0] ?? null;
  const firstCircular = current?.circulars.slice().sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0];

  return (
    <Page>
      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('সংসদ অধিবেশন', 'Sessions of Parliament')}
        lede={t(
          'প্রতিটি অধিবেশন, প্রতিটি বৈঠকের দিনের কার্যসূচি ও সংসদ সচিবালয়ের পরিপত্র, সংসদ যেভাবে প্রকাশ করে ঠিক সেভাবে। এখানে কিছুই সম্পাদনা বা সংক্ষেপ করা হয় না; প্রতিটি লিংক সংসদের নিজস্ব নথিতে যায়।',
          "Every session, the order of the day for every sitting and the Parliament Secretariat's circulars, exactly as Parliament publishes them. Nothing here is edited or shortened; every link goes to Parliament's own document.",
        )}
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('অধিবেশন', 'Sessions')} value={t.n(sessions.length)} />
            <Stat label={t('বৈঠক', 'Sittings')} value={t.n(totalSittings())} />
            <Stat
              label={t('শেষ বৈঠক', 'Last sitting')}
              value={
                ago === null
                  ? t('তথ্য নেই', 'Not available')
                  : ago === 0
                    ? t('আজ', 'Today')
                    : t(`${t.n(ago)} দিন আগে`, `${ago} ${plural(ago, 'day', 'days')} ago`)
              }
            />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href('/odhibeshon')}`}
          title={t('সংসদ অধিবেশন | আমার এমপি', 'Sessions of Parliament | My MP')}
          text={t(
            `ত্রয়োদশ জাতীয় সংসদের ${t.n(sessions.length)}টি অধিবেশন ও ${t.n(totalSittings())}টি বৈঠক: দিনের কার্যসূচি, পরিপত্র ও বিজ্ঞপ্তি`,
            `The 13th Parliament's ${t.count(sessions.length, '', 'session', 'sessions')} and ${t.count(totalSittings(), '', 'sitting', 'sittings')}: orders of the day, circulars and notices`,
          )}
        />
      </div>

      {current?.startDate && (
        <div className="mt-8">
          <SessionCountdown
            label={sessionLabel(current, t.lang)}
            start={current.startDate}
            startText={t.date(current.startDate) ?? current.startDate}
            weekday={weekdayOf(t, current.startDate)}
            end={current.endDate}
            lastSitting={current.sittings[0]?.date ?? null}
            sittings={current.sittings.length}
            circular={
              firstCircular?.pdfUrl
                ? { title: t.en ? circularTitleEn(firstCircular) : (firstCircular.titleBn ?? 'পরিপত্র'), url: firstCircular.pdfUrl }
                : null
            }
          />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          {sessions.length === 0 && (
            <Empty title={t('সংসদের তথ্যভান্ডারে এখনো কোনো অধিবেশন প্রকাশিত হয়নি।', "No session has been published in Parliament's database yet.")} />
          )}
          {sessions.map((s, i) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-rulesoft flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="display text-[22px] sm:text-[24px]">{sessionLabel(s, t.lang)}</h2>
                    {i === 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-brandsoft text-brand text-[12px] font-bold">
                        {s.sittings.length === 0 ? t('আসন্ন', 'Upcoming') : t('সর্বশেষ', 'Latest')}
                      </span>
                    )}
                  </div>
                  <span className="text-[14px] text-muted">
                    {t('শুরু ', 'Start: ')}{t.date(s.startDate) ?? t('তারিখ নেই', 'no date')}{s.endDate ? t(`, শেষ ${t.date(s.endDate)}`, `, end: ${t.date(s.endDate)}`) : ''}
                  </span>
                </div>
                <span className="text-[14px] font-semibold tnum">{t.count(s.sittings.length, 'টি বৈঠক', 'sitting', 'sittings')}</span>
              </div>

              {s.sittings.length ? (
                <ol className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {s.sittings.map((o, idx) => {
                    const inner = (
                      <>
                        <span className="flex items-center justify-between gap-2 text-[12px] text-muted">
                          <span className="tnum">{t('বৈঠক ', 'Sitting ')}{t.n(s.sittings.length - idx)}</span>
                          {o.pdfUrl && <Icon name="external" size={12} className="opacity-60 group-hover:opacity-100" />}
                        </span>
                        <span className="text-[15px] font-semibold leading-snug">{t.date(o.date) ?? (t.en ? sittingTitleEn(t, o) : o.titleBn)}</span>
                        {o.date && <span className="text-[12.5px] text-muted">{weekdayOf(t, o.date)}</span>}
                      </>
                    );
                    return (
                      <li key={o.id}>
                        {o.pdfUrl ? (
                          <a
                            href={o.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t('দিনের কার্যসূচি', sittingTitleEn(t, o))}
                            className="group h-full rounded-xl border border-rule bg-paper/60 px-3 py-2.5 flex flex-col gap-0.5 hover:border-brand hover:bg-brandsoft/50 transition-colors"
                          >
                            {inner}
                          </a>
                        ) : (
                          <span className="h-full rounded-xl border border-rule bg-paper/60 px-3 py-2.5 flex flex-col gap-0.5">{inner}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="px-6 py-4 text-[14px] text-muted">
                  {t('এই অধিবেশনের কোনো বৈঠকের কার্যসূচি এখনো প্রকাশিত হয়নি।', 'No order of the day has been published yet for any sitting of this session.')}
                </p>
              )}

              {s.circulars.length > 0 && (
                <div className="px-5 sm:px-6 py-4 bg-paper/60 border-t border-rulesoft flex flex-col gap-2">
                  <span className="text-[12px] font-bold tracking-[1px] text-muted">{t('পরিপত্র', 'Circulars')}</span>
                  <ul className="flex flex-col gap-1.5">
                    {s.circulars.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 text-[14px]">
                        <span>{t.en ? circularTitleEn(c) : (c.titleBn ?? `পরিপত্র ${c.no ?? ''}`)}{c.date ? <span className="text-muted">, {t.date(c.date)}</span> : null}</span>
                        {c.pdfUrl && <DocLink href={c.pdfUrl}>PDF</DocLink>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}

          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display text-[22px] sm:text-[24px]">{t('সংসদ সচিবালয়ের বিজ্ঞপ্তি', 'Parliament Secretariat notices')}</h2>
              <span className="text-[13.5px] text-muted tnum">{t.count(notices.length, 'টি', 'notice', 'notices')}</span>
            </div>
            {notices.length ? (
              <Card className="divide-y divide-rulesoft">
                {notices.slice(0, 25).map((n) => (
                  <div key={n.id} className="px-5 py-3.5 flex items-start gap-4">
                    <span className="grow min-w-0 flex flex-col gap-0.5">
                      <span className="text-[15px] font-medium wrap-anywhere">
                        {t.en ? tidyEn(n.titleEn) || 'Notice' : (bnText(n.titleBn) ?? n.titleEn)}
                      </span>
                      <span className="text-[12.5px] text-muted">{t.date(n.date) ?? t('তারিখ নেই', 'No date')}</span>
                    </span>
                    {n.pdfUrl && <DocLink href={n.pdfUrl}>PDF</DocLink>}
                  </div>
                ))}
              </Card>
            ) : (
              <Empty title={t('কোনো সাধারণ বিজ্ঞপ্তি নেই।', 'There are no general notices.')} />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-4">
            <h2 className="display text-[18px]">{t('ত্রয়োদশ সংসদ', '13th Parliament')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <Fact t={t} label={t('নির্বাচন', 'Election')} value={t.date(parliament.electionDate)} />
              <Fact t={t} label={t('গেজেট', 'Gazette')} value={t.date(parliament.gazetteDate)} />
              <Fact t={t} label={t('শপথ', 'Oath')} value={t.date(parliament.oathDate)} />
              <Fact t={t} label={t('মেয়াদ শেষ', 'Term ends')} value={t.date(parliament.endDate)} />
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[18px]">{t('সংসদ পরিচালনায়', 'Running the House')}</h2>
            <ul className="flex flex-col divide-y divide-rulesoft">
              {officers.map((o, i) => {
                const m = o.memberId ? getMemberById(o.memberId) : undefined;
                const tenure = t.en ? tenureEn(o.tenureBn) : o.tenureBn;
                const inner = (
                  <>
                    <span className="flex flex-col min-w-0">
                      <span className="text-[14.5px] font-semibold truncate">{t.en ? officerNameEn(o) : (o.nameBn ?? o.nameEn)}</span>
                      <span className="text-[12.5px] text-muted">
                        {t.en ? (HOUSE_ROLE[o.role]?.en ?? o.role) : (ROLE_LABELS[o.role] ?? o.role)}{tenure ? `, ${tenure}` : ''}
                      </span>
                    </span>
                    {m && <PartyDot abbr={m.party?.abbr} />}
                  </>
                );
                return (
                  <li key={`${o.role}-${i}`}>
                    {m ? (
                      <Link href={`/mp/${m.slug}`} className="py-2.5 flex items-center justify-between gap-3 hover:text-brand">{inner}</Link>
                    ) : (
                      <span className="py-2.5 flex items-center justify-between gap-3">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="p-4 rounded-card bg-brandsoft flex gap-3">
            <Icon name="info" size={18} className="text-brand mt-0.5" />
            <span className="text-[13px] leading-relaxed text-branddark">
              {t.en ? (
                <>
                  Source: Parliament of Bangladesh. Every document opens from Parliament&apos;s own server; My MP keeps no
                  documents itself. Updated {t.date(meta.syncedAt)}.
                </>
              ) : (
                <>
              তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ। প্রতিটি নথি সংসদের সার্ভার থেকে খোলে; আমার এমপি কোনো নথি নিজে রাখে না।
              হালনাগাদ {t.date(meta.syncedAt)}।
                </>
              )}
            </span>
          </div>
        </aside>
      </div>
      <div className="pb-14" />
    </Page>
  );
}
