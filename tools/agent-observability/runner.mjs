// runner.mjs — orchestrates the QA suite on real Kernel browsers and records each run.
//
// For each check:
//   1. kernel browsers create   → fresh sandboxed Chromium (+ live view URL)
//   2. Playwright over the CDP URL drives the task + asserts the outcome
//   3. a screenshot is captured at every step → stitched into an MP4 (ffmpeg)
//   4. console / network errors + a step timeline are captured
//   5. (paid plan) kernel browsers replays  → also pulls Kernel's native MP4
//   6. kernel browsers delete   → tear down
// Results are written to dashboard/results.json for the static dashboard.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, stat, rm } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { SUITE } from "./suite.mjs";

const execFileP = promisify(execFile);
// writes into the Next.js static assets so the deployed dashboard serves fresh data.
// run from the repo root:  npm run demo:run
const OUT_DIR = "public/demos/agent-observability";
const REPLAY_DIR = `${OUT_DIR}/replays`;

// Resolve config from the REAL environment first (e.g. Vercel env vars, or an exported
// shell var). Then fill any gaps from a local .env.local / .env file if one exists.
// Real env vars always win, so the same code works in production and locally — no edits.
function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val; // don't override real env
    }
  }
}
loadEnvFiles();

if (!process.env.KERNEL_API_KEY) {
  console.error("✗ KERNEL_API_KEY not found.");
  console.error("  Set it as an environment variable (Vercel project env, or");
  console.error("  `export KERNEL_API_KEY=sk_...`), or add it to a local .env.local file.");
  process.exit(1);
}

async function kernel(args, { json = false } = {}) {
  const { stdout } = await execFileP("kernel", args, { env: process.env, maxBuffer: 32 * 1024 * 1024 });
  return json ? JSON.parse(stdout) : stdout.trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// stitch a folder of frames into an MP4 at the given source fps (≈ real time)
async function stitch(framesGlob, outFile, fps) {
  await execFileP("ffmpeg", [
    "-y", "-framerate", String(fps), "-pattern_type", "glob", "-i", framesGlob,
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-r", "24",
    outFile,
  ]);
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

async function runCheck(check) {
  const startedAt = Date.now();
  const steps = [];
  const consoleErrors = [];
  const framesDir = `${REPLAY_DIR}/_frames_${check.id}`;
  let frameNo = 0, page = null;

  // step() just records the human-readable timeline
  const step = async (msg) => {
    steps.push({ t: Date.now() - startedAt, msg });
    console.log(`    · ${msg}`);
  };

  // Continuous capture: a fast JPEG screenshot every ~200ms while the agent works, so the
  // MP4 smoothly shows navigation / typing / scrolling. (Runs now last several seconds.)
  let capStartMs = 0, shotBusy = false, capTimer = null;
  const startCapture = async () => {
    capStartMs = Date.now();
    capTimer = setInterval(async () => {
      if (!page || shotBusy) return;
      shotBusy = true;
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 70 });
        await writeFile(`${framesDir}/${String(++frameNo).padStart(5, "0")}.jpg`, buf);
      } catch { /* mid-navigation — skip this frame */ }
      shotBusy = false;
    }, 200);
  };
  const stopCapture = async () => { if (capTimer) clearInterval(capTimer); capTimer = null; await sleep(250); };

  let session, replayId, browser;
  const result = {
    id: check.id, name: check.name, target: check.target,
    status: "fail", reason: null, steps, consoleErrors,
    liveViewUrl: null, replayFile: null, replaySource: null, durationMs: 0,
  };

  try {
    await mkdir(framesDir, { recursive: true });
    await step("Spinning up Kernel browser…");
    session = await kernel(
      ["browsers", "create", "--start-url", "about:blank", "--timeout", "120", "-o", "json"],
      { json: true }
    );
    result.liveViewUrl = session.browser_live_view_url;
    await step(`Browser ready (session ${session.session_id.slice(0, 8)}…)`);

    // native Kernel replay — auto-activates on a paid plan; harmless no-op on free tier
    try {
      const rep = await kernel(["browsers", "replays", "start", session.session_id, "-o", "json"], { json: true });
      replayId = rep.replay_id || rep.id || rep.replayId;
      await step("Kernel native recording started 🎥");
    } catch {
      await step("Recording via screenshot capture (free tier)");
    }

    browser = await chromium.connectOverCDP(session.cdp_ws_url);
    const ctx = browser.contexts()[0] || (await browser.newContext());
    page = ctx.pages()[0] || (await ctx.newPage());
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on("requestfailed", (r) => consoleErrors.push(`requestfailed: ${r.url()} (${r.failure()?.errorText})`));

    await startCapture();
    await check.run(page, step);
    result.status = "pass";
    await step("RESULT: PASS ✅");
    await sleep(900); // hold a beat on the final frame
  } catch (err) {
    result.status = "fail";
    result.reason = (err.message || String(err)).split("\n")[0];
    await step(`RESULT: FAIL ❌ — ${result.reason}`);
    await sleep(900); // let the screencast capture the failure state
  } finally {
    await stopCapture();
    const capSec = capStartMs ? (Date.now() - capStartMs) / 1000 : 1;
    const outFile = `${REPLAY_DIR}/${check.id}.mp4`;

    // prefer Kernel's native replay if we have one (paid plan)
    if (session && replayId) {
      try {
        await kernel(["browsers", "replays", "stop", session.session_id, replayId]);
        for (let i = 0; i < 5; i++) {
          try {
            await kernel(["browsers", "replays", "download", session.session_id, replayId, "-f", outFile]);
            if ((await stat(outFile)).size > 0) { result.replaySource = "kernel-native"; break; }
          } catch { /* finalizing — retry */ }
          await sleep(1500);
        }
      } catch { /* fall through to screenshot MP4 */ }
    }

    // otherwise (free tier) stitch the screencast frames into an MP4 at ≈ real-time fps
    if (!result.replaySource && frameNo > 0) {
      try {
        const fps = clamp(frameNo / capSec, 4, 30);
        await stitch(`${framesDir}/*.jpg`, outFile, fps);
        if ((await stat(outFile)).size > 0) result.replaySource = "screencast";
      } catch (e) { console.log("    · ⚠ ffmpeg stitch failed:", e.message.split("\n")[0]); }
    }
    if (result.replaySource) { result.replayFile = `replays/${check.id}.mp4`; await step(`Replay saved 💾 (${result.replaySource})`); }

    try { await rm(framesDir, { recursive: true, force: true }); } catch {}
    if (browser) { try { await browser.close(); } catch {} }
    if (session) { try { await kernel(["browsers", "delete", session.session_id]); } catch {} }
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}

(async () => {
  console.log(`\n🟣 Kernel Agent QA Suite — ${SUITE.length} checks\n`);
  const runs = [];
  for (const check of SUITE) {
    console.log(`▶ ${check.name}`);
    runs.push(await runCheck(check));
    console.log("");
  }

  const passed = runs.filter((r) => r.status === "pass").length;
  const report = {
    generatedAt: new Date().toISOString(),
    total: runs.length, passed, failed: runs.length - passed,
    replaySource: runs.find((r) => r.replaySource)?.replaySource || "none",
    runs,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}/results.json`, JSON.stringify(report, null, 2));

  console.log(`\n══════════════════════════════════════`);
  console.log(`  ${passed}/${runs.length} passed · ${report.failed} failed`);
  console.log(`  → wrote ${OUT_DIR}/results.json`);
  console.log(`  → run:  node serve.mjs   then open http://localhost:4321`);
  console.log(`══════════════════════════════════════\n`);
})();
