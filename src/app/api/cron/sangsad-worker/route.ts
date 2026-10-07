import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs sangsad worker jobs via Supabase Cron.
 * Called with ?job=parliament, ?job=parliament:photos, ?job=parliament:report, etc.
 * Add &deploy=1 to trigger a VPS redeployment after the job succeeds.
 * Authenticates with CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    (req.headers.get("authorization") ?? "") !== `Bearer ${secret}`
  ) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const job = url.searchParams.get("job") ?? "parliament";
  const shouldDeploy = url.searchParams.get("deploy") === "1";

  const validJobs = [
    "parliament",
    "parliament:photos",
    "parliament:report",
    "news",
    "news:rematch",
    "sources:inspect",
    "results:2026",
    "results:2026:refresh",
    "social:wikipedia",
    "bio:wikipedia",
    "og:cards",
    "health",
  ];

  if (!validJobs.includes(job)) {
    return NextResponse.json(
      {
        ok: false,
        error: `invalid job "${job}"; valid: ${validJobs.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const sangsadDir = resolve(process.cwd(), "sangsad");

  try {
    const output = execSync(`pnpm worker ${job}`, {
      cwd: sangsadDir,
      timeout: 55_000,
      encoding: "utf-8",
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.SANGSAD_DATABASE_URL ?? process.env.DATABASE_URL,
        DATABASE_SSL: process.env.SANGSAD_DATABASE_SSL ?? "disable",
        DATABASE_SCHEMA: process.env.SANGSAD_DATABASE_SCHEMA ?? "sangsad",
        NEXT_PUBLIC_SUPABASE_URL:
          process.env.SANGSAD_SUPABASE_URL ??
          process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY:
          process.env.SANGSAD_SUPABASE_SERVICE_ROLE_KEY ??
          process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let deployResult: { triggered: boolean; error?: string } | undefined;
    if (shouldDeploy) {
      deployResult = await triggerVpsDeploy(job);
    }

    return NextResponse.json({
      ok: true,
      job,
      output: output.slice(-2000),
      deploy: deployResult,
    });
  } catch (err) {
    const error = err as { message?: string; stderr?: string; stdout?: string };
    return NextResponse.json(
      {
        ok: false,
        job,
        error: error.message ?? "unknown error",
        stderr: error.stderr?.slice(-2000),
        stdout: error.stdout?.slice(-2000),
      },
      { status: 500 },
    );
  }
}

/**
 * Triggers a VPS redeployment by sending a repository_dispatch event to GitHub.
 * This is the same mechanism used by the deleted sangsad-worker.yml workflow.
 */
async function triggerVpsDeploy(
  job: string,
): Promise<{ triggered: boolean; error?: string }> {
  const token = process.env.MYMP_DEPLOY_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      triggered: false,
      error: "MYMP_DEPLOY_TOKEN or GITHUB_TOKEN is not set",
    };
  }

  const repo = process.env.GITHUB_REPOSITORY ?? "touristvisadomain-cloud/mymp";
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "sangsad-data-updated",
        client_payload: { ref: "prod", source: `sangsad-worker:${job}` },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        triggered: false,
        error: `GitHub API ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { triggered: true };
  } catch (err) {
    return { triggered: false, error: (err as Error).message };
  }
}
