// run.mjs — CLI to test the agent-buys-handbag flow end to end.
//   npm run commerce:demo
// Loads KERNEL_API_KEY + STRIPE_SECRET_KEY from the real env or .env.local/.env.

import { readFileSync, existsSync } from "node:fs";
import { runPurchase, CARDS } from "./buy.mjs";

const mode = process.argv[2] === "decline" ? "decline" : "success"; // node run.mjs decline

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
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}
loadEnvFiles();

for (const k of ["KERNEL_API_KEY", "STRIPE_SECRET_KEY"]) {
  if (!process.env[k]) { console.error(`✗ ${k} not set (add it to .env.local)`); process.exit(1); }
}

console.log(`\n🛍️  Agent commerce demo (${mode} card) — the agent shops & pays via Stripe\n`);
runPurchase({
  card: CARDS[mode],
  onEvent: (e) => {
    const secs = (e.t / 1000).toFixed(1).padStart(5);
    console.log(`  ${secs}s  ${e.msg}`);
    if (e.liveViewUrl) console.log(`         👀 live view: ${e.liveViewUrl}`);
  },
})
  .then((r) => {
    console.log("\n══════════════════════════════════════");
    if (r.paid) {
      console.log(`  ✅ PAID $${(r.amount / 100).toFixed(2)} ${r.currency.toUpperCase()}`);
      console.log(`  payment: ${r.paymentIntentId}`);
    } else {
      console.log(`  ❌ DECLINED — ${r.reason}`);
    }
    if (r.dashboardUrl) console.log(`  dashboard: ${r.dashboardUrl}`);
    console.log("══════════════════════════════════════\n");
  })
  .catch((e) => { console.error("\n✗ FAILED:", e.message, "\n"); process.exit(1); });
