// Tolerant parsing of model output, plus normalisation into the shapes the UI uses.

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

const clean = (v, max = 400) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Normalise claims output (array or {claims:[...]}) into [{id, quote, kind, why}]. */
export function normalizeClaims(value, { max = 12 } = {}) {
  const arr = Array.isArray(value) ? value : Array.isArray(value?.claims) ? value.claims : null;
  if (!arr) throw new Error("no claims array in model output");
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const quote = clean(typeof item === "string" ? item : item?.quote ?? item?.text ?? item?.claim, 300);
    if (quote.length < 8) continue;
    const key = quote.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const k = clean(item?.kind ?? item?.label ?? item?.type, 40).toLowerCase();
    const kind = /vague|puff|fluff|unverif|subjective|marketing/.test(k) ? "vague" : "specific";
    out.push({ id: "c" + (out.length + 1), quote, kind, why: clean(item?.why ?? item?.reason ?? item?.explanation, 220) });
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
