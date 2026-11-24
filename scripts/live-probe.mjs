// Real (unmocked) run of the DEV build in Chromium against a fixture page. Records what actually happens:
// LanguageModel availability, the mode badge, errors from the cloud fallback (App Check, key restrictions).
//   node scripts/live-probe.mjs                          default fixture, writes docs/live-probe.txt
//   node scripts/live-probe.mjs --fixture <file>         any saved HTML page (e.g. fixtures/real/founder-bio.html);
//                                                        writes docs/real-runs/<name>/ (run-log.txt, result.json, screenshots)
//   options: --out <dir>  --no-build  --nano-flags
// Needs a dev build with APPCHECK_DEBUG_TOKEN in .env.local (gitignored). The token is redacted from every output.
// Fixture pages are served from 127.0.0.1 with <script> tags removed (so client-side hydration cannot rewrite the text)
// and a <base href> pointing at the original URL (from fixtures/real/sources.json) so CSS and images still load.
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, readdirSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const fixtureArg = opt("--fixture");
const fixturePath = fixtureArg ? resolve(process.cwd(), fixtureArg) : resolve(root, "test/fixtures/company-site.html");
const urlArg = opt("--url"); // live page instead of a fixture (scripts kept, so client-side rendering works)
const fixtureName = urlArg ? (opt("--name") || "live-url") : basename(fixturePath).replace(/\.html?$/, "");
const outDir = fixtureArg || urlArg ? resolve(root, opt("--out") || `docs/real-runs/${fixtureName}`) : null;
if (outDir) mkdirSync(outDir, { recursive: true });

const log = [];
const tokenValue = existsSync(resolve(root, ".env.local")) ? readFileSync(resolve(root, ".env.local"), "utf8").match(/APPCHECK_DEBUG_TOKEN=(\S+)/)?.[1] : null;
const redact = (s) => (tokenValue ? String(s).split(tokenValue).join("<debug-token>") : String(s));
const out = (s) => { const r = redact(s); console.log(r); log.push(r); };

if (!argv.includes("--no-build") && spawnSync(process.execPath, [resolve(root, "scripts/build.mjs"), "--dev"], { cwd: root, stdio: "ignore" }).status !== 0) process.exit(1);
const mpath = resolve(root, "dist/manifest.json");
const m = JSON.parse(readFileSync(mpath, "utf8"));
m.host_permissions = urlArg ? [new URL(urlArg).origin + "/*"] : ["http://127.0.0.1/*"]; // test only, so the probe can inject without a toolbar click
writeFileSync(mpath, JSON.stringify(m, null, 2));

const base = join(os.homedir(), "AppData/Local/ms-playwright");
const exe = process.env.CHROMIUM_PATH || readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse().map((d) => join(base, d, "chrome-win64/chrome.exe")).find(existsSync);

const sources = existsSync(resolve(root, "fixtures/real/sources.json")) ? JSON.parse(readFileSync(resolve(root, "fixtures/real/sources.json"), "utf8")) : {};
const srcUrl = sources[basename(fixturePath)]?.url;
let html = readFileSync(fixturePath, "utf8");
if (fixtureArg) {
  html = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");
  if (srcUrl) html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${srcUrl}">`);
}
const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const dir = resolve(os.tmpdir(), "mfl-probe-" + Date.now());
const flags = argv.includes("--nano-flags") ? ["--enable-features=PromptAPIForGeminiNano,OptimizationGuideOnDeviceModel,AIPromptAPI"] : [];
const ctx = await chromium.launchPersistentContext(dir, {
  executablePath: exe, headless: false, viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${resolve(root, "dist")}`, `--load-extension=${resolve(root, "dist")}`, "--headless=new", "--no-first-run", ...flags],
});
out(`date: ${new Date().toISOString()}`);
out(`browser: ${ctx.browser()?.version?.() ?? "chromium"} (${exe})`);
out(`extra flags: ${flags.join(" ") || "none"}`);
if (urlArg) out(`url: ${urlArg}`);
if (fixtureArg) out(`fixture: ${basename(fixturePath)}${srcUrl ? ` (source ${srcUrl})` : ""}`);
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const extId = new URL(sw.url()).host;
  const page = await ctx.newPage();
  await page.goto(urlArg || `http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 90000 }).catch(() => {});
  if (urlArg) await page.waitForTimeout(6000);
  const tabPattern = urlArg ? new URL(urlArg).origin + "/*" : "http://127.0.0.1/*";
  const tabId = await sw.evaluate(async (pat) => (await chrome.tabs.query({ url: pat }))[0].id, tabPattern);
  const panel = await ctx.newPage();
  await panel.setViewportSize({ width: 440, height: 900 });
  const consoleLines = [];
  panel.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  panel.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));
  await panel.goto(`chrome-extension://${extId}/sidepanel.html?target=${tabId}`);
  const avail = await panel.evaluate(async () => (self.LanguageModel ? await self.LanguageModel.availability({ expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] }) : "LanguageModel API absent"));
  out(`LanguageModel.availability(): ${avail}`);
  out(`chip: ${await panel.textContent("#deviceChip")}`);
  await panel.click("#analyze");
  await panel.waitForFunction(() => /^Done|\S{20,}/.test(document.getElementById("status").textContent) && !document.getElementById("analyze").disabled, null, { timeout: 150000 }).catch(() => {});
  out(`status after Analyze: ${await panel.textContent("#status")}`);
  const badge = await panel.locator("#claimsMode .mode-main").first().textContent().catch(() => "(no result badge: no model answer)");
  out(`claims mode badge: ${badge}`);
  const last = await panel.evaluate(() => window.__lensLast || null);
  if (opt("--check-url") !== null || argv.includes("--check")) {
    // T2987: click Check on the first specific card (one real grounded call). --check-url pretends the page URL is a Wayback snapshot (dev build hook).
    if (opt("--check-model")) await panel.evaluate((m) => { self.__lensCheckModel = m; }, opt("--check-model"));
    if (opt("--check-url")) await panel.evaluate((u) => { window.__lensCheckUrl = u; }, opt("--check-url"));
    await panel.locator("button.check-btn").first().click();
    await panel.waitForFunction(() => document.querySelector(".pill[data-verdict]") || document.querySelector(".check-error"), null, { timeout: 90000 }).catch(() => {});
    const ck = await panel.evaluate(() => { const li = document.querySelector("li[data-verdict]:not([data-verdict=''])") || document.querySelector(".checkrow"); return { quote: li?.querySelector(".quote")?.textContent, row: li?.querySelector(".checkrow")?.innerText }; });
    out(`CHECK quote: ${ck.quote}`);
    out(`CHECK result: ${String(ck.row).split(String.fromCharCode(10)).join(" | ")}`);
    if (outDir) await panel.screenshot({ path: join(outDir, "panel-check.png") });
  }
  if (outDir && last) {
    const pageText = await page.evaluate(() => document.body.innerText.length);
    out(`page body text length: ${pageText}`);
    const ground = await page.evaluate(() => [...document.querySelectorAll("mark.mfl-hl")].map((m) => ({ id: m.getAttribute("data-mfl-id"), text: m.textContent })));
    const result = {
      fixture: urlArg ? null : basename(fixturePath), source_url: urlArg || srcUrl || null, run_at: new Date().toISOString(), model_path: "Firebase AI Logic, cloud (PREFER_ON_DEVICE; on-device unavailable in this Chromium)",
      page: last.page,
      claims: { source: last.claims.source, ms: last.claims.ms, first_ms: last.claims.firstMs, retried: last.claims.retried, raw: last.claims.raw, normalized: last.claims.value },
      highlight: last.highlight?.results || [],
      highlighted_text: ground,
      geo: { source: last.geo.source, ms: last.geo.ms, retried: last.geo.retried, raw: last.geo.raw, normalized: last.geo.value },
    };
    writeFileSync(join(outDir, "result.json"), redact(JSON.stringify(result, null, 2)) + "\n");
    await panel.screenshot({ path: join(outDir, "panel-claims.png") });
    await page.bringToFront();
    const first = ground[0];
    if (first) await page.evaluate((id) => document.querySelector(`mark[data-mfl-id="${id}"]`)?.scrollIntoView({ block: "center" }), first.id);
    await page.screenshot({ path: join(outDir, "page-highlights.png") });
    await panel.bringToFront();
    await panel.click("#tab-geo");
    await panel.screenshot({ path: join(outDir, "panel-geo.png"), fullPage: true });
    out(`claims: ${last.claims.value.length}, highlighted: ${ground.length ? new Set(ground.map((g) => g.id)).size : 0}, claims ${last.claims.ms} ms, geo ${last.geo.ms} ms`);
    // T2963 speed log (CLOUD path of this Chromium; the on-device model is unavailable here, so no on-device speed is measured):
    const w = last.window || {};
    const found = (last.highlight?.results || []).filter((r) => r.found).length;
    const nClaims = last.claims.value.length;
    out(`T2963 log: chars before extraction ${last.page.rawChars}, after ${last.page.textLength} (${last.page.blocks} blocks, root ${last.page.rootTag}); ` +
      `cloud window ${w.chars} of budget ${w.budget} chars, ${w.chunks} cloud call; on-device plan: ${w.deviceWindow?.chunks} chunks of about ${w.deviceWindow?.chunkChars} chars over ${w.deviceWindow?.chars} chars; ` +
      `claims ${nClaims}; first claim in ${(last.claims.firstMs / 1000).toFixed(1)} seconds (cloud: arrives with the single answer), claims call ${(last.claims.ms / 1000).toFixed(1)} seconds, AI view ${(last.geo.ms / 1000).toFixed(1)} seconds; matched ${found}/${nClaims} (${nClaims ? Math.round((found / nClaims) * 100) : 0}%)`);
  }
  out(`console (first 12 lines, token redacted):`);
  for (const l of consoleLines.slice(0, 12)) out("  " + l.slice(0, 300));
} catch (e) {
  out("probe error: " + e.message);
} finally {
  await ctx.close(); server.close();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
}
writeFileSync(outDir ? join(outDir, "run-log.txt") : resolve(root, "docs/live-probe.txt"), log.join("\n") + "\n");
