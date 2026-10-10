/**
 * Rebuilds and redeploys mymp.bd via the Dokploy API.
 * Every build re-reads the official sources and the admin database
 * (scripts/sync.mjs), so this is how an edit, a posts change or a
 * night's parliament data reaches visitors.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RebuildResult =
  | { ok: true }
  | { ok: false; reason: "no-config" | "refused" | "unreachable"; detail: string };

export async function requestRebuild(source: string): Promise<RebuildResult> {
  const apiKey = process.env.DOKPLOY_API_KEY?.trim();
  const appId = process.env.DOKPLOY_APP_ID?.trim();
  const apiUrl = process.env.DOKPLOY_API_URL?.trim() || "http://13.140.59.8:3000";

  if (!apiKey || !appId) {
    return { ok: false, reason: "no-config", detail: "DOKPLOY_API_KEY and DOKPLOY_APP_ID must be set" };
  }

  const deployUrl = `${apiUrl}/api/application.deploy`;
  console.log(`[rebuild] ${source}: POST ${deployUrl} (appId=${appId})`);

  try {
    const { stdout, stderr } = await execFileAsync("curl", [
      "-s",
      "-w", "\n%{http_code}",
      "-X", "POST",
      "-H", "Content-Type: application/json",
      "-H", `x-api-key: ${apiKey}`,
      "-d", JSON.stringify({ applicationId: appId, title: `Rebuild from ${source}` }),
      "--connect-timeout", "15",
      deployUrl,
    ], { timeout: 30_000 });

    const lines = stdout.trim().split("\n");
    const statusCode = parseInt(lines[lines.length - 1] || "0", 10);
    const body = lines.slice(0, -1).join("\n");

    console.log(`[rebuild] ${source}: curl HTTP ${statusCode} ${body.slice(0, 200)}`);

    if (statusCode >= 200 && statusCode < 300) return { ok: true };
    return { ok: false, reason: "refused", detail: `Dokploy API HTTP ${statusCode}: ${body.slice(0, 200)}` };
  } catch (e) {
    console.log(`[rebuild] ${source}: curl error: ${(e as Error).message}`);
    return { ok: false, reason: "unreachable", detail: (e as Error).message };
  }
}