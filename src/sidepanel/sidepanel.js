import { runTask, initDevice, probeDevice, InferenceSource } from "../ai.js";
import { CLAIMS_SCHEMA, GEO_SCHEMA, buildClaimsPrompt, buildGeoPrompt } from "../shared/prompts.js";
import { normalizeClaims, normalizeGeo } from "../shared/parse.js";
import { geoScore, geoBand, GEO_BANDS, GEO_DIMENSION_LABELS } from "../shared/geo.js";
import { modeInfo, statusLine, chipState } from "../shared/mode.js";
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

/* ---------- on-device chip + download progress (one renderer, driven by availability + progress) ---------- */
const device = { availability: "checking", progress: null, poll: null };

function renderDevice() {
  const st = chipState(device.availability, device.progress);
  const chip = $("deviceChip");
  chip.className = st.cls;
  chip.textContent = st.text;
  chip.title = st.tip;
  chip.setAttribute("aria-label", st.text);
  chip.dataset.state = st.kind;
  $("download").hidden = !st.canStart;
  const wrap = $("progressWrap");
  wrap.hidden = !st.showBar;
  wrap.classList.toggle("indeterminate", st.showBar && st.pct == null);
  const pct = st.pct ?? 0;
  $("progressBar").style.width = (st.pct == null ? 100 : pct) + "%";
  $("progressBar").setAttribute("aria-valuenow", String(pct));
  $("progressText").textContent = st.pct == null ? "Downloading private model..." : `Downloading private model ${pct}%`;
}

async function refreshDevice() {
  device.availability = await engine.probeDevice();
  if (device.availability !== "downloading") device.progress = device.availability === "available" ? 1 : null;
  renderDevice();
  // Keep checking while a download runs, so the chip turns green by itself when it finishes.
  if (device.availability === "downloading" && !device.poll) device.poll = setInterval(refreshDevice, 2000);
  if (device.availability !== "downloading" && device.poll) { clearInterval(device.poll); device.poll = null; }
}

function onDownloadProgress(p) {
  device.availability = p >= 1 ? "available" : "downloading";
  device.progress = p;
  renderDevice();
  if (p >= 1) setTimeout(refreshDevice, 300);
  else if (!device.poll) device.poll = setInterval(refreshDevice, 2000);
}

/* ---------- mode bar (top of each results tab) ---------- */
const SVG_NS = "http://www.w3.org/2000/svg";
function svgIcon(kind) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "30");
  svg.setAttribute("height", "30");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", "mode-icon");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  if (kind === "on_device") {
    // shield with a check mark
    path.setAttribute("d", "M12 3l7 3v5.5c0 4.4-3 7.7-7 9.5-4-1.8-7-5.1-7-9.5V6l7-3zM8.8 12.2l2.2 2.2 4.2-4.4");
  } else {
    // cloud
    path.setAttribute("d", "M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.6 4.5 4.5 0 0 0 7 18.5z");
  }
  svg.append(path);
  return svg;
}

function renderModeBar(containerId, info) {
  const c = $(containerId);
  c.hidden = false;
  c.className = "modebar mode-" + info.mode;
  c.dataset.mode = info.mode;
  c.title = info.tip;
  c.setAttribute("role", "group");
  c.setAttribute("aria-label", `Inference mode: ${info.text}. ${info.tip}`);
  c.replaceChildren(
    svgIcon(info.mode === "on_device" ? "on_device" : "cloud"),
    h("div", { class: "mode-text" }, h("div", { class: "mode-main" }, info.label, info.seconds ? [" · ", h("span", { class: "nw" }, info.seconds)] : ""), h("div", { class: "mode-sub" }, info.sub)),
  );
}

function renderModePending(containerId) {
  const c = $(containerId);
  c.hidden = false;
  c.className = "modebar mode-pending";
  c.dataset.mode = "pending";
  c.title = "Lens is choosing between the private on-device model and the cloud.";
  c.setAttribute("aria-label", "Inference mode: working");
  c.replaceChildren(h("div", { class: "mode-text" }, h("div", { class: "mode-main" }, "Working..."), h("div", { class: "mode-sub" }, "Lens prefers the on-device model and falls back to the cloud.")));
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
      c.summary ? h("span", { class: "why summary" }, "In short: " + c.summary) : "",
      c.why ? h("span", { class: "why" }, c.why) : "",
      c.note ? h("span", { class: "why note" }, "Note: " + c.note + ".") : "",
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

function renderGeo(geo, info) {
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
  renderModeBar("geoMode", info);
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
  $("rerun").disabled = true;
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
    device.availability = deviceStatus;
    renderDevice();
    // User gesture is active here: allowed to start the on-device model download.
    const init = engine.initDevice(CLAIMS_SCHEMA, onDownloadProgress);
    if (deviceStatus === "available") await init;
    else if (deviceStatus === "downloadable") refreshDevice().then(() => {}); // chip flips to downloading right away
    renderModePending("claimsMode");
    renderModePending("geoMode");

    setStatus("Finding claims...");
    $("claimsEmpty").textContent = "Working...";
    const cres = await engine.runTask({ key: "claims", schema: CLAIMS_SCHEMA, prompt: buildClaimsPrompt(page.text), normalize: normalizeClaims, deviceStatus });
    const cinfo = modeInfo({ source: cres.source, ms: cres.ms, deviceStatus, retried: cres.retried });
    state.claims = cres.value;
    setStatus("Highlighting claims on the page...");
    const hres = await send(tab.id, { type: "highlight", claims: cres.value });
    renderClaims(cres.value, hres?.results);
    renderModeBar("claimsMode", cinfo);
    $("clear").disabled = false;
    const missing = (hres?.results || []).filter((r) => !r.found).length;

    setStatus("Checking how an AI assistant would read this page...");
    const gres = await engine.runTask({ key: "geo", schema: GEO_SCHEMA, prompt: buildGeoPrompt(page.text, { title: page.title }), normalize: normalizeGeo, deviceStatus });
    const ginfo = modeInfo({ source: gres.source, ms: gres.ms, deviceStatus, retried: gres.retried });
    renderGeo(gres.value, ginfo);
    // Dev builds only: expose the last run so scripts/live-probe.mjs can save the raw model output.
    if (typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__) window.__lensLast = { page: { title: page.title, url: page.url, textLength: page.textLength, rootTag: page.rootTag }, claims: cres, highlight: hres, geo: gres };
    await refreshDevice();
    const totalMs = cres.ms + gres.ms; // time spent in the two model runs
    setStatus(statusLine({ totalMs, infos: [cinfo, ginfo], claims: cres.value.length, missing }));
    $("rerun").hidden = false;
  } catch (err) {
    $("claimsEmpty").textContent = "No claims yet. Click Analyze.";
    for (const id of ["claimsMode", "geoMode"]) if ($(id).dataset.mode === "pending") $(id).hidden = true;
    $("rerun").hidden = false;
    setStatus(friendlyError(err), true);
  } finally {
    btn.disabled = false;
    $("rerun").disabled = false;
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
$("rerun").addEventListener("click", analyze);
$("download").addEventListener("click", () => {
  // Click = user activation: the only moment Chrome lets the page start the download.
  device.availability = "downloading";
  device.progress = 0;
  renderDevice();
  engine.initDevice(CLAIMS_SCHEMA, onDownloadProgress);
  setTimeout(refreshDevice, 1500);
});
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
  await refreshDevice();
  // Chrome may already be downloading (started earlier or elsewhere): attach to it to get live percent.
  if (device.availability === "downloading") engine.initDevice(CLAIMS_SCHEMA, onDownloadProgress);
})();
