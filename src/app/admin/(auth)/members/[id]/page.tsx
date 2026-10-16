import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMemberById, bn, dateBn } from '@/lib/data';
import { withEnglish } from '@/i18n/content';
import { requireAdmin } from '@/lib/admin/auth';
import { overridesFor, isHidden } from '@/lib/admin/store';
import { AdminPage, Panel, Button, Notice, when } from '@/app/admin/ui';
import { EntityEditor, EditFlags, HidePanel, AuditLink } from '../../EntityEditor';
import { variantsFor } from '@/lib/admin/feed';
import { addNameVariant, deleteNameVariant } from '@/app/admin/actions';
import Link from 'next/link';
import { questionsFor, questionStates } from '@/lib/admin/questions';
import { QuestionItem } from '../../questions/QuestionItem';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = getMemberById((await params).id);
  return { title: m ? `${m.nameBn ?? m.nameEn} | সংসদ সদস্য` : 'সংসদ সদস্য' };
}

export default async function EditMember({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;
  const m = getMemberById(id);
  if (!m) {
    // A hidden member is left out of the published data, so this page cannot
    // show their details; it can still bring them back.
    const hiddenRow = await isHidden('member', id);
    if (!hiddenRow) notFound();
    return (
      <AdminPage title={`লুকানো সদস্য ${id}`} lede="এই সদস্য সাইট থেকে সরানো আছে, তাই প্রকাশিত তথ্যে তাঁর বিবরণ নেই। আবার দেখালে পরের প্রকাশে সাইটে ফিরবেন, তারপর এখানে সম্পাদনা করা যাবে।">
        <EditFlags flags={flags} noun="সদস্যটি" />
        <Notice tone="warn">সরানো হয়েছে {when(hiddenRow.hidden_at)}{hiddenRow.reason ? `: ${hiddenRow.reason}` : ''}।</Notice>
        <div className="max-w-[420px] flex flex-col gap-4">
          <HidePanel type="member" id={id} hidden={hiddenRow} noun="সদস্যের তথ্য" />
          <AuditLink id={id} type="member" />
        </div>
      </AdminPage>
    );
  }

  const questions = questionsFor(id);
  const [overrides, hidden, variants, states] = await Promise.all([
    overridesFor('member', id),
    isHidden('member', id),
    variantsFor(id),
    questions.length ? questionStates() : Promise.resolve(new Map()),
  ]);

  return (
    <AdminPage
      title={m.nameBn ?? m.nameEn ?? id}
      lede={[m.seat?.nameBn, m.party?.nameBn, m.nameEn].filter(Boolean).join(', ')}
      actions={<Button kind="secondary" href={`/mp/${m.slug}`}>সাইটে দেখুন ↗</Button>}
    >
      <EditFlags flags={flags} noun="সদস্যটি" />
      {hidden && !flags.hidden && (
        <Notice tone="warn">
          এই সদস্য সাইট থেকে সরানো আছে ({when(hidden.hidden_at)}){hidden.reason ? `: ${hidden.reason}` : ''}।
        </Notice>
      )}

      {m.socialSource && (
        <Notice tone="warn">
          এই সদস্যের সোশ্যাল লিংকগুলো স্বয়ংক্রিয়ভাবে তাঁর উইকিপিডিয়া নিবন্ধ থেকে নেওয়া ({m.socialSource.split(' ').join(', ')})। সাইটে সূত্র হিসেবে উইকিপিডিয়া দেখানো হচ্ছে। যাচাই করে কোনো লিংক বদলে সংরক্ষণ করলে সাইটে “সম্পাদক যাচাই করেছেন” দেখাবে।
        </Notice>
      )}

      {m.bioFromWiki && (
        <Notice tone="warn">
          {m.bioFromWiki.split(',').map((k) => ({ educationBn: 'শিক্ষা', birthPlaceBn: 'জন্মস্থান', professionBn: 'পেশা' })[k.trim()] ?? k).join(', ')}{' '}
          স্বয়ংক্রিয়ভাবে সদস্যের উইকিপিডিয়া নিবন্ধ থেকে নেওয়া ({(m.bioSource ?? '').split(' ').join(', ')})। সাইটে এগুলোর পাশে তারকাচিহ্ন ও সূত্র দেখানো হয়। যাচাই করে সংরক্ষণ করলে সেই ঘরটি আপনার সম্পাদনা হিসেবে দেখাবে।
        </Notice>
      )}

      {questions.length > 0 && (
        <Panel
          title={`যাচাইয়ের প্রশ্ন (${bn(questions.filter((x) => !states.get(x.id)?.resolved).length)}টি খোলা)`}
          action={<Link href="/admin/questions">সব প্রশ্ন →</Link>}
        >
          <ul className="flex flex-col divide-y divide-rulesoft">
            {questions.map((x) => (
              <QuestionItem key={x.id} question={x} state={states.get(x.id) ?? null} back={`/admin/members/${id}`} />
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <EntityEditor
          type="member"
          id={id}
          snapshot={withEnglish(m, ['bioBn', 'educationBn', 'birthPlaceBn', 'professionBn', 'partyRoleBn', 'ministryBn']) as unknown as Record<string, string | null | undefined>}
          overrides={overrides}
          backHref="/admin/members"
        />

        <div className="flex flex-col gap-4">
          <Panel title="সংসদের তথ্যভান্ডার থেকে">
            <dl className="flex flex-col gap-2 text-[14px]">
              <div className="flex justify-between gap-3"><dt className="text-muted">আইডি</dt><dd className="tnum">{m.id}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">জন্ম</dt><dd>{dateBn(m.dateOfBirth) ?? 'নেই'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">লিঙ্গ</dt><dd>{m.gender === 'Female' ? 'নারী' : 'পুরুষ'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">আসন</dt><dd>{m.seat?.nameBn ?? 'নেই'}{m.seat ? ` (${bn(m.seat.no)})` : ''}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">মোবাইল</dt><dd>{m.hasMobile ? 'আছে, প্রকাশ করা হয় না' : 'নেই'}</dd></div>
            </dl>
            <p className="mt-3 text-[12.5px] text-muted">
              এগুলো এখানে বদলানো যায় না; প্রতি সিঙ্কে সংসদের তথ্যভান্ডার থেকে আসে।
            </p>
          </Panel>

          <Panel title="নামের ভিন্ন রূপ">
            <p className="text-[13px] text-muted leading-relaxed pb-3">
              সংবাদের শিরোনামে এই সদস্যের নাম যেভাবে লেখা হয়। সম্মানসূচক শব্দ (মোঃ, ডা, ব্যারিস্টার) ও বিভক্তি নিজে থেকেই বাদ যায়,
              তাই শুধু ডাকনাম বা সংবাদমাধ্যমের চেনা বানানটি যোগ করুন। অন্তত দুই শব্দ লাগবে; এক শব্দে কাউকে চেনা যায় না।
            </p>
            <ul className="flex flex-col gap-1.5 pb-3">
              {variants.length === 0 ? (
                <li className="text-[13.5px] text-muted">কোনো রূপ নেই।</li>
              ) : variants.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3 text-[14px] border-b border-rulesoft pb-1.5">
                  <span className="min-w-0 break-words">
                    {v.variant}
                    <span className="text-muted text-[12px]"> ({v.source === 'official' ? 'তালিকা থেকে' : v.source === 'manual' ? 'হাতে লেখা' : 'শেখা'})</span>
                  </span>
                  {v.source !== 'official' && (
                    <form action={deleteNameVariant}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="mp_id" value={id} />
                      <input type="hidden" name="variant" value={v.variant} />
                      <button className="text-[12.5px] font-semibold text-brand hover:underline">সরান</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {flags.invalidVariant && (
              <p className="pb-3 text-[13px] text-danger font-semibold">যোগ করা হয়নি: মোঃ, ডা, ব্যারিস্টারের মতো শব্দ বাদ দিলে অন্তত দুই শব্দ থাকতে হবে।</p>
            )}
            <form action={addNameVariant} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="mp_id" value={id} />
              <input name="variant" required placeholder="যেমন: মঈন খান" className="h-10 grow min-w-0 basis-[140px] rounded-lg border border-rule bg-surface px-3 text-[14px]" />
              <button className="h-10 px-3.5 rounded-lg border border-rule text-[13.5px] font-semibold hover:border-ink">যোগ করুন</button>
            </form>
            <p className="pt-3 text-[13px]">
              <Link href={`/admin/feed?mp=${id}`} className="text-brand font-semibold hover:underline">এই সদস্যের ফিড দেখুন →</Link>
            </p>
          </Panel>

          <HidePanel type="member" id={id} hidden={hidden} noun="সদস্যের তথ্য" />
          <AuditLink id={id} type="member" />
        </div>
      </div>
    </AdminPage>
  );
}
