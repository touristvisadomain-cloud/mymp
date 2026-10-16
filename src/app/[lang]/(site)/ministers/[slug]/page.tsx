import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { shareGraph } from '@/lib/seo';
import { dateBn } from '@/lib/data';
import { allAdvisers, getAdviser, adviserPosts } from '@/lib/advisers';
import { sourceLabel } from '@/lib/sourceLabel';
import { Page, Card, Breadcrumb } from '@/components/ui';
import MemberPhoto from '@/components/MemberPhoto';

/**
 * A cabinet member from outside parliament (an adviser to the Prime Minister,
 * or a technocrat minister), who has no member page: who they are, what they
 * are responsible for, and where that account comes from.
 */

export function generateStaticParams() {
  return allAdvisers().map((a) => ({ slug: a.slug }));
}

const plain = (s: string) => s.replace(/\s+/g, ' ').trim();

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getAdviser(slug);
  if (!a) return { title: 'পাওয়া যায়নি' };
  const { rows } = adviserPosts(a);
  const portfolio = rows.map((r) => r.ministryBn).filter(Boolean).join(', ');
  const description = plain(
    `${a.nameBn}, ${a.roleBn}${a.rankBn ? ` (${a.rankBn})` : ''}${portfolio ? `; ${portfolio}` : ''}। জীবনী, শিক্ষা ও দায়িত্ব।`,
  ).slice(0, 300);
  return {
    title: { absolute: `${a.nameBn} | ${a.roleBn} | আমার এমপি` },
    description,
    alternates: { canonical: `/ministers/${a.slug}` },
    openGraph: { ...shareGraph(`/ministers/${a.slug}`), description },
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] sm:grid-cols-[150px_1fr] gap-x-4 py-2.5 border-b border-rulesoft last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium wrap-anywhere">{children}</span>
    </div>
  );
}

export default async function CabinetMemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getAdviser(slug);
  if (!a) notFound();

  const { rows, photoUrl } = adviserPosts(a);
  const paragraphs = a.bioBn.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const initial = a.nameBn.replace(/^(ব্রিগেডিয়ার জেনারেল \(অব\.\)|ড\.|ডা\.)\s*/g, '').charAt(0);

  const facts = [
    a.rankBn && { label: 'পদমর্যাদা', value: a.rankBn },
    a.partyRoleBn && { label: 'দলীয় পদ', value: a.partyRoleBn },
    a.professionBn && { label: 'পেশা', value: a.professionBn },
    a.educationBn && { label: 'শিক্ষা', value: a.educationBn, lines: true },
    a.birthPlaceBn && { label: 'জন্মস্থান', value: a.birthPlaceBn },
  ].filter(Boolean) as { label: string; value: string; lines?: boolean }[];

  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: a.nameBn,
    jobTitle: a.roleBn,
    ...(photoUrl ? { image: photoUrl } : {}),
    sameAs: a.sources,
  };

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }} />
      <Breadcrumb items={[{ href: '/', label: 'হোম' }, { href: '/ministers', label: 'মন্ত্রিসভা' }, { label: a.nameBn }]} />

      <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row sm:items-center gap-5">
        <MemberPhoto src={photoUrl} alt={a.nameBn} initial={initial} size={120} sizeClass="w-24 h-24 sm:w-[120px] sm:h-[120px]" />
        <div className="flex flex-col gap-2 min-w-0">
          <span className="text-[12.5px] font-bold tracking-[1.5px] text-brand">{a.roleBn}</span>
          <h1 className="display text-[28px] sm:text-[40px] leading-[1.15] text-balance wrap-anywhere">{a.nameBn}</h1>
          <p className="text-[14.5px] text-inksoft">
            {a.rankBn ?? 'উপদেষ্টা'} · সংসদ সদস্য নন
          </p>
        </div>
      </div>

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
        <div className="min-w-0 flex flex-col gap-6">
          <Card className="p-5 sm:p-6 flex flex-col gap-3">
            <h2 className="display text-[20px] font-bold">পরিচিতি</h2>
            {paragraphs.map((p, i) => (
              <p key={i} className="text-[15px] leading-[1.8] wrap-anywhere">{p}</p>
            ))}
            <p className="pt-3 mt-1 border-t border-rulesoft text-[12.5px] text-muted leading-relaxed">
              সূত্র:{' '}
              {a.sources.map((u, i) => (
                <span key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">{sourceLabel(u)}</a>
                  {i < a.sources.length - 1 ? ', ' : ''}
                </span>
              ))}
              ; দায়িত্বের তালিকা মন্ত্রিপরিষদ বিভাগের। {dateBn(a.checkedOn)} পর্যন্ত মিলিয়ে দেখা। ভুল দেখলে{' '}
              <Link href="/jogajog" className="underline hover:text-brand">জানান</Link>।
            </p>
          </Card>

          {facts.length > 0 && (
            <Card className="px-5 py-2 text-[14.5px]">
              {facts.map((f) => (
                <Row key={f.label} label={f.label}>
                  {(f.lines ? f.value.split(/;\s*/) : [f.value]).map((part, i) => (
                    <span key={i} className={f.lines ? 'block' : undefined}>{part}</span>
                  ))}
                </Row>
              ))}
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[18px] font-bold">দায়িত্ব</h2>
            {rows.length ? (
              <ul className="flex flex-col gap-2.5">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-col">
                    <span className="text-[14.5px] font-semibold">{r.ministryBn ?? r.title}</span>
                    <span className="text-[12.5px] text-muted">{dateBn(r.fromDate)} থেকে</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">মন্ত্রিপরিষদ বিভাগের তালিকায় এখন কোনো দায়িত্ব নেই।</p>
            )}
            <Link href="/ministers" className="text-[14px] font-semibold text-brand hover:underline">পুরো মন্ত্রিসভা →</Link>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
