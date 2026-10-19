import type { Metadata } from 'next';
import Link from '@/i18n/Link';
import { langAlternates, fitDescription } from '@/lib/seo';
import { pageShare } from '@/lib/og/pages';
import { members, parties, seats, getMemberById, partyColor, statistics, dateBn, RESERVED_SEATS } from '@/lib/data';
import { reservedMembers as reserved, reservedByParty as byParty, reservedQuestions as questions } from '@/lib/reservedSeats';
import { Page, PageHead, Stat, Card, MemberCard, PartyDot, DocLink } from '@/components/ui';
import ShareButtons from '@/components/ShareButtons';
import { siteUrl } from '@/lib/site';
import { getT } from '@/i18n/server';
import { partyName, partyShort, personName, seatName } from '@/i18n/names';

/**
 * The fifty seats reserved for women, on one page.
 *
 * Each of them already has a seat page and a member page, but nowhere showed
 * the fifty together: who holds them, which party each came from and how they
 * are filled. That last question is the one readers ask, because these members
 * are not elected in a constituency and the ballot never carries their names.
 * So the page shows the fifty at a glance, the sharing out against each
 * party's general seats, the steps by which a member is chosen, and the
 * members under their parties.
 */

const GENERAL_SEATS = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    alternates: langAlternates(t.lang, '/sangrakkhito-ason'),
    ...pageShare('sangrakkhito-ason', t),
    title: t('সংরক্ষিত নারী আসনের এমপি তালিকা', 'Reserved seats for women: list of women MPs'),
    description: fitDescription(
      t(
        `ত্রয়োদশ জাতীয় সংসদের ${t.n(RESERVED_SEATS)}টি সংরক্ষিত নারী আসনের সংসদ সদস্যদের তালিকা, কে কোন দলের এবং কোন আসনের। সংরক্ষিত আসন কীভাবে ভাগ হয় ও কারা ভোট দেন, তা-ও এই পাতায়।`,
        `The MPs in the ${RESERVED_SEATS} reserved seats for women in the 13th Parliament, with each one's party and seat, and how the seats are shared out and who elects them.`,
      ),
    ),
  };
}

/** Each sitting member for a general seat, counted by party: what the reserved seats are shared against. */
function generalByParty(): Map<string, number> {
  const c = new Map<string, number>();
  for (const m of members) {
    if (!m.seat || m.seat.reserved || m.resignedOn || !m.party) continue;
    c.set(m.party.abbr, (c.get(m.party.abbr) ?? 0) + 1);
  }
  return c;
}

export default async function ReservedSeatsPage() {
  const t = await getT();
  const stats = statistics();
  const filled = reserved.length;
  const QUESTIONS = questions(t);
  const FAQ_LD = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QUESTIONS.map((x) => ({
      '@type': 'Question',
      name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.a },
    })),
  };

  // The fifty in seat order, each with its sitting member, or the member who
  // resigned it while it stands vacant.
  const sitting = new Map(reserved.map((m) => [m.seat!.no, m]));
  const reservedSeats = seats.filter((s) => s.reserved).sort((a, b) => a.no - b.no);
  const tiles = reservedSeats.map((s) => {
    const m = sitting.get(s.no);
    const former = !m && s.memberId ? getMemberById(s.memberId) : undefined;
    return { seat: s, m, former };
  });
  const vacant = tiles.filter((x) => !x.m);
  const womenShare = Math.round((stats.women / (GENERAL_SEATS + RESERVED_SEATS)) * 100);

  // The sharing out: each party's general seats against the reserved seats it holds.
  const general = generalByParty();
  const shareRows = parties
    .map((p) => ({ party: p, general: general.get(p.abbr) ?? 0, held: byParty.find((x) => x.party.abbr === p.abbr)?.held ?? 0 }))
    .filter((r) => r.general > 0 || r.held > 0)
    .sort((a, b) => b.general - a.general || b.held - a.held);
  const perSeat = GENERAL_SEATS / RESERVED_SEATS;

  const nameOf = (m: { nameBn?: string | null; nameEn?: string | null }) => (t.en ? personName(m, 'en') : m.nameBn ?? '');
  const seatLabel = (s: (typeof reservedSeats)[number]) => (t.en ? seatName(s, 'en') : s.nameBn ?? '');
  const one = (n: number) => (Number.isInteger(n) ? t.n(n) : t.n(n.toFixed(1)));

  const STEPS = [
    {
      n: 1,
      title: t('সাধারণ নির্বাচন', 'The general election'),
      body: t(
        `ভোটাররা ${t.n(GENERAL_SEATS)}টি সাধারণ আসনে সংসদ সদস্য বেছে নেন। কোন দল কতটি আসন পেল, তা থেকেই সংরক্ষিত আসনের ভাগ ঠিক হয়।`,
        `Voters choose the Members of Parliament for the ${GENERAL_SEATS} general seats. How many seats each party won decides its share of the reserved seats.`,
      ),
    },
    {
      n: 2,
      title: t('আনুপাতিক ভাগ', 'Shared in proportion'),
      body: t(
        `${t.n(GENERAL_SEATS)}টি সাধারণ আসনের বিপরীতে ${t.n(RESERVED_SEATS)}টি সংরক্ষিত আসন, অর্থাৎ প্রতি ${t.n(perSeat)}টি সাধারণ আসনে প্রায় একটি। দলগুলো তাদের ভাগের আসনে নারী প্রার্থী মনোনয়ন দেয়।`,
        `${RESERVED_SEATS} reserved seats against ${GENERAL_SEATS} general seats: about one for every ${perSeat} general seats. Each party nominates women for its share.`,
      ),
    },
    {
      n: 3,
      title: t('সংসদ সদস্যদের ভোট', "The members' vote"),
      body: t(
        `সাধারণ আসনে নির্বাচিত সংসদ সদস্যরাই এই আসনের ভোটার। সাধারণ ভোটারের ব্যালটে এই সদস্যদের নাম থাকে না।`,
        `The members elected to the general seats are the voters for these seats. Their names never appear on an ordinary voter's ballot.`,
      ),
    },
  ];

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <PageHead
        eyebrow={t('ত্রয়োদশ জাতীয় সংসদ', '13th Parliament')}
        title={t('সংরক্ষিত নারী আসন', 'Reserved seats for women')}
        lede={t(
          `সংবিধান অনুযায়ী সংসদে নারীদের জন্য ${t.n(RESERVED_SEATS)}টি আসন সংরক্ষিত। এই আসনে সাধারণ ভোটাররা ভোট দেন না; সাধারণ আসনে জেতা দলগুলোর আনুপাতিক হারে আসনগুলো ভাগ হয়, আর নির্বাচিত সংসদ সদস্যরা ভোট দিয়ে সদস্য বেছে নেন।`,
          `Under the Constitution, ${RESERVED_SEATS} seats in Parliament are reserved for women. Ordinary voters do not vote for these seats: they are shared among the parties in proportion to the general seats each won, and the elected Members of Parliament vote to choose the members.`,
        )}
        aside={
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full md:w-auto">
            <Stat
              label={t('সংরক্ষিত আসন', 'Reserved seats')}
              value={t.n(RESERVED_SEATS)}
              note={vacant.length ? t(`${t.n(filled)}টি পূর্ণ, ${t.n(vacant.length)}টি শূন্য`, `${filled} filled, ${vacant.length} vacant`) : t('সবগুলো পূর্ণ', 'All filled')}
            />
            <Stat
              label={t('মোট নারী সদস্য', 'Women members')}
              value={t.n(stats.women)}
              note={t(`সাধারণ আসনে ${t.n(stats.womenTerritorial)} জন`, `${stats.womenTerritorial} in general seats`)}
            />
            <Stat
              label={t('সংসদে নারী', 'Women in the House')}
              value={t(`${t.n(womenShare)}%`, `${womenShare}%`)}
              note={t(`${t.n(GENERAL_SEATS + RESERVED_SEATS)} জনের মধ্যে`, `of ${GENERAL_SEATS + RESERVED_SEATS} members`)}
            />
          </div>
        }
      />

      <div className="mt-5">
        <ShareButtons
          url={`${siteUrl}${t.href('/sangrakkhito-ason')}`}
          title={t('সংরক্ষিত নারী আসন | আমার এমপি', 'Reserved seats for women | My MP')}
          text={t(
            `ত্রয়োদশ জাতীয় সংসদের ${t.n(RESERVED_SEATS)}টি সংরক্ষিত নারী আসনের সংসদ সদস্যরা`,
            `The Members of Parliament for the ${RESERVED_SEATS} reserved seats for women in the 13th Parliament`,
          )}
        />
      </div>

      {/* The fifty at a glance: one tile a seat, its holder's party symbol. */}
      <Card className="mt-8 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          <div className="min-w-0 lg:flex-[1.4]">
            <h2 className="display text-[19px] sm:text-[21px]">{t(`${t.n(RESERVED_SEATS)}টি আসন এক নজরে`, `The ${RESERVED_SEATS} seats at a glance`)}</h2>
            <p className="mt-1 text-[13.5px] text-muted leading-relaxed">
              {t('প্রতিটি ঘর একটি আসন, আসন নম্বর অনুযায়ী, সদস্যের দলের প্রতীকে। ঘরে চাপলে সদস্যের পাতা খুলবে।', "Each tile is a seat, in seat order, with its member's party symbol. Tap one for the member's page.")}
            </p>
            <ul className="mt-4 grid grid-cols-10 gap-1.5 sm:gap-2 max-w-[520px]">
              {tiles.map(({ seat, m, former }) => {
                const color = m ? partyColor(m.party?.abbr) : null;
                const label = m
                  ? `${seatLabel(seat)}: ${nameOf(m)}`
                  : `${seatLabel(seat)}: ${t('শূন্য', 'vacant')}${former ? ` (${nameOf(former)} ${t('পদত্যাগ করেছেন', 'resigned')})` : ''}`;
                return (
                  <li key={seat.no}>
                    <Link
                      href={m ? `/mp/${m.slug}` : `/ason/${seat.slug}`}
                      title={label}
                      aria-label={label}
                      className={`relative aspect-square rounded-[8px] grid place-items-center border transition-transform hover:-translate-y-0.5 hover:shadow-lift ${m ? 'bg-white' : 'bg-sunk border-dashed border-muted'}`}
                      style={m ? { borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, boxShadow: `inset 0 -3px 0 ${color}` } : undefined}
                    >
                      {m ? <PartyDot abbr={m.party?.abbr} size={20} /> : <span aria-hidden="true" className="text-[11px] font-bold text-muted">{t('শূন্য', '–')}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {vacant.map(({ seat, former }) => (
              <p key={seat.no} className="mt-3 text-[13px] text-inksoft">
                {former?.resignedOn
                  ? t(
                      `${seatLabel(seat)} এখন শূন্য: ${nameOf(former)} ${dateBn(former.resignedOn)} পদত্যাগ করেছেন।`,
                      `${seatLabel(seat)} is vacant: ${nameOf(former)} resigned on ${t.date(former.resignedOn)}.`,
                    )
                  : t(`${seatLabel(seat)} এখন শূন্য।`, `${seatLabel(seat)} is vacant.`)}
              </p>
            ))}
          </div>

          <div className="min-w-0 lg:flex-1 lg:border-s lg:border-rulesoft lg:ps-10">
            <h3 className="display text-[16px]">{t('কোন দল কতটি পেয়েছে', 'How many each party holds')}</h3>
            <ul className="mt-3 flex flex-col gap-1">
              {byParty.map(({ party, held }) => (
                <li key={party.abbr}>
                  <Link href={`/dol/${party.slug}`} className="group flex items-center gap-3 py-2 border-b border-rulesoft last:border-0">
                    <PartyDot abbr={party.abbr} size={24} />
                    <span className="grow min-w-0 flex flex-col">
                      <span className="truncate text-[14.5px] font-semibold text-ink group-hover:text-brand">{t.en ? partyName(party, 'en') : party.nameBn ?? party.abbr}</span>
                      <span aria-hidden="true" className="mt-1.5 h-1.5 rounded-full bg-sunk overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${(held / RESERVED_SEATS) * 100}%`, background: partyColor(party.abbr) }} />
                      </span>
                    </span>
                    <span className="display tnum shrink-0 text-[20px] text-ink w-10 text-end">{t.n(held)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* How a member is chosen. */}
      <section className="mt-10">
        <h2 className="display text-[19px] sm:text-[21px]">{t('কীভাবে নির্বাচিত হন', 'How the members are chosen')}</h2>
        <ol className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {STEPS.map((s) => (
            <li key={s.n} className="relative bg-surface border border-rule rounded-card shadow-card p-5 flex flex-col gap-2">
              <span aria-hidden="true" className="w-9 h-9 rounded-full bg-brandsoft text-brand display text-[17px] grid place-items-center">{t.n(s.n)}</span>
              <h3 className="display text-[16.5px]">{s.title}</h3>
              <p className="text-[14px] leading-relaxed text-inksoft text-pretty">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The sharing out, party by party. */}
      <section className="mt-10">
        <h2 className="display text-[19px] sm:text-[21px]">{t('আনুপাতিক ভাগের হিসাব', 'The sharing out, party by party')}</h2>
        <p className="mt-1 text-[13.5px] text-muted leading-relaxed max-w-[720px]">
          {t(
            `প্রতিটি দলের সাধারণ আসনকে ${t.n(perSeat)} দিয়ে ভাগ করলে মোটামুটি তার সংরক্ষিত আসনের ভাগ পাওয়া যায়। ভগ্নাংশ আর স্বতন্ত্র ও ছোট দলের সদস্যদের জন্য আইনের নিজস্ব নিয়ম আছে, তাই হিসাব সব সময় হুবহু মেলে না।`,
            `Dividing each party's general seats by ${perSeat} gives roughly its share of the reserved seats. The law has its own rules for fractions and for independents and small parties, so the figures do not always match exactly.`,
          )}
        </p>
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-[14px]">
            <thead>
              <tr className="text-start text-[12px] font-bold tracking-[0.5px] text-muted border-b border-rule">
                <th className="text-start font-bold px-4 sm:px-5 py-3">{t('দল', 'Party')}</th>
                <th className="text-end font-bold px-3 py-3">{t('সাধারণ আসন', 'General seats')}</th>
                <th className="text-end font-bold px-3 py-3">{t(`÷ ${t.n(perSeat)}`, `÷ ${perSeat}`)}</th>
                <th className="text-end font-bold px-4 sm:px-5 py-3">{t('সংরক্ষিত আসন', 'Reserved seats')}</th>
              </tr>
            </thead>
            <tbody>
              {shareRows.map((r) => (
                <tr key={r.party.abbr} className="border-b border-rulesoft last:border-0">
                  <td className="px-4 sm:px-5 py-2.5">
                    <Link href={`/dol/${r.party.slug}`} className="inline-flex items-center gap-2.5 font-semibold text-ink hover:text-brand">
                      <PartyDot abbr={r.party.abbr} size={20} />
                      {partyShort(r.party, t.lang)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-end tnum text-inksoft">{t.n(r.general)}</td>
                  <td className="px-3 py-2.5 text-end tnum text-muted">{one(r.general / perSeat)}</td>
                  <td className="px-4 sm:px-5 py-2.5 text-end tnum">
                    <span className={`inline-block min-w-[2.25rem] px-2 py-0.5 rounded-full text-[13.5px] font-bold ${r.held ? 'bg-brandsoft text-brand' : 'text-muted'}`}>{t.n(r.held)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* The members, under their parties. */}
      <section className="mt-12">
        <h2 className="display text-[19px] sm:text-[21px]">
          {t('সংরক্ষিত আসনের সংসদ সদস্য', 'Members of Parliament for the reserved seats')}
          <span className="ms-2 text-[14px] text-muted font-normal tnum">{t(`${t.n(filled)} জন`, String(filled))}</span>
        </h2>
        <div className="mt-5 flex flex-col gap-8">
          {byParty.map(({ party, held }) => (
            <div key={party.abbr}>
              <h3 className="flex items-center gap-2.5 pb-3 mb-4 border-b border-rule">
                <PartyDot abbr={party.abbr} size={26} />
                <span className="display text-[17px]">{t.en ? partyName(party, 'en') : party.nameBn ?? party.abbr}</span>
                <span className="tnum text-[13.5px] font-semibold text-muted">{t(`${t.n(held)} জন`, String(held))}</span>
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {reserved
                  .filter((m) => m.party?.abbr === party.abbr)
                  .map((m) => (
                    <li key={m.id}>
                      <MemberCard m={m} badge={(t.en ? seatName(m.seat, 'en') : m.seat?.nameBn) || undefined} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 pb-12">
        <h2 className="display text-[19px] sm:text-[21px]">{t('প্রশ্ন ও উত্তর', 'Questions and answers')}</h2>
        <div className="mt-4 flex flex-col gap-2.5">
          {QUESTIONS.map((x, i) => (
            <details key={x.q} open={i === 0} className="group bg-surface border border-rule rounded-card shadow-card">
              <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4">
                <h3 className="display text-[16px]">{x.q}</h3>
                <span aria-hidden="true" className="shrink-0 w-7 h-7 rounded-full bg-sunk grid place-items-center text-muted transition-transform group-open:rotate-45 text-[18px] leading-none">+</span>
              </summary>
              <p className="px-5 pb-5 -mt-1 text-[14.5px] leading-relaxed text-inksoft text-pretty">{x.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted leading-relaxed">
          {t(
            'সূত্র: গণপ্রজাতন্ত্রী বাংলাদেশের সংবিধান, ৬৫ অনুচ্ছেদ; সদস্যদের নাম ও দল বাংলাদেশ জাতীয় সংসদের তথ্য থেকে।',
            "Sources: the Constitution of the People's Republic of Bangladesh, Article 65; members' names and parties from the Parliament of Bangladesh.",
          )}{' '}
          <DocLink href="https://www.parliament.gov.bd">parliament.gov.bd</DocLink>
        </p>
      </section>
    </Page>
  );
}
