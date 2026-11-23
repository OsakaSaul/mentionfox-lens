import { runTask, initDevice, probeDevice, InferenceSource } from "../ai.js";
import { CLAIMS_SCHEMA, GEO_SCHEMA, buildClaimsPrompt, buildGeoPrompt } from "../shared/prompts.js";
import { normalizeClaims, normalizeGeo } from "../shared/parse.js";
import { geoScore, geoBand, GEO_BANDS, GEO_DIMENSION_LABELS } from "../shared/geo.js";
import { VERIFY_CLAIMS_URL, DECISION_MAKERS_URL } from "../shared/links.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

$("linkVerify").href = VERIFY_CLAIMS_URL;
$("linkPeople").href = DECISION_MAKERS_URL;

let engine = { runTask, initDevice, probeDevice };
let state = { tabId: null, claims: [] };

/* ---------- status helpers ---------- */
function setStatus(text, isError = false) {
  const s = $("status");
  s.textContent = text;
  s.classList.toggle("error", isError);
}

function setDeviceChip(status, note = "") {
  const chip = $("deviceChip");
  const map = {
    available: ["chip chip-device", "Private on-device model: ready", "Your browser can run the analysis on this device"],
    downloadable: ["chip chip-neutral", "Private on-device model: downloads on first Analyze", "A one-time download makes private analysis possible; until then the cloud is used"],
    downloading: ["chip chip-neutral", "Private on-device model: downloading", "The on-device model is downloading; the cloud is used until it is ready"],
    unsupported: ["chip chip-cloud", "On-device not available in this browser: cloud fallback", "This browser or device cannot run the on-device model, so the cloud is used"],
    unavailable: ["chip chip-cloud", "On-device not available on this device: cloud fallback", "This device cannot run the on-device model, so the cloud is used"],
  };
  const [cls, text, tip] = map[status] || map.unsupported;
  chip.className = cls;
  chip.textContent = text + (note ? " " + note : "");
  chip.title = tip;
  chip.setAttribute("aria-label", text);
}

function showProgress(p) {
  const wrap = $("progressWrap");
  wrap.hidden = false;
  const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
  $("progressBar").style.width = pct + "%";
  $("progressBar").setAttribute("aria-valuenow", String(pct));
  $("progressText").textContent = `Downloading private model ${pct}%`;
  if (p >= 1) setTimeout(() => (wrap.hidden = true), 1200);
}

function modeBadge(res) {
  const onDevice = res.source === InferenceSource.ON_DEVICE;
  const wrap = h("div", { class: "modebar" });
  const b = h(
    "span",
    {
      class: "chip " + (onDevice ? "chip-device" : "chip-cloud"),
      title: onDevice ? "This answer was produced on your device. The page text did not leave it." : "This answer was produced in the cloud by Firebase AI Logic because the on-device model was not used.",
      "aria-label": onDevice ? "Mode: on-device, private" : "Mode: cloud",
      "data-mode": onDevice ? "on_device" : "in_cloud",
    },
    onDevice ? "On-device (private)" : "Cloud",
  );
  const extra = [`${res.ms} ms`];
  if (res.inferred) extra.push("mode inferred");
  if (res.retried) extra.push("retried in cloud after an unusable on-device answer");
  wrap.append(b, h("span", { class: "ms", title: "Time from request to parsed answer" }, extra.join(" | ")));
  return wrap;
}

function placeMode(containerId, res) {
  const c = $(containerId);
  c.replaceChildren(...modeBadge(res).childNodes);
  c.hidden = false;
}

/* ---------- tabs ---------- */
function selectTab(name) {
  for (const n of ["claims", "geo"]) {
    const sel = n === name;
    $("tab-" + n).setAttribute("aria-selected", String(sel));
    $("tab-" + n).tabIndex = sel ? 0 : -1;
    $("panel-" + n).hidden = !sel;
  }
}
for (const n of ["claims", "geo"]) {
  $("tab-" + n).addEventListener("click", () => selectTab(n));
  $("tab-" + n).addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const next = n === "claims" ? "geo" : "claims";
      selectTab(next);
      $("tab-" + next).focus();
    }
  });
}

/* ---------- tab + content script plumbing ---------- */
async function getTab() {
  if (params.has("target")) return chrome.tabs.get(Number(params.get("target"))); // test harness only
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function ensureContent(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
}

const send = (tabId, msg) => chrome.tabs.sendMessage(tabId, { target: "lens-content", ...msg });

/* ---------- rendering ---------- */
function renderClaims(claims, results) {
  const list = $("claimsList");
  list.replaceChildren();
  const byId = new Map((results || []).map((r) => [r.id, r]));
  for (const c of claims) {
    const r = byId.get(c.id);
    const found = !r || r.found;
    const label = c.kind === "specific" ? "Specific and checkable" : "Vague or puffery";
    const card = h(
      "button",
      {
        class: "claim" + (found ? "" : " missing"),
        type: "button",
        "data-kind": c.kind,
        "data-id": c.id,
        title: found ? "Scroll to this claim on the page and flash it" : "This exact text was not found on the page (it may have changed)",
        "aria-label": `${label}: ${c.quote}. ${found ? "Jump to highlight on the page" : "Not found on the page"}`,
        disabled: !found || null,
      },
      h("span", { class: "pill pill-" + c.kind }, label),
      h("span", { class: "quote" }, `“${c.quote}”`),
      c.why ? h("span", { class: "why" }, c.why) : "",
      h("span", { class: "where" }, found ? "Show on page" : "Not found on the page"),
    );
    if (found) card.addEventListener("click", () => jump(c.id));
    list.append(h("li", {}, card));
  }
  $("claimsEmpty").hidden = claims.length > 0;
  $("claimsLegend").hidden = claims.length === 0;
  const cnt = $("claimCount");
  cnt.hidden = claims.length === 0;
  cnt.textContent = String(claims.length);
}

async function jump(id) {
  try {
    const r = await send(state.tabId, { type: "jump", id });
    if (!r?.ok) setStatus("Could not find that claim on the page any more.", true);
  } catch {
    setStatus("Lost contact with the page. Click Analyze again.", true);
  }
}

function renderGeo(geo, res) {
  const score = geoScore(geo.ratings);
  const band = geoBand(score);
  const body = $("geoBody");
  body.replaceChildren(
    h(
      "div",
      { class: "score-card" },
      h("div", { class: "score", style: `--pct:${score}`, role: "img", "aria-label": `AI-readiness score ${score} out of 100`, title: `AI-readiness score ${score} out of 100` }, h("span", {}, String(score))),
      h("div", {}, h("div", { class: "band-label" }, `${band.label}`), h("div", { class: "band-meaning" }, band.meaning)),
    ),
    h(
      "ul",
      { class: "ranges", "aria-label": "What each score range means" },
      GEO_BANDS.slice().reverse().map((b) => h("li", { class: b.id === band.id ? "on" : "" }, `${b.min} to ${b.max}: ${b.label}. ${b.meaning}`)),
    ),
    h("div", { class: "block" }, h("h3", {}, "People, companies and products it would pick up"),
      geo.entities.length ? h("ul", { class: "ents" }, geo.entities.map((e) => h("li", { class: "ent" }, e.name, h("small", {}, e.type)))) : h("p", { class: "empty" }, "None found.")),
    h("div", { class: "block" }, h("h3", {}, "Facts it would state"), geo.facts.length ? h("ul", {}, geo.facts.map((f) => h("li", {}, f))) : h("p", { class: "empty" }, "No checkable facts found.")),
    h("div", { class: "block" }, h("h3", {}, "Missing or ambiguous"), geo.missing.length ? h("ul", {}, geo.missing.map((f) => h("li", {}, f))) : h("p", { class: "empty" }, "Nothing flagged.")),
    h("div", { class: "block" }, h("h3", {}, "3 fixes"), geo.fixes.length ? h("ol", {}, geo.fixes.map((f) => h("li", {}, f))) : h("p", { class: "empty" }, "No fixes suggested.")),
    h("div", { class: "block" }, h("h3", {}, "How the score is built"),
      h("ul", { class: "dims" }, Object.entries(GEO_DIMENSION_LABELS).map(([k, label]) =>
        h("li", { class: "dim" }, h("span", {}, label), h("span", { class: "bar" }, h("i", { style: `width:${(geo.ratings[k] / 4) * 100}%` })), h("span", {}, `${geo.ratings[k]}/4`))))),
  );
  placeMode("geoMode", res);
  const g = $("geoCount");
  g.hidden = false;
  g.textContent = String(score);
}

/* ---------- main flow ---------- */
let busy = false;
async function analyze() {
  if (busy) return;
  busy = true;
  const btn = $("analyze");
  btn.disabled = true;
  try {
    setStatus("Reading the page...");
    const tab = await getTab();
    if (!tab?.id || !/^https?:|^file:/.test(tab.url || "")) throw new Error("Open a normal web page first (browser pages cannot be analysed).");
    state.tabId = tab.id;
    try {
      await ensureContent(tab.id);
    } catch {
      throw new Error("Lens needs permission for this tab. Click the Lens toolbar icon while on the page, then Analyze.");
    }
    const ex = await send(tab.id, { type: "extract" });
    if (!ex?.ok || ex.page.textLength < 80) throw new Error("Not enough readable text on this page.");
    const page = ex.page;

    const deviceStatus = await engine.probeDevice();
    setDeviceChip(deviceStatus);
    // User gesture is active here: allowed to start the on-device model download.
    const init = engine.initDevice(CLAIMS_SCHEMA, showProgress);
    if (deviceStatus === "available") await init;

    setStatus("Finding claims...");
    $("claimsEmpty").textContent = "Working...";
    const cres = await engine.runTask({ key: "claims", schema: CLAIMS_SCHEMA, prompt: buildClaimsPrompt(page.text), normalize: normalizeClaims, deviceStatus });
    state.claims = cres.value;
    setStatus("Highlighting claims on the page...");
    const hres = await send(tab.id, { type: "highlight", claims: cres.value });
    renderClaims(cres.value, hres?.results);
    placeMode("claimsMode", cres);
    $("clear").disabled = false;
    const missing = (hres?.results || []).filter((r) => !r.found).length;

    setStatus("Checking how an AI assistant would read this page...");
    const gres = await engine.runTask({ key: "geo", schema: GEO_SCHEMA, prompt: buildGeoPrompt(page.text, { title: page.title }), normalize: normalizeGeo, deviceStatus });
    renderGeo(gres.value, gres);
    // Dev builds only: expose the last run so scripts/live-probe.mjs can save the raw model output.
    if (typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__) window.__lensLast = { page: { title: page.title, url: page.url, textLength: page.textLength, rootTag: page.rootTag }, claims: cres, highlight: hres, geo: gres };
    setDeviceChip(await engine.probeDevice(), "");
    setStatus(`Done. ${cres.value.length} claims${missing ? `, ${missing} not found on the page` : ""}. Click a claim to jump to it.`);
  } catch (err) {
    $("claimsEmpty").textContent = "No claims yet. Click Analyze.";
    setStatus(friendlyError(err), true);
  } finally {
    btn.disabled = false;
    busy = false;
  }
}

function friendlyError(err) {
  const m = String(err?.message || err);
  if (/app.?check|403|permission|PERMISSION/i.test(m)) return "The cloud fallback was refused (App Check or key restriction). On-device analysis still works where supported. Details: " + m.slice(0, 160);
  if (/quota|429|RESOURCE/i.test(m)) return "The free cloud quota is used up for now. Try again later or use a browser with the on-device model.";
  if (/network|fetch|Failed to fetch/i.test(m)) return "Could not reach the cloud fallback. Check your connection.";
  return m.slice(0, 240);
}

$("analyze").addEventListener("click", analyze);
$("clear").addEventListener("click", async () => {
  try { if (state.tabId) await send(state.tabId, { type: "clear" }); } catch { /* page gone */ }
  $("clear").disabled = true;
  setStatus("Highlights cleared.");
});

(async () => {
  if (typeof __E2E__ !== "undefined" && __E2E__ && params.has("mock")) {
    const mod = await import("../e2e-mock.js");
    engine = mod.mockEngine(params.get("mock"));
  }
  setDeviceChip(await engine.probeDevice());
})();
