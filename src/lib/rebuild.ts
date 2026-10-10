/**
 * Rebuilds and redeploys mymp.bd. Every build re-reads the official sources and
 * the admin database (scripts/sync.mjs), so this is how an edit, a posts change
 * or a night's parliament data reaches visitors.
 *
 * Two ways, the first one configured wins:
 *
 *   DEPLOY_HOOK_URL     the deploy webhook of the platform that builds the site
 *                       (Coolify, Dokploy and the like). POST by default;
 *                       DEPLOY_HOOK_METHOD=GET for a platform that wants a GET,
 *                       DEPLOY_HOOK_TOKEN is sent as a bearer token when set.
 *   MYMP_DEPLOY_TOKEN   the `rebuild` dispatch to GitHub that
 *                       .github/workflows/deploy.yml listens for. A fine-grained
 *                       token for this repository only, Contents: Read and write.
 *
 * The worker container sends the same request (sangsad/worker/src/scheduler.ts).
 */
export type RebuildResult = { ok: true } | { ok: false; reason: 'no-token' | 'refused' | 'unreachable'; detail: string };

interface RebuildRequest {
  url: string;
  init: RequestInit;
  target: string;
}

function rebuildRequest(source: string): RebuildRequest | null {
  const hook = process.env.DEPLOY_HOOK_URL?.trim();
  if (hook) {
    const token = process.env.DEPLOY_HOOK_TOKEN?.trim();
    const method = process.env.DEPLOY_HOOK_METHOD?.trim().toUpperCase() === 'GET' ? 'GET' : 'POST';
    return { url: hook, init: { method, headers: token ? { authorization: `Bearer ${token}` } : {} }, target: 'the deploy webhook' };
  }
  const token = process.env.MYMP_DEPLOY_TOKEN?.trim();
  if (!token) return null;
  const repo = process.env.DEPLOY_REPOSITORY?.trim() || 'touristvisadomain-cloud/mymp';
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
    target: 'GitHub',
  };
}

export async function requestRebuild(source: string): Promise<RebuildResult> {
  const request = rebuildRequest(source);
  if (!request) return { ok: false, reason: 'no-token', detail: 'neither DEPLOY_HOOK_URL nor MYMP_DEPLOY_TOKEN is set' };
  try {
    const res = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return { ok: true };
    return { ok: false, reason: 'refused', detail: `${request.target} answered HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: 'unreachable', detail: `${request.target}: ${(e as Error).message}` };
  }
}
