// Real (unmocked) run of the DEV build in Chromium against a fixture page. Records what actually happens:
// LanguageModel availability, the mode badge, errors from the cloud fallback (App Check, key restrictions).
// Writes docs/run-log.txt. Needs a dev build with APPCHECK_DEBUG_TOKEN in .env.local.
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, readdirSync, writeFileSync, existsSync, rmSync, appendFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = [];
const out = (s) => { console.log(s); log.push(s); };
const redact = (s) => { const t = (existsSync(resolve(root, ".env.local")) ? readFileSync(resolve(root, ".env.local"), "utf8").match(/APPCHECK_DEBUG_TOKEN=(\S+)/)?.[1] : null); return t ? String(s).split(t).join("<debug-token>") : String(s); };

if (spawnSync(process.execPath, [resolve(root, "scripts/build.mjs"), "--dev"], { cwd: root, stdio: "ignore" }).status !== 0) process.exit(1);
const mpath = resolve(root, "dist/manifest.json");
const m = JSON.parse(readFileSync(mpath, "utf8"));
m.host_permissions = ["http://127.0.0.1/*"]; // test only, so the probe can inject without a toolbar click
writeFileSync(mpath, JSON.stringify(m, null, 2));

const base = join(os.homedir(), "AppData/Local/ms-playwright");
const exe = process.env.CHROMIUM_PATH || readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse().map((d) => join(base, d, "chrome-win64/chrome.exe")).find(existsSync);

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(readFileSync(resolve(root, "test/fixtures/company-site.html"))); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const dir = resolve(os.tmpdir(), "mfl-probe-" + Date.now());
const flags = process.argv.includes("--nano-flags") ? ["--enable-features=PromptAPIForGeminiNano,OptimizationGuideOnDeviceModel,AIPromptAPI"] : [];
const ctx = await chromium.launchPersistentContext(dir, {
  executablePath: exe, headless: false,
  args: [`--disable-extensions-except=${resolve(root, "dist")}`, `--load-extension=${resolve(root, "dist")}`, "--headless=new", "--no-first-run", ...flags],
});
out(`date: ${new Date().toISOString()}`);
out(`browser: ${ctx.browser()?.version?.() ?? "chromium"} (${exe})`);
out(`extra flags: ${flags.join(" ") || "none"}`);
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const extId = new URL(sw.url()).host;
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "http://127.0.0.1/*" }))[0].id);
  const panel = await ctx.newPage();
  const consoleLines = [];
  panel.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  panel.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));
  await panel.goto(`chrome-extension://${extId}/sidepanel.html?target=${tabId}`);
  const avail = await panel.evaluate(async () => (self.LanguageModel ? await self.LanguageModel.availability({ expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] }) : "LanguageModel API absent"));
  out(`LanguageModel.availability(): ${avail}`);
  out(`chip: ${await panel.textContent("#deviceChip")}`);
  await panel.click("#analyze");
  await panel.waitForFunction(() => /^Done|\S{20,}/.test(document.getElementById("status").textContent) && !document.getElementById("analyze").disabled, null, { timeout: 90000 }).catch(() => {});
  out(`status after Analyze: ${redact(await panel.textContent("#status"))}`);
  const badge = await panel.locator("#claimsMode .chip").first().textContent().catch(() => "(no result badge: no model answer)");
  out(`claims mode badge: ${badge}`);
  out(`console (first 12 lines, token redacted):`);
  for (const l of consoleLines.slice(0, 12)) out("  " + redact(l).slice(0, 300));
} catch (e) {
  out("probe error: " + redact(e.message));
} finally {
  await ctx.close(); server.close();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
}
writeFileSync(resolve(root, "docs/live-probe.txt"), log.join("\n") + "\n");
