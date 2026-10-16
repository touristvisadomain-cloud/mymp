/**
 * The header search's index, public/search-index.json: every seat, member,
 * party and district, by name in both scripts. Written by scripts/sync.mjs
 * from the snapshot it has just built; kept apart so the index can be rebuilt
 * from data/*.json alone (no network, no database).
 *
 * One row per entry: [type, Bangla name, English name, url, Bangla subtitle,
 * English subtitle]. The English name is the one the English pages show
 * (src/i18n/names.ts: "Chapai Nawabganj-1", "Women's Seat-1", title-cased
 * member names, the parties' own English names); the browser builds the match
 * keys from both names (src/lib/search.ts).
 *
 * src/i18n/names.ts is TypeScript. Node reads it directly from 22.18 on; on an
 * older Node the English column falls back to the source's own English, as it
 * was before the English pages.
 */

const slugify = (s) =>
  String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function englishNames() {
  try {
    const n = await import('../src/i18n/names.ts');
    return {
      seat: (s) => n.seatName(s, 'en'),
      person: (m) => n.personName(m, 'en'),
      party: (p) => n.partyName(p, 'en'),
      partyShort: (p) => n.partyShort(p, 'en'),
      district: (en) => n.districtNameEn(en),
    };
  } catch {
    return {
      seat: (s) => s?.nameEn ?? '',
      person: (m) => m?.nameEn ?? '',
      party: (p) => p?.nameEn ?? p?.abbr ?? '',
      partyShort: (p) => p?.abbr ?? '',
      district: (en) => en,
    };
  }
}

export async function buildSearchIndex({ seats, members, parties }) {
  const en = await englishNames();

  // Districts group exactly as districtOf() in src/lib/data.ts, which makes the /jela
  // pages: the source writes "Pabna 5" with a space, "Chittagong-8" beside Chattogram,
  // and "Cox'sBazar" unspaced. Split naively, those were extra one-seat districts in
  // search, and the Cox's Bazar hit linked to /jela/coxsbazar, which does not exist.
  const DISTRICT_EN_ALIASES = { Chittagong: 'Chattogram', "Cox'sBazar": "Cox's Bazar" };
  const districts = new Map();
  for (const s of seats) {
    if (s.reserved || !s.nameEn || !s.nameBn) continue;
    const raw = s.nameEn.replace(/[\s-]+\d+$/, '').trim();
    const enName = DISTRICT_EN_ALIASES[raw] ?? raw;
    const bnName = s.nameBn.replace(/[\s-]+[০-৯\d]+$/, '').trim();
    if (!districts.has(enName)) districts.set(enName, bnName);
  }

  return [
    ...seats.map((s) => ['seat', s.nameBn ?? '', en.seat(s) || (s.nameEn ?? ''), `/ason/${s.slug}`,
      s.reserved ? 'সংরক্ষিত আসন' : 'আসন', s.reserved ? 'Reserved seat' : 'Seat']),
    ...members.map((m) => ['member', m.nameBn ?? '', en.person(m) || (m.nameEn ?? ''), `/mp/${m.slug}`,
      [m.seat?.nameBn, m.party?.abbr, m.resignedOn ? 'পদত্যাগ করেছেন' : null].filter(Boolean).join(', '),
      [m.seat ? en.seat(m.seat) : null, m.party ? en.partyShort(m.party) : null, m.resignedOn ? 'Resigned' : null].filter(Boolean).join(', ')]),
    ...parties.map((p) => ['party', p.nameBn ?? '', en.party(p) || `${p.nameEn ?? ''} ${p.abbr}`, `/dol/${p.slug}`, 'দল', 'Party']),
    ...[...districts].map(([enName, bnName]) => ['district', bnName, en.district(enName), `/jela/${slugify(enName)}`, 'জেলা', 'District']),
  ];
}
