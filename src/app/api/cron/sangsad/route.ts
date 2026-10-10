/**
 * Runs সংসদ worker jobs on demand, called by Supabase Cron.
 *
 * Replaces the Docker worker container's scheduler (sangsad/worker/src/scheduler.ts).
 * Each job runs as `pnpm worker <job>` inside the sangsad/ directory, exactly as
 * the scheduler and manual `pnpm job` do. Results are recorded in the sangsad
 * database's ingest_runs table by the job itself.
 *
 * Parliament-nightly is a composite: parliament → parliament:photos →
 * parliament:report, then a rebuild of mymp.bd (the same chain the scheduler
 * ran at 02:00 Dhaka). All other jobs are single.
 *
 * Jobs run in the background; the endpoint returns immediately so Supabase
 * Cron's pg_net request does not hold a connection open for 40 minutes.
 */
import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { requestRebuild } from '@/lib/rebuild';

export const dynamic = 'force-dynamic';

const SANGSAD_DIR = resolve(process.cwd(), 'sangsad');

const JOBS = new Set([
  'health',
  'parliament',
  'parliament:photos',
  'parliament:report',
  'news',
  'sources:inspect',
  'news:rematch',
  'results:2026',
  'social:wikipedia',
  'bio:wikipedia',
  'og:cards',
]);

const TIMEOUT_MINUTES: Record<string, number> = {
  health: 5,
  parliament: 40,
  'parliament:photos': 30,
  'parliament:report': 10,
  news: 15,
  'sources:inspect': 15,
  'news:rematch': 20,
  'results:2026': 15,
  'social:wikipedia': 15,
  'bio:wikipedia': 15,
  'og:cards': 15,
};

const log = (msg: string) => console.log(`${new Date().toISOString()} [cron/sangsad] ${msg}`);

function runJob(name: string): Promise<boolean> {
  return new Promise((done) => {
    const started = Date.now();
    const timeout = (TIMEOUT_MINUTES[name] ?? 30) * 60_000;
    let settled = false;
    const finish = (ok: boolean, how: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      log(`${name}: ${how} after ${Math.round((Date.now() - started) / 1000)}s`);
      done(ok);
    };
    const child = spawn('pnpm', ['worker', name], {
      cwd: SANGSAD_DIR,
      env: {
        ...process.env,
        DATABASE_URL: process.env.SANGSAD_DATABASE_URL || process.env.DATABASE_URL,
        DATABASE_SSL: process.env.SANGSAD_DATABASE_SSL || 'disable',
        DATABASE_SCHEMA: process.env.SANGSAD_DATABASE_SCHEMA || 'sangsad',
        NEXT_PUBLIC_SUPABASE_URL: process.env.SANGSAD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SANGSAD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        MYMP_SUPABASE_URL: process.env.MYMP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        MYMP_SUPABASE_SERVICE_ROLE_KEY: process.env.MYMP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        APP_ENV: process.env.APP_ENV || 'production',
      },
      stdio: 'inherit',
      detached: true,
    });
    const timer = setTimeout(() => {
      log(`${name}: still running after ${TIMEOUT_MINUTES[name] ?? 30} min, stopping`);
      try { if (child.pid) process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
      setTimeout(() => { try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, 10_000).unref();
    }, timeout);
    child.on('error', (err) => finish(false, `could not start (${err.message})`));
    child.on('exit', (code, signal) => finish(code === 0, code === 0 ? 'ok' : `failed (${signal ?? `exit ${code}`})`));
  });
}

async function parliamentNightly() {
  const chain = ['parliament', 'parliament:photos', 'parliament:report'];
  for (const job of chain) {
    log(`parliament-nightly: running ${job}`);
    if (!(await runJob(job))) {
      log(`parliament-nightly: ${job} failed, stopping chain`);
      return;
    }
  }
  log('parliament-nightly: chain done, requesting rebuild');
  const r = await requestRebuild('cron-sangsad:parliament-nightly');
  log(`parliament-nightly: rebuild ${r.ok ? 'requested' : `failed (${r.reason})`}`);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.get('authorization') ?? '') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const job = url.searchParams.get('job') ?? 'health';
  const deploy = url.searchParams.get('deploy') === '1';

  if (job === 'parliament-nightly') {
    void parliamentNightly();
    return NextResponse.json({ ok: true, job, started: true, deploy });
  }

  if (!JOBS.has(job)) {
    return NextResponse.json(
      { ok: false, error: `unknown job "${job}"; known: ${Array.from(JOBS).join(', ')}, parliament-nightly` },
      { status: 400 },
    );
  }

  void (async () => {
    const ok = await runJob(job);
    if (deploy && ok) {
      log(`${job}: deploy=1, requesting rebuild`);
      const r = await requestRebuild(`cron-sangsad:${job}`);
      log(`${job}: rebuild ${r.ok ? 'requested' : `failed (${r.reason})`}`);
    }
  })();

  return NextResponse.json({ ok: true, job, started: true, deploy });
}