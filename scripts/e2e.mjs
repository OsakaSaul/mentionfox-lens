// Loads the built extension in Chromium and drives the real content script + side panel UI against the HTML fixtures.
// The model is MOCKED here (build:e2e): this verifies the extension shell, not Gemini Nano or the cloud model.
// Usage: npm run e2e   (needs Playwright's Chromium; set CHROMIUM_PATH to override)
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shots = resolve(root, "docs/screenshots");
mkdirSync(shots, { recursive: true });

const build = spawnSync(process.execPath, [resolve(root, "scripts/build.mjs"), "--dev", "--e2e"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(1);
// TEST ONLY: give the e2e dist host access to the local fixture server (a real build uses activeTab only).
const mpath = resolve(root, "dist/manifest.json");
const m = JSON.parse(readFileSync(mpath, "utf8"));
m.host_permissions = ["http://127.0.0.1/*"];
writeFileSync(mpath, JSON.stringify(m, null, 2));

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(os.homedir(), "AppData/Local/ms-playwright");
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) {
    const p = join(base, d, "chrome-win64/chrome.exe");
    if (existsSync(p)) return p;
  }
}

const MOCKS = {
  "linkedin-profile": {
    claims: { claims: [
      { quote: "grew Northwind Analytics from $2M to $18M ARR between 2021 and 2024", kind: "specific", why: "Two revenue figures and a date range a third party could check." },
      { quote: "I am a passionate, results-driven growth leader.", kind: "vague", why: "Adjectives, nothing checkable." },
      { quote: "I hold an MBA from INSEAD (2016).", kind: "specific", why: "Degree, school and year can be verified with the school." },
      { quote: "spent 6 years at Stripe on the Billing team", kind: "specific", why: "Employer, team and tenure." },
      { quote: "This sentence is not on the page at all.", kind: "vague", why: "Used to test the not-found state." },
    ] },
    geo: { entities: [{ name: "Dana Whitfield", type: "person" }, { name: "Northwind Analytics", type: "company" }, { name: "Stripe", type: "company" }], facts: ["Dana Whitfield is VP of Growth at Northwind Analytics.", "ARR grew from $2M to $18M between 2021 and 2024."], missing: ["No link to a source for the ARR figures.", "No location."], fixes: ["Add a source or press link next to the ARR figures.", "State the city and country.", "Name the products Northwind Analytics sells."], ratings: { entity_clarity: 3, fact_density: 3, structure: 2, trust_signals: 1, ambiguity: 2 } },
  },
  "x-post": {
    claims: { claims: [
      { quote: "just closed a $12M Series A led by Accel", kind: "specific", why: "Amount, round and lead investor are checkable." },
      { quote: "We now serve 3,400 customers in 41 countries", kind: "specific", why: "Two numbers, but no source." },
      { quote: "world's leading platform for ops teams", kind: "vague", why: "Superlative with no ranking source." },
    ] },
    geo: { entities: [{ name: "Priya N", type: "person" }, { name: "Lumen", type: "company" }, { name: "Accel", type: "company" }], facts: ["Lumen closed a $12M Series A led by Accel."], missing: ["No date for the round", "Priya's role is not stated"], fixes: ["State Priya's role.", "Link the funding announcement.", "Name the product."], ratings: { entity_clarity: 2, fact_density: 2, structure: 1, trust_signals: 1, ambiguity: 2 } },
  },
  "company-site": {
    claims: { claims: [
      { quote: "We are the world's best warehouse automation company.", kind: "vague", why: "Superlative with no evidence." },
      { quote: "pick up to 1,200 items per hour with 99.7% accuracy", kind: "specific", why: "Two measurable figures." },
      { quote: "SOC 2 Type II certified since March 2023", kind: "specific", why: "A certification with a date; the auditor's report can confirm it." },
    ] },
    geo: { entities: [{ name: "Acme Robotics", type: "company" }, { name: "Maria Lopez", type: "person" }], facts: ["Acme Robotics was founded in Austin in 2019."], missing: ["No pricing"], fixes: ["Add the auditor name for SOC 2.", "Name the customer case studies.", "Add a contact page link."], ratings: { entity_clarity: 3, fact_density: 3, structure: 3, trust_signals: 2, ambiguity: 3 } },
  },
  "news-article": {
    claims: { claims: [
      { quote: "raised $40 million in a Series B round led by Northgate Capital", kind: "specific", why: "Amount, round and lead are checkable." },
      { quote: "processes \"more than €2 billion\" in transactions a year", kind: "specific", why: "A figure attributed to the company." },
      { quote: "a transformational milestone for the industry", kind: "vague", why: "A quoted opinion." },
    ] },
    geo: { entities: [{ name: "Orbit", type: "company" }, { name: "Ana Silva", type: "person" }], facts: ["Orbit raised $40 million."], missing: ["No investor list beyond the lead"], fixes: ["Add the filing link.", "Add the round date in the body.", "State where Orbit is incorporated."], ratings: { entity_clarity: 4, fact_density: 4, structure: 3, trust_signals: 2, ambiguity: 3 } },
  },
};

const server = createServer((req, res) => {
  const name = req.url.replace(/^\/|\?.*$/g, "").replace(/\.html$/, "");
  const p = resolve(root, "test/fixtures", name + ".html");
  if (!existsSync(p)) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const userDataDir = resolve(os.tmpdir(), "mfl-e2e-" + Date.now());
const ctx = await chromium.launchPersistentContext(userDataDir, {
  executablePath: findChromium(),
  headless: false,
  args: [`--disable-extensions-except=${resolve(root, "dist")}`, `--load-extension=${resolve(root, "dist")}`, "--headless=new", "--no-first-run"],
  viewport: { width: 1100, height: 800 },
});

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };

try {
  let sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const extId = new URL(sw.url()).host;
  check("extension loads and service worker starts", /^[a-p]{32}$/.test(extId), extId);

  for (const [name, mock] of Object.entries(MOCKS)) {
    const mode = name === "linkedin-profile" ? "device" : "cloud";
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/${name}`);
    const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u + "*" }))[0].id, `http://127.0.0.1:${port}/${name}`);

    const panel = await ctx.newPage();
    await panel.addInitScript((m) => { window.__MFL_MOCK__ = m; }, mock);
    await panel.setViewportSize({ width: 420, height: 900 });
    await panel.goto(`chrome-extension://${extId}/sidepanel.html?target=${tabId}&mock=${mode}`);
    await panel.click("#analyze");
    await panel.waitForFunction(() => /^Done|cannot|Not enough|Lens needs/.test(document.getElementById("status").textContent), null, { timeout: 20000 });
    const status = await panel.textContent("#status");
    check(`${name}: analyze completes`, /^Done/.test(status), status);

    const nMarks = await page.evaluate(() => document.querySelectorAll("mark.mfl-hl").length);
    check(`${name}: highlights wrapped in the page`, nMarks >= 2, `${nMarks} marks`);
    const badge = await panel.textContent("#claimsMode .chip");
    check(`${name}: mode badge shown (mock: ${mode})`, badge === (mode === "device" ? "On-device (private)" : "Cloud"), badge);
    check(`${name}: latency shown`, /\d+ ms/.test(await panel.textContent("#claimsMode .ms")));
    check(`${name}: GEO score + badge shown`, (await panel.locator(".score").count()) === 1 && (await panel.locator("#geoMode .chip").count()) === 1);

    // Jump: click the first claim card and expect the matching mark to flash and be scrolled into view.
    await panel.locator(".claim:not(.missing)").first().click();
    await page.waitForTimeout(250);
    const flashed = await page.evaluate(() => {
      const f = document.querySelector("mark.mfl-flash");
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { id: f.dataset.mflId, inView: r.top >= 0 && r.bottom <= innerHeight };
    });
    check(`${name}: click claim flashes + scrolls to highlight`, !!flashed && flashed.inView, JSON.stringify(flashed));
    if (name === "linkedin-profile") {
      check("not-found claim is disabled with a message", (await panel.locator(".claim.missing").count()) === 1);
      await page.screenshot({ path: join(shots, "e2e-linkedin-page-highlights.png") });
      await panel.screenshot({ path: join(shots, "e2e-sidepanel-claims.png") });
      await panel.click("#tab-geo");
      await panel.screenshot({ path: join(shots, "e2e-sidepanel-ai-view.png") });
    }
    if (name === "company-site") await page.screenshot({ path: join(shots, "e2e-company-page-highlights.png") });
    await panel.click("#clear");
    check(`${name}: clear removes highlights`, (await page.evaluate(() => document.querySelectorAll("mark.mfl-hl").length)) === 0);
    await panel.close();
    await page.close();
  }

  // Popup renders and has every control labelled.
  const pop = await ctx.newPage();
  await pop.goto(`chrome-extension://${extId}/popup.html`);
  check("popup renders with open button", (await pop.locator("#open[title][aria-label]").count()) === 1);
  await pop.screenshot({ path: join(shots, "e2e-popup.png") });
  await pop.close();

  // Dark scheme screenshot of the empty panel.
  const dark = await ctx.newPage();
  await dark.emulateMedia({ colorScheme: "dark" });
  await dark.setViewportSize({ width: 420, height: 700 });
  await dark.goto(`chrome-extension://${extId}/sidepanel.html`);
  await dark.screenshot({ path: join(shots, "e2e-sidepanel-dark.png") });
  await dark.close();
} catch (e) {
  check("e2e run", false, String(e && e.stack || e));
} finally {
  await ctx.close();
  server.close();
  try { rmSync(userDataDir, { recursive: true, force: true }); } catch { /* temp */ }
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} e2e checks passed`);
writeFileSync(resolve(root, "docs/e2e-run.txt"), results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  " + r.detail : ""}`).join("\n") + `\n\n${results.length - failed}/${results.length} passed (model mocked; extension shell only)\n`);
process.exit(failed ? 1 : 0);
