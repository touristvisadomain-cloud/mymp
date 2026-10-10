/**
 * Rebuilds and redeploys mymp.bd on the VPS. Every build re-reads the official
 * sources and the admin database (scripts/sync.mjs), so this is how an edit,
 * a posts change or a night's parliament data reaches visitors.
 *
 * Uses the Dokploy deploy webhook when DOKPLOY_DEPLOY_WEBHOOK is set.
 * Falls back to GitHub repository_dispatch when MYMP_DEPLOY_TOKEN is set.
 */
export type RebuildResult = { ok: true } | { ok: false; reason: 'no-config' | 'refused' | 'unreachable'; detail: string };

export async function requestRebuild(source: string): Promise<RebuildResult> {
  // Dokploy webhook (preferred)
  const webhook = process.env.DOKPLOY_DEPLOY_WEBHOOK?.trim();
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { ok: true };
      return { ok: false, reason: 'refused', detail: `Dokploy webhook HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, reason: 'unreachable', detail: (e as Error).message };
    }
  }

  // GitHub repository_dispatch (legacy fallback)
  const token = process.env.MYMP_DEPLOY_TOKEN?.trim();
  if (!token) return { ok: false, reason: 'no-config', detail: 'neither DOKPLOY_DEPLOY_WEBHOOK nor MYMP_DEPLOY_TOKEN is set' };
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
