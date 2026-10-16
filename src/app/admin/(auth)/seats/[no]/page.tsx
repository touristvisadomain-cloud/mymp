import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { seats, getMemberById, bn } from '@/lib/data';
import { withEnglish } from '@/i18n/content';
import { requireAdmin } from '@/lib/admin/auth';
import { overridesFor } from '@/lib/admin/store';
import { AdminPage, Panel, Button } from '@/app/admin/ui';
import { EntityEditor, EditFlags, AuditLink } from '../../EntityEditor';

export async function generateMetadata({ params }: { params: Promise<{ no: string }> }): Promise<Metadata> {
  const { no } = await params;
  const seat = seats.find((s) => String(s.no) === no);
  return { title: seat ? `${seat.nameBn ?? seat.nameEn} | আসন` : 'আসন' };
}

export default async function EditSeat({
  params,
  searchParams,
}: {
  params: Promise<{ no: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { no } = await params;
  const flags = await searchParams;
  const seat = seats.find((s) => String(s.no) === no);
  if (!seat) notFound();

  const member = seat.memberId ? getMemberById(seat.memberId) : undefined;
  const overrides = await overridesFor('seat', no);

  return (
    <AdminPage
      title={seat.nameBn ?? seat.nameEn ?? no}
      lede={[seat.nameEn, seat.reserved ? 'সংরক্ষিত নারী আসন' : 'সাধারণ আসন'].filter(Boolean).join(', ')}
      actions={<Button kind="secondary" href={`/ason/${seat.slug}`}>সাইটে দেখুন ↗</Button>}
    >
      <EditFlags flags={flags} noun="আসনটি" type="seat" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <EntityEditor
          type="seat"
          id={no}
          snapshot={withEnglish(seat, ['boundaryBn']) as unknown as Record<string, string | null | undefined>}
          overrides={overrides}
          backHref="/admin/seats"
        />

        <div className="flex flex-col gap-4">
          <Panel title="সংসদের তথ্যভান্ডার থেকে">
            <dl className="flex flex-col gap-2 text-[14px]">
              <div className="flex justify-between gap-3"><dt className="text-muted">আসন নম্বর</dt><dd className="tnum">{bn(seat.no)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">ধরন</dt><dd>{seat.reserved ? 'সংরক্ষিত' : 'সাধারণ'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">বর্তমান সদস্য</dt><dd className="text-end">{member?.nameBn ?? 'নেই'}</dd></div>
            </dl>
            <p className="mt-3 text-[12.5px] text-muted">
              আসনে কে আছেন তা সংসদের তথ্যভান্ডার ঠিক করে। কোনো সদস্যকে সরাতে চাইলে তাঁর নিজের পাতায় যান।
            </p>
          </Panel>
          <AuditLink id={no} type="seat" />
        </div>
      </div>
    </AdminPage>
  );
}
