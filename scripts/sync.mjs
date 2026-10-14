/**
 * Pull the current parliament from parliament.gov.bd into a local snapshot.
 *
 * Run with `npm run sync`. Writes JSON into data/, which the site reads at build
 * time. Keeping a committed snapshot means a deploy never depends on their API
 * being up, and refreshing the data is a deliberate, reviewable act.
 *
 * Where the data comes from: the সংসদ engine (sangsad/ in this repository)
 * fetches parliament.gov.bd every night and publishes a cleaned copy of the
 * responses this script needs, plus a map of member photos it has copied to
 * its own storage. This script reads that copy when it is at most 36 hours
 * old, and parliament.gov.bd directly otherwise, so a build never depends on
 * the government server being up and never serves a stale copy for long.
 * `--live` skips the copy; `--engine` refuses to fall back (parity checks).
 *
 * Mobile numbers are deliberately NOT stored. Every sitting member has one in the
 * API, but bulk-publishing 349 personal numbers is a decision the site owner has
 * to make first; until then we record only whether one exists.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import tls from 'node:tls';
import { PARLIAMENT_CA } from '../src/lib/parliament-ca.mjs';
import { FLOORS, dataDrop, dataDropError } from '../src/lib/dataFloor.mjs';

const BASE = 'https://www.parliament.gov.bd';
const HOST = 'www.parliament.gov.bd';
const PARLIAMENT = 13;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

/**
 * --soft: used by the production build. If parliament.gov.bd cannot be reached,
 * keep the committed snapshot and exit 0 so a deploy never fails because a
 * government server is down. Without --soft (manual runs) a failure is fatal.
 */
const SOFT = process.argv.includes('--soft');
const LIVE = process.argv.includes('--live');
const ENGINE_ONLY = process.argv.includes('--engine');

/*
 * `npm run build` starts here, under plain Node, which does not read .env.local
 * the way Next does. Load it before any environment-derived URLs or clients are
 * initialized, so local and CI builds use the same configuration.
 */
const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

/*
 * The engine's public mirror. The bucket is public by design (it holds only
 * what mymp.bd itself publishes; mobile numbers are stripped by the engine),
 * so its address is not a secret and needs no environment variable.
 */
const ENGINE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
if (!ENGINE_URL) throw new Error('Supabase URL is not configured: set NEXT_PUBLIC_SUPABASE_URL.');
const MIRROR_URL = `${ENGINE_URL}/storage/v1/object/public/mirror`;
const MIRROR_MAX_AGE_HOURS = 36;
/** Set by loadMirror(): { fetchedAt, responses: { [apiPath]: rows }, photos: { [externalId]: url } }. */
let mirror = null;

/**
 * Optional admin database. When the Supabase variables are present, admin
 * overrides, hidden entities and published news are merged into the snapshot.
 * When absent (local runs, or before the database exists) this is skipped and
 * the site is built purely from the parliament API.
 */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbConfigured = () => !!SB_URL && !!SB_KEY;

async function db(path, init = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: init.method === 'POST' ? 'return=minimal' : '',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status} ${await res.text().catch(() => '')}`);
  return res.status === 204 || init.method === 'POST' ? null : res.json();
}

/**
 * Every row of a table, a page at a time. PostgREST answers at most 1000 rows
 * to one request and says nothing about the rest: on 2026-09-17 the overrides
 * table held 1,888 rows and the build applied only the first 1,000, so most of
 * that week's biographies never reached the site. The path must carry an order.
 */
async function dbAll(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let page;
    // A dropped connection is tried again twice before the build gives up.
    for (let attempt = 1; ; attempt++) {
      try {
        page = await db(path, { headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
        break;
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

/** Overrides are stored as text; the site reads a few fields as a number or a yes/no. */
const NUMBER_FIELDS = new Set(['termsCount']);
const BOOLEAN_FIELDS = new Set(['isFreedomFighter', 'fbVerified']);
function typed(field, value) {
  if (value == null) return value;
  if (NUMBER_FIELDS.has(field)) return Number.isFinite(Number(value)) ? Number(value) : null;
  if (BOOLEAN_FIELDS.has(field)) return value === 'true';
  return value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Two things about parliament.gov.bd's TLS make a plain fetch() fail on a clean
 * machine, which is why this uses node:https rather than fetch:
 *
 *  1. The server sends only its leaf certificate, not the GoGetSSL intermediate
 *     that signs it. Browsers paper over that by fetching the intermediate from
 *     the AIA extension; Node does not, and reports UNABLE_TO_VERIFY_LEAF_
 *     SIGNATURE. src/lib/parliament-ca.mjs supplies that intermediate and its
 *     root, added ALONGSIDE Node's bundled roots, since a ca option replaces
 *     the bundled list rather than adding to it.
 *  2. Requests with no User-Agent get their connection reset.
 *
 * Verified locally: without these, ECONNRESET / UNABLE_TO_VERIFY_LEAF_SIGNATURE;
 * with them, HTTP 200.
 */
const agent = new https.Agent({ ca: [...tls.rootCertificates, ...PARLIAMENT_CA], keepAlive: true });

function request(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: HOST,
        path,
        method: 'GET',
        agent,
        timeout: 30000,
        headers: { accept: 'application/json', 'user-agent': 'mymp-sync/1.0 (+https://mymp.bd)' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`${res.statusCode} ${res.statusMessage}`));
            return;
          }
          try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`bad JSON: ${e.message}`)); }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => reject(new Error(e.code ?? e.message)));
    req.end();
  });
}

async function getJson(path, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await request(path);
    } catch (err) {
      if (i === tries) throw new Error(`GET ${path} failed after ${tries} tries: ${err.message}`);
      await sleep(1500 * i);
    }
  }
}

async function fetchUrlJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'mymp-sync/1.0 (+https://mymp.bd)' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function loadMirror() {
  const doc = await fetchUrlJson(`${MIRROR_URL}/parliament/latest.json`);
  if (doc?.version !== 1 || typeof doc.responses !== 'object' || !doc.fetchedAt) throw new Error('unexpected mirror format');
  const ageHours = (Date.now() - Date.parse(doc.fetchedAt)) / 36e5;
  if (!(ageHours <= MIRROR_MAX_AGE_HOURS)) throw new Error(`mirror is ${ageHours.toFixed(1)} h old (limit ${MIRROR_MAX_AGE_HOURS} h)`);
  const current = doc.responses[`/api/members?parliamentNo=${PARLIAMENT}`];
  if (!Array.isArray(current) || current.length < 300) throw new Error('mirror lacks the sitting members');
  if (!Array.isArray(doc.responses['/api/committees'])) throw new Error('mirror lacks committees');
  let photos = {};
  try {
    photos = (await fetchUrlJson(`${MIRROR_URL}/photos/latest.json`))?.photos ?? {};
  } catch (err) {
    console.warn(`  photo map unavailable (${err.message}); using the source's photo links`);
  }
  return { fetchedAt: doc.fetchedAt, responses: doc.responses, photos };
}

/**
 * The engine's link-preview cards (og:cards): member id → version. Read on its
 * own, whether or not tonight's data comes from the mirror; without it every
 * page keeps the site's share image.
 */
async function loadShareCards() {
  try {
    // The storage CDN keeps a copy for a few minutes; ask past it so a fresh card list counts at once.
    const doc = await fetchUrlJson(`${MIRROR_URL}/og/latest.json?t=${Date.now()}`);
    return doc?.version === 1 && doc.cards && typeof doc.cards === 'object' ? doc.cards : {};
  } catch (err) {
    console.warn(`  share cards unavailable (${err.message}); pages keep the site's share image`);
    return {};
  }
}
let shareCards = {};

/** One API list from the mirror; the caller has already decided the mirror is in use. */
function fromMirror(path) {
  const rows = mirror.responses[path];
  if (!Array.isArray(rows)) throw new Error(`mirror has no ${path}`);
  process.stdout.write(`  ${path} — ${rows.length} (mirror)\n`);
  return rows;
}

async function getAllPages(path, limit = 100) {
  if (mirror) return fromMirror(path);
  return getAllPagesLive(path, limit);
}

/** Straight from parliament.gov.bd, whether or not the mirror is in use. */
async function getAllPagesLive(path, limit = 100) {
  const rows = [];
  let page = 1;
  let total = null;
  while (total === null || rows.length < total) {
    const sep = path.includes('?') ? '&' : '?';
    const j = await getJson(`${path}${sep}limit=${limit}&page=${page}`);
    total = j.total ?? 0;
    const batch = j.data ?? [];
    if (!batch.length) break;
    rows.push(...batch);
    process.stdout.write(`  ${path} page ${page}/${j.totalPages ?? '?'} — ${rows.length}/${total}\n`);
    page++;
    await sleep(700);
  }
  return rows;
}

const clean = (v) => (typeof v === 'string' ? v.trim() : v) || null;

/** Loose Bengali key for matching a person's name inside a notice title. */
const fold = (v) =>
  String(v ?? '')
    .normalize('NFC')
    .replace(/[\u200c\u200d]/g, '')
    .replace(/মোঃ|মো\.|মোহাম্মদ|মুহাম্মদ|মুহম্মদ/g, 'মো')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

/** The Speaker biographies arrive as HTML; the site renders plain paragraphs. */
const htmlToText = (html) =>
  clean(
    String(html ?? '')
      .replace(/<\/p>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n'),
  );

const BN_TO_LATIN = (v) => String(v).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));

/**
 * Is an earlier parliament's record the same person as a sitting member?
 *
 * The source is uneven: from the 11th parliament on, the secretariat's person
 * id (empId) is reliable; for the 8th and earlier, dates of birth are mostly
 * the placeholder 1900-01-01, names are transliterated differently each time
 * ("Lutfuzzaman Babor" / "Lutfozzaman Babar"), and one id was found on two
 * different people. So no single field decides. A match needs either
 *   - the same empId AND a corroboration (similar name, equal real birth date,
 *     or the same seat in the same district), or
 *   - a similar name AND an equal real birth date, or
 *   - a similar name AND the same seat in the same district, with no
 *     conflicting real birth dates.
 * Name alone never matches: the source has several unrelated members who
 * share a name exactly.
 */
const NAME_TITLES = /\b(md|mohammad|muhammad|mohd|mohammed|mohammod|alhaj|alhajj|haji|hajee|advocate|adv|barrister|dr|prof|professor|engineer|engr|begum|late|mrs|mr|ms|major|maj|retd|ret|rtd|general|gen|brig|colonel|col|captain|capt|lt|justice|bir|bikram|uttam|protik|khan|sarkar|sarker|mia|miah|mian|khandaker|khandakar|khondkar|khondaker|kazi|quazi|syed|sayed|shaikh|sheikh|shekh)\b\.?/g;
const NAME_ALIAS = [[/ahmm?e?d|ahmad|ahamed|ahammed|ahammad/g, 'ahmad'], [/hoss?ain|hussain|hossen|hosen|husain/g, 'hossain'], [/rahaman|rahman/g, 'rahman'], [/chowdhury|choudhury|chaudhury|chowdhuri|chaudhuri/g, 'chowdhury'], [/haque|hoque|huq|hoq/g, 'haque'], [/siddiqu?e?y?|siddiqi/g, 'siddique'], [/uddin|oddin|udin/g, 'uddin'], [/abdul|abdool/g, 'abdul'], [/islam|eslam/g, 'islam'], [/kabir|kobir/g, 'kabir'], [/karim|korim/g, 'karim'], [/hasan|hassan|hasaan/g, 'hasan'], [/mahmud|mahmood|mahamud/g, 'mahmud'], [/salim|selim/g, 'selim'], [/jahan|zahan/g, 'jahan'], [/nur|noor|nure/g, 'nur'], [/zaman|jaman/g, 'zaman'], [/akter|akhter|aktar|akhtar/g, 'akter']];
const nameKey = (v) => {
  let t = String(v ?? '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z\s]/g, ' ').replace(NAME_TITLES, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, to] of NAME_ALIAS) t = t.replace(re, to);
  return t.replace(/\s/g, '');
};
const bigrams = (t) => { const out = new Set(); for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2)); return out; };
const dice = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  let hit = 0; for (const x of A) if (B.has(x)) hit++;
  return (2 * hit) / (A.size + B.size);
};
/**
 * Consonant skeleton: "mosarrof" and "mosharraf" are one name spelled twice.
 * Vowels vary most in Bengali-to-Latin transliteration, so drop them (except
 * a leading one), fold the aspirates, and collapse doubled letters.
 */
const skeleton = (t) =>
  t.replace(/sh|ch/g, 's').replace(/ph/g, 'f').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b')
    .replace(/q/g, 'k').replace(/z/g, 'j').replace(/w/g, 'v')
    .replace(/(?!^)[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1');
/** Similarity of two name keys: the better of spelled and skeleton Dice, with containment ("Mirza Abbas" inside "Mirza Abbas Uddin Ahmad") counted as similar. */
const nameSimilarity = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if ((a.length >= 8 && b.length >= 8) && (a.includes(b) || b.includes(a))) return 0.9;
  return Math.max(dice(a, b), dice(skeleton(a), skeleton(b)));
};
const PLACEHOLDER_DOB = new Set(['1900-01-01', '1970-01-01', '0001-01-01']);
const realDob = (d) => !!d && !PLACEHOLDER_DOB.has(d);

const samePerson = (cur, old) => {
  const nameSim = nameSimilarity(cur.nameKey, old.nameKey);
  const dobEqual = realDob(cur.dob) && realDob(old.dob) && cur.dob === old.dob;
  const dobConflict = realDob(cur.dob) && realDob(old.dob) && cur.dob !== old.dob;
  const sameSeat = !!old.seatKey && old.seatKey === cur.seatKey && old.seatNo !== null && old.seatNo <= 300;
  // Two different people with near-identical names sat for neighbouring
  // districts under one id, so a district mismatch vetoes an id match.
  const districtConflict = !!old.district && !!cur.district && old.seatNo !== null && old.seatNo <= 300 && cur.seatNo !== null && cur.seatNo <= 300 && old.district !== cur.district;
  if (dobConflict) return false;
  if (cur.empId && old.empId && String(cur.empId) === String(old.empId)) return dobEqual || sameSeat || (nameSim >= 0.7 && !districtConflict);
  if (nameSim >= 0.8 && dobEqual) return true;
  if (nameSim >= 0.85 && sameSeat) return true;
  return false;
};

/** District part of "Bogura-6" / "BOGRA-6", folded across the 2018 renamings. */
const DISTRICT_ALIAS = { bogra: 'bogura', comilla: 'cumilla', chittagong: 'chattogram', jessore: 'jashore', barisal: 'barishal', nawabganj: 'chapainawabganj', chapainababganj: 'chapainawabganj', moulvibazar: 'maulvibazar', netrakona: 'netrokona', jhalakathi: 'jhalokati', munshigonj: 'munshiganj', narayangonj: 'narayanganj', coxbazar: 'coxsbazar', dacca: 'dhaka', kishorganj: 'kishoreganj', brahmanbaria: 'brahmanbaria', laxmipur: 'lakshmipur', lakshmipur: 'lakshmipur', gopalgonj: 'gopalganj', habigonj: 'habiganj', sunamgonj: 'sunamganj', manikgonj: 'manikganj', kishoregonj: 'kishoreganj', jhenaidah: 'jhenaidah', jhenidah: 'jhenaidah' };
const districtKey = (constituencyEng) => {
  const raw = String(constituencyEng ?? '').replace(/\s*-\s*\d+\s*$/, '').toLowerCase().replace(/[^a-z]/g, '');
  return DISTRICT_ALIAS[raw] ?? raw;
};
/** "BOGRA-6" and "Bogura-6" share one key; a single-seat district ("Bandarban") counts as its seat 1. */
const seatKey = (constituencyEng) => {
  const d = districtKey(constituencyEng);
  if (!d) return null;
  const ord = String(constituencyEng ?? '').match(/-\s*(\d+)\s*$/);
  return `${d}-${ord ? Number(ord[1]) : 1}`;
};
/** "জনাব X, ১১৮ ভোলা-৪", "৩১২ মহিলা আসন-১২" and "(293 Chattagram-16)" all carry the seat number. */
const seatInTitle = (title) => {
  const m = String(title ?? '').match(/(?:^|[\s,(])([০-৯\d]{1,3})\s+(?:মহিলা\s+আসন|[^\s,()]+)-[০-৯\d]+/u);
  return m ? Number(BN_TO_LATIN(m[1])) : null;
};
const slugify = (s) =>
  String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * What the committed snapshot in data/ was built with, read before this run
 * overwrites it: the floor the admin database is held to (src/lib/dataFloor.mjs).
 */
async function readBaseline() {
  const read = async (name) => {
    try { return JSON.parse(await readFile(join(OUT, name), 'utf8')); } catch { return null; }
  };
  const [meta, results, news] = await Promise.all([read('meta.json'), read('results.json'), read('news.json')]);
  return {
    overrides: meta?.overridesApplied ?? 0,
    results: Array.isArray(results) ? results.length : 0,
    news: Array.isArray(news) ? news.length : 0,
  };
}

async function main() {
  const baseline = await readBaseline();
  const allowDrop = process.env.ALLOW_DATA_DROP === '1';
  if (!LIVE) {
    try {
      mirror = await loadMirror();
      console.log(`Syncing the ${PARLIAMENT}th parliament from the সংসদ engine's copy (fetched from ${BASE} at ${mirror.fetchedAt})\n`);
    } catch (err) {
      if (ENGINE_ONLY) throw new Error(`engine mirror unavailable: ${err.message}`);
      console.warn(`  engine mirror unavailable (${err.message}); reading ${BASE} directly`);
    }
  }
  if (!mirror) console.log(`Syncing the ${PARLIAMENT}th parliament from ${BASE}\n`);
  shareCards = await loadShareCards();
  console.log(`  share cards: ${Object.keys(shareCards).length}`);

  const rawMembers = await getAllPages(`/api/members?parliamentNo=${PARLIAMENT}`);
  const rawCommittees = await getAllPages('/api/committees', 50);

  // What the House is doing, from the same source: sittings, circulars, notices,
  // the presiding officers and the parliament's own dates. Each is optional, so a
  // gap in one of them never blocks the member data.
  const optional = async (label, fn) => {
    try { return await fn(); } catch (err) { console.warn(`  ${label} skipped: ${err.message}`); return null; }
  };
  const rawSessions = (await optional('sessions', () => getAllPages(`/api/sessions?parliamentId=${PARLIAMENT}`, 50))) ?? [];
  const rawNotices = (await optional('notices', () => getAllPages('/api/notices', 100))) ?? [];
  const rawSpeakers = (await optional('speakers', () => getAllPages('/api/speakers', 100))) ?? [];
  const rawParliaments = (await optional('parliaments', async () => (mirror ? fromMirror('/api/parliaments') : getJson('/api/parliaments')))) ?? [];

  // Earlier parliaments. The source holds members for the 4th, 5th and 7th to
  // 12th; the others return nothing. These feed "who held this seat before"
  // and "how many terms has this member served", nothing else.
  const rawHistory = {};
  for (const n of [12, 11, 10, 9, 8, 7, 5, 4]) {
    rawHistory[n] = (await optional(`parliament ${n}`, () => getAllPages(`/api/members?parliamentNo=${n}`))) ?? [];
  }

  // ---- members ----
  // Two pairs of sitting members share a name, so the seat has to disambiguate the
  // slug. Without this their pages silently collapse into one.
  const nameCount = new Map();
  for (const m of rawMembers) {
    const s = slugify(m.nameEng || m.externalId);
    nameCount.set(s, (nameCount.get(s) ?? 0) + 1);
  }

  const members = rawMembers.map((m) => {
    const term = (m.terms ?? []).find((t) => t.parliamentNo === PARLIAMENT) ?? {};
    const c = term.constituency ?? {};
    const p = term.party ?? {};
    const seatNo = typeof c.constituencyNo === 'number' ? c.constituencyNo : null;
    const base = slugify(m.nameEng || m.externalId);
    return {
      id: m.externalId,
      slug: nameCount.get(base) > 1 && c.constituencyEng ? `${base}-${slugify(c.constituencyEng)}` : base,
      nameBn: clean(m.nameBng),
      nameEn: clean(m.nameEng),
      // Our stored copy from the engine when it has one; the source's link otherwise.
      photoUrl: mirror?.photos?.[m.externalId] ?? clean(m.photoUrl),
      gender: clean(m.gender),
      dateOfBirth: clean(m.dateOfBirth),
      professionBn: clean(m.professionBn),
      fatherBn: clean(m.fatherNameBng),
      fatherEn: clean(m.fatherNameEng),
      motherBn: clean(m.motherNameBng),
      motherEn: clean(m.motherNameEng),
      isFreedomFighter: !!m.isFreedomFighter,
      // parliament.gov.bd publishes home addresses; mymp.bd does not (owner's privacy policy, 2026-09-12).
      presentAddressBn: null,
      permanentAddressBn: null,
      email: clean(m.email),
      // The number itself is deliberately not stored; the engine's copy carries only this yes/no.
      hasMobile: typeof m.hasMobile === 'boolean' ? m.hasMobile : !!m.mobile,
      // The member's link-preview card, versioned so a changed card is fetched afresh.
      shareImage: shareCards[m.externalId] ? `${MIRROR_URL}/og/mp/${m.externalId}.jpg?v=${shareCards[m.externalId]}` : null,
      // The source carries a written biography only for the Speaker and Deputy
      // Speaker. Everyone else's stays null unless an admin writes one.
      bioBn: htmlToText(m.speakerDetailsBioBn),
      // The articles or documents an editor's biography was written from.
      bioSources: null,
      summaryBn: clean(m.speakerHeroSummaryBn),
      // parliament.gov.bd gives four sitting members an end (2022-12-11, their 11th-parliament
      // resignation) before this term's start; an end before the start is dropped, so it reads "চলমান".
      term: { start: clean(term.startDate), end: clean(term.endDate) && clean(term.startDate) && clean(term.endDate) < clean(term.startDate) ? null : clean(term.endDate) },
      // Official pages, from admin overrides only: an editor's own entry, or
      // the engine's reading of the member's Wikipedia article (socialSource
      // then names it). Nothing here comes from parliament.gov.bd.
      facebook: null, x: null, youtube: null, instagram: null, website: null, socialSource: null,
      // How far the Facebook link is confirmed, and the details kept with it.
      fbStatus: null, fbType: null, fbUsername: null, fbPageId: null, fbVerified: null, sourceUrl: null, lastChecked: null,
      // Education and birthplace likewise come only from overrides: an editor,
      // or the engine's reading of the member's Wikipedia infobox (bioFromWiki
      // names those fields, bioSource the articles).
      educationBn: null, birthPlaceBn: null, bioFromWiki: null, bioSource: null,
      // A party office and a government post, likewise only from an editor or a hand-checked engine fact.
      partyRoleBn: null, ministryBn: null, govPost: null,
      _match: { empId: m.empId ?? null, nameKey: nameKey(m.nameEng), dob: clean(m.dateOfBirth), seatNo, district: districtKey(c.constituencyEng), seatKey: seatKey(c.constituencyEng) }, // internal, stripped before writing
      party: p.abbreviation ? { abbr: p.abbreviation, nameBn: clean(p.nameBng), nameEn: clean(p.nameEng) } : null,
      seat: seatNo
        ? {
            no: seatNo,
            reserved: seatNo > 300,
            nameBn: clean(c.constituencyBng),
            nameEn: clean(c.constituencyEng),
            slug: slugify(c.constituencyEng || `seat-${seatNo}`),
            boundaryBn: clean(c.boundaryDetails),
          }
        : null,
      offices: [
        term.isSpeaker && 'speaker',
        term.isDeputySpeaker && 'deputy-speaker',
        term.isPm && 'pm',
        term.isOppositionLeader && 'opposition-leader',
      ].filter(Boolean),
      status: clean(term.status),
      // How many times the secretariat records this member as elected, this term included.
      termsCount: typeof term.count === 'number' && term.count > 0 ? term.count : null,
      // The source keeps a member who has resigned, with status "Resigned" and the term's end date.
      resignedOn: clean(term.status) === 'Resigned' ? clean(term.endDate) : null,
    };
  });

  const memberIds = new Set(members.map((m) => m.id));

  // ---- committees ----
  // The endpoint returns a record per committee PER PARLIAMENT, so the same body
  // appears twice: one constituted in 2026 for this parliament and one from 2024.
  // Group by name and keep the newest, or the site would list every standing
  // committee twice and lose half of them to slug collisions.
  //
  // A roster counts as current only when every listed member is a sitting member.
  // Many still hold the previous parliament's names, and presenting former members
  // as current would be publishing wrong information about real people.
  const records = rawCommittees.map((c) => {
    const people = (c.members ?? [])
      .filter((x) => x.member?.externalId)
      .map((x) => ({ role: clean(x.role) ?? 'Member', memberId: x.member.externalId }));
    const sitting = people.filter((x) => memberIds.has(x.memberId));
    const startDate = c.startDate && c.startDate !== 'null' ? c.startDate : null;
    return {
      id: String(c.id),
      slug: slugify(c.nameEn || `committee-${c.id}`),
      nameBn: clean(c.nameBn),
      nameEn: clean(c.nameEn),
      type: clean(c.type),
      startDate,
      rosterCurrent: people.length > 0 && sitting.length === people.length,
      memberCount: people.length,
      members: sitting,
    };
  });

  const grouped = new Map();
  for (const r of records) {
    const existing = grouped.get(r.slug);
    if (!existing) { grouped.set(r.slug, r); continue; }
    // Prefer a current roster, then the later start date.
    const better =
      r.rosterCurrent !== existing.rosterCurrent
        ? (r.rosterCurrent ? r : existing)
        : (r.startDate ?? '') > (existing.startDate ?? '') ? r : existing;
    const older = better === r ? existing : r;
    grouped.set(r.slug, { ...better, previousStartDate: older.startDate });
  }
  const committees = [...grouped.values()].sort((a, b) => {
    if (a.rosterCurrent !== b.rosterCurrent) return a.rosterCurrent ? -1 : 1;
    return (a.nameEn ?? '').localeCompare(b.nameEn ?? '');
  });

  // ---- parties, derived from who actually holds seats ----
  const partyMap = new Map();
  for (const m of members) {
    if (!m.party || m.resignedOn !== null) continue; // a resigned member no longer holds the seat
    const e = partyMap.get(m.party.abbr) ?? {
      abbr: m.party.abbr, slug: slugify(m.party.abbr),
      nameBn: m.party.nameBn, nameEn: m.party.nameEn,
      seats: 0, seatsTerritorial: 0, seatsReserved: 0,
    };
    e.seats++;
    if (m.seat?.reserved) e.seatsReserved++; else e.seatsTerritorial++;
    partyMap.set(m.party.abbr, e);
  }
  const parties = [...partyMap.values()].sort((a, b) => b.seats - a.seats);

  // ---- seats ----
  const seats = members
    .filter((m) => m.seat)
    .map((m) => ({ ...m.seat, memberId: m.id, vacantSince: m.resignedOn }))
    .sort((a, b) => a.no - b.no);

  // The member list only shows seats that have a member. A seat with none
  // (Chattogram-4 in the 13th parliament) would otherwise have no page, while
  // the site says it has one for each of the 300. Its record comes from the
  // constituency list, which the engine's mirror does not carry, so it is read
  // live; if that fails the gap stays and scripts/qa-data.ts reports it.
  {
    const present = new Set(seats.map((s) => s.no));
    const missing = Array.from({ length: 300 }, (_, i) => i + 1).filter((n) => !present.has(n));
    if (missing.length) {
      const electionId = (Array.isArray(rawParliaments) ? rawParliaments : []).find((x) => x.parliamentNo === PARLIAMENT)?.externalId ?? null;
      const rows = electionId === null ? null : await optional('constituencies', () => getAllPagesLive('/api/constituencies', 400));
      for (const c of rows ?? []) {
        if (c.electionId !== electionId || !missing.includes(c.constituencyNo)) continue;
        seats.push({ no: c.constituencyNo, reserved: false, nameBn: clean(c.constituencyBng), nameEn: clean(c.constituencyEng), slug: slugify(c.constituencyEng || `seat-${c.constituencyNo}`), boundaryBn: clean(c.boundaryDetails), memberId: null, vacantSince: null });
      }
      seats.sort((a, b) => a.no - b.no);
      const still = missing.filter((n) => !seats.some((s) => s.no === n));
      console.log(`  seats: ${missing.length - still.length} without a member added from the constituency list${still.length ? `; still missing ${still.join(', ')}` : ''}`);
    }
  }

  // ---- earlier parliaments ----
  const termOf = (m, n) => (m.terms ?? []).find((t) => t.parliamentNo === n) ?? (m.terms ?? [])[0] ?? {};
  // From the seat list, not the members, so a seat with no member still collects its earlier holders.
  const seatNoByKey = new Map(seats.filter((x) => !x.reserved).map((x) => [seatKey(x.nameEn), x.no]));
  const findCurrent = (m, n) => {
    const t = termOf(m, n);
    const c = t.constituency ?? {};
    const old = { empId: m.empId ?? null, nameKey: nameKey(m.nameEng), dob: clean(m.dateOfBirth), seatNo: typeof c.constituencyNo === 'number' ? c.constituencyNo : null, district: districtKey(c.constituencyEng), seatKey: seatKey(c.constituencyEng) };
    if (!old.nameKey && !old.empId) return null;
    return members.find((cur) => samePerson(cur._match, old)) ?? null;
  };
  const priorTerms = {};
  const seatHolders = {};
  const partySeats = {};
  const countParty = (bucket, abbr, nameBn, reserved) => {
    const e = bucket.get(abbr) ?? { abbr, nameBn, territorial: 0, reserved: 0 };
    if (reserved) e.reserved++; else e.territorial++;
    bucket.set(abbr, e);
  };
  for (const [nStr, list] of Object.entries(rawHistory)) {
    const n = Number(nStr);
    const bucket = new Map();
    const seenSeat = new Set();
    for (const m of list) {
      const t = termOf(m, n);
      const c = t.constituency ?? {};
      const seatNo = typeof c.constituencyNo === 'number' ? c.constituencyNo : null;
      const reserved = seatNo !== null && seatNo > 300;
      const abbr = t.party?.abbreviation ?? null;
      if (abbr && !(seatNo !== null && seenSeat.has(seatNo))) countParty(bucket, abbr, clean(t.party?.nameBng), reserved);
      if (seatNo !== null) seenSeat.add(seatNo);

      const cur = findCurrent(m, n);
      if (cur) {
        (priorTerms[cur.id] ??= []).push({ parliamentNo: n, seatNo, seatNameBn: clean(c.constituencyBng), seatNameEn: clean(c.constituencyEng), partyAbbr: abbr, partyNameBn: clean(t.party?.nameBng) });
      }
      // The seat is matched by its name (district + ordinal), never by number alone.
      const todaySeatNo = seatNo !== null && !reserved ? seatNoByKey.get(seatKey(c.constituencyEng)) : undefined;
      if (todaySeatNo !== undefined) {
        (seatHolders[todaySeatNo] ??= []).push({ parliamentNo: n, nameBn: clean(m.nameBng), nameEn: clean(m.nameEng), partyAbbr: abbr, partyNameBn: clean(t.party?.nameBng), memberId: cur?.id ?? null });
      }
    }
    partySeats[n] = [...bucket.values()].sort((a, b) => b.territorial + b.reserved - (a.territorial + a.reserved));
  }
  {
    const bucket = new Map();
    for (const m of members) if (m.party && m.resignedOn === null) countParty(bucket, m.party.abbr, m.party.nameBn, !!m.seat?.reserved);
    partySeats[PARLIAMENT] = [...bucket.values()].sort((a, b) => b.territorial + b.reserved - (a.territorial + a.reserved));
  }
  for (const list of Object.values(priorTerms)) {
    // one entry per parliament, newest first
    const byParl = new Map(); for (const t of list) byParl.set(t.parliamentNo, t);
    list.splice(0, list.length, ...[...byParl.values()].sort((a, b) => b.parliamentNo - a.parliamentNo));
  }
  for (const list of Object.values(seatHolders)) list.sort((a, b) => b.parliamentNo - a.parliamentNo);
  const parliamentsInfo = (Array.isArray(rawParliaments) ? rawParliaments : [])
    .map((p) => ({ no: p.parliamentNo, electionDate: clean(p.electionDate), oathDate: clean(p.oathDate), endDate: clean(p.parliamentLastDate), recorded: p.parliamentNo === PARLIAMENT ? members.length : (rawHistory[p.parliamentNo] ?? []).length }))
    .sort((a, b) => b.no - a.no);
  const history = { parliaments: parliamentsInfo, priorTerms, seatHolders, partySeats };
  console.log(`  history: ${Object.values(rawHistory).reduce((n, l) => n + l.length, 0)} earlier records, ${Object.keys(priorTerms).length} sitting members with earlier terms, ${Object.keys(seatHolders).length} seats with holders`);
  for (const m of members) delete m._match;

  // ---- parliamentary activity ----
  const p13 = (Array.isArray(rawParliaments) ? rawParliaments : []).find((x) => x.parliamentNo === PARLIAMENT);
  const parliament = p13
    ? { no: PARLIAMENT, electionDate: clean(p13.electionDate), oathDate: clean(p13.oathDate), gazetteDate: clean(p13.gazetteDate), endDate: clean(p13.parliamentLastDate) }
    : { no: PARLIAMENT, electionDate: null, oathDate: null, gazetteDate: null, endDate: null };

  const byFold = new Map(members.map((m) => [fold(m.nameBn), m.id]));
  const bySeatNo = new Map(members.filter((m) => m.seat).map((m) => [m.seat.no, m.id]));
  const memberByName = (name) => byFold.get(fold(name)) ?? null;

  const speakers = rawSpeakers
    .filter((x) => x.isCurrent && x.parliamentNo === PARLIAMENT)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((x) => ({ role: x.role, nameBn: clean(x.nameBn), nameEn: clean(x.nameEn), tenureBn: clean(x.tenureTextBn), memberId: memberByName(x.nameBn) }));

  const sessions = rawSessions
    .map((x) => ({
      id: String(x.id), titleBn: clean(x.titleBn), titleEn: clean(x.titleEn),
      startDate: clean(x.startDate), endDate: clean(x.endDate),
      circulars: (x.poripotras ?? []).map((c) => ({ id: String(c.id), no: c.poripotraNo ?? null, titleBn: clean(c.titleBn), date: clean(c.date), pdfUrl: clean(c.pdfUrl) })),
      sittings: (x.poripotras ?? []).flatMap((c) => c.orderOfTheDays ?? [])
        .map((o) => ({ id: String(o.id), titleBn: clean(o.titleBn), date: clean(o.date), pdfUrl: clean(o.pdfUrl) }))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    }))
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));

  // Only notices about the House and its members reach the site. Staff office
  // orders, tenders and downloads are the secretariat's business, not the public's.
  const finalCommitteeId = new Map(records.map((r) => [r.id, grouped.get(r.slug)?.id ?? r.id]));
  const notices = rawNotices
    .map((n) => {
      const seatNo = n.noticeType === 'NOC_GO' ? seatInTitle(n.titleBn) ?? seatInTitle(n.titleEn) : null;
      let memberId = seatNo ? bySeatNo.get(seatNo) ?? null : null;
      if (!memberId && n.noticeType === 'NOC_GO') {
        const t = fold(n.titleBn);
        for (const [key, id] of byFold) if (key.length > 6 && t.includes(key)) { memberId = id; break; }
      }
      const committeeId = n.committeeId ? finalCommitteeId.get(String(n.committeeId)) ?? null : null;
      const general = n.noticeType === 'GENERAL' && n.category === 'notification';
      if (!memberId && !committeeId && !general) return null;
      return {
        id: String(n.id), type: n.noticeType, category: clean(n.category), date: clean(n.date),
        titleBn: clean(n.titleBn), titleEn: clean(n.titleEn), pdfUrl: clean(n.pdfUrl),
        memberId, committeeId,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  console.log(`  activity: ${sessions.length} sessions, ${sessions.reduce((n, x) => n + x.sittings.length, 0)} sittings, ${notices.length} notices kept of ${rawNotices.length} (${notices.filter((n) => n.memberId).length} to members, ${notices.filter((n) => n.committeeId).length} to committees), ${speakers.length} presiding officers`);

  // ---- government and parliamentary posts ----
  // The posts table is kept current by the posts sync (src/lib/posts/sync.ts)
  // from cabinet.gov.bd and parliament.gov.bd. Current government posts fill
  // the member fields the page descriptions read (govPost, ministryBn); an
  // editor's override below still wins. Without the table (before
  // supabase/migrations/003_posts.sql is run), the committed data/posts.json
  // is used as it is, so pages and descriptions still agree.
  let posts = null;
  if (dbConfigured()) {
    try {
      const [rows, lastOk, aliases] = await Promise.all([
        db('posts?select=id,type,title,rank_note,ministry_bn,member_id,is_mp,person_name_bn,person_name_en,photo_url,from_date,to_date,source_order,source_key,source_url,auto_synced&order=from_date.desc,id.desc&limit=5000'),
        db('post_sync_runs?select=finished_at,unmatched_names&status=eq.ok&order=finished_at.desc&limit=1'),
        db('post_aliases?select=name_key'),
      ]);
      // Listed by the Cabinet Division but not yet placed: /ministers names them without a profile link.
      const resolved = new Set(aliases.map((a) => a.name_key));
      const pending = new Map();
      for (const u of lastOk[0]?.unmatched_names ?? []) {
        if (u.stored_as_non_mp || resolved.has(u.key)) continue;
        const k = `${u.key}|${u.title}`;
        const p = pending.get(k) ?? { nameBn: u.name_bn, title: u.title, ministries: [] };
        if (u.ministry_bn && !p.ministries.includes(u.ministry_bn)) p.ministries.push(u.ministry_bn);
        pending.set(k, p);
      }
      posts = {
        checkedAt: lastOk[0]?.finished_at ?? null,
        pending: [...pending.values()],
        rows: rows.map((r) => ({
          id: String(r.id), type: r.type, title: r.title, rankNote: r.rank_note, ministryBn: r.ministry_bn,
          memberId: r.member_id, isMp: r.is_mp, nameBn: r.person_name_bn, nameEn: r.person_name_en, photoUrl: r.photo_url,
          fromDate: r.from_date, toDate: r.to_date, order: r.source_order, sourceKey: r.source_key, sourceUrl: r.source_url,
          autoSynced: r.auto_synced,
        })),
      };
    } catch (err) {
      console.warn('  posts table unavailable (run supabase/migrations/003_posts.sql?):', err.message.slice(0, 120));
    }
  }
  if (!posts) {
    try {
      posts = JSON.parse(await readFile(join(OUT, 'posts.json'), 'utf8'));
      console.log('  posts: using the committed data/posts.json');
    } catch {
      posts = null;
    }
  }
  if (posts) {
    const RANKS = new Set(['মন্ত্রী', 'প্রতিমন্ত্রী', 'উপমন্ত্রী']);
    for (const m of members) {
      const held = posts.rows.filter((r) => r.memberId === m.id && !r.toDate && r.type === 'government' && RANKS.has(r.title));
      if (!held.length) continue;
      m.govPost = held[0].title;
      m.ministryBn = [...new Set(held.map((r) => r.ministryBn).filter(Boolean))].join(' ও ') || null;
    }
    console.log(`  posts: ${posts.rows.length} rows, ${posts.rows.filter((r) => !r.toDate).length} current, last checked ${posts.checkedAt ?? 'never'}`);
  }

  // ---- admin overrides and hidden entities ----
  // Applied AFTER everything above so a hand edit always wins over the source,
  // and re-applied on every sync so the source can never quietly undo it.
  let overridesApplied = 0;
  let hiddenApplied = 0;
  let adminNote = 'admin database not configured; built from parliament.gov.bd only';
  if (dbConfigured()) {
    try {
      const [overrides, hidden] = await Promise.all([
        dbAll('overrides?select=entity_type,entity_id,field,value&order=entity_type,entity_id,field'),
        dbAll('hidden_entities?select=entity_type,entity_id&order=entity_type,entity_id'),
      ]);
      const byType = { member: members, party: parties, committee: committees, seat: seats };
      const keyOf = { member: (x) => x.id, party: (x) => x.abbr, committee: (x) => x.id, seat: (x) => String(x.no) };
      for (const o of overrides) {
        const list = byType[o.entity_type];
        const target = list?.find((x) => keyOf[o.entity_type](x) === o.entity_id);
        if (!target) continue;
        target[o.field] = typed(o.field, o.value);
        overridesApplied++;
        // A member's seat name lives on the member object too; keep them in step.
        if (o.entity_type === 'seat') {
          const m = members.find((x) => x.seat && String(x.seat.no) === o.entity_id);
          if (m) m.seat[o.field] = o.value;
        }
      }
      const hiddenMembers = new Set(hidden.filter((h) => h.entity_type === 'member').map((h) => h.entity_id));
      const hiddenCommittees = new Set(hidden.filter((h) => h.entity_type === 'committee').map((h) => h.entity_id));
      // Mutate in place: these arrays are consts referenced below.
      for (const s of seats) if (hiddenMembers.has(s.memberId)) s.memberId = null;
      members.splice(0, members.length, ...members.filter((m) => !hiddenMembers.has(m.id)));
      committees.splice(0, committees.length, ...committees.filter((c) => !hiddenCommittees.has(c.id)));
      for (const c of committees) c.members = c.members.filter((x) => !hiddenMembers.has(x.memberId));
      for (const n of notices) if (n.memberId && hiddenMembers.has(n.memberId)) n.memberId = null;
      for (const s of speakers) if (s.memberId && hiddenMembers.has(s.memberId)) s.memberId = null;
      if (posts) for (const r of posts.rows) if (r.memberId && hiddenMembers.has(r.memberId)) r.memberId = null;
      for (const id of hiddenMembers) delete priorTerms[id];
      for (const list of Object.values(seatHolders)) for (const h of list) if (h.memberId && hiddenMembers.has(h.memberId)) h.memberId = null;
      notices.splice(0, notices.length, ...notices.filter((n) => n.memberId || (n.committeeId && !hiddenCommittees.has(n.committeeId)) || (!n.committeeId && n.type === 'GENERAL')));
      hiddenApplied = hiddenMembers.size + hiddenCommittees.size;
      adminNote = `applied ${overridesApplied} overrides, ${hiddenApplied} hidden`;
      console.log(`  admin: ${adminNote}`);
    } catch (err) {
      // Publishing without the editors' work would put every hidden member back
      // and undo every correction, while the run reported success. Stop the
      // build instead: the live site stays as it is until the next try.
      const e = new Error(`admin edits could not be read, nothing was published: ${err.message}`);
      e.fatal = true;
      throw e;
    }
  }
  // An empty or wrong database reads without an error, so the floor catches it.
  // A production build with no database at all would drop the edits the same way.
  if (!allowDrop) {
    const configured = dbConfigured();
    const reason = configured || SOFT ? dataDrop('admin corrections', overridesApplied, baseline.overrides, FLOORS.overrides) : null;
    if (reason) throw dataDropError(configured ? reason : `${reason} (the admin database is not configured)`);
  }

  const meta = {
    parliamentNo: PARLIAMENT,
    overridesApplied,
    hidden: hiddenApplied,
    // When parliament.gov.bd was read: the engine's fetch time, or now for a direct read.
    syncedAt: mirror ? mirror.fetchedAt : new Date().toISOString(),
    builtAt: new Date().toISOString(),
    source: mirror ? `${MIRROR_URL}/parliament/latest.json` : `${BASE}/api`,
    via: mirror ? 'engine' : 'live',
    counts: {
      members: members.filter((m) => m.resignedOn === null).length,
      territorial: members.filter((m) => m.resignedOn === null && m.seat && !m.seat.reserved).length,
      reserved: members.filter((m) => m.resignedOn === null && m.seat?.reserved).length,
      resigned: members.filter((m) => m.resignedOn !== null).length,
      parties: parties.length,
      committees: committees.length,
      committeesCurrent: committees.filter((c) => c.rosterCurrent).length,
      sittings: sessions.reduce((n, x) => n + x.sittings.length, 0),
      notices: notices.length,
      returningMembers: Object.keys(priorTerms).length,
    },
  };
  const activity = { parliament, speakers, sessions, notices };

  // ---- search index ----
  // Names only, in both scripts. Match keys are built in the browser, which halves
  // the download for about 8 ms of work once on load.
  // Districts group exactly as districtOf() in src/lib/data.ts, which makes the /jela
  // pages: the source writes "Pabna 5" with a space, "Chittagong-8" beside Chattogram,
  // and "Cox'sBazar" unspaced. Split naively, those were extra one-seat districts in
  // search, and the Cox's Bazar hit linked to /jela/coxsbazar, which does not exist.
  const DISTRICT_EN_ALIASES = { Chittagong: 'Chattogram', "Cox'sBazar": "Cox's Bazar" };
  const districts = new Map();
  for (const s of seats) {
    if (s.reserved || !s.nameEn || !s.nameBn) continue;
    const raw = s.nameEn.replace(/[\s-]+\d+$/, '').trim();
    const en = DISTRICT_EN_ALIASES[raw] ?? raw;
    const bnName = s.nameBn.replace(/[\s-]+[০-৯\d]+$/, '').trim();
    if (!districts.has(en)) districts.set(en, bnName);
  }

  const searchIndex = [
    ...seats.map((s) => ['seat', s.nameBn ?? '', s.nameEn ?? '', `/ason/${s.slug}`, s.reserved ? 'সংরক্ষিত আসন' : 'আসন']),
    ...members.map((m) => ['member', m.nameBn ?? '', m.nameEn ?? '', `/mp/${m.slug}`,
      [m.seat?.nameBn, m.party?.abbr, m.resignedOn ? 'পদত্যাগ করেছেন' : null].filter(Boolean).join(', ')]),
    ...parties.map((p) => ['party', p.nameBn ?? '', `${p.nameEn ?? ''} ${p.abbr}`, `/dol/${p.slug}`, 'দল']),
    ...[...districts].map(([en, bnName]) => ['district', bnName, en, `/jela/${slugify(en)}`, 'জেলা']),
  ];

  await mkdir(OUT, { recursive: true });
  for (const [name, value] of Object.entries({ members, committees, parties, seats, meta, activity, history })) {
    await writeFile(join(OUT, `${name}.json`), JSON.stringify(value, null, 1), 'utf8');
  }
  if (posts) await writeFile(join(OUT, 'posts.json'), JSON.stringify(posts, null, 1), 'utf8');
  await mkdir(join(OUT, '..', 'public'), { recursive: true });
  await writeFile(join(OUT, '..', 'public', 'search-index.json'), JSON.stringify(searchIndex), 'utf8');

  console.log('\nWrote data/ —', JSON.stringify(meta.counts));
  console.log('Wrote public/search-index.json —', searchIndex.length, 'entries');

  // ---- published news + a record of this run ----
  // Only published items reach the site, and only the fields the site shows.
  if (dbConfigured()) {
    try {
      const rows = await dbAll('news_posts?select=id,title_bn,source_name,source_url,published_on,excerpt_bn,member_id,seat_slug&status=eq.published&order=published_on.desc,created_at.desc,id');
      const news = rows.map((r) => ({
        id: r.id, titleBn: r.title_bn, sourceName: r.source_name, sourceUrl: r.source_url,
        publishedOn: r.published_on, excerptBn: r.excerpt_bn ?? null, memberId: r.member_id ?? null, seatSlug: r.seat_slug ?? null,
      }));
      const drop = allowDrop ? null : dataDrop('published news', news.length, baseline.news, FLOORS.news);
      if (drop) throw dataDropError(drop);
      await writeFile(join(OUT, 'news.json'), JSON.stringify(news, null, 1), 'utf8');
      console.log('Wrote data/news.json —', news.length, 'published items');
    } catch (err) {
      if (err.fatal) throw err;
      console.warn('  news skipped:', err.message);
    }
    // Vote counts come only from here: the source has none. Draft rows never leave the database.
    try {
      const rows = await dbAll('election_results?select=seat_no,parliament_no,candidates,total_votes,turnout,source_url,source_note&status=eq.published&order=seat_no,parliament_no');
      const results = rows.map((r) => ({
        seatNo: r.seat_no, parliamentNo: r.parliament_no, candidates: r.candidates ?? [],
        totalVotes: r.total_votes ?? null, turnout: r.turnout == null ? null : Number(r.turnout),
        sourceUrl: r.source_url, sourceNote: r.source_note ?? null,
      }));
      const drop = allowDrop ? null : dataDrop('published vote counts', results.length, baseline.results, FLOORS.results);
      if (drop) throw dataDropError(drop);
      await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 1), 'utf8');
      console.log('Wrote data/results.json —', results.length, 'published results');
    } catch (err) {
      if (err.fatal) throw err;
      console.warn('  election results skipped (table missing?):', err.message.slice(0, 120));
    }
    try {
      await db('sync_runs', {
        method: 'POST',
        body: JSON.stringify({
          finished_at: new Date().toISOString(), ok: true,
          members: members.length, committees: committees.length,
          overrides_applied: overridesApplied, message: `${adminNote}; data via ${mirror ? 'engine mirror' : 'parliament.gov.bd'}`,
        }),
      });
    } catch (err) {
      console.warn('  sync_runs not recorded:', err.message);
    }
  }
  if (members.length === 0) {
    console.error('\nNo members returned. Refusing to treat this as a successful sync.');
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error('\nSync failed:', err.message);
  // The dashboard's "last sync" shows this, so a failed publish is not mistaken for a quiet one.
  if (dbConfigured()) {
    await db('sync_runs', {
      method: 'POST',
      body: JSON.stringify({ finished_at: new Date().toISOString(), ok: false, message: err.message.slice(0, 500) }),
    }).catch(() => {});
  }
  if (SOFT && !err.fatal) {
    // Production build: keep the committed snapshot and let the deploy proceed.
    console.warn('--soft: keeping the committed snapshot in data/ and continuing the build.');
    process.exit(0);
  }
  process.exit(1);
});
