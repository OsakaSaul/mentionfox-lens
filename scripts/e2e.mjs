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
      // Model slips (T2960): footnote marker, changed name, a wrong vague label and a cut-off reason. Lens must still find it, keep it green and show a full reason.
      { quote: "Orbit Inc. said on Thursday it raised $40 million[1][2] in a Series B round led by Northgate Capital.", kind: "vague", why: "The adjectives", summary: "Orbit raised $40 million." },
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
    const badge = (await panel.textContent("#claimsMode .mode-main")).trim();
    check(`${name}: mode bar shown (mock: ${mode})`, mode === "device" ? /^On-device · \d+\.\d seconds$/.test(badge) : /^Cloud · \d+\.\d seconds$/.test(badge), badge);
    check(`${name}: status line names mode and time`, mode === "device" ? /^Done in \d+\.\d seconds on-device: /.test(status) : /^Done in \d+\.\d seconds on Cloud: /.test(status), status);
    check(`${name}: GEO score + mode bar shown`, (await panel.locator(".score").count()) === 1 && (await panel.locator("#geoMode .mode-main").count()) === 1);

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
    if (name === "news-article") {
      const card = panel.locator(".claim", { hasText: "Orbit Inc." });
      check("news-article: footnote + renamed quote is found, not disabled", (await card.count()) === 1 && !(await card.evaluate((e) => e.classList.contains("missing"))));
      check("news-article: wrong vague label overridden to specific, cut-off reason replaced", (await card.getAttribute("data-kind")) === "specific" && !/The adjectives/.test(await card.textContent()) && /Names an amount/.test(await card.textContent()), (await card.textContent()).slice(0, 200));
      const markText = await page.evaluate(() => [...document.querySelectorAll("mark.mfl-hl[data-mfl-id=c4]")].map((m) => m.textContent).join(""));
      check("news-article: highlight covers the page sentence", /said on Thursday it raised .40 million in a Series B round led by Northgate Capital/.test(markText), markText.slice(0, 160));
    }
    if (name === "linkedin-profile") {
      check("not-found claim is disabled with a message", (await panel.locator(".claim.missing").count()) === 1, `${await panel.locator(".claim.missing").count()} missing of ${await panel.locator(".claim").count()}`);
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

  // ---- Mode bar and download chip in every state (mock simulates availability and the SDK progress callback) ----
  const demo = resolve(root, "docs/demo/mode-states");
  mkdirSync(demo, { recursive: true });
  const fx = MOCKS["company-site"];
  const fxUrl = `http://127.0.0.1:${port}/company-site`;
  const fxPage = await ctx.newPage();
  await fxPage.goto(fxUrl);
  const fxTab = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u + "*" }))[0].id, fxUrl);
  const openPanel = async (mockMode, ms) => {
    const pg = await ctx.newPage();
    await pg.addInitScript((a) => { window.__MFL_MOCK__ = a.m; window.__MFL_MS__ = a.ms; }, { m: fx, ms });
    await pg.setViewportSize({ width: 420, height: 900 });
    await pg.goto(`chrome-extension://${extId}/sidepanel.html?target=${fxTab}&mock=${mockMode}`);
    await pg.waitForFunction(() => document.getElementById("deviceChip").dataset.state && document.getElementById("deviceChip").dataset.state !== "checking");
    return pg;
  };
  const analyzeDone = async (pg) => {
    await pg.click("#analyze");
    await pg.waitForFunction(() => /^Done|cannot|Not enough|Lens needs/.test(document.getElementById("status").textContent), null, { timeout: 20000 });
  };
  const barBg = (pg, sel) => pg.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundImage, sel);
  const txt = async (pg, sel) => (await pg.textContent(sel)).trim();
  const DOT = "·";

  // 1. cloud fallback while the model is still downloading (progress 0, 42, 100)
  let pn = await openPanel("downloading", 1600);
  check("downloading: chip shows downloading, bar visible before Analyze", /downloading/.test(await txt(pn, "#deviceChip")) && (await pn.locator("#progressWrap").isVisible()));
  await pn.evaluate(() => window.__mflProgress(0));
  check("progress 0: chip 'downloading 0%'", (await txt(pn, "#deviceChip")) === "On-device model: downloading 0%", await txt(pn, "#deviceChip"));
  await pn.evaluate(() => window.__mflProgress(0.42));
  check("progress 42: chip 'downloading 42%', bar 42% wide", (await txt(pn, "#deviceChip")) === "On-device model: downloading 42%" && (await pn.getAttribute("#progressBar", "aria-valuenow")) === "42" && /42%/.test(await pn.getAttribute("#progressBar", "style")), await txt(pn, "#progressText"));
  await analyzeDone(pn);
  check(`cloud while downloading: claims bar 'Cloud (on-device not ready) ${DOT} 1.6 seconds'`, (await txt(pn, "#claimsMode .mode-main")) === `Cloud (on-device not ready) ${DOT} 1.6 seconds`, await txt(pn, "#claimsMode .mode-main"));
  check("cloud while downloading: status line", (await txt(pn, "#status")).startsWith("Done in 3.2 seconds on Cloud (on-device not ready): "), await txt(pn, "#status"));
  check("cloud while downloading: AI view bar too", (await txt(pn, "#geoMode .mode-main")) === `Cloud (on-device not ready) ${DOT} 1.6 seconds`);
  check("download bar still visible after Analyze completes", (await pn.locator("#progressWrap").isVisible()) && /42%/.test(await txt(pn, "#deviceChip")));
  check("Run again button appears and is enabled", (await pn.locator("#rerun").isVisible()) && (await pn.locator("#rerun").isEnabled()));
  await pn.screenshot({ path: join(demo, "1-cloud-while-downloading.png") });
  await pn.click("#tab-geo");
  await pn.screenshot({ path: join(demo, "1b-ai-view-cloud-while-downloading.png") });
  await pn.click("#tab-claims");
  const cloudBg = await barBg(pn, "#claimsMode");
  await pn.evaluate(() => window.__mflProgress(1));
  await pn.waitForFunction(() => document.getElementById("deviceChip").dataset.state === "ready", null, { timeout: 8000 });
  check("progress 100: chip turns green 'On-device model ready', bar hidden", (await txt(pn, "#deviceChip")) === "On-device model ready" && !(await pn.locator("#progressWrap").isVisible()) && /chip-ready/.test(await pn.getAttribute("#deviceChip", "class")));
  await pn.screenshot({ path: join(demo, "2-model-ready-green.png") });
  // 2. the next run uses the on-device model
  await pn.evaluate(() => { window.__MFL_MS__ = 1400; });
  await pn.click("#rerun");
  await pn.waitForFunction(() => /^Done in \d+\.\d seconds on-device/.test(document.getElementById("status").textContent), null, { timeout: 20000 });
  check(`Run again after download: claims bar 'On-device ${DOT} N seconds'`, /^On-device · \d+\.\d seconds$/.test(await txt(pn, "#claimsMode .mode-main")), await txt(pn, "#claimsMode .mode-main"));
  check("Run again after download: status line", /^Done in \d+\.\d seconds on-device: /.test(await txt(pn, "#status")), await txt(pn, "#status"));
  check("on-device and cloud bars have different colours", (await barBg(pn, "#claimsMode")) !== cloudBg);
  await pn.screenshot({ path: join(demo, "3-on-device-after-download.png") });
  await pn.emulateMedia({ colorScheme: "dark" });
  await pn.screenshot({ path: join(demo, "3c-on-device-dark.png") });
  await pn.emulateMedia({ colorScheme: "light" });
  await pn.click("#tab-geo");
  check("AI view bar says on-device too", (await txt(pn, "#geoMode .mode-main")) === `On-device ${DOT} 1.4 seconds`, await txt(pn, "#geoMode .mode-main"));
  await pn.screenshot({ path: join(demo, "3b-ai-view-on-device.png") });
  check("mode bars have tooltip and aria-label explaining hybrid inference", /prefers the private on-device model/.test(await pn.getAttribute("#geoMode", "title")) && /falls back to the cloud/.test(await pn.getAttribute("#claimsMode", "aria-label")));
  check("mode bars contain an inline svg icon", (await pn.locator("#claimsMode svg").count()) === 1 && (await pn.locator("#geoMode svg").count()) === 1);
  await pn.close();

  // 3. cloud because on-device is unavailable
  pn = await openPanel("unavailable", 3200);
  check("unavailable: chip says using cloud", (await txt(pn, "#deviceChip")) === "On-device not available on this device: using cloud");
  await analyzeDone(pn);
  check(`cloud when unavailable: bar 'Cloud ${DOT} 3.2 seconds'`, (await txt(pn, "#claimsMode .mode-main")) === `Cloud ${DOT} 3.2 seconds`, await txt(pn, "#claimsMode .mode-main"));
  check("cloud when unavailable: status line", (await txt(pn, "#status")).startsWith("Done in 6.4 seconds on Cloud: "), await txt(pn, "#status"));
  await pn.screenshot({ path: join(demo, "4-cloud-unavailable.png") });
  await pn.close();

  // 4. on-device attempted, failed, cloud took over
  pn = await openPanel("failed", 3200);
  await analyzeDone(pn);
  check(`on-device failed then cloud: bar 'Cloud (on-device failed) ${DOT} N seconds'`, /^Cloud \(on-device failed\) · \d+\.\d seconds$/.test(await txt(pn, "#claimsMode .mode-main")), await txt(pn, "#claimsMode .mode-main"));
  await pn.screenshot({ path: join(demo, "5-on-device-failed-cloud.png") });
  await pn.close();

  // 5. downloadable: click-to-start button, then percent
  pn = await openPanel("downloadable", 3200);
  check("downloadable: Download button shown with tooltip", (await pn.locator("#download").isVisible()) && !!(await pn.getAttribute("#download", "title")));
  await pn.screenshot({ path: join(demo, "6-downloadable-button.png") });
  await pn.click("#download");
  await pn.evaluate(() => window.__mflProgress(0.42));
  check("after Download click: chip shows percent and button is gone", /downloading 42%/.test(await txt(pn, "#deviceChip")) && !(await pn.locator("#download").isVisible()));
  await pn.close();
  await fxPage.close();

  // ---- Speed (T2963): warm-up, main-content extraction, chunked streaming, progress, first claim, Analyze more. MOCK on-device model: it proves the
  // ---- streaming and progress logic of the extension, NOT the speed of Gemini Nano. ----
  const SBF = "wikipedia-sam-bankman-fried";
  const sbfUrl = `http://127.0.0.1:${port}/${SBF}`;
  const sbfPage = await ctx.newPage();
  await sbfPage.goto(sbfUrl);
  const sbfTab = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u + "*" }))[0].id, sbfUrl);
  const sbfClaims = (arr) => ({ claims: { claims: arr.map(([quote, kind = "specific"]) => ({ quote, kind, why: "A date, number or name a reader can check against a public source." })) }, geo: MOCKS["company-site"].geo });
  const setA = sbfClaims([
    ["Samuel Benjamin Bankman-Fried (born March 5, 1992), commonly known as SBF, is an American entrepreneur convicted of fraud."],
    ["In November 2022, as evidence of potential fraud began to surface, depositors quickly withdrew their assets from FTX, forcing the company into bankruptcy."],
    ["He graduated from the Massachusetts Institute of Technology in 2014 with a bachelor's degree in physics and a minor in mathematics."],
    ["In the summer of 2013, Bankman-Fried worked as an intern at Jane Street Capital, a proprietary trading firm, trading international ETFs."],
    ["By 2021, Bankman-Fried owned approximately 90 percent of Alameda Research."],
    ["Bankman-Fried founded the FTX cryptocurrency derivatives exchange in April 2019; it opened for business the following month."],
    ["In September 2021, Bankman-Fried and the entire senior staff of FTX moved from Hong Kong to the Bahamas."],
    ["His parents are Barbara Fried and Joseph Bankman, both professors at Stanford Law School."],
  ]);
  const setB = sbfClaims([
    ["Bankman-Fried attended Canada/USA Mathcamp, a summer program for mathematically talented high-school students."],
    ["He attended high school at the elite private Crystal Springs Uplands School in Hillsborough, California."],
  ]);
  const sp = await ctx.newPage();
  await sp.addInitScript((a) => { window.__MFL_MOCK__ = a.m; window.__MFL_CHUNK_MS__ = 700; }, { m: setA });
  await sp.setViewportSize({ width: 420, height: 900 });
  await sp.goto(`chrome-extension://${extId}/sidepanel.html?target=${sbfTab}&mock=device`);
  await sp.waitForFunction(() => document.getElementById("deviceChip").dataset.state === "ready");
  const warm = await sp.evaluate(() => window.__mflWarm || null);
  check("warm-up: the on-device session is created when the panel opens, before any Analyze click", !!warm && warm.clicked === false, JSON.stringify(warm));
  await sp.evaluate(() => {
    window.__rec = { status: [], firstCardAt: null, doneAt: null, clickAt: null };
    const st = document.getElementById("status");
    new MutationObserver(() => { window.__rec.status.push(st.textContent); if (/^Done/.test(st.textContent) && !window.__rec.doneAt) window.__rec.doneAt = performance.now(); }).observe(st, { childList: true, characterData: true, subtree: true });
    new MutationObserver(() => { if (!window.__rec.firstCardAt && document.querySelector("#claimsList .claim")) window.__rec.firstCardAt = performance.now(); }).observe(document.getElementById("claimsList"), { childList: true, subtree: true });
    document.getElementById("analyze").addEventListener("click", () => { window.__rec.clickAt = performance.now(); window.__mflClickedAt = window.__rec.clickAt; }, true);
  });
  await sp.click("#analyze");
  await sp.waitForFunction(() => window.__rec.firstCardAt, null, { timeout: 15000 });
  const midStatus = await sp.textContent("#status");
  check("streaming: the first card is on screen while the run is still going", !/^Done/.test(midStatus) && (await sp.locator("#analyze").isDisabled()), midStatus);
  await sp.waitForTimeout(400);
  const marksMid = await sbfPage.evaluate(() => document.querySelectorAll("mark.mfl-hl").length);
  const doneMid = await sp.evaluate(() => !!window.__rec.doneAt);
  check("streaming: highlights land on the page while the run is still going", marksMid >= 1 && !doneMid, `${marksMid} marks`);
  await sp.waitForFunction(() => /^Done/.test(document.getElementById("status").textContent), null, { timeout: 30000 });
  const rec = await sp.evaluate(() => window.__rec);
  check("streaming: first card appears at least one chunk-time before the run ends", rec.doneAt - rec.firstCardAt > 1200, `first card +${Math.round(rec.firstCardAt - rec.clickAt)} ms, done +${Math.round(rec.doneAt - rec.clickAt)} ms`);
  const progress = rec.status.filter((t) => /^Finding claims: chunk/.test(t));
  check("progress: 'chunk N of M, K claims so far' is shown and counts up", progress.some((t) => /^Finding claims: chunk 2 of \d+, [1-9]\d* claims? so far/.test(t)), progress.slice(0, 6).join(" | "));
  const chunkLens = await sp.evaluate(() => window.__mflChunks);
  await sp.keyboard.press("Control+Shift+D");
  await sp.waitForSelector("#toast:not([hidden])", { timeout: 3000 }).catch(() => {});
  check("debug export: Ctrl+Shift+D shows 'Debug copied'", (await sp.evaluate(() => document.getElementById("toast")?.textContent)) === "Debug copied");
  check("chunks: about 800 characters each, 5 to 10 chunks for the first 6,000 characters", chunkLens.length >= 5 && chunkLens.length <= 10 && chunkLens.every((n) => n <= 1100), chunkLens.join(","));
  const total1 = await txt(sp, "#claimsMode .mode-main");
  check("mode bar: 'On-device · N seconds' (no '(private)')", /^On-device · \d+\.\d seconds$/.test(total1), total1);
  const firstLine = await txt(sp, "#claimsMode .mode-first");
  check("mode bar: 'First claim in X seconds' line", /^First claim in \d+\.\d seconds$/.test(firstLine), firstLine);
  const sub1 = await txt(sp, "#claimsMode .mode-sub");
  check("claims tab: 'Your page stayed in this browser.' visible under the bar", sub1 === "Your page stayed in this browser." && (await sp.locator("#claimsMode .mode-sub").isVisible()), sub1);
  const status1 = await txt(sp, "#status");
  check("status line: total and first claim, with the word seconds", /^Done in \d+\.\d seconds on-device: 8 claims\. First claim in \d+\.\d seconds\./.test(status1), status1);
  const firstNum = Number(firstLine.match(/(\d+\.\d)/)[1]), totalNum = Number(status1.match(/^Done in (\d+\.\d)/)[1]);
  check("first claim is earlier than the total", firstNum < totalNum, `${firstNum} < ${totalNum}`);
  await sp.click("#tab-geo");
  check("AI view tab: bar and 'Your page stayed in this browser.' visible", (await sp.locator("#geoMode .mode-sub").isVisible()) && (await txt(sp, "#geoMode .mode-sub")) === "Your page stayed in this browser." && /^On-device · \d+\.\d seconds$/.test(await txt(sp, "#geoMode .mode-main")));
  await sp.click("#tab-claims");
  const ids = await sp.locator("#claimsList .claim").evaluateAll((els) => els.map((e) => e.dataset.id));
  const shownTotal = Number(await txt(sp, "#claimCount"));   // T3003: only red, vague and the 2 best green cards are shown; the rest sit behind "Show N more checkable claims"
  const moreRow = (await sp.locator(".more-toggle").count()) ? await txt(sp, ".more-toggle") : "";
  check("claims are merged without duplicates and numbered", shownTotal === 8 && new Set(ids).size === ids.length && ids.length + Number((moreRow.match(/\d+/) || [0])[0]) === 8, `${ids.join(",")} | ${moreRow}`);
  const marks1 = await sbfPage.evaluate(() => new Set([...document.querySelectorAll("mark.mfl-hl")].map((m) => m.dataset.mflId)).size);
  check("every card has its highlight on the page", marks1 === 8, `${marks1} highlighted`);
  const geoPrompt = await sp.evaluate(() => window.__mflPrompts.geo);
  check("on-device AI view input is capped (4,000 characters of main content) and has no site furniture", geoPrompt.length < 8500 && !/28 languages|Toggle the table of contents|Edit links/.test(geoPrompt), `${geoPrompt.length} chars of prompt`);
  check("'Analyze more of this page' button is offered", (await sp.locator("#more").isVisible()) && (await txt(sp, "#more")) === "Analyze more of this page");
  await sp.evaluate((m) => { window.__MFL_MOCK__ = m; window.__mflChunks = []; }, setB);
  await sp.click("#more");
  await sp.waitForFunction(() => /^Done/.test(document.getElementById("status").textContent) && !document.getElementById("analyze").disabled && Number(document.getElementById("claimCount").textContent) > 8, null, { timeout: 30000 });
  const ids2 = await sp.locator("#claimsList .claim").evaluateAll((els) => els.map((e) => e.dataset.id));
  check("Analyze more: the next window adds claims to the list, ids continue", Number(await txt(sp, "#claimCount")) === 10 && ids2.every((i) => /^c\d+$/.test(i)), ids2.join(","));
  const chunks2 = await sp.evaluate(() => window.__mflChunks);
  check("Analyze more: a new window of chunks is analysed", chunks2.length >= 3, chunks2.join(","));
  const marks2 = await sbfPage.evaluate(() => new Set([...document.querySelectorAll("mark.mfl-hl")].map((m) => m.dataset.mflId)).size);
  check("Analyze more: old highlights stay, new ones are added", marks2 === 10, `${marks2} highlighted`);
  await sp.evaluate(() => window.scrollTo(0, 0));
  await sp.screenshot({ path: join(demo, "7-streaming-on-device.png") });
  await sp.close();

  // Cloud: same extraction, bigger budget (12,000 characters), single call.
  const cp = await ctx.newPage();
  await cp.addInitScript((a) => { window.__MFL_MOCK__ = a.m; window.__MFL_MS__ = 3100; }, { m: setA });
  await cp.setViewportSize({ width: 420, height: 900 });
  await cp.goto(`chrome-extension://${extId}/sidepanel.html?target=${sbfTab}&mock=cloud`);
  await cp.waitForFunction(() => document.getElementById("deviceChip").dataset.state !== "checking");
  await sbfPage.evaluate(() => window.scrollTo(0, 0));
  await cp.click("#analyze");
  await cp.waitForFunction(() => /^Done/.test(document.getElementById("status").textContent), null, { timeout: 30000 });
  const cloudPrompt = await cp.evaluate(() => window.__mflPrompts.claims);
  check("cloud: one call, same main-content extraction, 12,000-character budget", cloudPrompt.length > 12000 && cloudPrompt.length < 16000 && !/28 languages|Toggle the table of contents|Edit links/.test(cloudPrompt) && /Samuel Benjamin Bankman-Fried \(born March 5, 1992\)/.test(cloudPrompt), `${cloudPrompt.length} chars of prompt`);
  check("cloud: bar 'Cloud · 3.1 seconds'", (await txt(cp, "#claimsMode .mode-main")) === "Cloud · 3.1 seconds", await txt(cp, "#claimsMode .mode-main"));
  check("cloud: 'First claim in X seconds' also shown, and the more button is offered", /^First claim in \d+\.\d seconds$/.test(await txt(cp, "#claimsMode .mode-first")) && (await cp.locator("#more").isVisible()));
  await cp.close();
  await sbfPage.close();

  // ---- Check button (T2987/T2988): one claim, answered by the lens-check Worker (mocked), three verdict states, 5 a day ----
  {
    const ckPage = await ctx.newPage();
    await ckPage.goto(`http://127.0.0.1:${port}/company-site`);
    const ckTab = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u + "*" }))[0].id, `http://127.0.0.1:${port}/company-site`);
    await sw.evaluate(() => chrome.storage.local.remove("lensChecks"));
    const srcs = [{ title: "example.org", url: "https://example.org/a" }, { title: "example.net", url: "https://example.net/b" }, { title: "example.com", url: "https://example.com/c" }, { title: "example.io", url: "https://example.io/d" }];
    const withCheck = (c) => ({ ...MOCKS["company-site"], check: { sources: srcs, ...c } });
    const openCk = async (mock) => {
      const pg = await ctx.newPage();
      await pg.addInitScript((m) => { window.__MFL_MOCK__ = m; }, mock);
      await pg.setViewportSize({ width: 420, height: 900 });
      await pg.goto(`chrome-extension://${extId}/sidepanel.html?target=${ckTab}&mock=cloud`);
      await pg.click("#analyze");
      await pg.waitForFunction(() => /^Done/.test(document.getElementById("status").textContent), null, { timeout: 20000 });
      return pg;
    };
    const cp = await openCk(withCheck({ verdict: "contradicted", reason: "The cash was later reported as not existing." }));
    const nSpecific = await cp.locator('.claim[data-kind="specific"]').count();
    const nBtn = await cp.locator(".check-btn").count();
    check("check: every specific card has a Check button, vague cards have none", nSpecific > 0 && nBtn === nSpecific, `${nBtn} buttons, ${nSpecific} specific`);
    check("check: tooltip says the page is not sent", (await cp.locator(".check-btn").first().getAttribute("title")) === "Searches the web for this one sentence. Your page is not sent.");
    check("check: '5 of 5 free checks left today' shown", (await cp.locator(".check-quota").first().textContent()) === "5 of 5 free checks left today");
    await cp.locator(".check-btn").first().click();
    await cp.waitForSelector('.pill[data-verdict="contradicted"]');
    check("check: Contradicted pill, reason, at most 3 source links opening in a new tab", (await cp.locator(".pill-contradicted").first().textContent()) === "Contradicted" && /later reported/.test(await cp.locator(".check-reason").first().textContent()) && (await cp.locator(".check-sources a").count()) === 3 && (await cp.locator('.check-sources a[target="_blank"][rel*="noopener"]').count()) === 3);
    check("check: mode shows 'Cloud · N seconds' and quota drops to 4", /^Cloud · \d+\.\d seconds$/.test(await cp.locator(".checkmode").first().textContent()) && (await cp.locator(".check-quota").first().textContent()) === "4 of 5 free checks left today", await cp.locator(".check-quota").first().textContent());
    check("check: no Google Search suggestions iframe any more", (await cp.locator("iframe.check-suggest").count()) === 0);
    const sent = await cp.evaluate(() => window.__mflCheckPrompts);
    check("check: only the claim sentence, the 127.0.0.1 domain and an empty date were sent, not the page", sent.length === 1 && Object.keys(sent[0]).sort().join() === "claim,date,domain" && sent[0].claim.length < 300 && sent[0].domain === "127.0.0.1" && !sent[0].date, JSON.stringify(sent[0]).slice(0, 200));
    await cp.screenshot({ path: join(shots, "e2e-check-contradicted.png") });
    const q = await sw.evaluate(async () => (await chrome.storage.local.get("lensChecks")).lensChecks);
    check("check: counter kept in chrome.storage.local", q && q.used === 1, JSON.stringify(q));
    // exhaust the day: with 5 used, every unchecked card shows the MentionFox link instead of the button
    await cp.close();
    await sw.evaluate(() => chrome.storage.local.set({ lensChecks: { day: (() => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })(), used: 5 } }));
    const xp = await openCk(withCheck({ verdict: "supported", reason: "x" }));
    const xl = xp.locator("a.check-btn");
    check("check: after the 5th, cards show 'Deep check in MentionFox' as a new-tab link with no price", (await xl.count()) === 2 && (await xl.first().textContent()) === "Deep check in MentionFox" && (await xl.first().getAttribute("target")) === "_blank" && /^https:\/\/mentionfox\.com\//.test(await xl.first().getAttribute("href")) && (await xp.locator("button.check-btn").count()) === 0, await xl.first().getAttribute("href"));
    await xp.screenshot({ path: join(shots, "e2e-check-limit.png") });
    await xp.close();
    const sp = await openCk(withCheck({ verdict: "supported", reason: "Filed with the regulator." }));
    await sw.evaluate(() => chrome.storage.local.remove("lensChecks"));
    await sp.reload();
    await sp.click("#analyze");
    await sp.waitForFunction(() => /^Done/.test(document.getElementById("status").textContent), null, { timeout: 20000 });
    await sp.locator(".check-btn").first().click();
    await sp.waitForSelector('.pill[data-verdict="supported"]');
    check("check: Supported shows a tick", /^✓ Supported$/.test(await sp.locator(".pill-supported").last().textContent()));
    await sp.close();
    const np = await openCk(withCheck({ verdict: "no_record", reason: "Nothing found." }));
    await np.locator(".check-btn").first().click();
    await np.waitForSelector('.pill[data-verdict="none"]');
    check("check: No clear record is grey", (await np.locator(".pill-none").first().textContent()) === "No clear record");
    await np.close();
    const ep = await openCk({ ...MOCKS["company-site"], check: { error: "429 RESOURCE_EXHAUSTED" } });
    await sw.evaluate(() => chrome.storage.local.remove("lensChecks"));
    await ep.locator(".check-btn").first().click();
    await ep.waitForSelector(".check-error");
    const qe = await sw.evaluate(async () => (await chrome.storage.local.get("lensChecks")).lensChecks);
    check("check: a failed call shows an error and is NOT counted", !qe || !qe.used, JSON.stringify(qe));
    await ep.close();
    await ckPage.close();
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
