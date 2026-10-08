/**
 * Rebuilds and redeploys mymp.bd on the VPS. Every build re-reads the official
 * sources and the admin database (scripts/sync.mjs), so this is how an edit,
 * a posts change or a night's parliament data reaches visitors.
 *
 * It asks GitHub for the `rebuild` dispatch that .github/workflows/deploy.yml
 * listens for, always building main. MYMP_DEPLOY_TOKEN is a fine-grained token
 * for this repository only, with Contents: Read and write (the permission the
 * dispatch endpoint requires). The worker container sends the same request
 * (sangsad/worker/src/scheduler.ts).
 */
export type RebuildResult = { ok: true } | { ok: false; reason: 'no-token' | 'refused' | 'unreachable'; detail: string };

export async function requestRebuild(source: string): Promise<RebuildResult> {
  const token = process.env.MYMP_DEPLOY_TOKEN?.trim();
  if (!token) return { ok: false, reason: 'no-token', detail: 'MYMP_DEPLOY_TOKEN is not set' };
  const repo = process.env.DEPLOY_REPOSITORY?.trim() || 'touristvisadomain-cloud/mymp';
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ event_type: 'rebuild', client_payload: { source } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: 'refused', detail: `GitHub HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: 'unreachable', detail: (e as Error).message };
  }
}
