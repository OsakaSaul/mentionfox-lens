// Renders the Chrome Web Store images into store/ from the built extension (dev + e2e mock build, used for rendering only).
// The pages are made up (test/fixtures/made-up) and the claims and AI-view text are hand-written examples (T3188): nothing on these
// images is another site's page or real model output, and no run time is shown. Nothing here is shipped in the zip. Usage: node scripts/store-images.mjs
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "store");
mkdirSync(out, { recursive: true });
const tmp = resolve(os.tmpdir(), "mfl-store-" + Date.now());
mkdirSync(tmp, { recursive: true });

const build = spawnSync(process.execPath, [resolve(root, "scripts/build.mjs"), "--dev", "--e2e"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(1);
const mpath = resolve(root, "dist/manifest.json");
const m = JSON.parse(readFileSync(mpath, "utf8"));
m.host_permissions = ["http://127.0.0.1/*"];
writeFileSync(mpath, JSON.stringify(m, null, 2));
const icon = "data:image/png;base64," + readFileSync(resolve(root, "icons/icon128.png")).toString("base64");

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(os.homedir(), "AppData/Local/ms-playwright");
  const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) { const p = join(base, d, "chrome-win64/chrome.exe"); if (existsSync(p)) return p; }
}

const EXAMPLES = JSON.parse(readFileSync(resolve(root, "test/fixtures/claims/store-examples.json"), "utf8"));
const made = (key, file) => ({ ...EXAMPLES[key], file: resolve(root, "test/fixtures/made-up", file + ".html") });
const RUNS = { priya: made("priya", "encyclopedia-priya"), rowan: made("rowan", "encyclopedia-rowan"), release: made("release", "veridrop-release") };

const server = createServer((req, res) => {
  const k = req.url.replace(/^\/|\?.*$/g, "");
  if (!RUNS[k]) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(readFileSync(RUNS[k].file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const ctx = await chromium.launchPersistentContext(resolve(tmp, "profile"), {
  executablePath: findChromium(),
  headless: false,
  args: [`--disable-extensions-except=${resolve(root, "dist")}`, `--load-extension=${resolve(root, "dist")}`, "--headless=new", "--no-first-run"],
  viewport: { width: 840, height: 650 },
});
const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
const extId = new URL(sw.url()).host;

const PW = 840, PH = 650, SW = 380;
const FORBIDDEN = /\b(gemini|nano|claude|openai|firebase)\b/i; // whole words
const texts = [];

async function capture(key, { mock, ms, tab = "claims", jump = null, progress = null }) {
  const run = RUNS[key];
  const url = `http://127.0.0.1:${port}/${key}`;
  const page = await ctx.newPage();
  await page.setViewportSize({ width: PW, height: PH });
  await page.goto(url);
  const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u + "*" }))[0].id, url);
  const panel = await ctx.newPage();
  await panel.addInitScript((a) => { window.__MFL_MOCK__ = a.m; window.__MFL_MS__ = a.ms; }, { m: { claims: run.claims, geo: run.geo }, ms });
  await panel.setViewportSize({ width: SW, height: PH });
  await panel.goto(`chrome-extension://${extId}/sidepanel.html?target=${tabId}&mock=${mock}`);
  await panel.addStyleTag({ content: ".mode-first{display:none}" }); // store images show the mode, not a mock first-claim time
  await panel.waitForFunction(() => { const s = document.getElementById("deviceChip").dataset.state; return s && s !== "checking"; });
  if (progress != null) await panel.evaluate((p) => window.__mflProgress(p), progress);
  await panel.click("#analyze");
  await panel.waitForFunction(() => /^Done|cannot|Not enough|Lens needs/.test(document.getElementById("status").textContent), null, { timeout: 20000 });
  if (progress != null) await panel.evaluate((p) => window.__mflProgress(p), progress);
  if (tab === "geo") await panel.click("#tab-geo");
  if (jump != null) { await panel.locator(".claim:not(.missing)").nth(jump).click(); await page.waitForTimeout(650); }
  else await page.evaluate(() => { const e = document.querySelector("mark.mfl-hl"); if (e) e.scrollIntoView({ block: "center" }); });
  // The privacy paragraph names the cloud provider; store images carry no model or provider names, so it is left out of the captures.
  await panel.evaluate(() => document.getElementById("privacy")?.remove());
  // The mock has no real first-claim time: drop that sentence from the status line in the images.
  await panel.evaluate(() => { const st = document.getElementById("status"); st.textContent = st.textContent.replace(/ First claim in [0-9.]+ seconds./, ""); });
  // no real run happened, so no run time is shown
  await panel.evaluate(() => document.querySelectorAll(".mode-main .nw").forEach((e) => { const p = e.previousSibling; if (p && p.nodeType === 3 && p.nodeValue.trim() === "·") p.remove(); e.remove(); }));
  await panel.evaluate(() => { const w = document.createTreeWalker(document.body, 4); for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeValue = n.nodeValue.replace(/\s*·\s*[0-9.]+ seconds/g, "").replace(/ in [0-9.]+ seconds/g, "").replace(/First claim in [0-9.]+ seconds\.?/g, ""); });
  await page.waitForTimeout(400);
  texts.push(await panel.evaluate(() => document.body.innerText));
  const pageShot = await page.screenshot();
  const panelShot = await panel.screenshot();
  await panel.close();
  await page.close();
  return { pageShot, panelShot };
}

const b64 = (b) => "data:image/png;base64," + b.toString("base64");
const CSS = `
*{box-sizing:border-box;margin:0}
body{font-family:"Segoe UI",system-ui,sans-serif;color:#fff;overflow:hidden;position:relative;
 background:radial-gradient(900px 500px at 85% 0%,#F27A3A 0%,rgba(242,122,58,0) 60%),radial-gradient(700px 500px at 0% 100%,#2f6bff 0%,rgba(47,107,255,0) 55%),linear-gradient(135deg,#1A2040,#111733)}
.h{font-weight:800;letter-spacing:-.01em;line-height:1.08}
.h em{font-style:normal;color:#F5C542}
.sub{opacity:.92;font-weight:500}
.frame{position:absolute;border-radius:14px;overflow:hidden;box-shadow:0 18px 50px rgba(5,8,25,.55);border:2px solid rgba(255,255,255,.25);background:#fff}
.frame img{display:block;width:100%;height:100%}
.brand{display:flex;align-items:center;gap:12px;font-weight:800}
.brand img{width:44px;height:44px;border-radius:10px}
`;
async function render(name, w, h, html) {
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: w, height: h });
  await pg.setContent(`<html><head><style>${CSS}body{width:${w}px;height:${h}px}</style></head><body>${html}</body></html>`);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: join(out, name), type: "png" });
  await pg.close();
}
const screenshot = (name, headline, sub, shots) => render(name, 1280, 800, `
  <div style="position:absolute;left:36px;top:22px;right:36px;display:flex;align-items:center;gap:18px">
    <div class="brand"><img src="${icon}"></div>
    <div><div class="h" style="font-size:36px">${headline}</div><div class="sub" style="font-size:18px;margin-top:4px">${sub} <span style="opacity:.7">Example on a made-up page.</span></div></div>
  </div>
  <div class="frame" style="left:24px;top:112px;width:${PW}px;height:${PH}px"><img src="${b64(shots.pageShot)}"></div>
  <div class="frame" style="left:${24 + PW + 16}px;top:112px;width:${SW}px;height:${PH}px"><img src="${b64(shots.panelShot)}"></div>`);

let s = await capture("priya", { mock: "cloud", ms: 3301 });
await screenshot("screenshot-1-claim-xray.png", "Spot the claims. <em>Check what is checkable.</em>", "Every factual claim is highlighted in place and labelled specific or vague.", s);
const s1 = s;
s = await capture("rowan", { mock: "cloud", ms: 3619, jump: 2 });
await screenshot("screenshot-2-jump-to-claim.png", "Click a claim. <em>The page jumps to that sentence.</em>", "A reason sits next to each claim, so you know what to verify first.", s);
s = await capture("release", { mock: "cloud", ms: 3519, tab: "geo" });
await screenshot("screenshot-3-ai-view.png", "See the page <em>the way an AI assistant would.</em>", "People, companies and facts it picks up, what is missing, three fixes and a 0 to 100 score.", s);
s = await capture("priya", { mock: "available", ms: 2100 });
await screenshot("screenshot-4-on-device.png", "Private when it can be. <em>On-device first.</em>", "When your Chrome has its built-in model, the analysis stays on your computer.", s);
s = await capture("release", { mock: "downloading", ms: 3519, progress: 0.42 });
await screenshot("screenshot-5-never-blocked.png", "Never stuck waiting. <em>Cloud fills in while it downloads.</em>", "The panel shows the download percent and which mode answered.", s);

await render("promo-tile-440x280.png", 440, 280, `
  <div style="position:absolute;left:22px;top:20px" class="brand"><img src="${icon}"><span style="font-size:18px">MentionFox Lens</span></div>
  <div class="h" style="position:absolute;left:22px;top:92px;width:230px;font-size:30px">Spot the claims. <em>Check what is checkable.</em></div>
  <div class="sub" style="position:absolute;left:22px;bottom:18px;font-size:14px">Free. On-device first. Open source.</div>
  <div class="frame" style="left:262px;top:34px;width:190px;height:290px"><img src="${b64(s1.panelShot)}" style="object-fit:cover;object-position:top"></div>`);
await render("marquee-1400x560.png", 1400, 560, `
  <div style="position:absolute;left:56px;top:48px" class="brand"><img src="${icon}" style="width:64px;height:64px;border-radius:14px"><span style="font-size:30px">MentionFox Lens</span></div>
  <div class="h" style="position:absolute;left:56px;top:150px;width:640px;font-size:62px">Spot the claims. <em>Check what is checkable.</em></div>
  <div class="sub" style="position:absolute;left:56px;top:400px;width:600px;font-size:24px">Highlights the claims on any page and shows how an AI assistant would read it.</div>
  <div style="position:absolute;left:56px;bottom:40px;font-weight:700;font-size:20px;color:#F5C542">Free. Private. No account.</div>
  <div class="frame" style="left:740px;top:44px;width:${Math.round(PW * 0.44)}px;height:${Math.round(PH * 0.8)}px;transform:rotate(-2deg)"><img src="${b64(s1.pageShot)}" style="object-fit:cover;object-position:left top"></div>
  <div class="frame" style="left:1090px;top:88px;width:270px;height:${Math.round(270 * PH / SW)}px;transform:rotate(2deg)"><img src="${b64(s1.panelShot)}"></div>`);

await ctx.close();
server.close();
try { rmSync(tmp, { recursive: true, force: true }); } catch { /* temp */ }
const bad = texts.filter((t) => FORBIDDEN.test(t));
console.log(bad.length ? "FORBIDDEN WORD in visible panel text: " + bad.map((t) => (t.match(/.{0,50}(gemini|nano|claude|openai|firebase).{0,50}/is) || [""])[0].replace(/s+/g, " ")).join(" // ") : "no model names in visible panel text");
if (bad.length) process.exit(1);
