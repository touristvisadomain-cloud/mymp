/**
 * Rebuilds and redeploys mymp.bd via the Dokploy API.
 * Every build re-reads the official sources and the admin database
 * (scripts/sync.mjs), so this is how an edit, a posts change or a
 * night's parliament data reaches visitors.
 */
export type RebuildResult =
  | { ok: true }
  | { ok: false; reason: "no-config" | "refused" | "unreachable"; detail: string };

export async function requestRebuild(source: string): Promise<RebuildResult> {
  const apiKey = process.env.DOKPLOY_API_KEY?.trim();
  const appId = process.env.DOKPLOY_APP_ID?.trim();
  const apiUrl = process.env.DOKPLOY_API_URL?.trim() || "http://dokploy:3000";

  if (!apiKey || !appId) {
    return { ok: false, reason: "no-config", detail: "DOKPLOY_API_KEY and DOKPLOY_APP_ID must be set" };
  }

  const deployUrl = `${apiUrl}/api/application.deploy`;
  console.log(`[rebuild] ${source}: POST ${deployUrl} (appId=${appId})`);

  try {
    const res = await fetch(deployUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ applicationId: appId, title: `Rebuild from ${source}` }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: "refused", detail: `Dokploy API HTTP ${res.status}` };
  } catch (e) {
    console.log(`[rebuild] ${source}: fetch error: ${(e as Error).message}`);
    return { ok: false, reason: "unreachable", detail: (e as Error).message };
  }
}