// suite.mjs — the QA checklist the agent runs.
// Each check drives a real page via Playwright and ASSERTS an outcome.
// await step(msg) records a human-readable step for the dashboard timeline.
// Throwing an Error marks the run FAILED, and the message becomes the failure reason.
// Some checks are designed to fail on purpose, to prove the dashboard catches them.
//
// Actions are deliberately *visible* (typing delays, scrolling, short pauses) so the
// recorded MP4 reads like watching a person — not an instant blur.

const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const pause = (page, ms = 700) => page.waitForTimeout(ms);
// smooth-ish scroll so the replay shows the page moving
async function scrollThrough(page, total = 1400, steps = 7) {
  const dy = Math.round(total / steps);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(220); }
}

export const SUITE = [
  {
    id: "homepage-loads",
    name: "Marketing site loads",
    target: "https://example.com/",
    async run(page, step) {
      await step("Navigate to example.com");
      const resp = await page.goto("https://example.com/", { waitUntil: "domcontentloaded" });
      await pause(page);
      ok(resp && resp.ok(), `Expected HTTP 200, got ${resp ? resp.status() : "no response"}`);
      await step("Read page title");
      const title = await page.title();
      await step(`Title is "${title}"`);
      await pause(page, 900);
      ok(/example domain/i.test(title), `Title did not match — got "${title}"`);
      await step("✓ Homepage healthy");
    },
  },
  {
    id: "login-valid",
    name: "Login with valid credentials",
    target: "https://the-internet.herokuapp.com/login",
    async run(page, step) {
      await step("Open login page");
      await page.goto("https://the-internet.herokuapp.com/login", { waitUntil: "domcontentloaded" });
      await pause(page, 500);
      await step("Type username");
      await page.click("#username");
      await page.type("#username", "tomsmith", { delay: 110 });        // visible typing
      await step("Type password");
      await page.click("#password");
      await page.type("#password", "SuperSecretPassword!", { delay: 70 });
      await pause(page, 400);
      await step("Submit form");
      await page.click("button[type=submit]");
      await step("Wait for secure area");
      await page.waitForSelector(".flash.success", { timeout: 10000 });
      const flash = (await page.textContent(".flash.success")) || "";
      await pause(page, 900);
      ok(/logged into a secure area/i.test(flash), `No success banner — got "${flash.trim()}"`);
      await step("✓ Login succeeded");
    },
  },
  {
    id: "search-results",
    name: "Catalog returns products",
    target: "https://books.toscrape.com/",
    async run(page, step) {
      await step("Open catalog");
      await page.goto("https://books.toscrape.com/", { waitUntil: "domcontentloaded" });
      await pause(page, 500);
      await step("Browse the shelf");
      await scrollThrough(page, 1600, 8);                              // visible scrolling
      await step("Count product cards");
      const count = await page.locator("article.product_pod").count();
      await step(`Found ${count} products`);
      ok(count >= 10, `Expected >= 10 products, found ${count}`);
      const first = await page.locator("article.product_pod h3 a").first().getAttribute("title");
      await step(`First product: "${first}"`);
      await pause(page, 700);
      ok(!!first, "First product had no title");
      await step("✓ Catalog healthy");
    },
  },
  {
    id: "price-threshold",
    name: "Featured price under $50",
    target: "https://books.toscrape.com/",
    async run(page, step) {
      await step("Open catalog");
      await page.goto("https://books.toscrape.com/", { waitUntil: "domcontentloaded" });
      await pause(page, 500);
      await step("Scroll to featured item");
      await scrollThrough(page, 700, 4);
      await page.locator(".product_price .price_color").first().scrollIntoViewIfNeeded();
      await step("Read first product price");
      const priceText = (await page.locator(".product_price .price_color").first().textContent()) || "";
      const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
      await step(`Price is ${priceText.trim()}`);
      await pause(page, 900);
      // a real business assertion that happens to fail — great failure-reason demo
      ok(price < 50, `Price ${priceText.trim()} exceeds $50 threshold`);
      await step("✓ Price within range");
    },
  },
  {
    id: "checkout-button",
    name: "Checkout button present (BROKEN SELECTOR)",
    target: "https://books.toscrape.com/",
    async run(page, step) {
      await step("Open catalog");
      await page.goto("https://books.toscrape.com/", { waitUntil: "domcontentloaded" });
      await pause(page, 400);
      await step("Scroll looking for checkout");
      await scrollThrough(page, 1800, 9);                              // hunt across the page
      await step("Look for #checkout-now button");
      // Selector intentionally wrong → the classic "the site changed and our agent broke" failure.
      await page.waitForSelector("#checkout-now", { timeout: 6000 });
      await step("✓ Checkout button found");
    },
  },
  {
    id: "api-health-500",
    name: "Status endpoint returns 200",
    target: "https://the-internet.herokuapp.com/status_codes/500",
    async run(page, step) {
      await step("Hit status endpoint");
      const resp = await page.goto("https://the-internet.herokuapp.com/status_codes/500", { waitUntil: "domcontentloaded" });
      const code = resp ? resp.status() : 0;
      await step(`Endpoint responded ${code}`);
      await pause(page, 1100);
      ok(code === 200, `Health check failed — endpoint returned ${code}`);
      await step("✓ Endpoint healthy");
    },
  },
];
