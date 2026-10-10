/**
 * Rebuilds and redeploys mymp.bd via the Dokploy deploy webhook.
 * Every build re-reads the official sources and the admin database
 * (scripts/sync.mjs), so this is how an edit, a posts change or a
 * night's parliament data reaches visitors.
 */
export type RebuildResult =
  | { ok: true }
  | { ok: false; reason: "no-config" | "refused" | "unreachable"; detail: string };

export async function requestRebuild(source: string): Promise<RebuildResult> {
  const webhook = process.env.DOKPLOY_DEPLOY_WEBHOOK?.trim();
  if (!webhook) {
    return { ok: false, reason: "no-config", detail: "DOKPLOY_DEPLOY_WEBHOOK is not set" };
  }
  try {
    const res = await fetch(webhook, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: "refused", detail: `Dokploy webhook HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: "unreachable", detail: (e as Error).message };
  }
}