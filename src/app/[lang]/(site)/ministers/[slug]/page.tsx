import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { notFound } from 'next/navigation';
import { shareGraph, shareTwitter, langAlternates, cardImage, fitDescription, withSiteName } from '@/lib/seo';
import { dateBn } from '@/lib/data';
import { allAdvisers, getAdviser, adviserPosts, adviserName, adviserRole, rankIn, type AdviserProfile } from '@/lib/advisers';
import { sourceLabel } from '@/lib/sourceLabel';
import { Page, Card, Breadcrumb, TranslatedNote } from '@/components/ui';
import MemberPhoto from '@/components/MemberPhoto';
import { getT } from '@/i18n/server';
import { govPost } from '@/i18n/names';
import { inLang, translated } from '@/i18n/content';
import type { Lang } from '@/i18n/core';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';

/**
 * A cabinet member from outside parliament (an adviser to the Prime Minister,
 * or a technocrat minister), who has no member page: who they are, what they
 * are responsible for, and where that account comes from.
 */

export function generateStaticParams() {
  return allAdvisers().map((a) => ({ slug: a.slug }));
}

const plain = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The ministries in the page's language; on an English page, those with no English yet are left out. */
const portfolioIn = (rows: { ministryBn: string | null }[], lang: Lang) =>
  rows.map((r) => inLang(r.ministryBn, lang)).filter(Boolean).join(', ');

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  const a = getAdviser(slug);
  if (!a) return { title: t('পাওয়া যায়নি', 'Not found') };
  const { rows } = adviserPosts(a);
  const path = `/ministers/${a.slug}`;
  const portfolio = portfolioIn(rows, t.lang);
  let description: string;
  /** Who and what, without the site's name: the title's core and the card's alt. */
  let label: string;
  if (t.en) {
    // A name the English page can only give in Bangla stays out of the English title and description.
    const name = adviserName(a, 'en');
    const who = name.lang === 'en' ? name.text : null;
    const role = adviserRole(a, 'en');
    const rank = rankIn(a.rankBn, 'en');
    description = plain(
      `${who ? `${who}, ` : ''}${role}${rank ? ` (${rank.charAt(0).toLowerCase()}${rank.slice(1)})` : ''}${portfolio ? `; ${portfolio}` : ''}. Biography, education and responsibilities.`,
    );
    label = who ? `${who} | ${role}` : `${role} | Cabinet`;
  } else {
    description = plain(
      `${a.nameBn}, ${a.roleBn}${a.rankBn ? ` (${a.rankBn})` : ''}${portfolio ? `; ${portfolio}` : ''}। জীবনী, শিক্ষা ও দায়িত্ব।`,
    );
    label = `${a.nameBn} | ${a.roleBn}`;
  }
  description = fitDescription(description);
  // Their own card (src/app/api/og/ministers/[slug]/route.tsx): photo, post and ministries.
  const image = cardImage(`/api/og/ministers/${a.slug}${t.en ? '/en' : ''}`, label);
  return {
    // With " | My MP" when the whole still fits what search results show.
    title: { absolute: withSiteName(label, t.lang) },
    description,
    alternates: langAlternates(t.lang, path),
    openGraph: { ...shareGraph(path, image, t.lang), description },
    twitter: { ...shareTwitter(image), description },
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

/** The profile's facts in the page's language; on an English page a fact with no English yet is left out. */
function factsOf(a: AdviserProfile, lang: Lang) {
  const en = lang === 'en';
  return [
    rankIn(a.rankBn, lang) && { label: en ? 'Rank' : 'পদমর্যাদা', value: rankIn(a.rankBn, lang)! },
    inLang(a.partyRoleBn, lang) && { label: en ? 'Party post' : 'দলীয় পদ', value: inLang(a.partyRoleBn, lang)! },
    inLang(a.professionBn, lang) && { label: en ? 'Profession' : 'পেশা', value: inLang(a.professionBn, lang)! },
    inLang(a.educationBn, lang) && { label: en ? 'Education' : 'শিক্ষা', value: inLang(a.educationBn, lang)!, lines: true },
    inLang(a.birthPlaceBn, lang) && { label: en ? 'Birthplace' : 'জন্মস্থান', value: inLang(a.birthPlaceBn, lang)! },
  ].filter(Boolean) as { label: string; value: string; lines?: boolean }[];
}

/** The first letter of an English name, past its titles, for the photo's stand-in. */
const initialEn = (name: string) =>
  (name.replace(/^((Brigadier General|Brig\. Gen\.|Dr\.?|Md\.?|Mohammad|Barrister|Advocate)\s+|\(retd\.?\)\s*)+/i, '') || name).charAt(0).toUpperCase();

export default async function CabinetMemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getAdviser(slug);
  if (!a) notFound();
  const t = await getT();
  const bnHref = `/ministers/${a.slug}`;

  const { rows, photoUrl } = adviserPosts(a);
  const name = adviserName(a, t.lang);
  // Bangla in a lang="bn" element on an English page, for a name with no English yet.
  const nameLang = name.lang !== t.lang ? name.lang : undefined;
  const role = adviserRole(a, t.lang);
  const bio = translated(a.bioBn, t.lang);
  const paragraphs = (bio?.text ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const initial = name.lang === 'en'
    ? initialEn(name.text)
    : a.nameBn.replace(/^(ব্রিগেডিয়ার জেনারেল \(অব\.\)|ড\.|ডা\.)\s*/g, '').charAt(0);

  const facts = factsOf(a, t.lang);
  const rank = rankIn(a.rankBn, t.lang);
  const ministries = rows.map((r) => ({ id: r.id, name: r.ministryBn ? inLang(r.ministryBn, t.lang) : govPost(r.title, t.lang), title: r.title, fromDate: r.fromDate }));
  const unnamed = ministries.filter((m) => !m.name).length;

  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: name.text,
    jobTitle: role,
    ...(photoUrl ? { image: photoUrl } : {}),
    sameAs: a.sources,
  };

  const sourceLinks = a.sources.map((u, i) => (
    <span key={u}>
      <a href={u} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">{sourceLabel(u, t.lang)}</a>
      {i < a.sources.length - 1 ? ', ' : ''}
    </span>
  ));

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }} />
      {/* The breadcrumb cannot mark a name as Bangla, so an English page without an English name ends it with the role. */}
      <Breadcrumb items={[{ href: '/', label: t('হোম', 'Home') }, { href: '/ministers', label: t('মন্ত্রিসভা', 'Cabinet') }, { label: nameLang ? role : name.text }]} />

      <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row sm:items-center gap-5">
        {nameLang ? (
          <span lang={nameLang} className="contents">
            <MemberPhoto src={photoUrl} alt={name.text} initial={initial} size={120} sizeClass="w-24 h-24 sm:w-[120px] sm:h-[120px]" />
          </span>
        ) : (
          <MemberPhoto src={photoUrl} alt={name.text} initial={initial} size={120} sizeClass="w-24 h-24 sm:w-[120px] sm:h-[120px]" />
        )}
        <div className="flex flex-col gap-2 min-w-0">
          <span className="text-[12.5px] font-bold tracking-[1.5px] text-brand">{role}</span>
          <h1 lang={nameLang} className="display text-[28px] sm:text-[40px] leading-[1.15] text-balance wrap-anywhere">{name.text}</h1>
          <p className="text-[14.5px] text-inksoft">
            {t.en ? (rank ? `${rank} · Not an MP` : 'Not an MP') : <>{a.rankBn ?? 'উপদেষ্টা'} · সংসদ সদস্য নন</>}
          </p>
        </div>
      </div>

      {/* Name and post; an English page without an English name shares the post alone. */}
      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href(`/ministers/${a.slug}`)}`}
          title={`${nameLang ? role : name.text} | ${t('আমার এমপি', 'My MP')}`}
          text={nameLang ? role : `${name.text}, ${role}`}
        />
      </div>

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
        <div className="min-w-0 flex flex-col gap-6">
          <Card className="p-5 sm:p-6 flex flex-col gap-3">
            <h2 className="display text-[20px] font-bold">{t('পরিচিতি', 'Profile')}</h2>
            {paragraphs.map((p, i) => (
              <p key={i} className="text-[15px] leading-[1.8] wrap-anywhere">{p}</p>
            ))}
            {t.en && bio?.translated && <TranslatedNote bnHref={bnHref} />}
            {t.en && !bio && (
              <p className="text-[15px] leading-[1.8] text-inksoft">
                This profile is written in Bangla and has not been translated yet.{' '}
                <a href={bnHref} hrefLang="bn" className="font-semibold text-brand underline decoration-rule underline-offset-2 hover:decoration-brand">
                  Read it in Bangla
                </a>
              </p>
            )}
            {t.en ? (
              <p className="pt-3 mt-1 border-t border-rulesoft text-[12.5px] text-muted leading-relaxed">
                Sources: {sourceLinks}; the list of responsibilities is the Cabinet Division&rsquo;s. Checked up to {t.date(a.checkedOn)}. If you see a mistake,{' '}
                <Link href="/jogajog" className="underline hover:text-brand">let us know</Link>.
              </p>
            ) : (
              <p className="pt-3 mt-1 border-t border-rulesoft text-[12.5px] text-muted leading-relaxed">
                সূত্র:{' '}
                {sourceLinks}
                ; দায়িত্বের তালিকা মন্ত্রিপরিষদ বিভাগের। {dateBn(a.checkedOn)} পর্যন্ত মিলিয়ে দেখা। ভুল দেখলে{' '}
                <Link href="/jogajog" className="underline hover:text-brand">জানান</Link>।
              </p>
            )}
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
            <h2 className="display text-[18px] font-bold">{t('দায়িত্ব', 'Responsibilities')}</h2>
            {rows.length ? (
              <ul className="flex flex-col gap-2.5">
                {ministries.filter((m) => m.name).map((m) => (
                  <li key={m.id} className="flex flex-col">
                    <span className="text-[14.5px] font-semibold">{m.name}</span>
                    <span className="text-[12.5px] text-muted">{t.en ? `Since ${t.date(m.fromDate)}` : `${dateBn(m.fromDate)} থেকে`}</span>
                  </li>
                ))}
                {unnamed > 0 && (
                  <li className="text-[13px] text-muted leading-snug">
                    {unnamed === ministries.length
                      ? `${unnamed === 1 ? 'One responsibility' : `${unnamed} responsibilities`}, named so far only on the `
                      : `${unnamed === 1 ? 'One more' : `${unnamed} more`}, named so far only on the `}
                    <a href={bnHref} hrefLang="bn" className="underline hover:text-brand">Bangla page</a>.
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">{t('মন্ত্রিপরিষদ বিভাগের তালিকায় এখন কোনো দায়িত্ব নেই।', 'The Cabinet Division’s list gives no responsibility at present.')}</p>
            )}
            <Link href="/ministers" className="text-[14px] font-semibold text-brand hover:underline">{t('পুরো মন্ত্রিসভা', 'The whole Cabinet')} →</Link>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
