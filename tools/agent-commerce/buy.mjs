// buy.mjs — the "agent that browses AND buys" core flow (Kernel × Stripe).
//
// 1. Create a Stripe Checkout Session (test mode) for the product.
// 2. Spin up a Kernel cloud browser.
// 3. Drive it to checkout.stripe.com (which shows the product), fill the test card,
//    and click Pay — you watch it happen via the live-view URL.
// 4. Detect the real outcome from Stripe: paid, or declined (with the reason).
// Test payments appear in the real Stripe Dashboard (Sandboxes).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright-core";
import Stripe from "stripe";

const execFileP = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const group = (n) => n.replace(/(.{4})/g, "$1 ").trim();

async function kernel(args, { json = false } = {}) {
  const { stdout } = await execFileP("kernel", args, { env: process.env, maxBuffer: 32 * 1024 * 1024 });
  return json ? JSON.parse(stdout) : stdout.trim();
}

export const DEFAULT_PRODUCT = {
  name: "Designer Leather Handbag",
  amount: 24900, // $249.00
  image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80",
};

// Stripe test cards: one always succeeds, one always declines.
export const CARDS = {
  success: { number: "4242424242424242", label: "succeeds" },
  decline: { number: "4000000000000002", label: "declined" },
};

// Fill the Stripe-hosted checkout form with the given card and submit.
async function payOnStripe(page, log, cardNumber) {
  const email = `agent.shopper.${Date.now()}@example.com`;
  const fast = async (sel, v) => { const el = page.locator(sel).first(); await el.waitFor({ state: "visible", timeout: 20000 }); await el.fill(v); };
  const slow = async (sel, v, d = 55) => { const el = page.locator(sel).first(); await el.waitFor({ state: "visible", timeout: 20000 }); await el.click(); await el.pressSequentially(v, { delay: d }); };

  await page.waitForLoadState("domcontentloaded");
  await sleep(1500);
  await log("Reviewing the item on Stripe Checkout");

  try { await fast("#email", email); } catch {}

  // uncheck "Save my information" so checkout doesn't require a phone / Link signup
  try { const s = page.locator("#enableStripePass"); if ((await s.count()) && (await s.isChecked())) await s.uncheck({ force: true }); } catch {}

  // if Stripe shows a currency chooser (non-US geo), pick the USD option
  try {
    if (await page.getByText(/Choose a currency/i).count()) {
      const usd = page.locator('button, [role="button"], [role="radio"]').filter({ hasText: /^\$\d/ }).first();
      if (await usd.count()) { await usd.click({ timeout: 3000 }); await log("Picked USD"); }
    }
  } catch {}

  // card fields only render once the "Card" method is selected
  for (const attempt of [
    () => page.locator("#payment-method-accordion-item-title-card").check({ force: true, timeout: 6000 }),
    () => page.getByText("Card", { exact: true }).first().click({ timeout: 6000 }),
  ]) { try { await attempt(); break; } catch {} }
  await page.locator("#cardNumber").waitFor({ state: "visible", timeout: 15000 });
  await log("Chose to pay by card");

  await slow("#cardNumber", cardNumber, 55); // typed slowly so you can watch it
  await fast("#cardExpiry", "12 / 34");
  await fast("#cardCvc", "123");
  await log(`Entered card ${group(cardNumber)}`);
  try { await fast("#billingName", "Kernel Agent"); } catch {}

  // force US billing country so a US ZIP is always valid, wherever the browser runs
  try { const c = page.locator("#billingCountry"); if (await c.count()) await c.selectOption("US"); } catch {}
  if (await page.locator("#billingPostalCode").count()) { try { await fast("#billingPostalCode", "94107"); } catch {} }

  await page.locator('button[type="submit"], .SubmitButton').first().click();
  await log("Clicked Pay");
}

// Poll Stripe (authoritative) + the page until we know the outcome.
async function detectOutcome(page, stripe, sessionId) {
  for (let i = 0; i < 24; i++) {
    let s;
    try { s = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] }); } catch {}
    const pi = s?.payment_intent;
    const piId = typeof pi === "string" ? pi : pi?.id;
    if (s?.payment_status === "paid" || pi?.status === "succeeded") return { ok: true, session: s, piId };
    const lpe = pi?.last_payment_error?.message;
    if (lpe) return { ok: false, reason: lpe, piId };
    let pageErr = null;
    try {
      pageErr = await page.evaluate(() => {
        const els = [...document.querySelectorAll('[role="alert"], .Error, .FieldError, [class*="error" i]')];
        return els.map((e) => e.textContent.trim()).filter(Boolean)
          .find((x) => /declin|was declined|insufficient|do not honor|cannot be processed/i.test(x)) || null;
      });
    } catch {}
    if (pageErr) return { ok: false, reason: pageErr, piId };
    await sleep(1500);
  }
  return { ok: false, reason: "Payment not confirmed in time" };
}

/**
 * Run a purchase. card = CARDS.success | CARDS.decline.
 * onEvent({ t, msg, ...extra }) streams progress (emits liveViewUrl + checkoutUrl + result).
 */
export async function runPurchase({ product = DEFAULT_PRODUCT, card = CARDS.success, successUrl, onEvent = () => {} } = {}) {
  const startedAt = Date.now();
  const log = (msg, extra = {}) => onEvent({ t: Date.now() - startedAt, msg, ...extra });

  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
  if (!process.env.KERNEL_API_KEY) throw new Error("KERNEL_API_KEY not set");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  await log(`Creating a Stripe Checkout session for "${product.name}"`);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: product.amount, product_data: { name: product.name, images: product.image ? [product.image] : [] } } }],
    success_url: successUrl || "https://httpbin.org/anything/paid?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://httpbin.org/anything/canceled",
  });
  await log(`Checkout ready — $${(product.amount / 100).toFixed(2)}`, { checkoutUrl: session.url });

  await log("Spinning up a Kernel cloud browser…");
  const browser = await kernel(["browsers", "create", "--start-url", session.url, "--timeout", "240", "-o", "json"], { json: true });
  await log("Browser ready — watch it work 👇", { liveViewUrl: browser.browser_live_view_url });

  let pw, page;
  try {
    pw = await chromium.connectOverCDP(browser.cdp_ws_url);
    const ctx = pw.contexts()[0] || (await pw.newContext());
    page = ctx.pages()[0] || (await ctx.newPage());
    if (!/checkout\.stripe\.com/.test(page.url())) await page.goto(session.url, { waitUntil: "domcontentloaded" });

    await payOnStripe(page, log, card.number);
    await log("Waiting for Stripe…");

    const outcome = await detectOutcome(page, stripe, session.id);
    const dash = outcome.piId ? `https://dashboard.stripe.com/test/payments/${outcome.piId}` : null;

    if (outcome.ok) {
      const result = {
        paid: true, declined: false,
        amount: outcome.session.amount_total, currency: outcome.session.currency,
        paymentIntentId: outcome.piId, dashboardUrl: dash,
        liveViewUrl: browser.browser_live_view_url, productName: product.name, durationMs: Date.now() - startedAt,
      };
      await log(`✅ Paid $${(result.amount / 100).toFixed(2)} — it's in your Stripe Dashboard`, { result });
      return result;
    }
    const result = {
      paid: false, declined: true, reason: outcome.reason,
      paymentIntentId: outcome.piId || null, dashboardUrl: dash,
      liveViewUrl: browser.browser_live_view_url, productName: product.name, durationMs: Date.now() - startedAt,
    };
    await log(`❌ Payment declined — ${outcome.reason}`, { result });
    return result;
  } catch (err) {
    try { if (page) await page.screenshot({ path: "/tmp/commerce-fail.png", fullPage: true }); } catch {}
    throw err;
  } finally {
    if (pw) { try { await pw.close(); } catch {} }
    if (browser?.session_id) { try { await kernel(["browsers", "delete", browser.session_id]); } catch {} }
  }
}
