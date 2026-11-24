// lens-check (T2988): the Check button's backend. A tiny Cloudflare Worker that turns ONE sentence into a verdict by calling our own FoxAPIs claims_check endpoint.
// No new paid service: it runs on the existing Workers plan, the daily cap lives in Workers KV, and the FoxAPIs token is a Worker secret (FOXAPIS_TOKEN) that the owner sets himself.
//
//   POST {claim, domain, snapshot_date}  ->  200 {verdict: "contradicted"|"supported"|"no_record", reason, sources: [{title, url}]}
//   429 {error: "busy", message: "Web checks are busy today"}    when the global daily cap (DAILY_CAP, default 100) is used up
//   503 {error: "not_available"}                                  when the secret is not set yet or the upstream is down
//   403 {error: "origin"}                                         unless Origin is one of ALLOWED_ORIGINS (chrome-extension://<the Lens id>, comma separated)
// Nothing from the upstream is passed through as-is: only the verdict, one reason sentence and up to 3 sources.

export const DAILY_CAP_DEFAULT = 100;
export const POLL_MS = 3000;
export const POLL_MAX_MS = 110000;
const API = "https://api.foxapis.com";

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors } });

export const allowedOrigins = (env) => String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const corsFor = (origin) => ({ "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "Origin" });

/** The text sent to claims_check. The endpoint wants a document of at least 50 words, so the one sentence sits inside a neutral frame that contains no claim of its own. */
export function buildDocument({ claim, domain, date }) {
  const where = domain ? `the website ${domain}` : "a company website";
  const when = date ? `archived on ${date}` : "as it was on the day it was published";
  return (
    `Statement from ${where}, ${when}. The one sentence below is reproduced exactly as it was published so that it can be checked against the public record. ` +
    `Check only this one sentence. It was a statement made on the stated day, so later reports, filings or court records can contradict it.\n\n"${claim}"\n\n` +
    `End of the sentence to check. Nothing else in this note is a claim.`
  );
}

export function validate(body) {
  const claim = typeof body?.claim === "string" ? body.claim.replace(/\s+/g, " ").trim() : "";
  if (claim.length < 15 || claim.length > 600) return { error: "claim must be 15 to 600 characters" };
  const domain = typeof body.domain === "string" && /^[a-z0-9]([a-z0-9.-]{0,98}[a-z0-9])?$/i.test(body.domain.trim()) ? body.domain.trim().toLowerCase() : "";
  const date = typeof body.snapshot_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.snapshot_date) ? body.snapshot_date : "";
  return { claim: claim.replace(/"/g, "'"), domain, date };
}

/** claims_check answer -> {verdict, reason, sources}. contradicted wins, then supported; partly and cant_verify are "no_record" (never a made-up red or green). */
export function mapResult(res) {
  const claims = Array.isArray(res?.claims) ? res.claims : [];
  if (!claims.length) return { verdict: "no_record", reason: "No clear public record was found for this sentence.", sources: [] };
  const pick = claims.find((c) => c.verdict === "contradicted") || claims.find((c) => c.verdict === "supported") || claims[0];
  const verdict = pick.verdict === "contradicted" ? "contradicted" : pick.verdict === "supported" ? "supported" : "no_record";
  const seen = new Set();
  const sources = [];
  for (const s of pick.sources || []) {
    const url = s && typeof s.url === "string" ? s.url : "";
    if (!/^https?:\/\//i.test(url)) continue;
    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { continue; }
    if (seen.has(host)) continue;
    seen.add(host);
    sources.push({ title: String(s.title || host).slice(0, 80), url });
    if (sources.length >= 3) break;
  }
  const reason = String(pick.reason || "").replace(/\s+/g, " ").trim().slice(0, 300) || "No clear public record was found for this sentence.";
  return { verdict, reason, sources };
}

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** Global daily counter in KV. Returns false when the cap is already used up. KV is not atomic: two checks at the same instant can overshoot the cap by one or two, which is fine for a spend brake. */
async function takeSlot(env, now) {
  const cap = Number(env.DAILY_CAP) > 0 ? Number(env.DAILY_CAP) : DAILY_CAP_DEFAULT;
  const key = "cap:" + utcDay(now);
  const used = parseInt((await env.LENS_KV.get(key)) || "0", 10) || 0;
  if (used >= cap) return { ok: false, key, used };
  await env.LENS_KV.put(key, String(used + 1), { expirationTtl: 172800 });
  return { ok: true, key, used: used + 1 };
}
async function giveSlotBack(env, key) {
  try {
    const used = parseInt((await env.LENS_KV.get(key)) || "0", 10) || 0;
    if (used > 0) await env.LENS_KV.put(key, String(used - 1), { expirationTtl: 172800 });
  } catch { /* the cap is a brake, not a ledger */ }
}

async function runClaimsCheck(env, text, fetchFn, sleep, pollMax) {
  const h = { authorization: "Bearer " + env.FOXAPIS_TOKEN, "content-type": "application/json", "user-agent": "mentionfox-lens-check/1" };
  const r = await fetchFn(API + "/v1/claims_check", { method: "POST", headers: h, body: JSON.stringify({ text, mode: "snapshot", doc_type: "other" }) });
  if (r.status !== 202 && r.status !== 200) return { ok: false, status: r.status };
  const first = await r.json().catch(() => null);
  if (r.status === 200 && first && Array.isArray(first.claims)) return { ok: true, result: first };
  const poll = first && (first.poll_url || (first.job_id ? "/v1/jobs/" + first.job_id : ""));
  if (!poll || !/^\/v1\/jobs\//.test(String(poll).replace(/^https?:\/\/[^/]+/, ""))) return { ok: false, status: 502 };
  const path = String(poll).replace(/^https?:\/\/[^/]+/, "");
  const t0 = Date.now();
  while (Date.now() - t0 < pollMax) {
    await sleep(POLL_MS);
    const p = await fetchFn(API + path, { headers: h });
    if (p.status >= 500) continue;
    if (p.status !== 200) return { ok: false, status: p.status };
    const j = await p.json().catch(() => null);
    if (!j || /^(pending|running|queued|processing)$/i.test(String(j.status || ""))) continue;
    if (/^(done|completed|complete|success)$/i.test(String(j.status)) && j.result) return { ok: true, result: j.result };
    return { ok: false, status: 502 };
  }
  return { ok: false, status: 504 };
}

export async function handle(request, env, deps = {}) {
  const fetchFn = deps.fetch || fetch, sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))), now = deps.now || new Date(), pollMax = deps.pollMax ?? POLL_MAX_MS;
  const origin = request.headers.get("origin") || "";
  const okOrigin = allowedOrigins(env).includes(origin);
  const cors = okOrigin ? corsFor(origin) : {};
  if (request.method === "OPTIONS") return okOrigin ? new Response(null, { status: 204, headers: cors }) : json({ error: "origin" }, 403, {});
  if (!okOrigin) return json({ error: "origin" }, 403, {});
  if (request.method !== "POST") return json({ error: "method" }, 405, cors);
  if (!env.FOXAPIS_TOKEN) return json({ error: "not_available" }, 503, cors);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400, cors); }
  const v = validate(body);
  if (v.error) return json({ error: "bad_request", message: v.error }, 400, cors);
  const slot = await takeSlot(env, now);
  if (!slot.ok) return json({ error: "busy", message: "Web checks are busy today" }, 429, cors);
  let out;
  try { out = await runClaimsCheck(env, buildDocument(v), fetchFn, sleep, pollMax); } catch { out = { ok: false, status: 502 }; }
  if (!out.ok) { await giveSlotBack(env, slot.key); return json({ error: "not_available" }, 503, cors); }
  return json(mapResult(out.result), 200, cors);
}

export default { fetch: (request, env) => handle(request, env) };
