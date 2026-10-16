import type { Metadata } from 'next';
import { shareGraph } from '@/lib/seo';
import Link from 'next/link';
import { getMemberById, bn, dateBn, meta, bnText } from '@/lib/data';
import {
  sessions, officers, parliament, sessionLabel, latestSitting, totalSittings, generalNotices, ROLE_LABELS, daysSince,
} from '@/lib/activity';
import { Page, PageHead, Card, Stat, Empty, PartyDot, DocLink } from '@/components/ui';
import Icon from '@/components/Icon';
import SessionCountdown from '@/components/SessionCountdown';

export const metadata: Metadata = {
  alternates: { canonical: '/odhibeshon' },
  openGraph: shareGraph('/odhibeshon'),
  title: 'সংসদ অধিবেশন',
  description: 'ত্রয়োদশ জাতীয় সংসদের অধিবেশন, প্রতিটি বৈঠকের দিনের কার্যসূচি, পরিপত্র ও সংসদ সচিবালয়ের বিজ্ঞপ্তি, সংসদের প্রকাশনা থেকে সরাসরি।',
};

const WEEKDAY_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
/** The weekday of an ISO date, as the calendar in Dhaka has it. */
const weekdayBn = (iso: string) => WEEKDAY_BN[new Date(`${iso}T12:00:00+06:00`).getUTCDay()]!;

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[15px] font-semibold">{value ?? 'তথ্য নেই'}</span>
    </div>
  );
}

export default function SessionsPage() {
  const last = latestSitting();
  const ago = daysSince(last?.date ?? null);
  const notices = generalNotices();
  const current = sessions[0] ?? null;
  const firstCircular = current?.circulars.slice().sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0];

  return (
    <Page>
      <PageHead
        eyebrow="ত্রয়োদশ জাতীয় সংসদ"
        title="সংসদ অধিবেশন"
        lede="প্রতিটি অধিবেশন, প্রতিটি বৈঠকের দিনের কার্যসূচি ও সংসদ সচিবালয়ের পরিপত্র, সংসদ যেভাবে প্রকাশ করে ঠিক সেভাবে। এখানে কিছুই সম্পাদনা বা সংক্ষেপ করা হয় না; প্রতিটি লিংক সংসদের নিজস্ব নথিতে যায়।"
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Stat label="অধিবেশন" value={bn(sessions.length)} />
            <Stat label="বৈঠক" value={bn(totalSittings())} />
            <Stat label="শেষ বৈঠক" value={ago === null ? 'তথ্য নেই' : ago === 0 ? 'আজ' : `${bn(ago)} দিন আগে`} />
          </div>
        }
      />

      {current?.startDate && (
        <div className="mt-8">
          <SessionCountdown
            label={sessionLabel(current)}
            start={current.startDate}
            startBn={dateBn(current.startDate) ?? current.startDate}
            weekdayBn={weekdayBn(current.startDate)}
            end={current.endDate}
            lastSitting={current.sittings[0]?.date ?? null}
            sittings={current.sittings.length}
            circular={firstCircular?.pdfUrl ? { title: firstCircular.titleBn ?? 'পরিপত্র', url: firstCircular.pdfUrl } : null}
          />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          {sessions.length === 0 && (
            <Empty title="সংসদের তথ্যভান্ডারে এখনো কোনো অধিবেশন প্রকাশিত হয়নি।" />
          )}
          {sessions.map((s, i) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-rulesoft flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="display text-[22px] sm:text-[24px]">{sessionLabel(s)}</h2>
                    {i === 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-brandsoft text-brand text-[12px] font-bold">
                        {s.sittings.length === 0 ? 'আসন্ন' : 'সর্বশেষ'}
                      </span>
                    )}
                  </div>
                  <span className="text-[14px] text-muted">
                    শুরু {dateBn(s.startDate) ?? 'তারিখ নেই'}{s.endDate ? `, শেষ ${dateBn(s.endDate)}` : ''}
                  </span>
                </div>
                <span className="text-[14px] font-semibold tnum">{bn(s.sittings.length)}টি বৈঠক</span>
              </div>

              {s.sittings.length ? (
                <ol className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {s.sittings.map((o, idx) => {
                    const inner = (
                      <>
                        <span className="flex items-center justify-between gap-2 text-[12px] text-muted">
                          <span className="tnum">বৈঠক {bn(s.sittings.length - idx)}</span>
                          {o.pdfUrl && <Icon name="external" size={12} className="opacity-60 group-hover:opacity-100" />}
                        </span>
                        <span className="text-[15px] font-semibold leading-snug">{dateBn(o.date) ?? o.titleBn}</span>
                        {o.date && <span className="text-[12.5px] text-muted">{weekdayBn(o.date)}</span>}
                      </>
                    );
                    return (
                      <li key={o.id}>
                        {o.pdfUrl ? (
                          <a
                            href={o.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="দিনের কার্যসূচি"
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
                <p className="px-6 py-4 text-[14px] text-muted">এই অধিবেশনের কোনো বৈঠকের কার্যসূচি এখনো প্রকাশিত হয়নি।</p>
              )}

              {s.circulars.length > 0 && (
                <div className="px-5 sm:px-6 py-4 bg-paper/60 border-t border-rulesoft flex flex-col gap-2">
                  <span className="text-[12px] font-bold tracking-[1px] text-muted">পরিপত্র</span>
                  <ul className="flex flex-col gap-1.5">
                    {s.circulars.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 text-[14px]">
                        <span>{c.titleBn ?? `পরিপত্র ${c.no ?? ''}`}{c.date ? <span className="text-muted">, {dateBn(c.date)}</span> : null}</span>
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
              <h2 className="display text-[22px] sm:text-[24px]">সংসদ সচিবালয়ের বিজ্ঞপ্তি</h2>
              <span className="text-[13.5px] text-muted tnum">{bn(notices.length)}টি</span>
            </div>
            {notices.length ? (
              <Card className="divide-y divide-rulesoft">
                {notices.slice(0, 25).map((n) => (
                  <div key={n.id} className="px-5 py-3.5 flex items-start gap-4">
                    <span className="grow min-w-0 flex flex-col gap-0.5">
                      <span className="text-[15px] font-medium wrap-anywhere">{bnText(n.titleBn) ?? n.titleEn}</span>
                      <span className="text-[12.5px] text-muted">{dateBn(n.date) ?? 'তারিখ নেই'}</span>
                    </span>
                    {n.pdfUrl && <DocLink href={n.pdfUrl}>PDF</DocLink>}
                  </div>
                ))}
              </Card>
            ) : (
              <Empty title="কোনো সাধারণ বিজ্ঞপ্তি নেই।" />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-4">
            <h2 className="display text-[18px]">ত্রয়োদশ সংসদ</h2>
            <div className="grid grid-cols-2 gap-4">
              <Fact label="নির্বাচন" value={dateBn(parliament.electionDate)} />
              <Fact label="গেজেট" value={dateBn(parliament.gazetteDate)} />
              <Fact label="শপথ" value={dateBn(parliament.oathDate)} />
              <Fact label="মেয়াদ শেষ" value={dateBn(parliament.endDate)} />
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[18px]">সংসদ পরিচালনায়</h2>
            <ul className="flex flex-col divide-y divide-rulesoft">
              {officers.map((o, i) => {
                const m = o.memberId ? getMemberById(o.memberId) : undefined;
                const inner = (
                  <>
                    <span className="flex flex-col min-w-0">
                      <span className="text-[14.5px] font-semibold truncate">{o.nameBn ?? o.nameEn}</span>
                      <span className="text-[12.5px] text-muted">{ROLE_LABELS[o.role] ?? o.role}{o.tenureBn ? `, ${o.tenureBn}` : ''}</span>
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
              তথ্যসূত্র: বাংলাদেশ জাতীয় সংসদ। প্রতিটি নথি সংসদের সার্ভার থেকে খোলে; আমার এমপি কোনো নথি নিজে রাখে না।
              হালনাগাদ {dateBn(meta.syncedAt)}।
            </span>
          </div>
        </aside>
      </div>
      <div className="pb-14" />
    </Page>
  );
}
