// Chunked, streaming claim run (the on-device path). Pure orchestration: the model call is injected, so the unit tests and the e2e
// mock can prove the streaming and progress behaviour without Gemini Nano.
import { normalizeClaims, extractCompleteClaimObjects, parseModelJson } from "./parse.js";

const dedupeKey = (q) => String(q).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Add claims to a list, de-duplicated by normalised quote, with ids that continue the list (c1, c2, ...).
 * Returns the claims that were really new.
 */
export function mergeClaims(existing, incoming) {
  const seen = new Set(existing.map((c) => dedupeKey(c.quote)));
  const added = [];
  let n = existing.reduce((m, c) => Math.max(m, Number(String(c.id).replace(/\D/g, "")) || 0), 0);
  for (const c of incoming) {
    const k = dedupeKey(c.quote);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const claim = { ...c, id: "c" + ++n };
    existing.push(claim);
    added.push(claim);
  }
  return added;
}

/** The status text while a chunked run is going. */
export function progressText({ chunk, total, claims }) {
  const n = `${claims} claim${claims === 1 ? "" : "s"} so far`;
  return total > 1 ? `Finding claims: chunk ${chunk} of ${total}, ${n}...` : `Finding claims: ${n}...`;
}

/**
 * Run the chunks one after another.
 *  chunks: [string]; streamChunk(chunk, onText, info) -> Promise<{text, source}>; onText(partialText) is called as text arrives.
 *  claims: the shared list (mutated); onClaims(added) is called the moment new claims are known; onProgress({chunk,total,claims}).
 *  A chunk whose answer cannot be used is counted in failed and skipped, so one bad chunk never stops the run.
 * Returns {sources, failed, chunks, firstClaimAt} where firstClaimAt is now() when the first claim arrived (or null).
 */
export async function runChunkedClaims({ chunks, streamChunk, claims, onClaims = () => {}, onProgress = () => {}, now = () => performance.now(), maxPerChunk = 6 }) {
  const sources = [];
  let failed = 0;
  let firstClaimAt = null;
  const add = (items) => {
    const norm = [];
    for (const it of items) {
      try { norm.push(...normalizeClaims({ claims: [it] })); } catch { /* unusable object */ }
    }
    const added = mergeClaims(claims, norm);
    if (added.length) {
      if (firstClaimAt == null) firstClaimAt = now();
      onClaims(added);
    }
  };
  for (let i = 0; i < chunks.length; i++) {
    onProgress({ chunk: i + 1, total: chunks.length, claims: claims.length });
    let streamed = 0;
    const onText = (partial) => {
      const objs = extractCompleteClaimObjects(partial).slice(0, maxPerChunk);
      if (objs.length > streamed) { add(objs.slice(streamed)); streamed = objs.length; }
    };
    try {
      const res = await streamChunk(chunks[i], onText, { index: i, total: chunks.length });
      sources.push(res.source);
      let value;
      try { value = parseModelJson(res.text); } catch { value = null; }
      const arr = Array.isArray(value) ? value : Array.isArray(value?.claims) ? value.claims : null;
      if (!arr) { if (streamed === 0) failed++; }
      else add(arr.slice(0, maxPerChunk).slice(streamed)); // anything the streaming parser did not see
    } catch (err) {
      if (err && err.fatal) throw err;
      failed++;
    }
    onProgress({ chunk: i + 1, total: chunks.length, claims: claims.length, done: i + 1 === chunks.length });
  }
  return { sources, failed, chunks: chunks.length, firstClaimAt };
}
