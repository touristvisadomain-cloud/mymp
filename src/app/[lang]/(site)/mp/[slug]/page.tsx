import type { Metadata } from 'next';
import { shareGraph, shareTwitter, cardImage, langAlternates, fitDescription } from '@/lib/seo';
import { sourceLabel, sourceList } from '@/lib/sourceLabel';
import { mpDescription, mpTitle, partyBn, isIndependent, partyEnBare, possessiveEn } from '@/lib/seo/mpDescription';
import Link from '@/i18n/Link';
import { notFound } from 'next/navigation';
import {
  members, allMembers, getMember, committeesOfMember, membersOfParty, districtOf, seats, posts,
  bn, ageFrom, dateBn, meta, committeeCounts, partyColor, postsCheckedOnBn, nameEnDisplay, bnText,
} from '@/lib/data';
import { storiesForMember } from '@/lib/newsView';
import { noticesForMember, NOTICE_CATEGORY_BN, NOTICE_CATEGORY_EN } from '@/lib/activity';
import { priorTermsOf, parliamentLabel, parliamentOrdinal, socialsOf, facebookNotice, unverifiedLabel } from '@/lib/history';
import { Page, Card, Breadcrumb, Empty, PartyDot, DocLink, TranslatedNote } from '@/components/ui';
import { ResultCard } from '@/components/results';
import { memberText, memberRoles, postBadges } from '@/lib/memberProfile';
import MemberPhoto from '@/components/MemberPhoto';
import { memberInitial } from '@/components/mp/initial';
import Icon from '@/components/Icon';
import MemberFeed from '@/components/MemberFeed';
import BrandIcon, { isBrand } from '@/components/BrandIcon';
import ShareButtons from '@/components/ShareButtons';
import CorrectionButton from '@/components/CorrectionButton';
import SeatMap from '@/components/SeatMap';
import { getT } from '@/i18n/server';
import { hrefIn, plural } from '@/i18n/core';
import { inLang, translated } from '@/i18n/content';
import {
  personName, otherName, seatName, districtName, partyName, partyByAbbr, noParty, committeeName, committeeRole,
  ordinalWordEn, titleCaseName,
} from '@/i18n/names';

import { siteUrl } from '@/lib/site';

export function generateStaticParams() {
  return allMembers.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/mp/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  const m = getMember(slug);
  if (!m) return { title: t('সদস্য পাওয়া যায়নি', 'Member not found') };
  const path = `/mp/${m.slug}`;
  // The member's own 1200x630 preview image (src/app/api/og/mp/[slug]/route.tsx).
  const image = cardImage(`/api/og/mp/${m.slug}${t.en ? "/en" : ""}`, mpTitle(m, t.lang));
  const description = fitDescription(mpDescription(m, t.lang));
  return {
    title: { absolute: mpTitle(m, t.lang) },
    description,
    alternates: langAlternates(t.lang, path),
    openGraph: { ...shareGraph(path, image, t.lang), description },
    twitter: { ...shareTwitter(image), card: 'summary_large_image', description },
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

async function H2({ children, count }: { children: React.ReactNode; count?: number }) {
  const t = await getT();
  return (
    <h2 className="display text-[21px] sm:text-[24px]">
      {children}
      {typeof count === 'number' && count > 0 && <span className="ms-2 text-[15px] font-semibold text-muted tnum">({t.n(count)})</span>}
    </h2>
  );
}

/** "a, b and c" */
const listEn = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? '');

/** "Once", "Twice", "3 times": how often a member has been elected. */
const timesEn = (n: number) => (n === 1 ? 'Once' : n === 2 ? 'Twice' : `${n} times`);

export default async function MemberPage({ params }: PageProps<'/[lang]/mp/[slug]'>) {
  const { slug } = await params;
  const m = getMember(slug);
  if (!m) notFound();
  const t = await getT();
  const en = t.en;
  const path = `/mp/${m.slug}`;
  // The original Bangla page, for text that is only in Bangla so far.
  const bnHref = hrefIn('bn', path);
  const his = possessiveEn(m.gender);
  const name = en ? personName(m, 'en') : m.nameBn ?? m.nameEn;

  const age = ageFrom(m.dateOfBirth);
  const district = districtOf(m.seat);
  const onCommittees = committeesOfMember(m.id);
  // Same-story headlines from several outlets come folded into one story.
  const memberStories = storiesForMember(m.slug);
  const notices = noticesForMember(m.id);
  const prior = priorTermsOf(m.id);
  const socials = socialsOf(m, t.lang);
  const fbNotice = facebookNotice(m, t.lang);
  const { result, wonThisResult, year, bio, bioOnlyInBangla, paragraphs, summary, showSummary, intro, lead } = memberText(m, t.lang);
  const cc = committeeCounts();
  const partyMates = m.party ? membersOfParty(m.party.abbr).filter((x) => x.id !== m.id) : [];
  const sameDistrict = district
    ? members.filter((x) => x.id !== m.id && districtOf(x.seat)?.en === district.en)
    : [];

  const { roles } = memberRoles(m, t.lang);
  const badges = postBadges(m, t.lang);
  const postsChecked = en ? t.date(posts.checkedAt) : postsCheckedOnBn();

  // Facts read from the member's Wikipedia infobox are marked, with the article linked under the list.
  const fromWiki = new Set((m.bioFromWiki ?? '').split(',').map((x) => x.trim()).filter(Boolean));
  // Fields the source writes only in Bangla: their English when it is on file, else left out of the English page.
  const birthPlace = inLang(m.birthPlaceBn, t.lang);
  const education = inLang(m.educationBn, t.lang);
  const profession = inLang(m.professionBn, t.lang);
  const father = en ? titleCaseName(m.fatherEn) ?? inLang(m.fatherBn, 'en') : m.fatherBn;
  const mother = en ? titleCaseName(m.motherEn) ?? inLang(m.motherBn, 'en') : m.motherBn;
  const facts = [
    m.dateOfBirth && {
      label: t('জন্ম', 'Born'),
      value: en
        ? `${t.date(m.dateOfBirth)}${age !== null ? ` (aged ${age})` : ''}`
        : `${dateBn(m.dateOfBirth)}${age !== null ? `, ${bn(age)} বছর` : ''}`,
    },
    birthPlace && { label: t('জন্মস্থান', 'Birthplace'), value: birthPlace, wiki: fromWiki.has('birthPlaceBn') },
    m.gender && { label: t('লিঙ্গ', 'Gender'), value: en ? (m.gender === 'Female' ? 'Female' : 'Male') : m.gender === 'Female' ? 'নারী' : 'পুরুষ' },
    education && { label: t('শিক্ষা', 'Education'), value: education, wiki: fromWiki.has('educationBn'), lines: true },
    profession && { label: t('পেশা', 'Profession'), value: profession, wiki: fromWiki.has('professionBn') },
    father && { label: t('পিতা', 'Father'), value: father },
    mother && { label: t('মাতা', 'Mother'), value: mother },
    m.isFreedomFighter && { label: t('মুক্তিযোদ্ধা', 'Freedom fighter'), value: t('হ্যাঁ', 'Yes') },
    m.term?.start && {
      label: m.resignedOn ? t('মেয়াদ', 'Term') : t('বর্তমান মেয়াদ', 'Current term'),
      value: en
        ? m.term.end ? `${t.date(m.term.start)} to ${t.date(m.term.end)}` : `From ${t.date(m.term.start)}, ongoing`
        : `${dateBn(m.term.start)} থেকে ${dateBn(m.term.end) ?? 'চলমান'}`,
    },
    m.resignedOn && { label: t('পদত্যাগ', 'Resigned'), value: en ? t.date(m.resignedOn) ?? 'Date not found' : dateBn(m.resignedOn) ?? 'তারিখ পাওয়া যায়নি' },
    m.termsCount && { label: t('সংসদ সদস্য নির্বাচিত', 'Elected an MP'), value: en ? timesEn(m.termsCount) : `মোট ${bn(m.termsCount)} বার` },
  ].filter(Boolean) as { label: string; value: string; wiki?: boolean; lines?: boolean }[];
  const wikiSources = facts.some((f) => f.wiki) ? (m.bioSource ?? '').split(' ').filter(Boolean) : [];

  const bioSources = sourceList(m.bioSources);
  const party = partyBn(m.party);
  // The same person elsewhere: search engines use these to tie this page to
  // the member's Wikipedia article and their own accounts.
  const sameAs = (() => {
    const same = [
      ...(m.bioSource ?? '').split(/\s+/),
      ...bioSources,
      // Only links the site stands behind: an unconfirmed Facebook page is not claimed as the member's.
      ...socials.filter((s) => !s.unverified).map((s) => s.url),
    ].filter((u): u is string => !!u && /^https?:\/\//.test(u) && (!/wikipedia\.org/.test(u) || /\/wiki\//.test(u)));
    const canon = (u: string) => {
      try {
        return encodeURI(decodeURI(u));
      } catch {
        return u;
      }
    };
    const unique = [...new Set(same.filter((u) => !/mymp\.bd|tbsnews\.net\/election/.test(u)).map(canon))];
    return unique.length ? { sameAs: unique } : {};
  })();
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: name,
    ...(m.nameEn && m.nameBn ? { alternateName: en ? m.nameBn : nameEnDisplay(m.nameEn) } : {}),
    jobTitle: m.seat && !m.resignedOn
      ? t(m.seat.reserved ? `${m.seat.nameBn}-এর সংসদ সদস্য` : `${m.seat.nameBn} আসনের সংসদ সদস্য`, `Member of Parliament for ${seatName(m.seat, 'en')}`)
      : t('সংসদ সদস্য', 'Member of Parliament'),
    ...(party && !isIndependent(m) ? { memberOf: { '@type': 'Organization', name: en ? partyEnBare(m.party) ?? party.name : party.name } } : {}),
    worksFor: { '@type': 'Organization', name: t('বাংলাদেশ জাতীয় সংসদ', 'Parliament of Bangladesh'), url: 'https://www.parliament.gov.bd' },
    ...(m.photoUrl ? { image: m.photoUrl } : {}),
    url: `${siteUrl}${t.href(path)}`,
    description: lead,
    nationality: { '@type': 'Country', name: t('বাংলাদেশ', 'Bangladesh') },
    ...(m.gender === 'Male' || m.gender === 'Female' ? { gender: m.gender } : {}),
    ...(m.dateOfBirth ? { birthDate: m.dateOfBirth } : {}),
    ...(birthPlace ? { birthPlace: { '@type': 'Place', name: birthPlace } } : {}),
    ...(education ? { alumniOf: { '@type': 'EducationalOrganization', name: education } } : {}),
    ...sameAs,
  };
  // Name only the sources this member's introduction actually drew on.
  const introParts = en
    ? ([
        "Parliament's list of members",
        wonThisResult ? 'the published election result' : null,
        wikiSources.length ? 'the Wikipedia facts marked with an asterisk in the list below' : null,
      ].filter(Boolean) as string[])
    : ([
        'সংসদের সদস্য তালিকা',
        wonThisResult ? 'প্রকাশিত নির্বাচনী ফল' : null,
        wikiSources.length ? 'নিচের তালিকায় তারকাচিহ্নিত উইকিপিডিয়ার তথ্য' : null,
      ].filter(Boolean) as string[]);
  const introSources = en
    ? listEn(introParts)
    : introParts.length > 1 ? `${introParts.slice(0, -1).join(', ')} এবং ${introParts[introParts.length - 1]}` : introParts[0];

  // The member's seat, district and party as the page names them.
  const seatLabel = (s: typeof m.seat) => (en ? seatName(s, 'en') : s?.nameBn);
  const districtLabel = district ? (en ? districtName(district, 'en') : district.bn) : '';
  const wikiArticle = (u: string, many: boolean) =>
    en
      ? `${many ? (/\/\/bn\./.test(u) ? 'Bangla ' : 'English ') : ''}Wikipedia article`
      : `উইকিপিডিয়া নিবন্ধ${many ? (/\/\/bn\./.test(u) ? ' (বাংলা)' : ' (ইংরেজি)') : ''}`;

  return (
    <Page>
      <Breadcrumb
        items={[
          { href: '/', label: t('হোম', 'Home') },
          { href: '/mp', label: t('সংসদ সদস্য', 'MPs') },
          ...(district ? [{ href: `/jela/${district.slug}`, label: districtLabel }] : []),
          { label: en ? (m.seat ? seatName(m.seat, 'en') : personName(m, 'en')) : m.seat?.nameBn ?? (m.nameBn ?? '') },
        ]}
      />

      <header
        className="mt-5 bg-surface border border-rule rounded-card shadow-card p-5 sm:p-7 flex flex-col gap-4"
        style={{ borderTopColor: partyColor(m.party?.abbr), borderTopWidth: 4 }}
      >
        {/* Photo and name side by side on every screen; the rest runs below, in line with the name from sm up. */}
        <div className="flex items-center gap-4 sm:gap-7">
          <MemberPhoto
            src={m.photoUrl}
            alt={en ? personName(m, 'en') : m.nameBn ?? m.nameEn ?? ''}
            initial={memberInitial(m, t.lang)}
            size={120}
            sizeClass="w-[88px] h-[88px] sm:w-[120px] sm:h-[120px]"
            className="ring-4 ring-paper"
          />
          <div className="min-w-0 flex flex-col gap-1">
            <h1 className="display text-[26px] sm:text-[40px] leading-[1.15] text-balance wrap-anywhere">
              {name}
            </h1>
            {/* The name in the other language: English under the Bangla, Bangla (marked as such) under the English. */}
            {m.nameEn && m.nameBn && (
              en ? (
                <p lang="bn" className="text-[14px] sm:text-[15.5px] text-muted">{otherName(m, 'en')}</p>
              ) : (
                <p className="text-[14px] sm:text-[15.5px] text-muted">{nameEnDisplay(m.nameEn)}</p>
              )
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:ps-[148px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px]">
            {m.party && (
              <Link href={`/dol/${m.party.abbr.toLowerCase()}`} className="flex items-center gap-2 font-semibold hover:text-brand">
                <PartyDot abbr={m.party.abbr} />
                {en ? partyName(m.party, 'en') : m.party.nameBn ?? m.party.abbr}
              </Link>
            )}
            {m.seat && (
              <Link href={`/ason/${m.seat.slug}`} className="font-semibold text-brand hover:underline">
                {seatLabel(m.seat)}
              </Link>
            )}
            {district && (
              <Link href={`/jela/${district.slug}`} className="text-inksoft hover:text-brand">{en ? `${districtLabel} district` : `${district.bn} জেলা`}</Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {m.resignedOn ? (
              <span className="px-3 py-1 rounded-full bg-warnsoft text-warn text-[12.5px] font-bold">
                {en ? `Resigned, ${t.date(m.resignedOn)}` : `পদত্যাগ করেছেন, ${dateBn(m.resignedOn)}`}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-brandsoft text-brand text-[12.5px] font-bold">
                {t('বর্তমান সদস্য, ত্রয়োদশ সংসদ', 'Current member, 13th Parliament')}
              </span>
            )}
            {roles.map((r) => (
              <span key={r} className="px-3 py-1 rounded-full bg-ink text-white text-[12.5px] font-bold">{r}</span>
            ))}
            {badges.map((r) => (
              <span key={r} className="px-3 py-1 rounded-full bg-ink text-white text-[12.5px] font-bold">{r}</span>
            ))}
            {(m.termsCount ?? prior.length + 1) > 1 && (
              <span className="px-3 py-1 rounded-full border border-rule text-[12.5px] font-semibold text-inksoft">
                {en
                  ? `Elected ${timesEn(m.termsCount ?? prior.length + 1).toLowerCase()}`
                  : `মোট ${bn(m.termsCount ?? prior.length + 1)} বার নির্বাচিত`}
              </span>
            )}
            {m.seat?.reserved && (
              <span className="px-3 py-1 rounded-full border border-rule text-[12.5px] font-semibold text-inksoft">
                {t('সংরক্ষিত নারী আসন', 'Reserved seat for women')}
              </span>
            )}
          </div>
          {postsChecked && (
            <p className="-mt-1 text-[12.5px] text-muted">
              {t('সরকারি পদ সর্বশেষ যাচাই', 'Government posts last checked')}: {postsChecked},{' '}
              <Link href="/ministers" className="underline decoration-rule underline-offset-2 hover:text-brand">{t('মন্ত্রিসভা', 'Cabinet')}</Link>
            </p>
          )}
          {m.resignedOn && (
            <div role="note" className="flex items-start gap-2.5 rounded-lg border-s-[3px] border-warn bg-warnsoft px-4 py-3 text-[14.5px] leading-relaxed text-ink">
              <Icon name="info" size={18} className="mt-[3px] text-warn shrink-0" />
              {en ? (
                <span>
                  <strong className="font-bold">Resigned as a Member of Parliament on {t.date(m.resignedOn)}.</strong>{' '}
                  {m.seat && (
                    <>
                      {his.replace(/^./, (c) => c.toUpperCase())} seat,{' '}
                      <Link href={`/ason/${m.seat.slug}`} className="font-semibold text-brand hover:underline">{seatName(m.seat, 'en')}</Link>, is now
                      vacant.{' '}
                    </>
                  )}
                  <span className="text-inksoft">Source: the list of members of the Parliament of Bangladesh.</span>
                </span>
              ) : (
                <span>
                  <strong className="font-bold">{dateBn(m.resignedOn)} তারিখে সংসদ সদস্য পদ থেকে পদত্যাগ করেছেন।</strong>{' '}
                  {m.seat && (
                    <>
                      তাঁর আসন{' '}
                      <Link href={`/ason/${m.seat.slug}`} className="font-semibold text-brand hover:underline">{m.seat.nameBn}</Link>{' '}
                      এখন শূন্য।{' '}
                    </>
                  )}
                  <span className="text-inksoft">সূত্র: বাংলাদেশ জাতীয় সংসদের সদস্য তালিকা।</span>
                </span>
              )}
            </div>
          )}
          {(socials.length > 0 || fbNotice) && (
            <div className="flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-rule bg-surface text-[13px] font-semibold hover:border-brand hover:text-brand transition-colors"
                >
                  {isBrand(s.key) ? <BrandIcon name={s.key} size={14} /> : <Icon name={s.icon} size={14} />}
                  {s.label}
                  {s.unverified && <span className="text-[11.5px] font-medium text-muted">({unverifiedLabel(t.lang)})</span>}
                </a>
              ))}
              {fbNotice && (
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-rule text-[13px] text-muted">
                  <BrandIcon name="facebook" size={14} />
                  {fbNotice}
                </span>
              )}
            </div>
          )}
          <div className="pt-1 flex flex-col gap-3">
            <ShareButtons
              url={`${siteUrl}${t.href(path)}`}
              title={en ? `${name} | My MP` : `${m.nameBn ?? m.nameEn} | আমার এমপি`}
              text={
                en
                  ? [name, m.seat ? seatName(m.seat, 'en') : null, m.party ? partyName(m.party, 'en') : null].filter(Boolean).join(', ')
                  : [m.nameBn ?? m.nameEn, m.seat?.nameBn, m.party?.nameBn].filter(Boolean).join(', ')
              }
            />
            <CorrectionButton page={path} subject={en ? name || 'this member' : m.nameBn ?? m.nameEn ?? 'এই সদস্য'} />
          </div>
        </div>
      </header>

      <div className="pt-8 pb-14 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 lg:gap-10 items-start">
        <div className="flex flex-col gap-10 min-w-0">
          <section className="flex flex-col gap-4">
            <H2>{t('পরিচিতি', 'Profile')}</H2>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
            <p className="text-[16px] sm:text-[17px] leading-relaxed text-inksoft">{lead}</p>
            {intro.length > 0 && (
              <div className="flex flex-col gap-3">
                {intro.map((p, i) => (
                  <p key={i} className="text-[16px] sm:text-[17px] leading-relaxed text-inksoft">{p}</p>
                ))}
                <p className="text-[12.5px] text-muted leading-relaxed">
                  {en
                    ? `This introduction is put together from the information on this page: ${introSources}. It contains no assessment of our own.`
                    : `এই পরিচিতি এই পাতার তথ্য থেকে সাজানো: ${introSources}। নিজস্ব কোনো মূল্যায়ন এতে নেই।`}
                </p>
              </div>
            )}
            {showSummary && summary && (
              summary.translated && paragraphs.length === 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[16px] sm:text-[17px] leading-relaxed text-inksoft">{summary.text}</p>
                  <TranslatedNote bnHref={bnHref} />
                </div>
              ) : (
                <p className="text-[16px] sm:text-[17px] leading-relaxed text-inksoft">{summary.text}</p>
              )
            )}
            {paragraphs.length > 0 && (
              <Card className="p-5 sm:p-6 flex flex-col gap-3">
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-[15px] leading-[1.8] wrap-anywhere">{p}</p>
                ))}
                {bio?.translated && <TranslatedNote bnHref={bnHref} />}
                {bioSources.length > 0 && (
                  // A biography is only as good as where it came from, so it says.
                  <p className="pt-3 mt-1 border-t border-rulesoft text-[12.5px] text-muted leading-relaxed">
                    {t('সূত্র', plural(bioSources.length, 'Source', 'Sources'))}:{' '}
                    {bioSources.map((u, i) => (
                      <span key={u}>
                        <a href={u} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">{sourceLabel(u, t.lang)}</a>
                        {i < bioSources.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    {t('। ভুল দেখলে জানান।', '. If you see a mistake, let us know.')}
                  </p>
                )}
              </Card>
            )}
            {bioOnlyInBangla && (
              <Card className="p-5 sm:p-6 flex items-start gap-3">
                <Icon name="info" size={18} className="mt-0.5 text-brand shrink-0" />
                <p className="text-[15px] leading-relaxed">
                  {name}&rsquo;s biography is available in Bangla.{' '}
                  <a href={bnHref} hrefLang="bn" className="font-semibold text-brand underline decoration-rule underline-offset-2 hover:decoration-brand">
                    Read the biography in Bangla
                  </a>
                </p>
              </Card>
            )}
            {facts.length ? (
              <Card className="px-5 py-2 text-[14.5px]">
                {facts.map((b) => (
                  <Row key={b.label} label={b.label}>
                    {(b.lines ? b.value.split(/;\s*/) : [b.value]).map((part, i, all) => (
                      <span key={i} className={b.lines ? 'block' : undefined}>
                        {part}
                        {b.wiki && i === all.length - 1 && <sup className="ms-0.5 text-brand font-bold" title={t('উইকিপিডিয়া থেকে', 'From Wikipedia')}>*</sup>}
                      </span>
                    ))}
                  </Row>
                ))}
                {wikiSources.length > 0 && (
                  <p className="py-2.5 text-[12.5px] text-muted leading-relaxed">
                    {en ? (
                      <>
                        Facts marked <span className="text-brand font-bold">*</span> are taken from the member&rsquo;s{' '}
                        {wikiSources.map((u, i) => (
                          <span key={u}>
                            <a href={u} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">
                              {wikiArticle(u, wikiSources.length > 1)}
                            </a>
                            {i < wikiSources.length - 1 ? ' and ' : ''}
                          </span>
                        ))}{' '}
                        and have not been checked against the records of Parliament or the Election Commission. If you see a mistake, let us know.
                      </>
                    ) : (
                      <>
                        <span className="text-brand font-bold">*</span> চিহ্নিত তথ্য সদস্যের{' '}
                        {wikiSources.map((u, i) => (
                          <span key={u}>
                            <a href={u} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">
                              {wikiArticle(u, wikiSources.length > 1)}
                            </a>
                            {i < wikiSources.length - 1 ? ' ও ' : ''}
                          </span>
                        ))}{' '}
                        থেকে নেওয়া; সংসদ বা নির্বাচন কমিশনের নথির সঙ্গে মিলিয়ে দেখা হয়নি। ভুল দেখলে জানান।
                      </>
                    )}
                  </p>
                )}
              </Card>
            ) : (
              <Empty title={t('পরিচিতির তথ্য সংসদের তথ্যভান্ডারে নেই।', "Parliament's database has no profile details for this member.")} />
            )}
          </section>

          {m.seat && !m.seat.reserved && district && (
            <section className="flex flex-col gap-4" id="elaka">
              <H2>{t('নির্বাচনী এলাকা', 'Constituency')}</H2>
              <SeatMap
                geoUrl={`/geo/${district.slug}.json`}
                seat={{ slug: m.seat.slug, color: partyColor(m.party?.abbr) }}
                title={en ? seatName(m.seat, 'en') : m.seat.nameBn ?? m.seat.nameEn ?? ''}
                note={inLang(m.seat.boundaryBn, t.lang)}
                seatNames={Object.fromEntries(
                  seats
                    .filter((x) => districtOf(x)?.slug === district.slug)
                    .map((x) => [x.slug, en ? seatName(x, 'en') || x.slug : x.nameBn ?? x.nameEn ?? x.slug]),
                )}
              />
            </section>
          )}

          <section className="flex flex-col gap-4">
            <H2>{t('সংসদে মেয়াদ', 'Terms in Parliament')}</H2>
            <Card className="divide-y divide-rulesoft">
              <div className="px-5 py-3 flex items-center gap-4 bg-brandsoft/40">
                <span className="w-[150px] sm:w-[190px] shrink-0 text-[13.5px] font-semibold text-brand">{parliamentLabel(meta.parliamentNo, t.lang)}</span>
                <span className="grow min-w-0 flex flex-col">
                  <span className="font-semibold truncate">{en ? (m.seat ? seatName(m.seat, 'en') : 'Seat not stated') : m.seat?.nameBn ?? 'আসন উল্লেখ নেই'}</span>
                  <span className="text-[12.5px] text-muted">
                    {en
                      ? m.resignedOn ? `Resigned ${t.date(m.resignedOn)}` : 'Current term'
                      : m.resignedOn ? `পদত্যাগ করেছেন ${dateBn(m.resignedOn)}` : 'বর্তমান মেয়াদ'}
                  </span>
                </span>
                <span className="shrink-0 flex items-center gap-2 text-[13px] font-semibold text-inksoft">
                  <PartyDot abbr={m.party?.abbr} />
                  <span className="hidden sm:inline">{en ? (m.party ? partyName(m.party, 'en') : noParty('en')) : m.party?.nameBn ?? m.party?.abbr ?? 'দল নেই'}</span>
                  <span className="sm:hidden">{m.party?.abbr ?? noParty(t.lang)}</span>
                </span>
              </div>
              {prior.map((pt) => (
                <div key={pt.parliamentNo} className="px-5 py-3 flex items-center gap-4">
                  <span className="w-[150px] sm:w-[190px] shrink-0 text-[13.5px] text-muted">{parliamentLabel(pt.parliamentNo, t.lang)}</span>
                  {en ? (
                    <span className="grow min-w-0 flex flex-col">
                      <span className="font-semibold truncate">
                        {pt.seatNameEn ? seatName({ nameEn: titleCaseName(pt.seatNameEn), nameBn: pt.seatNameBn }, 'en') : 'Seat not stated'}
                      </span>
                    </span>
                  ) : (
                    <span className="grow min-w-0 flex flex-col">
                      <span className="font-semibold truncate">{pt.seatNameBn ?? pt.seatNameEn ?? 'আসন উল্লেখ নেই'}</span>
                      {pt.seatNameEn && pt.seatNameBn && <span className="text-[12.5px] text-muted truncate">{pt.seatNameEn}</span>}
                    </span>
                  )}
                  <span className="shrink-0 flex items-center gap-2 text-[13px] font-semibold text-inksoft">
                    <PartyDot abbr={pt.partyAbbr} />
                    <span className="hidden sm:inline">{en ? partyByAbbr(pt.partyAbbr, pt.partyNameBn, 'en') || noParty('en') : pt.partyNameBn ?? pt.partyAbbr ?? 'দল নেই'}</span>
                    <span className="sm:hidden">{pt.partyAbbr ?? noParty(t.lang)}</span>
                  </span>
                </div>
              ))}
            </Card>
            <p className="text-[12.5px] text-muted leading-relaxed">
              {en ? (
                <>
                  {m.termsCount
                    ? `According to the Parliament Secretariat, ${his === 'her' ? 'she' : 'he'} has been elected an MP ${m.termsCount === 1 ? 'once' : `${timesEn(m.termsCount).toLowerCase()} in all`}${
                        m.termsCount > 1
                          ? prior.length >= m.termsCount - 1
                            ? '. '
                            : prior.length === 0
                              ? `; details of the ${m.termsCount - 1 === 1 ? 'earlier term were' : `${m.termsCount - 1} earlier terms were`} not found in Parliament's database. `
                              : `; details of ${prior.length} of the ${m.termsCount - 1} earlier terms are given here. `
                          : '. '
                      }`
                    : prior.length
                      ? `According to Parliament's database, this is ${his} ${ordinalWordEn(prior.length + 1).toLowerCase()} term. `
                      : "Parliament's database has no earlier term for this member. "}
                  Parliament&rsquo;s database holds the records of the 4th, 5th and 7th to 12th Parliaments; it has no lists for the 1st to 3rd and
                  the 6th, so an earlier term in those, if any, does not appear here.
                </>
              ) : (
                <>
                  {m.termsCount
                    ? `সংসদ সচিবালয়ের তথ্য অনুযায়ী তিনি মোট ${bn(m.termsCount)} বার সংসদ সদস্য নির্বাচিত হয়েছেন${
                        m.termsCount > 1
                          ? prior.length >= m.termsCount - 1
                            ? '। '
                            : prior.length === 0
                              ? `; আগের ${bn(m.termsCount - 1)}টি মেয়াদের বিস্তারিত সংসদের তথ্যভান্ডারে পাওয়া যায়নি। `
                              : `; আগের ${bn(m.termsCount - 1)}টি মেয়াদের মধ্যে ${bn(prior.length)}টির বিস্তারিত এখানে আছে। `
                          : '। '
                      }`
                    : prior.length
                      ? `সংসদের তথ্যভান্ডার অনুযায়ী এটি ${parliamentOrdinal(prior.length + 1).replace(' সংসদ', '')} মেয়াদ। `
                      : 'সংসদের তথ্যভান্ডারে এই সদস্যের আগের কোনো মেয়াদ পাওয়া যায়নি। '}
                  সেখানে ৪র্থ, ৫ম ও ৭ম থেকে ১২শ সংসদের রেকর্ড আছে; ১ম থেকে ৩য় ও ৬ষ্ঠ সংসদের তালিকা নেই, তাই তার আগের মেয়াদ থাকলে এখানে দেখা যাবে না।
                </>
              )}
            </p>
          </section>

          {m.seat && !m.seat.reserved && (
            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-baseline gap-4">
                <H2>
                  {en
                    ? result && !wonThisResult
                      ? `Result for this seat in the ${year ? `${year} ` : ''}general election`
                      : `Votes won in the ${year ? `${year} ` : ''}election`
                    : result && !wonThisResult
                      ? `${year ? `${bn(year)} সালের সাধারণ নির্বাচনে` : 'সাধারণ নির্বাচনে'} এই আসনের ফল`
                      : `${year ? `${bn(year)} নির্বাচনে` : 'নির্বাচনে'} প্রাপ্ত ভোট`}
                </H2>
                <Link href={`/ason/${m.seat.slug}`} className="text-[14px] font-semibold text-brand hover:underline whitespace-nowrap">
                  {t('আসনের সব ফল', 'All results for the seat')} →
                </Link>
              </div>
              {result ? (
                <>
                  {!wonThisResult && (
                    <p className="text-[14.5px] leading-relaxed text-inksoft">
                      {t(
                        'এই আসনের সাধারণ নির্বাচনের বিজয়ী ও বর্তমান সংসদ সদস্যের নাম আলাদা। নিচের কার্ডের শেষে উৎসের বিবরণ দেখুন।',
                        "The winner of this seat's general election and the current MP have different names. See the details of the source at the end of the card below.",
                      )}
                    </p>
                  )}
                  <ResultCard r={result} />
                </>
              ) : (
                <Empty
                  title={t('এই আসনের ভোটের সংখ্যা এখনো যোগ হয়নি।', 'The vote counts for this seat have not been added yet.')}
                  body={t(
                    'সংসদের তথ্যভান্ডারে ভোটের সংখ্যা নেই। নির্বাচন কমিশনের গেজেট থেকে যাচাই করে যোগ করা হলে এখানে দেখা যাবে।',
                    "Parliament's database has no vote counts. They will appear here once they have been checked against the Election Commission's gazette and added.",
                  )}
                />
              )}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <H2 count={notices.length}>{t('সংসদ সচিবালয়ের প্রজ্ঞাপন', 'Parliament Secretariat notifications')}</H2>
            {notices.length ? (
              <Card className="divide-y divide-rulesoft">
                {notices.map((n) => (
                  <div key={n.id} className="px-5 py-3.5 flex items-start gap-4">
                    <span className="grow min-w-0 flex flex-col gap-0.5">
                      <span className="text-[14.5px] font-medium wrap-anywhere">{en ? n.titleEn ?? '' : bnText(n.titleBn) ?? n.titleEn}</span>
                      <span className="text-[12.5px] text-muted">
                        {en
                          ? `${t.date(n.date) ?? 'No date'}${n.category ? `, ${NOTICE_CATEGORY_EN[n.category] ?? n.category}` : ''}`
                          : `${dateBn(n.date) ?? 'তারিখ নেই'}${n.category ? `, ${NOTICE_CATEGORY_BN[n.category] ?? n.category}` : ''}`}
                      </span>
                    </span>
                    {n.pdfUrl && <DocLink href={n.pdfUrl}>PDF</DocLink>}
                  </div>
                ))}
              </Card>
            ) : (
              <Empty
                title={t('এই সদস্য সম্পর্কে সংসদ সচিবালয়ের কোনো প্রজ্ঞাপন নেই।', 'There are no Parliament Secretariat notifications about this member.')}
                body={t(
                  'সংসদ সচিবালয় কোনো সদস্যের নামে প্রজ্ঞাপন বা সরকারি আদেশ প্রকাশ করলে তা প্রতিদিন এখানে যুক্ত হয়।',
                  "When the Parliament Secretariat publishes a notification or government order in a member's name, it is added here in the daily update.",
                )}
              />
            )}
          </section>

          {m.seat && !m.seat.reserved && (
            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-baseline gap-4">
                <H2>{t('আসন', 'Seat')}: {seatLabel(m.seat)}</H2>
                <Link href={`/ason/${m.seat.slug}`} className="text-[14px] font-semibold text-brand hover:underline whitespace-nowrap">
                  {t('আসনের পাতা', 'Seat page')} →
                </Link>
              </div>
              {m.seat.boundaryBn ? (
                (() => {
                  const area = translated(m.seat.boundaryBn, t.lang);
                  return area ? (
                    <Card className="p-5 flex flex-col gap-2">
                      <span className="text-[12px] font-bold tracking-[1px] text-muted">{t('এলাকা', 'Area')}</span>
                      <p className="text-[15px] leading-relaxed">{area.text}</p>
                      {area.translated && <TranslatedNote bnHref={bnHref} />}
                    </Card>
                  ) : (
                    // English page, no English of the Election Commission's description yet.
                    <Card className="p-5 flex items-start gap-3">
                      <Icon name="info" size={18} className="mt-0.5 text-brand shrink-0" />
                      <p className="text-[15px] leading-relaxed">
                        The Election Commission&rsquo;s description of this seat&rsquo;s area is available in Bangla.{' '}
                        <a href={bnHref} hrefLang="bn" className="font-semibold text-brand underline decoration-rule underline-offset-2 hover:decoration-brand">
                          Read it in Bangla
                        </a>
                      </p>
                    </Card>
                  );
                })()
              ) : (
                <Empty title={t('এই আসনের এলাকার বিবরণ পাওয়া যায়নি।', "No description of this seat's area was found.")} />
              )}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <H2 count={onCommittees.length}>{t('সংসদীয় কমিটি', 'Parliamentary committees')}</H2>
            {onCommittees.length ? (
              <ul className="flex flex-col gap-2.5">
                {onCommittees.map((c) => {
                  const role = c.members.find((x) => x.memberId === m.id)?.role;
                  return (
                    <li key={c.id}>
                      <Link href={`/committee/${c.slug}`} className="bg-surface border border-rule rounded-card shadow-card px-5 py-4 flex items-center gap-4 hover:border-brand hover:shadow-lift transition-all">
                        <span className="grow display text-[15.5px]">{en ? committeeName(c, 'en') : c.nameBn ?? c.nameEn}</span>
                        {role && role !== 'Member' && (
                          <span className="shrink-0 px-2.5 py-1 rounded-full bg-brandsoft text-brand text-[12px] font-bold">
                            {en ? committeeRole(role, 'en') : role === 'Chairman' ? 'সভাপতি' : role}
                          </span>
                        )}
                        <Icon name="arrow" size={16} className="text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty
                title={t('হালনাগাদ কোনো কমিটিতে এই সদস্যের নাম নেই।', 'This member is not on any committee whose membership list has been updated.')}
                body={
                  en
                    ? `Of Parliament's ${cc.total} committees, the membership lists of ${cc.current} have been updated for the 13th Parliament. The rest will be added here when they are updated.`
                    : `সংসদের ${bn(cc.total)}টি কমিটির মধ্যে ${bn(cc.current)}টির সদস্য তালিকা ত্রয়োদশ সংসদের জন্য হালনাগাদ হয়েছে। বাকিগুলো হালনাগাদ হলে এখানে যুক্ত হবে।`
                }
              />
            )}
          </section>

          <section className="flex flex-col gap-4" id="songbad">
            <H2>{t('সংবাদ ও ভিডিও', 'News and videos')}</H2>
            <MemberFeed slug={m.slug} correctionHref={t.href('/jogajog')} />
            {memberStories.length > 0 && (
              <Link
                href={`/songbad?mp=${m.slug}`}
                className="self-start inline-flex items-center gap-2 h-11 px-5 rounded-full border border-ink font-semibold text-[15px] hover:bg-surface transition-colors"
              >
                {en
                  ? `${memberStories.length} ${plural(memberStories.length, 'news story', 'news stories')} checked by the editor`
                  : `সম্পাদকের যাচাই করা ${bn(memberStories.length)}টি খবর`}
                <Icon name="arrow" size={16} />
              </Link>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-3">
            <h2 className="display text-[18px] flex items-center gap-2"><Icon name="mail" size={17} className="text-brand" /> {t('যোগাযোগ', 'Contact')}</h2>
            {m.email ? (
              <>
                <p className="text-[13.5px] text-inksoft leading-relaxed">
                  {en ? (
                    `The official address published by Parliament. Messages go straight to the member; My MP does not reply on ${his} behalf.`
                  ) : (
                    <>
                      সংসদ কর্তৃক প্রকাশিত দাপ্তরিক ঠিকানা। বার্তা সরাসরি সদস্যের কাছে যাবে; আমার এমপি
                      তাঁর পক্ষে উত্তর দেয় না।
                    </>
                  )}
                </p>
                <a
                  href={`mailto:${m.email}`}
                  className="inline-flex items-center justify-center h-11 rounded-lg bg-brand text-white text-[14px] font-semibold hover:bg-branddark transition-colors wrap-anywhere px-3"
                >
                  {m.email}
                </a>
              </>
            ) : (
              <p className="text-[13.5px] text-inksoft leading-relaxed">
                {t('সংসদের তথ্যভান্ডারে এই সদস্যের কোনো দাপ্তরিক ইমেইল প্রকাশ করা নেই।', "Parliament's database publishes no official email address for this member.")}
                {m.seat?.reserved && t(' সংরক্ষিত আসনের সদস্যদের ক্ষেত্রে এটি সাধারণ।', ' This is common for members in reserved seats.')}
              </p>
            )}
            {(socials.length > 0 || fbNotice) && (
              <div className="flex flex-col gap-2 border-t border-rule pt-3">
                <span className="text-[12px] font-bold tracking-[1px] text-muted">{t('অফিসিয়াল সোশ্যাল মিডিয়া', 'Official social media')}</span>
                <ul className="flex flex-col gap-1.5">
                  {socials.map((s) => (
                    <li key={s.key}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer me" className="flex items-center gap-2 text-[14px] font-semibold hover:text-brand">
                        {isBrand(s.key) ? <BrandIcon name={s.key} size={15} /> : <Icon name={s.icon} size={15} className="text-muted" />}
                        {s.label}
                        {s.unverified && <span className="text-[12px] font-medium text-muted">({unverifiedLabel(t.lang)})</span>}
                        <Icon name="external" size={12} className="text-muted" />
                      </a>
                    </li>
                  ))}
                  {fbNotice && (
                    <li className="flex items-center gap-2 text-[14px] text-muted">
                      <BrandIcon name="facebook" size={15} />
                      {fbNotice}
                    </li>
                  )}
                </ul>
                {m.socialSource ? (
                  <span className="text-[12px] text-muted leading-relaxed">
                    {t('সূত্র: সদস্যের', 'Source: the member’s')}{' '}
                    {m.socialSource.split(' ').filter(Boolean).map((u, i, all) => (
                      <span key={u}>
                        <a href={u} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">
                          {wikiArticle(u, all.length > 1)}
                        </a>
                        {i < all.length - 1 ? t(' ও ', ' and ') : ''}
                      </span>
                    ))}
                    {t('। ভুল দেখলে জানান।', '. If you see a mistake, let us know.')}
                  </span>
                ) : (
                  <span className="text-[12px] text-muted leading-relaxed">{t('আমার এমপির সম্পাদক যাচাই করে যুক্ত করেছেন।', 'Checked and added by the editor of My MP.')}</span>
                )}
              </div>
            )}
          </Card>

          {partyMates.length > 0 && m.party && (
            <Card className="p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center gap-3">
                <h2 className="display text-[18px] flex items-center gap-2">
                  <PartyDot abbr={m.party.abbr} size={22} />
                  {t('একই দলের', 'Same party')}
                </h2>
                <Link href={`/dol/${m.party.abbr.toLowerCase()}`} className="text-[13px] font-semibold text-brand hover:underline">
                  {en ? `All ${partyMates.length + 1}` : `সব ${bn(partyMates.length + 1)}`} →
                </Link>
              </div>
              <ul className="flex flex-col divide-y divide-rulesoft text-[14.5px]">
                {partyMates.slice(0, 5).map((x) => (
                  <li key={x.id}>
                    <Link href={`/mp/${x.slug}`} className="flex justify-between gap-3 py-2 hover:text-brand">
                      <span className="truncate">{en ? personName(x, 'en') : x.nameBn ?? x.nameEn}</span>
                      <span className="text-muted shrink-0">{seatLabel(x.seat)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {sameDistrict.length > 0 && district && (
            <Card className="p-5 flex flex-col gap-3">
              <div className="flex justify-between items-baseline">
                <h2 className="display text-[18px]">{en ? `Other seats in ${districtLabel} district` : `${district.bn} জেলার অন্য আসন`}</h2>
                <Link href={`/jela/${district.slug}`} className="text-[13px] font-semibold text-brand hover:underline">{t('জেলা', 'District')} →</Link>
              </div>
              <ul className="flex flex-col divide-y divide-rulesoft text-[14.5px]">
                {sameDistrict.slice(0, 6).map((x) => (
                  <li key={x.id}>
                    <Link href={`/ason/${x.seat?.slug}`} className="flex justify-between items-center gap-3 py-2 hover:text-brand">
                      <span className="shrink-0">{seatLabel(x.seat)}</span>
                      <span
                        className="min-w-0 flex items-center justify-end gap-2 text-muted"
                        title={en ? (x.party ? partyName(x.party, 'en') : undefined) : x.party?.nameBn ?? undefined}
                      >
                        <span className="truncate">{en ? personName(x, 'en') : x.nameBn ?? x.nameEn}</span>
                        <PartyDot abbr={x.party?.abbr} size={18} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="p-4 rounded-card bg-brandsoft flex gap-3">
            <Icon name="info" size={18} className="text-brand mt-0.5" />
            {en ? (
              <span className="text-[13px] leading-relaxed text-branddark">
                Source: the Parliament of Bangladesh. Updated daily from Parliament&rsquo;s database, most recently on {t.date(meta.syncedAt)}.
                If you see a mistake, <Link href="/jogajog" className="font-semibold underline">let us know</Link>.
              </span>
            ) : (
              <span className="text-[13px] leading-relaxed text-branddark">
                তথ্যসূত্র বাংলাদেশ জাতীয় সংসদ। সংসদের তথ্যভান্ডার থেকে প্রতিদিন হালনাগাদ, সর্বশেষ {dateBn(meta.syncedAt)}।
                ভুল দেখলে <Link href="/jogajog" className="font-semibold underline">আমাদের জানান</Link>।
              </span>
            )}
          </div>
        </aside>
      </div>
    </Page>
  );
}
