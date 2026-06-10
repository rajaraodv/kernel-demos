# Kernel Demos

A small, growing collection of working demos built on [Kernel](https://www.kernel.sh)'s
browser infrastructure for AI agents. Deployed as a **Next.js** app on Vercel.

> Live site: deployed via Vercel from this repo's `main` branch.

## Demos
| Demo | What it shows |
|------|---------------|
| **Agent Run Observability** (`/demos/agent-observability/`) | Runs browser QA checks on live Kernel browsers, records an MP4 of each run, and shows pass/fail with replay + step timeline + error log. |
| **Marketing Teardown** (`/teardown.html`) | Presentation-style DX teardown of Kernel vs. Stripe & Steel. |

## Project layout
```
app/                         Next.js app (landing page that lists demos)
public/
  demos/agent-observability/ static dashboard + results.json + replays/*.mp4
  teardown.html              the marketing teardown
tools/
  agent-observability/       the runner that generates the demo data (local only)
    runner.mjs               drives live Kernel browsers + records replays
    suite.mjs                the QA checklist (edit to add/remove checks)
```

## Run locally
```bash
npm install
npm run dev          # http://localhost:3000
```

## Regenerate the observability demo data
This drives **real** Kernel browsers, so it needs the Kernel CLI + an API key + ffmpeg.
```bash
brew install kernel/tap/kernel          # one-time
export KERNEL_API_KEY=sk_...            # your key
npm run demo:run                        # writes public/demos/agent-observability/{results.json,replays/*.mp4}
git add public/demos/agent-observability && git commit -m "refresh demo data"
```
> Note: Kernel's **native** MP4 replay requires a paid plan. On the free tier the runner
> records its own MP4 from screenshots; the native-replay code path activates automatically
> on a paid plan.

## Deploy
Vercel auto-detects Next.js — no config needed. Push to `main` and Vercel builds & deploys.
The demo dashboards are static assets, so the cloud site always serves the last committed runs.
