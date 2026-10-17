import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import { members, parties, bn, statistics, partyShortBn, districtOf } from '@/lib/data';
import { Page, PageHead, Stat } from '@/components/ui';
import MemberFilter from '@/components/MemberFilter';
import { getT } from '@/i18n/server';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

const generalSeats = members.filter((m) => !m.seat?.reserved).length;
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/mp'),
    ...pageShare('mp', t),
    title: t('সংসদ সদস্যদের তালিকা ২০২৬: সব এমপি', 'List of MPs of Bangladesh 2026'),
    description: fitDescription(
      t(
        `ত্রয়োদশ জাতীয় সংসদের ${bn(members.length)} জন সংসদ সদস্যের তালিকা: ${bn(generalSeats)}টি সাধারণ আসন ও ${bn(members.length - generalSeats)}টি সংরক্ষিত নারী আসন। নাম, দল, আসন বা জেলা দিয়ে খুঁজুন।`,
        `The ${members.length} Members of the 13th Parliament: ${generalSeats} general seats and ${members.length - generalSeats} seats reserved for women. Search by name, party, seat or district.`,
      ),
    ),
  };
}

export default async function AllMps() {
  const t = await getT();
  const stats = statistics();
  const sorted = [...members].sort((a, b) => (a.seat?.no ?? 999) - (b.seat?.no ?? 999));

  return (
    <Page>
      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('সব সংসদ সদস্য', 'All MPs')}
        lede={t(
          `${bn(stats.total)} জন সদস্য। ${bn(stats.territorial)} জন আসন থেকে নির্বাচিত, ${bn(stats.reserved)} জন সংরক্ষিত নারী আসনে।`,
          `${stats.total} members: ${stats.territorial} elected from seats, ${stats.reserved} in seats reserved for women.`,
        )}
        aside={
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <Stat label={t('মোট সদস্য', 'Total members')} value={t.n(stats.total)} />
            <Stat label={t('নারী সদস্য', 'Women members')} value={t.n(stats.women)} />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href('/mp')}`}
          title={t('সব সংসদ সদস্য | আমার এমপি', 'All MPs | My MP')}
          text={t(
            `ত্রয়োদশ জাতীয় সংসদের ${bn(stats.total)} জন সংসদ সদস্যের তালিকা, দল, আসন ও জেলাসহ`,
            `The ${stats.total} Members of the 13th Parliament, with their parties, seats and districts`,
          )}
        />
      </div>

      {t.en ? (
        <p className="mt-5 text-[14px] text-inksoft">
          To see the {stats.reserved} members in seats reserved for women together, go to the{' '}
          <Link href="/sangrakkhito-ason" className="font-semibold text-brand hover:underline">
            reserved seats for women
          </Link>{' '}
          page.
        </p>
      ) : (
        <p className="mt-5 text-[14px] text-inksoft">
          সংরক্ষিত নারী আসনের {bn(stats.reserved)} জন সদস্য একসঙ্গে দেখতে{' '}
          <Link href="/sangrakkhito-ason" className="font-semibold text-brand hover:underline">
            সংরক্ষিত নারী আসন
          </Link>{' '}
          পাতায় যান।
        </p>
      )}

      <div className="py-8">
        <MemberFilter
          members={sorted.map((m) => ({
            id: m.id,
            slug: m.slug,
            nameBn: m.nameBn,
            nameEn: m.nameEn,
            photoUrl: m.photoUrl,
            party: m.party?.abbr ?? null,
            partyBn: partyShortBn(m.party),
            seatBn: m.seat?.nameBn ?? null,
            seatEn: m.seat?.nameEn ?? null,
            seatSlug: m.seat?.slug ?? null,
            districtBn: districtOf(m.seat)?.bn ?? null,
            districtEn: districtOf(m.seat)?.en ?? null,
            seatNo: m.seat?.no ?? null,
            reserved: !!m.seat?.reserved,
            gender: m.gender,
          }))}
          parties={parties.map((p) => ({ abbr: p.abbr, label: partyShortBn(p) ?? p.abbr, seats: p.seats }))}
        />
      </div>
    </Page>
  );
}
