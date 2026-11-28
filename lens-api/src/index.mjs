// lens-api (T3230): the cloud side of the public (store) build of Lens. The extension sends page text; this Worker fixes the model, the prompt and the output size.
//   POST {mode: "deep"|"quick"|"geo", text, title?, install_id}  ->  200 the JSON the side panel renders ({claims: [...]}, or the AI view object)
//   429 {error: "busy", scope, message}      a daily cap is used up
//   503 {error: "not_available"}             no provider key, the counter failed, or every provider failed (fails closed)
//   403 {error: "origin"}   400 {error: "install_id"|"mode"|"text"}   413 {error: "too_large"}
// Page text is never stored and never logged: logs hold the mode, the outcome and token counts only.
// The Origin check only stops other web pages; a script can send any Origin. The daily caps are what bound the cost.
import { CLAIMS_SCHEMA, GEO_SCHEMA, MAX_PAGE_CHARS, buildClaimsPrompt, buildGeoPrompt } from "../../src/shared/prompts.js"; // the extension's own prompts
import { buildDeepPrompt, DEEP_PAGE_CHARS } from "../../src/shared/deep.js";
import { parseModelJson } from "../../src/shared/parse.js";

export const CAPS = { install: 10, ip: 20, all: 100 }; // model calls per UTC day
export const MAX_BODY_BYTES = 400000;
export const MODES = {
  deep: { chars: DEEP_PAGE_CHARS, maxTokens: 6000, schema: CLAIMS_SCHEMA, prompt: (t) => buildDeepPrompt(t), valid: (v) => Array.isArray(v?.claims) },
  quick: { chars: MAX_PAGE_CHARS, maxTokens: 3500, schema: CLAIMS_SCHEMA, prompt: (t) => buildClaimsPrompt(t), valid: (v) => Array.isArray(v?.claims) },
  geo: { chars: MAX_PAGE_CHARS, maxTokens: 2500, schema: GEO_SCHEMA, prompt: (t, title) => buildGeoPrompt(t, { title }), valid: (v) => !!v?.ratings },
};
// Same order as the other Fox products use today: the cheap model, then the older one on an error or an unusable answer.
// extra: the newer model thinks by default and rejects temperature.
export const PROVIDERS = [
  { model: "claude-haiku-5-5", extra: { thinking: { type: "disabled" } } },
  { model: "claude-haiku-4-5", extra: { temperature: 0.2 } },
];

const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

/** Takes one unit from every scope, or from none and names the first full scope. */
export function take(counts, keys, caps) {
  for (const scope of ["install", "ip", "all"]) if ((counts[keys[scope]] || 0) >= caps[scope]) return { ok: false, scope };
  for (const k of Object.values(keys)) counts[k] = (counts[k] || 0) + 1;
  return { ok: true };
}

/** One Durable Object per UTC day. Read, check and write run with other requests held back, so the caps cannot be raced past. */
export class Counter {
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    const { keys, caps } = await request.json();
    return this.state.blockConcurrencyWhile(async () => {
      const counts = (await this.state.storage.get("counts")) || {};
      const out = take(counts, keys, caps);
      if (out.ok) await this.state.storage.put("counts", counts);
      if (!(await this.state.storage.getAlarm())) await this.state.storage.setAlarm(Date.now() + 48 * 3600 * 1000);
      return Response.json(out);
    });
  }
  async alarm() {
    await this.state.storage.deleteAll(); // install id and IP hashes are gone after about two days
  }
}

const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
const capsFrom = (env) => Object.fromEntries(Object.entries(CAPS).map(([k, v]) => [k, Number(env["CAP_" + k.toUpperCase()] ?? v)]));

/** One provider call. Returns the parsed answer, or throws. */
export async function ask(provider, mode, prompt, key, fetchFn = fetch) {
  const r = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: mode.maxTokens,
      system: "Reply with one JSON object only, no other text and no code fence. It must match this JSON schema: " + JSON.stringify(mode.schema),
      messages: [{ role: "user", content: prompt }],
      ...provider.extra,
    }),
    signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const body = await r.json();
  const value = parseModelJson((body.content || []).filter((c) => c.type === "text").map((c) => c.text).join(""));
  if (!mode.valid(value)) throw new Error("provider shape");
  return { value, usage: body.usage || {} };
}

export async function handle(request, env, fetchFn = fetch, log = console.log) {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return json({ error: "origin" }, 403);
  const cors = { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "Origin" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "method" }, 405, cors);

  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) return json({ error: "too_large" }, 413, cors);
  let body = null;
  try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { /* handled below */ }
  const installId = String(body?.install_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(installId)) return json({ error: "install_id" }, 400, cors);
  const mode = Object.hasOwn(MODES, body.mode) ? MODES[body.mode] : null;
  if (!mode) return json({ error: "mode" }, 400, cors);
  const text = typeof body.text === "string" ? body.text.slice(0, mode.chars * 2) : "";
  if (text.trim().length < 40) return json({ error: "text" }, 400, cors);
  if (!env.ANTHROPIC_API_KEY || !env.COUNTER) return json({ error: "not_available" }, 503, cors);

  try {
    const day = new Date().toISOString().slice(0, 10);
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const keys = { install: "i:" + (await sha(day + installId.toLowerCase())), ip: "p:" + (await sha(day + ip)), all: "all" };
    const stub = env.COUNTER.get(env.COUNTER.idFromName(day));
    const got = await (await stub.fetch("https://counter/take", { method: "POST", body: JSON.stringify({ keys, caps: capsFrom(env) }) })).json();
    if (!got.ok) {
      log(JSON.stringify({ mode: body.mode, outcome: "cap", scope: got.scope }));
      return json({ error: "busy", scope: got.scope, message: "Free daily limit reached, try again tomorrow" }, 429, cors);
    }
    // The builders cut the text to the extension's own window (mode.chars) before it reaches the model.
    const prompt = mode.prompt(text, typeof body.title === "string" ? body.title.slice(0, 200) : "");
    for (const [i, provider] of PROVIDERS.entries()) {
      try {
        const { value, usage } = await ask(provider, mode, prompt, env.ANTHROPIC_API_KEY, fetchFn);
        log(JSON.stringify({ mode: body.mode, outcome: "ok", provider: i + 1, in: usage.input_tokens, out: usage.output_tokens }));
        return json(value, 200, cors);
      } catch (err) {
        const why = /^provider (\d{3}|shape)$/.test(err?.message) ? err.message : "unusable"; // never anything that could hold page text
        log(JSON.stringify({ mode: body.mode, outcome: "failed", provider: i + 1, why }));
      }
    }
    return json({ error: "not_available" }, 503, cors);
  } catch {
    log(JSON.stringify({ mode: body.mode, outcome: "error" }));
    return json({ error: "not_available" }, 503, cors);
  }
}

export default { fetch: (request, env) => handle(request, env) };
