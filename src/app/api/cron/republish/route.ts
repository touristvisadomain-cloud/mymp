import { NextResponse } from 'next/server';
import { requestRebuild } from '@/lib/rebuild';

export const dynamic = 'force-dynamic';

/**
 * Rebuilds the site on request. Rebuilding is what refreshes the site from
 * parliament.gov.bd and applies every admin edit. The worker container already
 * rebuilds every night after the parliament jobs (sangsad/worker/src/scheduler.ts);
 * this route is for anything else that should be able to ask for one.
 *
 * Callers send `Authorization: Bearer <CRON_SECRET>`; anything else is refused.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const r = await requestRebuild('cron-republish');
  return NextResponse.json(
    r.ok ? { ok: true, at: new Date().toISOString() } : { ok: false, error: r.detail, at: new Date().toISOString() },
    { status: r.ok ? 200 : r.reason === 'no-config' ? 500 : 502 },
  );
}
