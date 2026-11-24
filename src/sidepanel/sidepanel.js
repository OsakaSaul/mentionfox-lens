import { runTask, initDevice, probeDevice, warmDevice, streamDeviceChunk, InferenceSource } from "../ai.js";
import { CLAIMS_SCHEMA, GEO_SCHEMA, buildClaimsPrompt, buildGeoPrompt, MAX_PAGE_CHARS, DEVICE_WINDOW_CHARS, DEVICE_CHUNK_CHARS, DEVICE_GEO_CHARS } from "../shared/prompts.js";
import { findAnchorIndex, pickWindow, chunkBlocks } from "../shared/extract.js";
import { runChunkedClaims, mergeClaims, progressText } from "../shared/chunked.js";
import { normalizeClaims, normalizeGeo } from "../shared/parse.js";
import { setSelfNames, deriveSelfNames, reconcileKind } from "../shared/anchors.js";
import { applyRedFlags, signalLabel } from "../shared/redflags.js";   // T2992
import { buildDeepPrompt, buildDeepCards, DEEP_PAGE_CHARS, DEEP_MAX_CLAIMS } from "../shared/deep.js";   // T3003
import { pickCards, cardSummary, MORE_ROW_TIP } from "../shared/quality.js";
import { friendlyError } from "../shared/errors.js";   // T3007
import { debugReset, debugSet, debugSnapshot } from "../shared/debug.js";
import { geoScore, geoBand, GEO_BANDS, GEO_DIMENSION_LABELS } from "../shared/geo.js";
import { modeInfo, statusLine, chipState, formatSeconds } from "../shared/mode.js";
import { VERIFY_CLAIMS_URL, DECISION_MAKERS_URL, mentionfoxLink } from "../shared/links.js";
import { QUOTA_KEY, quotaState, quotaAfterUse, quotaText, runWorkerCheck, archiveDate, claimDomain } from "../shared/check.js";

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

let engine = { runTask, initDevice, probeDevice, warmDevice, streamChunk: streamDeviceChunk, runCheck: runWorkerCheck };
let state = { tabId: null, claims: [], results: new Map(), page: null, covered: new Set(), remaining: 0, warm: null };

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
  if (p >= 1) setTimeout(() => refreshDevice().then(maybeWarm), 300);
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
    h("div", { class: "mode-text" }, h("div", { class: "mode-main" }, info.label, info.seconds ? [" · ", h("span", { class: "nw" }, info.seconds)] : ""), h("div", { class: "mode-sub" }, info.sub), info.first ? h("div", { class: "mode-first" }, info.first) : ""),
  );
}

function renderModePending(containerId, firstMs = null) {
  const c = $(containerId);
  c.hidden = false;
  c.className = "modebar mode-pending";
  c.dataset.mode = "pending";
  c.title = "Lens is choosing between the private on-device model and the cloud.";
  c.setAttribute("aria-label", "Inference mode: working");
  c.replaceChildren(h("div", { class: "mode-text" }, h("div", { class: "mode-main" }, "Working..."), h("div", { class: "mode-sub" }, "Lens prefers the on-device model and falls back to the cloud."), firstMs != null ? h("div", { class: "mode-first" }, `First claim in ${formatSeconds(firstMs)}`) : ""));
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
let showMoreGreens = false;   // T3003: the collapsed "more checkable claims" row; closed at the start of every scan
function renderClaims(claims, results) {
  const list = $("claimsList");
  list.replaceChildren();
  checkRows.clear();
  const byId = new Map((results || []).map((r) => [r.id, r]));
  const addCard = (c) => {
    const r = byId.get(c.id);
    const found = !r || r.found;
    const label = c.kind === "redflag" ? "Red flag: " + signalLabel(c.signal) : c.kind === "specific" ? "Specific and checkable" : "Vague or puffery";
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
      c.unsourced ? h("span", { class: "tag-unsourced", title: "An exact figure from the company itself with nothing on the page to back it. Not a red flag." }, "unsourced") : "",
      h("span", { class: "quote" }, `“${c.quote}”`),
      c.summary ? h("span", { class: "why summary" }, "In short: " + c.summary) : "",
      c.why ? h("span", { class: "why" }, c.why) : "",
      c.note ? h("span", { class: "why note" }, "Note: " + c.note + ".") : "",
      h("span", { class: "where" }, found ? "Show on page" : "Not found on the page"),
    );
    if (found) card.addEventListener("click", () => jump(c.id));
    const li = h("li", {}, card);
    if ((c.kind === "specific" || c.kind === "redflag") && found) {
      const row = h("div", { class: "checkrow" });
      li.append(row);
      checkRows.set(c.quote, { c, row, li });
      renderCheckRow(c.quote);
    }
    list.append(li);
  };
  // T3003 (Saul): red flags first, then amber (vague), then at most 2 green cards (the 2 most consequential); the rest sit behind a collapsed row
  const { shown, more } = pickCards(claims);
  for (const c of shown) addCard(c);
  if (more.length) {
    const toggle = h("button", { class: "btn btn-ghost more-toggle", type: "button", title: MORE_ROW_TIP, "aria-expanded": String(showMoreGreens), "aria-label": `${showMoreGreens ? "Hide" : "Show"} ${more.length} more checkable claims. ${MORE_ROW_TIP}.` },
      showMoreGreens ? `Hide ${more.length} more checkable claim${more.length === 1 ? "" : "s"}` : `Show ${more.length} more checkable claim${more.length === 1 ? "" : "s"}`);
    toggle.addEventListener("click", () => { showMoreGreens = !showMoreGreens; renderClaims(claims, results); });
    list.append(h("li", { class: "more-row" }, toggle));
    if (showMoreGreens) for (const c of more) addCard(c);
  }
  $("claimsEmpty").hidden = claims.length > 0;
  $("claimsLegend").hidden = claims.length === 0;
  const sum = $("claimsSummary");
  sum.textContent = cardSummary(claims);
  sum.hidden = claims.length === 0;
  const cnt = $("claimCount");
  cnt.hidden = claims.length === 0;
  cnt.textContent = String(claims.length);
}

/* ---------- Check: verify one claim on the web through our own Worker (FoxAPIs claims_check) ---------- */
const checkRows = new Map(); // quote -> {c, row, li} (rebuilt with the list)
const checkResults = new Map(); // quote -> {pending} | {error} | {verdict, reason, sources, ms}; survives re-renders of the list
let memQuota = null; // fallback when chrome.storage is unavailable
async function readStoredQuota() {
  try {
    return (await chrome.storage.local.get(QUOTA_KEY))[QUOTA_KEY] ?? memQuota;
  } catch {
    return memQuota;
  }
}
async function writeStoredQuota(rec) {
  memQuota = rec;
  try { await chrome.storage.local.set({ [QUOTA_KEY]: rec }); } catch { /* memory copy only */ }
}
let quotaNow = quotaState(null);
const VERDICT_TEXT = { contradicted: "Contradicted", supported: "\u2713 Supported", none: "No clear record" };

function renderCheckRow(quote) {
  const e = checkRows.get(quote);
  if (!e) return;
  const { row, li } = e;
  const res = checkResults.get(quote);
  const kids = [];
  li.dataset.verdict = res?.verdict || "";
  if (res?.pending) {
    kids.push(h("button", { class: "btn btn-secondary check-btn", type: "button", disabled: true }, "Checking the web..."));
  } else if (quotaNow.exhausted && !res?.verdict) {
    kids.push(h("a", { class: "btn btn-secondary check-btn", href: mentionfoxLink("/", "deep_check"), target: "_blank", rel: "noopener noreferrer", title: "Open MentionFox in a new tab for a deeper check", "aria-label": "Deep check in MentionFox (opens a new tab)" }, "Deep check in MentionFox"));
    kids.push(h("span", { class: "check-quota" }, "Today's free checks are used."));
  } else if (!res?.verdict) {
    kids.push(h("button", { class: "btn btn-secondary check-btn", type: "button", title: "Searches the web for this one sentence. Your page is not sent.", "aria-label": `Check this claim on the web. ${quotaText(quotaNow)}.` }, "Check"));
    kids.push(h("span", { class: "check-quota" }, quotaText(quotaNow)));
  }
  if (res?.error) kids.push(h("span", { class: "why check-error", role: "alert" }, res.error));
  if (res?.verdict) {
    kids.push(h("span", { class: "pill pill-" + res.verdict, "data-verdict": res.verdict }, VERDICT_TEXT[res.verdict]));
    kids.push(h("span", { class: "why check-reason" }, res.reason));
    if (res.asOf) kids.push(h("span", { class: "check-asof", title: "The check used only sources dated on or before the date of this page." }, "As known on " + res.asOf + (res.sources.length && res.sources.every((x) => x.undated) ? " (sources undated, so not all could be tested against this date)" : "")));
    if (res.sources.length) kids.push(h("ul", { class: "check-sources", "aria-label": "Sources" }, res.sources.map((x) => h("li", {}, h("a", { href: x.uri, target: "_blank", rel: "noopener noreferrer" }, x.title), x.undated ? h("span", { class: "tag-unsourced", title: "This source carries no date, so it could not be tested against the page date." }, "undated") : ""))));
    kids.push(h("div", { class: "checkmode mode-cloud", title: "Checks run in the cloud: only this one sentence, its website and its date are sent. Analysis stays on your device where supported." }, `Cloud \u00B7 ${formatSeconds(res.ms)}`));
    kids.push(h("span", { class: "check-quota" }, quotaText(quotaNow)));
  }
  row.replaceChildren(...kids);
  const btn = row.querySelector("button.check-btn:not([disabled])");
  if (btn) btn.addEventListener("click", () => doCheck(quote));
}
const renderAllCheckRows = () => checkRows.forEach((_, q) => renderCheckRow(q));

async function doCheck(quote) {
  if (!checkRows.has(quote) || checkResults.get(quote)?.pending) return;
  quotaNow = quotaState(await readStoredQuota());
  if (quotaNow.exhausted) { renderAllCheckRows(); return; }
  checkResults.set(quote, { pending: true });
  renderCheckRow(quote);
  try {
    const page = state.page || {};
    const pageUrl = (typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__ && window.__lensCheckUrl) || page.url; // dev builds only: lets the probe test a Wayback date
    const out = await engine.runCheck({ claim: quote, domain: claimDomain(pageUrl), date: archiveDate(pageUrl) });
    await writeStoredQuota(quotaAfterUse(await readStoredQuota())); // counted only when the call succeeded
    quotaNow = quotaState(await readStoredQuota());
    checkResults.set(quote, { verdict: out.verdict, reason: out.reason, sources: out.sources, ms: out.ms, asOf: out.asOf });
  } catch (err) {
    console.warn("[lens-check] failed:", String(err?.message || err).slice(0, 2500));
    checkResults.set(quote, { error: err?.code === "busy" ? "Web checks are busy today" : "Web checks are not available right now. Try again later." });
  }
  renderAllCheckRows();
}
readStoredQuota().then((q) => { quotaNow = quotaState(q); renderAllCheckRows(); });

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
let warmStarted = false;
let warmPromise = null;

/** Load the on-device model into memory as soon as the panel is open and the model is already downloaded (no Analyze click needed). */
function maybeWarm() {
  if (warmStarted || device.availability !== "available" || !engine.warmDevice) return;
  warmStarted = true;
  warmPromise = engine.warmDevice().then((r) => { state.warm = r; return r; }).catch(() => null);
}

const asSeconds = (ms) => formatSeconds(ms);

async function analyze({ more = false, deep = false } = {}) {
  if (busy) return;
  busy = true;
  const t0 = performance.now(); // the moment of the click: first-claim time and totals are measured from here
  const btn = $(deep ? "deep" : "analyze");
  $("deep").disabled = true; $("analyze").disabled = true;
  showMoreGreens = false;
  btn.disabled = true;
  $("rerun").disabled = true;
  $("more").disabled = true;
  try {
    setStatus("Reading the page...");
    const tab = await getTab();
    if (!tab?.id || !/^https?:|^file:/.test(tab.url || "")) throw new Error("Open a normal web page first (browser pages cannot be analysed).");
    state.tabId = tab.id;
    if (!more || !state.page) {
      try {
        await ensureContent(tab.id);
      } catch {
        throw new Error("Lens needs permission for this tab. Click the Lens toolbar icon while on the page, then Analyze.");
      }
      const ex = await send(tab.id, { type: "extract" });
      if (!ex?.ok || ex.page.textLength < 80) throw new Error("Not enough readable text on this page.");
      state.page = ex.page;
      $("noscriptNote").hidden = !ex.page.fromNoscript;   // T3002
      state.covered = new Set();
      state.claims = [];
      state.results = new Map();
      more = false;
    }
    const page = state.page;
    setSelfNames(deriveSelfNames({ title: page.title, url: page.url }));

    if (deep) {   // T3003: Deep scan = the cloud reads the whole extracted article in ONE call
      try { await send(tab.id, { type: "clear" }); } catch { /* nothing to clear */ }
      state.claims = []; state.results = new Map(); state.covered = new Set();
      renderModePending("claimsMode");
      $("claimsEmpty").textContent = "Deep scan: reading the whole article...";
      setStatus("Deep scan: the cloud is reading the whole article...");
      const r = await engine.runTask({ key: "claims", schema: CLAIMS_SCHEMA, prompt: buildDeepPrompt(page.blocks.join(String.fromCharCode(10))), normalize: (v) => normalizeClaims(v, { max: DEEP_MAX_CLAIMS }), deviceStatus: "unavailable", onlyCloud: true });
      window.__lensDeepRaw = String(r.raw ?? "");   // recorded by scripts/live-probe.mjs --deep for the unit tests
      const cards = buildDeepCards(r.value, page.blocks, { title: page.title, url: page.url });
      mergeClaims(state.claims, cards);
      const showCards = () => renderClaims(state.claims, [...state.results.values()]);
      showCards();
      const h2 = await send(tab.id, { type: "highlight", claims: state.claims });
      state.results = new Map((h2?.results || []).map((x) => [x.id, x]));
      const ms = r.ms ?? Math.round(performance.now() - t0);
      renderModeBar("claimsMode", modeInfo({ source: "in_cloud", ms, deviceStatus: "unavailable", deep: true }));
      $("clear").disabled = false;
      $("more").hidden = true;
      debugSet({ mode: "cloud-deep", deepMs: ms, deepCards: state.claims.length });
      showCards();
      setStatus(`Done. Deep scan took ${formatSeconds(ms)}: ${cardSummary(state.claims)}.`);
      $("rerun").hidden = false;
      return;
    }

    const deviceStatus = await engine.probeDevice();
    device.availability = deviceStatus;
    renderDevice();
    // User gesture is active here: allowed to start the on-device model download.
    const init = engine.initDevice(CLAIMS_SCHEMA, onDownloadProgress);
    if (deviceStatus === "available") {
      await init;
      if (warmPromise) await warmPromise; // a warm-up already loading the model: wait for it instead of loading twice
    } else if (deviceStatus === "downloadable") refreshDevice().then(() => {}); // chip flips to downloading right away
    renderModePending("claimsMode");
    if (!more) renderModePending("geoMode");

    const onDevice = deviceStatus === "available" && !!engine.streamChunk;
    const budget = onDevice ? DEVICE_WINDOW_CHARS : MAX_PAGE_CHARS;
    const anchorIdx = more ? -1 : findAnchorIndex(page.blocks, page.anchorText);
    const win = pickWindow(page.blocks, { budget, covered: state.covered, anchorIdx });
    if (!more) debugReset({ version: chrome.runtime.getManifest().version, mode: onDevice ? "on-device" : "cloud", url: page.url });
    debugSet({ extractedChars: page.textLength, windowChars: win.chars, mode: onDevice ? "on-device" : "cloud" });
    if (!win.indices.length) throw new Error("Nothing more to analyse on this page.");
    for (const i of win.indices) state.covered.add(i);
    state.remaining = win.remaining;

    $("claimsEmpty").textContent = "Working...";
    $("more").hidden = true;
    const before = state.claims.length;
    let firstMs = null;
    const claimsStart = performance.now();
    let cres;
    let hlQueue = Promise.resolve();
    const showCards = () => renderClaims(state.claims, [...state.results.values()]);
    const highlightNew = (added) => {
      hlQueue = hlQueue.then(async () => {
        try {
          const r = await send(tab.id, { type: "highlightAdd", claims: added });
          for (const x of r?.results || []) state.results.set(x.id, x);
          showCards();
        } catch { /* page gone: the cards stay, unmarked */ }
      });
    };
    const onFirst = () => { if (firstMs == null) { firstMs = performance.now() - t0; renderModePending("claimsMode", firstMs); } };

    if (onDevice) {
      // Chunked and streamed: about 1,500 characters at a time; each card (and its highlight) appears the moment the model finishes writing it.
      if (!more) { try { await send(tab.id, { type: "clear" }); } catch { /* nothing to clear */ } }
      const chunks = chunkBlocks(win.indices.map((i) => page.blocks[i]), DEVICE_CHUNK_CHARS);
      state.chunks = chunks.length;
      let raw = "";
      setStatus(progressText({ chunk: 1, total: chunks.length, claims: state.claims.length }));
      const run = await runChunkedClaims({
        chunks,
        claims: state.claims,
        streamChunk: async (c, onText, info) => {
          const r = await engine.streamChunk(c, onText, info);
          raw += r.text + "\n";
          return r;
        },
        onClaims: (added) => { onFirst(); showCards(); highlightNew(added); },
        onProgress: (p) => setStatus(progressText(p)),
      });
      await hlQueue;
      const allDevice = run.sources.length > 0 && run.sources.every((s) => s === InferenceSource.ON_DEVICE);
      if (run.failed >= chunks.length && state.claims.length === before) {
        // Every on-device chunk failed: the cloud redoes the window (labelled "on-device failed").
        setStatus("The on-device model could not answer. Trying the cloud...");
        const cloudWin = pickWindow(page.blocks, { budget: MAX_PAGE_CHARS, covered: new Set(), anchorIdx });
        const r = await engine.runTask({ key: "claims", schema: CLAIMS_SCHEMA, prompt: buildClaimsPrompt(cloudWin.text), normalize: normalizeClaims, deviceStatus });
        mergeClaims(state.claims, r.value);
        if (!more) { const h = await send(tab.id, { type: "highlight", claims: state.claims }); state.results = new Map((h?.results || []).map((x) => [x.id, x])); }
        onFirst();
        cres = { source: r.source, retried: true, raw: r.raw };
      } else {
        cres = { source: allDevice ? InferenceSource.ON_DEVICE : InferenceSource.IN_CLOUD, retried: !allDevice && run.sources.length > 0, raw };
        if (run.firstClaimAt != null && firstMs == null) firstMs = run.firstClaimAt - t0;
      }
      cres.chunks = chunks.length;
      cres.failedChunks = run.failed;
    } else {
      setStatus("Finding claims...");
      const r = await engine.runTask({ key: "claims", schema: CLAIMS_SCHEMA, prompt: buildClaimsPrompt(win.text), normalize: normalizeClaims, deviceStatus });
      const added = mergeClaims(state.claims, r.value);
      showCards();
      onFirst();
      setStatus("Highlighting claims on the page...");
      if (!more) {
        const h = await send(tab.id, { type: "highlight", claims: state.claims });
        state.results = new Map((h?.results || []).map((x) => [x.id, x]));
      } else if (added.length) {
        const h = await send(tab.id, { type: "highlightAdd", claims: added });
        for (const x of h?.results || []) state.results.set(x.id, x);
      }
      debugSet({ chunks: [win.text], rawPerChunk: [{ chunk: 1, raw: String(r.raw ?? "") }] });
      cres = { source: r.source, retried: r.retried, raw: r.raw, chunks: 1, failedChunks: 0 };
      cres.ms = r.ms; // time the model call took
    }
    cres.ms = cres.ms ?? Math.round(performance.now() - claimsStart);
    if (typeof __E2E__ !== "undefined" && __E2E__ && onDevice && window.__MFL_MS__ != null) cres.ms = Number(window.__MFL_MS__); // test harness only: fixed latency for the mock
    cres.firstMs = Math.round(firstMs ?? performance.now() - t0);
    showCards();
    const cinfo = modeInfo({ source: cres.source, ms: cres.ms, deviceStatus, retried: cres.retried, firstMs: cres.firstMs });
    renderModeBar("claimsMode", cinfo);
    $("clear").disabled = false;
    const missing = [...state.results.values()].filter((r) => !r.found).length;
    $("more").hidden = !(state.remaining > 200);
    $("more").title = `Analyze the next part of this page (about ${Math.min(state.remaining, budget).toLocaleString("en-US")} more characters of the ${page.textLength.toLocaleString("en-US")} in the main content)`;

    let infos = [cinfo];
    let totalMs = cres.ms;
    let gres = null;
    // T2992 RED FLAGS: signals a careful reader could have caught on the page's own date, judged from the text alone. The rules (and Saul's calibration: no citation alone is never a flag) are in shared/redflags.js;
    // the model's own red-flag cards are re-checked there, the flags it missed are added, and an ordinary unsourced figure gets a small grey tag.
    try {
      // T3002: on a picked ARTICLE body the rules read the whole article (deterministic and cheap), not only the window the model analysed: a flagged line at the edge of the window must not depend on where the window ends. Long wiki pages and guessed roots keep the analysed-window rule
      const articleRoot = !!page.rootKind && page.rootKind !== "legacy";   // an article body was confidently picked (not Wikipedia, not a guessed root)
      const seenText = (articleRoot ? page.blocks : page.blocks.filter((_, i) => state.covered.has(i))).join("\n");
      const rf = applyRedFlags(state.claims, seenText, { company: (claimDomain(page.url) || "").split(".")[0], title: page.title, merge: mergeClaims, reconcile: reconcileKind });
      if (rf.changed) {
        showCards();
        const h2 = await send(tab.id, { type: "highlight", claims: state.claims });
        state.results = new Map((h2?.results || []).map((x) => [x.id, x]));
        showCards();
      }
    } catch (rfErr) { console.warn("[lens] red flags skipped:", String(rfErr?.message || rfErr).slice(0, 200)); }
    if (!more) {
      setStatus("Checking how an AI assistant would read this page...");
      const geoText = onDevice ? firstBlocksText(page.blocks, win.indices, DEVICE_GEO_CHARS) : win.text;
      gres = await engine.runTask({ key: "geo", schema: GEO_SCHEMA, prompt: buildGeoPrompt(geoText, { title: page.title }), normalize: normalizeGeo, deviceStatus });
      const ginfo = modeInfo({ source: gres.source, ms: gres.ms, deviceStatus, retried: gres.retried });
      renderGeo(gres.value, ginfo);
      infos = [cinfo, ginfo];
      totalMs += gres.ms;
    }
    // Dev builds only: expose the last run so scripts/live-probe.mjs can save the raw model output.
    if (typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__) {
      window.__lensLast = {
        page: { title: page.title, url: page.url, textLength: page.textLength, rawChars: page.rawChars, rootTag: page.rootTag, blocks: page.blocks.length },
        window: { budget, chars: win.chars, blocks: win.indices.length, chunks: cres.chunks, remaining: win.remaining, anchored: anchorIdx >= 0, deviceWindow: (() => { const w = pickWindow(page.blocks, { budget: DEVICE_WINDOW_CHARS, anchorIdx }); return { chars: w.chars, chunks: chunkBlocks(w.indices.map((i) => page.blocks[i]), DEVICE_CHUNK_CHARS).length, chunkChars: DEVICE_CHUNK_CHARS }; })() },
        claims: { source: cres.source, ms: cres.ms, firstMs: cres.firstMs, retried: cres.retried, raw: cres.raw, value: state.claims },
        highlight: { results: [...state.results.values()] },
        geo: gres ? { source: gres.source, ms: gres.ms, retried: gres.retried, raw: gres.raw, value: gres.value } : null,
      };
    }
    await refreshDevice();
    setStatus(statusLine({ totalMs, infos, claims: state.claims.length, missing, firstMs: cres.firstMs }));
    $("rerun").hidden = false;
  } catch (err) {
    $("claimsEmpty").hidden = state.claims.length > 0;
    $("claimsEmpty").textContent = "No claims yet. Click Deep scan.";
    for (const id of ["claimsMode", "geoMode"]) if ($(id).dataset.mode === "pending") $(id).hidden = true;
    $("rerun").hidden = false;
    $("more").hidden = !(state.remaining > 200) || !state.claims.length;
    setStatus(friendlyError(err, { deep }), true);
  } finally {
    btn.disabled = false; $("deep").disabled = false; $("analyze").disabled = false;
    $("rerun").disabled = false;
    $("more").disabled = false;
    busy = false;
  }
}

/** The first blocks of a window up to a character budget, joined as text. */
function firstBlocksText(blocks, indices, max) {
  const out = [];
  let n = 0;
  for (const i of indices) {
    if (n && n + blocks[i].length > max) break;
    out.push(blocks[i]);
    n += blocks[i].length + 1;
  }
  return out.join("\n");
}

/* Hidden debug export: Ctrl+Shift+D copies the last run (text length, chunks, raw model answers, reconcile decisions) as JSON. */
function showToast(text) {
  let t = $("toast");
  if (!t) {
    t = h("div", { id: "toast", role: "status", "aria-live": "polite" });
    t.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#1f2937;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;z-index:9999";
    document.body.append(t);
  }
  t.textContent = text;
  t.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}
document.addEventListener("keydown", async (e) => {
  if (!(e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d"))) return;
  e.preventDefault();
  const json = JSON.stringify(debugSnapshot(), null, 1);
  try { await navigator.clipboard.writeText(json); } catch {
    const ta = h("textarea", { "aria-hidden": "true" }); ta.value = json; document.body.append(ta); ta.select();
    try { document.execCommand("copy"); } finally { ta.remove(); }
  }
  showToast("Debug copied");
});

$("deep").addEventListener("click", () => analyze({ deep: true }));
$("analyze").addEventListener("click", () => analyze());
$("rerun").addEventListener("click", () => analyze());
$("more").addEventListener("click", () => analyze({ more: true }));
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
  maybeWarm();
  // Chrome may already be downloading (started earlier or elsewhere): attach to it to get live percent.
  if (device.availability === "downloading") engine.initDevice(CLAIMS_SCHEMA, onDownloadProgress);
})();
