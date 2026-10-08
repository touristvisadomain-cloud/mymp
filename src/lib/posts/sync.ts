import { POST_SOURCES } from '../../../config/sync-sources';
import { parseCabinetPage, parseOfficers, cabinetListMarkup, type ParsedPost } from './parse';
import { loadCabinet, loadOfficers, sha256 } from './fetch';
import { buildMatcher, type Candidate, type MatchMember, type Resolution } from './match';
import { normalizeName, nameSimilarity, ministryKey } from './names';
import { restDb, isMissingTable, type Db } from './db';
import { sendSyncMail } from './mail';
import { requestRebuild } from '../rebuild';

/**
 * The posts sync: reads the cabinet and parliament lists, works out who each
 * listed person is, and brings the posts table in line with the lists.
 *
 *   new on a list          → a row is opened (auto_synced)
 *   gone from its list     → its row gets to_date = today and auto_closed
 *   another ministry       → the old row closes, a new one opens
 *   adviser, not an MP     → kept with is_mp = false and no profile link
 *   not matched otherwise  → left out and listed for review in /admin/sync
 *
 * It never deletes, never touches a row an editor entered (auto_synced =
 * false), and only lets a list that was read successfully this run close
 * rows. A list that parses to nothing, or to under 60% of what the last good
 * run found, stops the whole run before anything is written.
 */

export interface PostRow {
  id: number;
  type: 'government' | 'parliament';
  title: string;
  rank_note: string | null;
  ministry_bn: string | null;
  member_id: string | null;
  is_mp: boolean;
  person_name_bn: string;
  person_name_en: string | null;
  photo_url: string | null;
  from_date: string;
  to_date: string | null;
  appointed_on: string | null;
  source_order: number | null;
  source_key: string | null;
  source_url: string | null;
  source_hash: string | null;
  auto_synced: boolean;
  auto_closed: boolean;
}

export interface Unmatched {
  key: string;
  name_bn: string;
  title: string;
  ministry_bn: string | null;
  source_key: string;
  /** Advisers are kept as people who are not MPs until an editor says otherwise. */
  stored_as_non_mp: boolean;
  candidates: Candidate[];
}

export interface Planned {
  post: ParsedPost;
  key: string;
  memberId: string | null;
  resolution: Resolution;
}

export interface RunError { source: string; message: string }

export interface SyncReport {
  status: 'ok' | 'failed' | 'skipped';
  dryRun: boolean;
  runId: number | null;
  /** supabase/migrations/003_posts.sql has not been run. */
  tablesMissing: boolean;
  parsed: ParsedPost[];
  planned: Planned[];
  add: Planned[];
  close: PostRow[];
  /** Rows kept for someone not matched before, now known to be an MP. */
  identified: { row: PostRow; memberId: string }[];
  unchanged: number;
  unmatched: Unmatched[];
  errors: RunError[];
  /** Sources that have now failed three runs in a row. */
  broken: string[];
  sourceCounts: Record<string, number>;
  sourceHashes: Record<string, string>;
  sourceUrls: Record<string, string>;
  mail: string | null;
  deploy: string | null;
}

export interface SyncOptions {
  dryRun?: boolean;
  /** cron, github, admin, cli */
  trigger: string;
  members: MatchMember[];
  /** yyyy-mm-dd in Dhaka; defaults to today. */
  today?: string;
  log?: (line: string) => void;
}

const GUARD_RATIO = 0.6;
const LOCK_MINUTES = 10;
/** An unmatched name this close to an open row's name holds that row open instead of closing it. */
const HOLD_SIMILARITY = 0.75;

export const dhakaToday = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(d);

const personKey = (memberId: string | null, nameBn: string) => (memberId ? `mp:${memberId}` : `name:${normalizeName(nameBn)}`);
const postKey = (type: string, title: string, ministry: string | null, person: string) => `${type}|${title}|${ministryKey(ministry)}|${person}`;

/** For the admin banner and the email: sources that failed in each of these runs. */
export function brokenSources(runs: { errors: RunError[] | null }[], times = 3): string[] {
  if (runs.length < times) return [];
  const recent = runs.slice(0, times);
  const first = new Set((recent[0]!.errors ?? []).map((e) => e.source));
  return [...first].filter((s) => recent.every((r) => (r.errors ?? []).some((e) => e.source === s)));
}

export async function runPostsSync(opts: SyncOptions): Promise<SyncReport> {
  const log = opts.log ?? (() => {});
  const today = opts.today ?? dhakaToday();
  const report: SyncReport = {
    status: 'ok', dryRun: !!opts.dryRun, runId: null, tablesMissing: false,
    parsed: [], planned: [], add: [], close: [], identified: [], unchanged: 0, unmatched: [], errors: [], broken: [],
    sourceCounts: {}, sourceHashes: {}, sourceUrls: {}, mail: null, deploy: null,
  };
  const db = restDb();
  if (!db && !opts.dryRun) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed for a real run');

  // ---- a run row, and one run at a time ----
  if (db && !opts.dryRun) {
    try {
      const since = encodeURIComponent(new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString());
      await db.patch(`post_sync_runs?status=eq.running&started_at=lt.${since}`, {
        status: 'failed', finished_at: new Date().toISOString(), errors: [{ source: 'run', message: 'stopped before it finished' }],
      });
      const running = await db.get<{ id: number }[]>(`post_sync_runs?select=id&status=eq.running&started_at=gte.${since}`);
      if (running.length) {
        log(`another run (#${running[0]!.id}) started less than ${LOCK_MINUTES} minutes ago; skipping`);
        return { ...report, status: 'skipped' };
      }
      const [row] = await db.insert<{ id: number }>('post_sync_runs', { trigger: opts.trigger, status: 'running' });
      report.runId = row!.id;
    } catch (e) {
      if (!isMissingTable(e)) throw e;
      report.tablesMissing = true;
      report.status = 'failed';
      report.errors.push({ source: 'database', message: 'the posts tables are missing: run supabase/migrations/003_posts.sql' });
      return report;
    }
  }

  // ---- read every source ----
  for (const src of POST_SOURCES) {
    try {
      if (src.kind === 'cabinet') {
        const page = await loadCabinet(src);
        if (!page) { log(`${src.key}: not published (optional)`); continue; }
        const rows = parseCabinetPage(page.html, { key: src.key, url: page.url });
        report.sourceHashes[src.key] = sha256(cabinetListMarkup(page.html));
        report.sourceUrls[src.key] = page.url;
        report.sourceCounts[src.key] = rows.length;
        report.parsed.push(...rows);
      } else {
        const raw = await loadOfficers(src);
        const rows = parseOfficers(raw, src);
        report.sourceHashes[src.key] = sha256(JSON.stringify(rows.map((r) => [r.title, r.nameBn, r.nameEn, r.seatEn, r.fromDate])));
        report.sourceUrls[src.key] = src.url;
        report.sourceCounts[src.key] = rows.length;
        report.parsed.push(...rows);
      }
      log(`${src.key}: ${report.sourceCounts[src.key]} rows`);
    } catch (e) {
      report.errors.push({ source: src.key, message: (e as Error).message });
      log(`${src.key}: FAILED ${(e as Error).message}`);
    }
  }

  // ---- what is in the database now ----
  let previousRun: { source_counts: Record<string, number> | null; unmatched_names: Unmatched[] | null } | undefined;
  let openRows: PostRow[] = [];
  let aliases = new Map<string, string | null>();
  if (db) {
    try {
      [previousRun] = await db.get<NonNullable<typeof previousRun>[]>('post_sync_runs?select=source_counts,unmatched_names&status=eq.ok&order=started_at.desc&limit=1');
      openRows = await db.get<PostRow[]>('posts?select=*&to_date=is.null&limit=5000');
      const al = await db.get<{ name_key: string; member_id: string | null }[]>('post_aliases?select=name_key,member_id');
      aliases = new Map(al.map((a) => [a.name_key, a.member_id]));
    } catch (e) {
      if (!isMissingTable(e)) throw e;
      report.tablesMissing = true;
      log('posts tables missing: comparing against an empty table');
    }
  }

  // ---- the 60% guard ----
  for (const src of POST_SOURCES) {
    const n = report.sourceCounts[src.key];
    if (n === undefined || report.errors.some((e) => e.source === src.key)) continue;
    const prev = previousRun?.source_counts?.[src.key];
    if (n === 0) report.errors.push({ source: src.key, message: 'the list parsed to zero rows' });
    else if (prev && n < GUARD_RATIO * prev) report.errors.push({ source: src.key, message: `only ${n} rows, where the last good run had ${prev}` });
  }
  if (report.errors.length) return finish(report, db, opts, previousRun);

  // ---- who is who ----
  const previousNames = new Map(
    openRows.filter((r) => r.auto_synced && r.member_id).map((r) => [r.person_name_bn.normalize('NFC').trim(), r.member_id!]),
  );
  const resolve = buildMatcher(opts.members, aliases, previousNames);
  const planned = new Map<string, Planned>();
  const unmatched = new Map<string, Unmatched>();
  for (const p of report.parsed) {
    const r = resolve(p);
    const keepWithoutProfile = p.title === 'উপদেষ্টা' || r.method === 'alias-not-mp';
    if (!r.memberId && r.method !== 'alias-not-mp') {
      const key = normalizeName(p.nameBn);
      if (!unmatched.has(`${key}|${p.title}`)) {
        unmatched.set(`${key}|${p.title}`, {
          key, name_bn: p.nameBn, title: p.title, ministry_bn: p.ministryBn, source_key: p.sourceKey,
          stored_as_non_mp: keepWithoutProfile, candidates: r.candidates,
        });
      }
    }
    if (!r.memberId && !keepWithoutProfile) continue;
    const key = postKey(p.type, p.title, p.ministryBn, personKey(r.memberId, p.nameBn));
    if (!planned.has(key)) planned.set(key, { post: p, key, memberId: r.memberId, resolution: r });
  }
  report.planned = [...planned.values()];
  report.unmatched = [...unmatched.values()];

  // Someone kept without a profile who is now known to be an MP keeps their row; it gains the link.
  for (const row of openRows.filter((r) => r.auto_synced && !r.member_id)) {
    const r = resolve({ nameBn: row.person_name_bn, nameEn: row.person_name_en, seatEn: null } as ParsedPost);
    if (r.memberId) report.identified.push({ row, memberId: r.memberId });
  }
  const identifiedAs = new Map(report.identified.map((i) => [i.row.id, i.memberId]));

  // ---- the difference ----
  const open = new Map<string, PostRow>();
  for (const row of openRows) {
    open.set(postKey(row.type, row.title, row.ministry_bn, personKey(identifiedAs.get(row.id) ?? row.member_id, row.person_name_bn)), row);
  }
  const reorder: { id: number; order: number }[] = [];
  for (const plan of report.planned) {
    const row = open.get(plan.key);
    if (!row) { report.add.push(plan); continue; }
    report.unchanged++;
    if (row.auto_synced && row.source_order !== plan.post.order) reorder.push({ id: row.id, order: plan.post.order });
  }
  const readThisRun = new Set(Object.keys(report.sourceCounts));
  const plannedKeys = new Set(planned.keys());
  for (const [key, row] of open) {
    if (!row.auto_synced || plannedKeys.has(key)) continue; // hand-entered rows are never touched
    if (!row.source_key || !readThisRun.has(row.source_key)) continue; // only a list read now can close a row
    // A listed name the matcher could not place, close to this row's name in the same post: hold, don't close.
    const held = report.unmatched.some(
      (u) => u.title === row.title && ministryKey(u.ministry_bn) === ministryKey(row.ministry_bn) &&
        nameSimilarity(u.key, normalizeName(row.person_name_bn)) >= HOLD_SIMILARITY,
    );
    if (held) { report.unchanged++; continue; }
    report.close.push(row);
  }

  if (opts.dryRun || !db) return finish(report, db, opts, previousRun);

  // ---- write ----
  const now = new Date().toISOString();
  for (const i of report.identified) await db.patch(`posts?id=eq.${i.row.id}`, { member_id: i.memberId, is_mp: true, updated_at: now });
  for (const r of reorder) await db.patch(`posts?id=eq.${r.id}`, { source_order: r.order, updated_at: now });
  if (report.add.length) {
    await db.insert('posts', report.add.map((a) => ({
      type: a.post.type,
      title: a.post.title,
      rank_note: a.post.rankNote,
      ministry_bn: a.post.ministryBn,
      member_id: a.memberId,
      is_mp: !!a.memberId,
      person_name_bn: a.post.nameBn,
      person_name_en: a.post.nameEn,
      photo_url: a.memberId ? null : a.post.photoUrl,
      // The list's own date for this post when it gives one; otherwise the day the sync first saw it.
      from_date: a.post.fromDate ?? today,
      appointed_on: a.post.appointedOn,
      source_order: a.post.order,
      source_key: a.post.sourceKey,
      source_url: a.post.sourceUrl,
      source_hash: report.sourceHashes[a.post.sourceKey] ?? null,
      auto_synced: true,
    })));
  }
  const bySource = new Map<string, number[]>();
  for (const row of report.close) bySource.set(row.source_key!, [...(bySource.get(row.source_key!) ?? []), row.id]);
  for (const [source, ids] of bySource) {
    await db.patch(`posts?id=in.(${ids.join(',')})`, {
      to_date: today, auto_closed: true, closed_source_hash: report.sourceHashes[source] ?? null, updated_at: now,
    });
  }
  return finish(report, db, opts, previousRun);
}

/** Records the run, emails when something changed or failed, and rebuilds the site after a change. */
async function finish(
  report: SyncReport,
  db: Db | null,
  opts: SyncOptions,
  previousRun: { unmatched_names: Unmatched[] | null } | undefined,
): Promise<SyncReport> {
  if (report.errors.length) report.status = 'failed';
  if (opts.dryRun || !db || report.runId === null) return report;

  const changed = report.add.length + report.close.length + report.identified.length;
  const seenBefore = new Set((previousRun?.unmatched_names ?? []).map((u) => `${u.key}|${u.title}`));
  const newUnmatched = report.unmatched.filter((u) => !seenBefore.has(`${u.key}|${u.title}`));

  if (report.status === 'failed') {
    const earlier = await db
      .get<{ errors: RunError[] | null }[]>(`post_sync_runs?select=errors&status=in.(ok,failed)&id=neq.${report.runId}&order=started_at.desc&limit=2`)
      .catch(() => []);
    report.broken = brokenSources([{ errors: report.errors }, ...earlier]);
  }

  await db.patch(`post_sync_runs?id=eq.${report.runId}`, {
    finished_at: new Date().toISOString(),
    status: report.status,
    source_hashes: report.sourceHashes,
    source_counts: report.sourceCounts,
    parsed: report.parsed.length,
    added: report.add.length,
    closed: report.close.length,
    unchanged: report.unchanged,
    unmatched: report.unmatched.length,
    unmatched_names: report.unmatched,
    changes: [
      ...report.add.map((a) => ({ kind: 'added', title: a.post.title, ministry_bn: a.post.ministryBn, name_bn: a.post.nameBn, member_id: a.memberId })),
      ...report.close.map((r) => ({ kind: 'closed', title: r.title, ministry_bn: r.ministry_bn, name_bn: r.person_name_bn, member_id: r.member_id })),
      ...report.identified.map((i) => ({ kind: 'identified', title: i.row.title, ministry_bn: i.row.ministry_bn, name_bn: i.row.person_name_bn, member_id: i.memberId })),
    ],
    errors: report.errors,
  });

  if (report.status === 'failed' || changed > 0 || newUnmatched.length > 0) {
    report.mail = await sendSyncMail(mailSubject(report, changed), mailText(report, newUnmatched));
  }
  if (report.status === 'ok' && changed > 0) {
    const r = await requestRebuild('posts-sync');
    report.deploy = r.ok ? 'site rebuild requested' : r.reason === 'no-token' ? `not rebuilt: ${r.detail}` : `rebuild failed: ${r.detail}`;
  }
  return report;
}

const bnDigits = (n: number | string) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
const postLabel = (title: string, ministry: string | null) => (ministry ? `${title}, ${ministry}` : title);

function mailSubject(r: SyncReport, changed: number) {
  if (r.status === 'failed') return `আমার এমপি: সরকারি পদ সিঙ্ক ব্যর্থ${r.broken.length ? ' (টানা তিনবার)' : ''}`;
  return `আমার এমপি: সরকারি পদে ${bnDigits(changed)}টি পরিবর্তন`;
}

function mailText(r: SyncReport, newUnmatched: Unmatched[]) {
  const when = new Intl.DateTimeFormat('bn-BD', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date());
  const lines = [`সরকারি পদ সিঙ্ক, ${when}`, `ফল: ${r.status === 'ok' ? 'সফল' : 'ব্যর্থ, কোনো তথ্য বদলানো হয়নি'}`, ''];
  if (r.add.length) {
    lines.push(`যুক্ত হয়েছে (${bnDigits(r.add.length)}):`);
    for (const a of r.add) lines.push(`  ${a.post.nameBn}: ${postLabel(a.post.title, a.post.ministryBn)}${a.memberId ? '' : ' (সংসদ সদস্য নন)'}`);
    lines.push('');
  }
  if (r.close.length) {
    lines.push(`শেষ হয়েছে (${bnDigits(r.close.length)}):`);
    for (const c of r.close) lines.push(`  ${c.person_name_bn}: ${postLabel(c.title, c.ministry_bn)}`);
    lines.push('');
  }
  if (r.identified.length) {
    lines.push(`সংসদ সদস্য হিসেবে চেনা গেছে (${bnDigits(r.identified.length)}):`);
    for (const i of r.identified) lines.push(`  ${i.row.person_name_bn}: ${postLabel(i.row.title, i.row.ministry_bn)}`);
    lines.push('');
  }
  if (r.unmatched.length) {
    lines.push(`মেলানো যায়নি (${bnDigits(r.unmatched.length)}, এর মধ্যে নতুন ${bnDigits(newUnmatched.length)}):`);
    for (const u of r.unmatched) lines.push(`  ${u.name_bn}: ${postLabel(u.title, u.ministry_bn)}${u.stored_as_non_mp ? ' (সংসদ সদস্য নন হিসেবে রাখা হয়েছে)' : ''}`);
    lines.push('');
  }
  if (r.errors.length) {
    lines.push('ব্যর্থতা:');
    for (const e of r.errors) lines.push(`  ${e.source}: ${e.message}`);
    lines.push('');
  }
  for (const s of r.broken) {
    lines.push(`${s} টানা তিনবার পড়া যায়নি। পাতার গঠন বদলেছে কিনা দেখে config/sync-sources.ts হালনাগাদ করুন: ${r.sourceUrls[s] ?? ''}`);
  }
  lines.push('', 'পর্যালোচনা: https://mymp.bd/admin/sync');
  return lines.join('\n');
}
