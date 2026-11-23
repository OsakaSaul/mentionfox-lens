// Hidden debug trail for the last run (Ctrl+Shift+D in the side panel copies it as JSON). Plain data only: the extracted text length,
// the chunks sent to the model, the raw model answer per chunk and every reconcile decision. Never holds keys, tokens or config.
let log = fresh();

function fresh(meta = {}) {
  return { version: meta.version || "", mode: meta.mode || "", url: meta.url || "", extractedChars: 0, windowChars: 0, chunks: [], rawPerChunk: [], decisions: [], notes: [] };
}

export function debugReset(meta) { log = fresh(meta); }
export function debugSet(patch) { Object.assign(log, patch); }
export function debugChunk(text) { log.chunks.push(text); }
export function debugRaw(index, text) { log.rawPerChunk.push({ chunk: index + 1, raw: String(text ?? "") }); }
export function debugDecision(d) { log.decisions.push(d); }
export function debugNote(text) { log.notes.push(String(text)); }
export function debugSnapshot() { return JSON.parse(JSON.stringify(log)); }
