// GET /api/agent-buy/status?runId=... — returns accumulated progress + final result.
export const dynamic = "force-dynamic";

const jobs = (globalThis.__agentJobs ??= new Map());

export async function GET(req) {
  const runId = new URL(req.url).searchParams.get("runId");
  const job = runId && jobs.get(runId);
  if (!job) return Response.json({ error: "unknown runId" }, { status: 404 });
  return Response.json(job);
}
