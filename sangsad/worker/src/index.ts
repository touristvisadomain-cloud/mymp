/**
 * Worker entry point. Jobs are plain async functions registered by name and
 * run one at a time: `pnpm worker <job>`. The scheduler (GitHub Actions or a
 * VPS cron) calls the same entry, so a job behaves identically everywhere.
 * Every run is recorded in ingest_runs, success or failure.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { closeDb, getDb } from '@sangsad/db';
import { ingestRuns } from '@sangsad/db/schema';
import { parliamentGet } from '@sangsad/shared';
import { runParliament } from './jobs/parliament';
import { runPhotos } from './jobs/photos';
import { runReport } from './jobs/report';
import { runSourcesInspect } from './jobs/sources-inspect';
import { runNews, runNewsRematch } from './jobs/news';
import { runResults2026 } from './jobs/results-wiki';
import { runSocialWiki } from './jobs/social-wiki';
import { runBioWiki } from './jobs/bio-wiki';
import { runOgCards } from './jobs/og-cards';

config({ path: resolve(import.meta.dirname, '../../.env.local') });
config({ path: resolve(import.meta.dirname, '../../.env') });

type Job = () => Promise<{ itemsFound: number; itemsNew: number }>;

const jobs: Record<string, Job> = {
  /** Proves the two things every later job depends on: the database and parliament.gov.bd. */
  async health() {
    const db = getDb();
    const rows = await db.execute<{ now: string }>(sql`select now()::text as now`);
    const now = rows[0]?.now ?? '?';
    const parl = await parliamentGet<{ total: number }>('/api/members?parliamentNo=13&limit=1&page=1');
    console.log(`db ok (${now}); parliament.gov.bd ok (${parl.total} sitting members)`);
    return { itemsFound: parl.total, itemsNew: 0 };
  },
  /** Members, parties, officers, committees, sessions, notices, earlier terms. */
  parliament: () => runParliament(getDb()),
  /** Copies official photos into Supabase Storage. */
  'parliament:photos': () => runPhotos(getDb()),
  /** Writes docs/reports/parliament-<date>.md. */
  'parliament:report': () => runReport(getDb()),
  /** Inspects every news source (robots.txt, feeds) and records it in config/sources.json and docs/SOURCES.md. */
  'sources:inspect': () => runSourcesInspect(),
  /** Reads the active news sources, matches new stories to members, hands matches to mymp.bd. */
  news: () => runNews(getDb()),
  /** Re-runs the matcher over the last week's articles (after the matcher changes). */
  'news:rematch': () => runNewsRematch(getDb()),
  /** 2026 results from TBS and Wikipedia into mymp.bd's election_results (new seats as drafts). */
  'results:2026': () => runResults2026(getDb()),
  /** The same, and rewrites its own earlier rows that no editor has saved since. */
  'results:2026:refresh': () => runResults2026(getDb(), 13, { refresh: true }),
  /** Official website and social links of sitting members from their Wikipedia articles, into mymp.bd. */
  'social:wikipedia': () => runSocialWiki(getDb()),
  /** Education, birthplace and missing professions of sitting members from their Wikipedia infobox, into mymp.bd. */
  'bio:wikipedia': () => runBioWiki(getDb()),
  /** Link-preview cards (photo, name, seat, party) for every sitting member, into the public mirror. */
  'og:cards': () => runOgCards(getDb()),
};

async function run(name: string) {
  const job = jobs[name];
  if (!job) {
    console.error(`unknown job "${name}"; known: ${Object.keys(jobs).join(', ')}`);
    process.exit(2);
  }
  const db = getDb();
  const [runRow] = await db.insert(ingestRuns).values({ job: name }).returning({ id: ingestRuns.id });
  const started = Date.now();
  try {
    const result = await job();
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), ok: true, itemsFound: result.itemsFound, itemsNew: result.itemsNew })
      .where(sql`${ingestRuns.id} = ${runRow!.id}`);
    console.log(`job ${name}: ok in ${Math.round((Date.now() - started) / 1000)}s`);
    await closeDb();
    process.exit(0);
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), ok: false, errors: 1, errorText: message.slice(0, 2000) })
      .where(sql`${ingestRuns.id} = ${runRow!.id}`);
    console.error(`job ${name}: failed: ${message}`);
    await closeDb();
    process.exit(1);
  }
}

run(process.argv[2] ?? 'health');
