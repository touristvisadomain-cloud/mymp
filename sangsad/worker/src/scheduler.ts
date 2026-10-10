/**
 * The clock of the worker container (docker-compose.yml, service `worker`, built
 * from sangsad/Dockerfile). It took over from the GitHub schedules that were
 * deleted with the move to the VPS:
 *
 *   02:00 Dhaka (20:00 UTC)  parliament → parliament:photos → parliament:report,
 *                            then a rebuild of mymp.bd (also the nightly rebuild
 *                            that applies the day's admin edits)
 *   every 30 minutes         news; on the hour every third hour (UTC) a rebuild
 *                            when it succeeded, so new headlines reach the pages
 *
 * Each job runs exactly as by hand: `pnpm worker <job>` in sangsad/.
 *
 * With WORKER_SITE_JOBS=on it also calls mymp.bd's own /api/cron routes on the
 * beat the deleted feed-loop, feed-search and sync-posts workflows kept, plus the
 * daily press and weekly learn collectors vercel.json used to run. Leave it off
 * while Supabase Cron still calls those routes, or every collector runs twice and
 * the YouTube and search quotas run out by midday.
 *
 * Work runs in two lanes, one job at a time each: the সংসদ jobs share a database,
 * the site calls share the outlets. A slot that comes due while its lane is still
 * busy is skipped and logged, not queued; the next slot picks up what it missed.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Lane = 'sangsad' | 'site';

export type Step =
  | { kind: 'job'; job: string; timeoutMinutes: number }
  | { kind: 'call'; path: string };

export interface Slot {
  name: string;
  lane: Lane;
  steps: Step[];
  /** `always`: rebuild after the steps whatever happened. `on-success`: only when every step passed. */
  rebuild?: 'always' | 'on-success';
}

const job = (name: string, timeoutMinutes: number): Step => ({ kind: 'job', job: name, timeoutMinutes });
const call = (path: string): Step => ({ kind: 'call', path });

/** Everything due in the UTC minute that `at` falls in, in the order it runs. */
export function dueSlots(at: Date, siteJobs: boolean): Slot[] {
  const h = at.getUTCHours();
  const m = at.getUTCMinutes();
  const slots: Slot[] = [];

  if (h === 20 && m === 0) {
    slots.push({
      name: 'parliament nightly',
      lane: 'sangsad',
      steps: [job('parliament', 40), job('parliament:photos', 30), job('parliament:report', 10)],
      rebuild: 'always',
    });
  }
  if (m % 30 === 0) {
    slots.push({ name: 'news', lane: 'sangsad', steps: [job('news', 15)], ...(m === 0 && h % 3 === 0 ? { rebuild: 'on-success' as const } : {}) });
  }
  if (!siteJobs) return slots;

  // News feeds and outlet sitemaps take turns every quarter hour, pictures follow
  // each feed run, and YouTube runs once an hour: the beat of the old feed-loop.yml.
  if (m % 15 === 0) {
    const quarter = h * 4 + m / 15;
    const steps =
      quarter % 2 === 0
        ? [call('/api/cron/feed?collector=rss'), call('/api/cron/feed?collector=thumbs')]
        : [call('/api/cron/feed?collector=sitemap')];
    if (quarter % 4 === 1) steps.push(call('/api/cron/feed?collector=youtube'));
    slots.push({ name: 'feed', lane: 'site', steps });
  }
  if (m === 45) slots.push({ name: 'search', lane: 'site', steps: [call('/api/cron/feed?collector=search')] });
  if (m === 40 && h % 6 === 0) slots.push({ name: 'posts sync', lane: 'site', steps: [call('/api/cron/sync-posts')] });
  if (h === 3 && m === 40) slots.push({ name: 'press', lane: 'site', steps: [call('/api/cron/feed?collector=press')] });
  if (at.getUTCDay() === 1 && h === 4 && m === 0) slots.push({ name: 'learn', lane: 'site', steps: [call('/api/cron/feed?collector=learn')] });
  if (m === 0 && h % 6 === 0) slots.push({ name: 'probe', lane: 'site', steps: [call('/api/cron/probe')] });
  return slots;
}

const pick = (...values: (string | undefined)[]) => values.find((v) => v !== undefined && v.trim() !== '');

/**
 * The environment a সংসদ job runs with. One Supabase for everything.
 */
export function jobEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    DATABASE_URL: env.DATABASE_URL,
    DATABASE_SSL: env.DATABASE_SSL ?? 'disable',
    DATABASE_SCHEMA: env.DATABASE_SCHEMA ?? 'sangsad',
    APP_ENV: env.APP_ENV ?? 'production',
  };
}

/**
 * The call that rebuilds and redeploys mymp.bd, the same request as
 * src/lib/rebuild.ts in the site: the hosting platform's deploy webhook when
 * DEPLOY_HOOK_URL is set (DEPLOY_HOOK_METHOD=GET and DEPLOY_HOOK_TOKEN when the
 * platform wants them), else the `rebuild` dispatch to GitHub that
 * .github/workflows/deploy.yml listens for. Null when neither is configured.
 */
export function rebuildRequest(env: NodeJS.ProcessEnv, source: string): { url: string; init: RequestInit } | null {
  const hook = pick(env.DEPLOY_HOOK_URL);
  if (hook) {
    const hookToken = pick(env.DEPLOY_HOOK_TOKEN);
    return {
      url: hook,
      init: {
        method: pick(env.DEPLOY_HOOK_METHOD)?.toUpperCase() === 'GET' ? 'GET' : 'POST',
        headers: hookToken ? { authorization: `Bearer ${hookToken}` } : {},
      },
    };
  }
  const token = pick(env.MYMP_DEPLOY_TOKEN);
  if (!token) return null;
  const repo = pick(env.DEPLOY_REPOSITORY) ?? 'touristvisadomain-cloud/mymp';
  return {
    url: `https://api.github.com/repos/${repo}/dispatches`,
    init: {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ event_type: 'rebuild', client_payload: { source } }),
    },
  };
}

const SANGSAD_DIR = resolve(import.meta.dirname, '../..');
const running = new Set<ChildProcess>();
const busy = new Set<Lane>();

const log = (message: string) => console.log(`${new Date().toISOString()} [scheduler] ${message}`);

/** Stops a job with everything it started: pnpm, tsx and node run as one process group. */
function stop(child: ChildProcess, signal: NodeJS.Signals) {
  try {
    if (child.pid) process.kill(-child.pid, signal);
  } catch {
    // already gone
  }
}

function runJob(step: Extract<Step, { kind: 'job' }>): Promise<boolean> {
  return new Promise((done) => {
    const started = Date.now();
    let settled = false;
    const finish = (ok: boolean, how: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      running.delete(child);
      log(`${step.job}: ${how} after ${Math.round((Date.now() - started) / 1000)}s`);
      done(ok);
    };
    const child = spawn('pnpm', ['worker', step.job], { cwd: SANGSAD_DIR, env: jobEnv(process.env), stdio: 'inherit', detached: true });
    running.add(child);
    const timer = setTimeout(() => {
      log(`${step.job}: still running after ${step.timeoutMinutes} min, stopping it`);
      stop(child, 'SIGTERM');
      setTimeout(() => stop(child, 'SIGKILL'), 10_000).unref();
    }, step.timeoutMinutes * 60_000);
    child.on('error', (err) => finish(false, `could not start (${err.message})`));
    child.on('exit', (code, signal) => finish(code === 0, code === 0 ? 'ok' : `failed (${signal ?? `exit ${code}`})`));
  });
}

async function callSite(path: string): Promise<boolean> {
  const base = (pick(process.env.MYMP_INTERNAL_URL) ?? 'http://127.0.0.1:5000').replace(/\/$/, '');
  const secret = pick(process.env.CRON_SECRET);
  if (!secret) {
    log(`${path}: not called, CRON_SECRET is not set`);
    return false;
  }
  try {
    const res = await fetch(base + path, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(5 * 60_000) });
    const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 300);
    log(`${path} -> ${res.status} ${body}`);
    return res.ok;
  } catch (err) {
    log(`${path} -> ${(err as Error).message}`);
    return false;
  }
}

async function rebuild(source: string) {
  const request = rebuildRequest(process.env, `worker:${source}`);
  if (!request) {
    log(`${source}: no rebuild, neither DEPLOY_HOOK_URL nor MYMP_DEPLOY_TOKEN is set`);
    return;
  }
  try {
    const res = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(30_000) });
    log(res.ok ? `${source}: rebuild of mymp.bd requested` : `${source}: rebuild refused, HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    log(`${source}: rebuild request failed (${(err as Error).message})`);
  }
}

async function runSlot(slot: Slot) {
  log(`${slot.name}: start`);
  let ok = true;
  for (const step of slot.steps) {
    const passed = step.kind === 'job' ? await runJob(step) : await callSite(step.path);
    if (passed) continue;
    ok = false;
    // A failed সংসদ job ends its chain, as the nightly workflow did; site calls do not depend on each other.
    if (step.kind === 'job') break;
  }
  if (slot.rebuild === 'always' || (slot.rebuild === 'on-success' && ok)) await rebuild(slot.name);
}

function runInLane(lane: Lane, slots: Slot[]) {
  if (busy.has(lane)) {
    log(`skipped ${slots.map((s) => s.name).join(', ')}: the ${lane} lane is still busy`);
    return;
  }
  busy.add(lane);
  void (async () => {
    try {
      for (const slot of slots) await runSlot(slot);
    } catch (err) {
      log(`${lane} lane: ${(err as Error).message}`);
    } finally {
      busy.delete(lane);
    }
  })();
}

function tick(at: Date, siteJobs: boolean) {
  const slots = dueSlots(at, siteJobs);
  for (const lane of ['sangsad', 'site'] as const) {
    const mine = slots.filter((s) => s.lane === lane);
    if (mine.length) runInLane(lane, mine);
  }
}

/** Fires once per minute, a second past the minute, with the minute itself as the time. */
function every(minuteHandler: (at: Date) => void) {
  const now = Date.now();
  const next = Math.floor(now / 60_000) * 60_000 + 60_000;
  setTimeout(() => {
    minuteHandler(new Date(next));
    every(minuteHandler);
  }, next - now + 1_000);
}

function main() {
  const siteJobs = pick(process.env.WORKER_SITE_JOBS)?.toLowerCase() === 'on';
  const rebuildsVia = pick(process.env.DEPLOY_HOOK_URL) ? 'the deploy webhook' : pick(process.env.MYMP_DEPLOY_TOKEN) ? 'GitHub' : null;
  log(
    `started; site jobs ${siteJobs ? 'on' : 'off'}; rebuilds ${rebuildsVia ? `via ${rebuildsVia}` : 'off (neither DEPLOY_HOOK_URL nor MYMP_DEPLOY_TOKEN is set)'}`,
  );
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      log(`${signal}: stopping ${running.size} running job(s)`);
      for (const child of running) stop(child, 'SIGTERM');
      process.exit(0);
    });
  }
  // One health run on every start proves the database and parliament.gov.bd are reachable from here.
  runInLane('sangsad', [{ name: 'health on start', lane: 'sangsad', steps: [job('health', 2)] }]);
  every((at) => tick(at, siteJobs));
}

/** `pnpm job <job> [<job> …]`: runs jobs once, by hand, with the environment the schedule uses. */
async function runByHand(names: string[]) {
  if (!names.length) {
    console.error('usage: pnpm job <job> [<job> …]');
    process.exit(2);
  }
  for (const name of names) {
    if (!(await runJob({ kind: 'job', job: name, timeoutMinutes: 60 }))) process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'run') void runByHand(process.argv.slice(3));
  else main();
}
