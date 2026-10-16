import Link from 'next/link';
import { bn, initial, partyColor, type Member, type Party } from '@/lib/data';
import MemberPhoto from './MemberPhoto';
import PartyBadge from './PartyBadge';
import Icon from './Icon';
import { siteUrl } from '@/lib/site';
import { partyLogo } from '@/lib/partyLogos';

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1200px] px-4 sm:px-5">{children}</div>;
}

export function PageHead({
  eyebrow,
  title,
  lede,
  aside,
  mark,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  aside?: React.ReactNode;
  /** A logo beside the heading (a party's page). */
  mark?: React.ReactNode;
}) {
  const text = (
    <div className="flex flex-col gap-2.5 min-w-0">
      {eyebrow && (
        <span className="text-[12.5px] font-bold tracking-[1.5px] text-brand">{eyebrow}</span>
      )}
      <h1 className="display text-[30px] sm:text-[44px] leading-[1.15] text-balance wrap-anywhere">{title}</h1>
      {lede && <p className="text-[15.5px] sm:text-[17px] leading-relaxed text-inksoft max-w-[660px] text-pretty">{lede}</p>}
    </div>
  );
  return (
    <div className="pt-8 sm:pt-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
      {mark ? <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 min-w-0">{mark}{text}</div> : text}
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** A section heading with an optional link on the right, used on every listing page. */
export function SectionHead({
  title,
  href,
  linkLabel,
  count,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  count?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="display text-[22px] sm:text-[26px] flex items-center gap-2.5">
        <span aria-hidden="true" className="w-1.5 h-[0.85em] rounded-full bg-gradient-to-b from-logo to-brand shrink-0" />
        {title}
        {count && <span className="ms-2 text-[15px] font-semibold text-muted tnum">{count}</span>}
      </h2>
      {href && (
        <Link href={href} className="shrink-0 text-[14px] font-semibold text-brand hover:underline whitespace-nowrap">
          {linkLabel ?? 'সব দেখুন'} →
        </Link>
      )}
    </div>
  );
}

export function Card({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** An anchor, for a link to this card. */
  id?: string;
}) {
  return (
    <div id={id} className={`reveal bg-surface border border-rule rounded-card shadow-card ${className}`}>{children}</div>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-1">
      <span className="text-[11.5px] sm:text-[12px] font-bold tracking-[1px] text-muted">{label}</span>
      <span className="display tnum text-[26px] sm:text-[34px] leading-none">{value}</span>
      {note && <span className="text-[12.5px] text-muted leading-snug">{note}</span>}
    </Card>
  );
}

/**
 * A party beside its name: the party's logo where one is on record, a person
 * for an independent, and the party colour for anyone else (the parties of
 * earlier parliaments). Always a size-square box, so names in a list line up.
 */
export function PartyDot({ abbr, size = 18 }: { abbr: string | null | undefined; size?: number }) {
  return <PartyBadge abbr={abbr} color={partyColor(abbr)} size={size} />;
}

/** A party's logo on a white tile: the party list and the party's own page. */
export function PartyMark({ abbr, size = 52 }: { abbr: string; size?: number }) {
  const logo = partyLogo(abbr);
  return (
    <span
      aria-hidden="true"
      className="inline-grid place-items-center shrink-0 rounded-xl border border-rule bg-white overflow-hidden"
      style={{ width: size, height: size, padding: Math.round(size * 0.1) }}
    >
      {logo ? (
        // Lazy even at the top of a page: an eager <img> makes every page that links
        // to /dol preload all ten logos when Next prefetches it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo.src} alt="" width={logo.width} height={logo.height} loading="lazy" decoding="async" className="w-full h-full object-contain" />
      ) : (
        <PartyDot abbr={abbr} size={Math.round(size * 0.66)} />
      )}
    </span>
  );
}

/** Where a party's logo came from and on what terms; a CC BY licence needs its author named. */
export function LogoCredit({ abbr }: { abbr: string }) {
  const logo = partyLogo(abbr);
  if (!logo) return null;
  const where = logo.page.includes('commons.wikimedia.org') ? 'উইকিমিডিয়া কমন্স' : 'বাংলা উইকিপিডিয়া';
  const link = 'underline decoration-rule underline-offset-2 hover:text-brand';
  return (
    <span>
      <a href={logo.page} target="_blank" rel="noopener noreferrer" className={link}>{where}</a>
      {logo.author && <>, {logo.author}</>}
      {', '}
      {logo.licenceUrl ? <a href={logo.licenceUrl} target="_blank" rel="noopener noreferrer" className={link}>{logo.licence}</a> : logo.licence}
    </span>
  );
}

/** A link to a document on the source's own server, always opened in a new tab. */
export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brandsoft text-brand text-[13px] font-bold hover:bg-brand hover:text-white transition-colors"
    >
      {children}
      <Icon name="external" size={13} />
    </a>
  );
}

/** A member as a card: photo beside the name on a phone, photo above it in a grid from sm up. */
export function MemberCard({ m, badge }: { m: Member; badge?: string }) {
  const badgeClass = 'px-2.5 py-1 rounded-full bg-ink text-white text-[11.5px] font-bold whitespace-nowrap';
  return (
    <Link
      href={`/mp/${m.slug}`}
      className="reveal group bg-surface border border-rule rounded-card shadow-card p-4 sm:p-5 flex sm:flex-col gap-3.5 sm:gap-4 hover:border-brand hover:shadow-lift hover:-translate-y-0.5 transition-all"
      style={{ borderTopColor: partyColor(m.party?.abbr), borderTopWidth: 3 }}
    >
      <div className="shrink-0 flex items-start justify-between gap-3">
        <MemberPhoto src={m.photoUrl} alt="" initial={initial(m)} size={64} sizeClass="w-14 h-14 sm:w-16 sm:h-16" />
        {badge && <span className={`hidden sm:inline-block ${badgeClass}`}>{badge}</span>}
      </div>
      <span className="grow min-w-0 flex flex-col gap-1">
        {badge && <span className={`sm:hidden self-start mb-0.5 ${badgeClass}`}>{badge}</span>}
        <span className="display text-[16.5px] sm:text-[17px] leading-snug sm:min-h-[2.6em] group-hover:text-brand transition-colors">
          {m.nameBn || m.nameEn}
        </span>
        <span className="text-[13.5px] text-muted">
          {m.seat?.nameBn ?? 'আসন নেই'}
        </span>
        <span className="flex items-center gap-2 text-[13px] font-semibold text-inksoft mt-1 sm:mt-auto sm:pt-3">
          <PartyDot abbr={m.party?.abbr} />
          <span className="truncate">{m.party?.nameBn ?? m.party?.abbr ?? 'দল নেই'}</span>
        </span>
      </span>
    </Link>
  );
}

export function MemberRow({ m }: { m: Member }) {
  return (
    <Link
      href={`/mp/${m.slug}`}
      className="bg-surface border border-rule rounded-card shadow-card ps-3 pe-4 py-3 flex items-center gap-3.5 hover:border-brand hover:shadow-lift transition-all"
      style={{ borderInlineStartColor: partyColor(m.party?.abbr), borderInlineStartWidth: 3 }}
    >
      <MemberPhoto src={m.photoUrl} alt="" initial={initial(m)} size={44} />
      <span className="grow min-w-0 flex flex-col gap-0.5">
        <span className="display text-[15.5px] truncate">{m.nameBn || m.nameEn}</span>
        <span className="text-[13px] text-muted truncate">
          {[m.seat?.nameBn, m.party?.abbr].filter(Boolean).join(', ')}
        </span>
      </span>
      <Icon name="arrow" size={16} className="text-muted" />
    </Link>
  );
}

/**
 * Seat composition. The caption has to say which of the two counts this is:
 * the constituency result and the seated parliament are different numbers,
 * because the fifty reserved seats are allocated after the general result.
 */
export function CompositionBar({
  parties,
  total,
  majority,
}: {
  parties: Party[];
  total: number;
  majority: number;
}) {
  const top = parties.slice(0, 4);
  const restSeats = parties.slice(4).reduce((n, p) => n + p.seats, 0);
  const rows = [
    ...top.map((p) => ({ label: p.nameBn ?? p.abbr, abbr: p.abbr, seats: p.seats })),
    ...(restSeats
      ? [{ label: `অন্য ${bn(parties.length - 4)} দল`, abbr: 'other', seats: restSeats }]
      : []),
  ];
  const majorityPct = (majority / total) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative pt-5">
        <div
          className="absolute top-3.5 bottom-0 border-l-[1.5px] border-dashed border-ink"
          style={{ left: `${majorityPct}%` }}
          aria-hidden="true"
        />
        <div
          className="absolute top-0 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap"
          style={{ left: `${majorityPct}%` }}
        >
          সংখ্যাগরিষ্ঠতা {bn(majority)}
        </div>
        <div
          className="bar-fill flex gap-0.5 h-[30px] rounded-md overflow-hidden"
          role="img"
          aria-label={rows.map((r) => `${r.label} ${r.seats}`).join(', ')}
        >
          {rows.map((r) => (
            <div
              key={r.abbr}
              className="flex items-center ps-2.5 text-[13px] font-bold tnum overflow-hidden"
              style={{
                flex: `${r.seats} 1 0`,
                background: partyColor(r.abbr === 'other' ? null : r.abbr),
                color: r.abbr === 'BJEI' ? 'var(--color-ink)' : '#fff',
              }}
            >
              {r.seats / total > 0.06 ? bn(r.seats) : ''}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[14px]">
        {rows.map((r) => (
          <div key={r.abbr} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="w-3 h-3 rounded-[3px] shrink-0"
              style={{ background: partyColor(r.abbr === 'other' ? null : r.abbr) }}
            />
            <span className="grow truncate">{r.label}</span>
            <span className="font-bold tnum">{bn(r.seats)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Used wherever a source has no data, so a gap never looks like a zero. */
export function Empty({ title, body }: { title: string; body?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 p-5 sm:p-6 rounded-card border-[1.5px] border-dashed border-rule bg-surface/60">
      <Icon name="info" size={24} className="text-muted mt-0.5" />
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold">{title}</span>
        {body && <span className="text-[14px] text-muted leading-relaxed">{body}</span>}
      </div>
    </div>
  );
}

export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-5 bg-warnsoft border-s-[3px] border-warn rounded-e-lg">
      <span className="block font-semibold text-warn mb-1">{title}</span>
      <span className="block text-[14px] leading-relaxed text-inksoft">{children}</span>
    </div>
  );
}

/** The trail above a page, and the same trail as BreadcrumbList data for search engines. */
export function Breadcrumb({ items }: { items: { href?: string; label: string }[] }) {
  const trail = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: `${siteUrl}${it.href === '/' ? '' : it.href}` } : {}),
    })),
  };
  return (
    <nav aria-label="পথ" className="flex flex-wrap gap-2 text-[13.5px] text-muted pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(trail) }} />
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="flex gap-2">
          {it.href ? <Link href={it.href} className="hover:text-brand">{it.label}</Link>
            : <span className="text-ink">{it.label}</span>}
          {i < items.length - 1 && <span aria-hidden="true">›</span>}
        </span>
      ))}
    </nav>
  );
}
