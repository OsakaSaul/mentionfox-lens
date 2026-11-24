// Tolerant parsing of model output, plus normalisation into the shapes the UI uses.
import { stripMarkers } from "./match.js";
import { reconcileDecision } from "./anchors.js";
import { debugDecision } from "./debug.js";

/** T2992: the signal type of a red flag, from the model's own word for it (null when it names none of the four). */
const pickSignal = (s, why = "") => {
  const t = (String(s || "") + " " + String(why || "")).toLowerCase();
  if (/extraordinar|overturn|too good/.test(t)) return "extraordinary_claim";
  if (/evasi|generic answer|dodg|redirect/.test(t)) return "evasive_answer";
  if (/inconsisten|do not agree|disagree/.test(t)) return "inconsistent_numbers";
  if (/secre|stealth|proprietary|not publish|don't publish/.test(t)) return "secrecy";
  return null;
};

/** Extract the first balanced JSON object/array from text (string-aware). Returns the substring or null. */
export function extractJsonBlock(text) {
  const s = String(text ?? "");
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{" || s[i] === "[") { start = i; break; }
  }
  if (start < 0) return null;
  const stack = [];
  let inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") {
      stack.pop();
      if (stack.length === 0) return s.slice(start, i + 1);
    }
  }
  // Unbalanced (truncated output): return the rest so the repair step can try to close it.
  return s.slice(start);
}

function repairJson(block) {
  let t = block.replace(/,\s*([}\]])/g, "$1"); // trailing commas
  let inStr = false, esc = false;
  const stack = [];
  for (const c of t) {
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  if (inStr) t += '"';
  t = t.replace(/,\s*$/, "");
  while (stack.length) t += stack.pop();
  return t.replace(/,\s*([}\]])/g, "$1");
}

/** Parse model text into a JS value. Handles fenced JSON, prose around JSON, trailing commas, truncation. */
export function parseModelJson(text) {
  const raw = String(text ?? "").trim();
  if (!raw) throw new Error("empty model output");
  const unfenced = raw.replace(/```(?:json|JSON)?\s*([\s\S]*?)```/g, "$1");
  for (const c of [raw, unfenced]) {
    try { return JSON.parse(c); } catch { /* next */ }
    const block = extractJsonBlock(c);
    if (block) {
      try { return JSON.parse(block); } catch { /* repair */ }
      try { return JSON.parse(repairJson(block)); } catch { /* next */ }
    }
  }
  throw new Error("model output is not valid JSON");
}

const clean = (v, max = 400) => safeSlice(String(v ?? "").replace(/\s+/g, " ").trim(), max);

/**
 * Cut text to at most max UTF-16 units without splitting a surrogate pair. With {words:true} the cut falls on a word boundary
 * and an ellipsis marks it. Text that already fits is returned unchanged.
 */
export function safeSlice(text, max, { words = false } = {}) {
  const t = String(text ?? "");
  if (t.length <= max) return t;
  const room = words ? Math.max(1, max - 1) : max;
  let end = room;
  const hi = t.charCodeAt(end - 1);
  if (hi >= 0xd800 && hi <= 0xdbff) end--; // do not leave half of a surrogate pair
  let cut = t.slice(0, end);
  if (!words) return cut;
  const sp = cut.search(/\s\S*$/);
  if (sp > room * 0.4) cut = cut.slice(0, sp);
  return cut.replace(/[\s,;:–—-]+$/, "") + "…";
}

const TERMINAL = /[.!?…]["'”’)]*$/;
/** A reason the model cut off mid-sentence ("The adjectives") is dropped, never shown. */
export function reasonIsComplete(why) {
  const t = String(why ?? "").trim();
  return t.split(/\s+/).length >= 4 && TERMINAL.test(t);
}

/**
 * Normalise claims output (array or {claims:[...]}) into [{id, quote, kind, why, summary?, note?}].
 * quote is the verbatim span (footnote markers removed); summary is an optional display paraphrase; kind is reconciled with the
 * anchor detector, so a claim with a date, number, amount or named place can never stay "vague".
 */
export function normalizeClaims(value, { max = 12 } = {}) {
  const arr = Array.isArray(value) ? value : Array.isArray(value?.claims) ? value.claims : null;
  if (!arr) throw new Error("no claims array in model output");
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const quote = clean(stripMarkers(typeof item === "string" ? item : item?.quote ?? item?.text ?? item?.claim ?? ""), 600);
    if (quote.length < 8) continue;
    const key = quote.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const k = clean(item?.kind ?? item?.label ?? item?.type, 40).toLowerCase();
    if (/red ?flag/.test(k)) {   // T2992: kept as the model labelled it; applyRedFlags() (shared/redflags.js) re-checks it against the page text and demotes it when the rules do not hold
      const whyF = clean(item?.why ?? item?.reason ?? item?.explanation, 400);
      out.push({ id: "c" + (out.length + 1), quote, kind: "redflag", signal: pickSignal(item?.signal, whyF), why: reasonIsComplete(whyF) ? safeSlice(whyF, 220, { words: true }) : "A careful reader of this page alone could question it." });
      if (out.length >= max) break;
      continue;
    }
    const kind = /vague|puff|fluff|unverif|subjective|marketing/.test(k) ? "vague" : "specific";
    const whyRaw = clean(item?.why ?? item?.reason ?? item?.explanation, 1000);
    const why = reasonIsComplete(whyRaw) ? safeSlice(whyRaw, 220, { words: true }) : kind === "vague" ? "Nothing in it names a date, number, place or source a reader could check." : "It contains a detail a reader can check against a public source.";
    const summary = clean(item?.summary, 1000);
    const claim = { id: "c" + (out.length + 1), quote, kind, why };
    if (summary && reasonIsComplete(summary)) claim.summary = safeSlice(summary, 220, { words: true });
    const rec = reconcileDecision(claim);
    debugDecision(rec.decision);
    out.push(rec.claim);
    if (out.length >= max) break;
  }
  return out;
}

const ENTITY_TYPES = ["person", "company", "product", "place", "other"];
const list = (v, max, len = 240) =>
  (Array.isArray(v) ? v : []).map((x) => clean(typeof x === "string" ? x : x?.text ?? x?.name ?? "", len)).filter(Boolean).slice(0, max);

/** Normalise GEO output into {entities, facts, missing, fixes, ratings}. Ratings are clamped to 0..4. */
export function normalizeGeo(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("GEO output is not an object");
  const entities = (Array.isArray(value.entities) ? value.entities : [])
    .map((e) => {
      const name = clean(typeof e === "string" ? e : e?.name, 120);
      const t = clean(typeof e === "string" ? "other" : e?.type, 20).toLowerCase();
      return { name, type: ENTITY_TYPES.includes(t) ? t : "other" };
    })
    .filter((e) => e.name)
    .slice(0, 12);
  const r = value.ratings && typeof value.ratings === "object" ? value.ratings : {};
  const num = (x) => { const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(4, Math.round(n))) : 0; };
  const ratings = {
    entity_clarity: num(r.entity_clarity),
    fact_density: num(r.fact_density),
    structure: num(r.structure),
    trust_signals: num(r.trust_signals),
    ambiguity: num(r.ambiguity),
  };
  const fixes = list(value.fixes, 3);
  if (!entities.length && !fixes.length && !list(value.facts, 1).length) throw new Error("GEO output is empty");
  return { entities, facts: list(value.facts, 8), missing: list(value.missing, 6), fixes, ratings };
}

/**
 * Streaming helper: the claim objects that are COMPLETE in a partial model answer such as '{"claims":[{"quote":"a","kind":"specific","why":"b"},{"quote":"c',
 * so a card can be shown the moment its closing brace arrives. Returns an array of parsed objects (never throws).
 */
export function extractCompleteClaimObjects(partial) {
  const s = String(partial ?? "");
  const m = /"claims"\s*:\s*\[/.exec(s);
  let i = m ? m.index + m[0].length : s.indexOf("[") + 1;
  if (!i) return [];
  const out = [];
  while (i < s.length) {
    while (i < s.length && s[i] !== "{") { if (s[i] === "]") return out; i++; }
    if (i >= s.length) break;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) break; // the object is still being written
    try { out.push(JSON.parse(s.slice(i, end + 1))); } catch { /* skip a broken object */ }
    i = end + 1;
  }
  return out;
}
