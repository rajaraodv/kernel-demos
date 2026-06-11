// POST /api/agent-buy — kicks off the agent purchase in the background, returns a runId.
// Runs locally (next dev), where the Kernel CLI + Playwright are available.
import { runPurchase, DEFAULT_PRODUCT, CARDS } from "../../../tools/agent-commerce/buy.mjs";

export const dynamic = "force-dynamic";
// NOTE: the live agent run only works locally (needs the Kernel CLI + Playwright).
// On Vercel the page loads but this route won't run a real browser.
export const maxDuration = 60;

const jobs = (globalThis.__agentJobs ??= new Map());

export async function POST(req) {
  let product = DEFAULT_PRODUCT;
  let mode = "success";
  try {
    const body = await req.json();
    if (body?.product) product = body.product;
    if (body?.mode === "decline") mode = "decline";
  } catch { /* use defaults */ }

  const runId = "run_" + Math.random().toString(36).slice(2, 10);
  const job = { runId, events: [], done: false, result: null, error: null };
  jobs.set(runId, job);

  // NOTE: success_url must be PUBLIC (the cloud browser redirects there after paying),
  // so we don't point it at localhost. Payment truth comes from polling Stripe regardless.
  runPurchase({
    product,
    card: CARDS[mode],
    onEvent: (e) => job.events.push(e),
  })
    .then((r) => { job.result = r; job.done = true; })
    .catch((e) => { job.error = String(e?.message || e); job.done = true; });

  return Response.json({ runId });
}
