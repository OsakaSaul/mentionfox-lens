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
const fixtureName = basename(fixturePath).replace(/\.html?$/, "");
const outDir = fixtureArg ? resolve(root, opt("--out") || `docs/real-runs/${fixtureName}`) : null;
if (outDir) mkdirSync(outDir, { recursive: true });

const log = [];
const tokenValue = existsSync(resolve(root, ".env.local")) ? readFileSync(resolve(root, ".env.local"), "utf8").match(/APPCHECK_DEBUG_TOKEN=(\S+)/)?.[1] : null;
const redact = (s) => (tokenValue ? String(s).split(tokenValue).join("<debug-token>") : String(s));
const out = (s) => { const r = redact(s); console.log(r); log.push(r); };

if (!argv.includes("--no-build") && spawnSync(process.execPath, [resolve(root, "scripts/build.mjs"), "--dev"], { cwd: root, stdio: "ignore" }).status !== 0) process.exit(1);
const mpath = resolve(root, "dist/manifest.json");
const m = JSON.parse(readFileSync(mpath, "utf8"));
m.host_permissions = ["http://127.0.0.1/*"]; // test only, so the probe can inject without a toolbar click
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
if (fixtureArg) out(`fixture: ${basename(fixturePath)}${srcUrl ? ` (source ${srcUrl})` : ""}`);
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const extId = new URL(sw.url()).host;
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" }).catch(() => {});
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "http://127.0.0.1/*" }))[0].id);
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
  const badge = await panel.locator("#claimsMode .chip").first().textContent().catch(() => "(no result badge: no model answer)");
  out(`claims mode badge: ${badge}`);
  const last = await panel.evaluate(() => window.__lensLast || null);
  if (outDir && last) {
    const ground = await page.evaluate(() => [...document.querySelectorAll("mark.mfl-hl")].map((m) => ({ id: m.getAttribute("data-mfl-id"), text: m.textContent })));
    const result = {
      fixture: basename(fixturePath), source_url: srcUrl || null, run_at: new Date().toISOString(), model_path: "Firebase AI Logic, cloud (PREFER_ON_DEVICE; on-device unavailable in this Chromium)",
      page: last.page,
      claims: { source: last.claims.source, ms: last.claims.ms, retried: last.claims.retried, raw: last.claims.raw, normalized: last.claims.value },
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
