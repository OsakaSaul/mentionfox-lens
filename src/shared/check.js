// "Check" button: verify ONE claim sentence against the web through our own server (POST https://api.foxapis.com/v1/lens/check, T2989), which runs the claims-check engine.
// Pure helpers (quota, archive date, reply handling) so they can be unit tested without a browser.

export const DAILY_FREE_CHECKS = 5;
export const QUOTA_KEY = "lensChecks";

/** Local calendar day as YYYY-MM-DD (the counter resets at local midnight). */
export function localDay(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** stored: {day, used} or anything. Returns {day, used, left, exhausted} for `now`; a stale or broken record counts as 0 used. */
export function quotaState(stored, now = new Date(), limit = DAILY_FREE_CHECKS) {
  const day = localDay(now);
  const used = stored && stored.day === day && Number.isInteger(stored.used) && stored.used > 0 ? Math.min(stored.used, limit) : 0;
  return { day, used, left: limit - used, exhausted: used >= limit };
}

export const quotaAfterUse = (stored, now = new Date(), limit = DAILY_FREE_CHECKS) => {
  const q = quotaState(stored, now, limit);
  return { day: q.day, used: Math.min(q.used + 1, limit) };
};

export function quotaText(q) {
  return `${q.left} of ${DAILY_FREE_CHECKS} free checks left today`;
}

/** "20010507225240" from a web.archive.org URL -> "2001-05-07" (else null). */
export function archiveDate(url) {
  const m = /^https?:\/\/web\.archive\.org\/web\/(\d{4})(\d{2})(\d{2})\d{0,6}[a-z_]*\//i.exec(String(url || ""));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** The domain the claim was made on. For an Archive URL it is the original site, not web.archive.org. */
export function claimDomain(url) {
  try {
    let u = String(url || "");
    const m = /^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\/(.+)$/i.exec(u);
    if (m) u = /^https?:\/\//i.test(m[1]) ? m[1] : "http://" + m[1];
    return new URL(u).hostname.replace(/^www\d*\./, "");
  } catch {
    return "";
  }
}

/** The route that answers Check: no key, no sign-in; the server only answers a Chrome extension origin and keeps a global daily cap. */
export const CHECK_URL = "https://api.foxapis.com/v1/lens/check";
export const CHECK_TIMEOUT_MS = 100000;   // the server gives up at about 90 seconds

const VERDICTS = { supported: "supported", contradicted: "contradicted", no_record: "none" };

/** Server JSON -> {verdict: "supported"|"contradicted"|"none", reason, sources: [{title, uri}]}. Anything unexpected is "none" (never a made-up red or green); only http(s) sources are kept. */
export function normalizeCheck(res) {
  const verdict = VERDICTS[res?.verdict] || "none";
  const reason = String(res?.reason || "").replace(/\s+/g, " ").trim().slice(0, 310) || "No clear public record was found for this sentence.";
  const sources = [];
  for (const s of Array.isArray(res?.sources) ? res.sources : []) {
    const uri = s && typeof s.url === "string" ? s.url : "";
    if (!/^https?:\/\//i.test(uri)) continue;
    let host = "";
    try { host = new URL(uri).hostname.replace(/^www\./, ""); } catch { continue; }
    sources.push({ title: String(s.title || host).slice(0, 80), uri, undated: s.undated === true });
    if (sources.length >= 3) break;
  }
  // T2992: as_of is the page date the server judged against ("As known on <date>"); only a plain YYYY-MM-DD is shown
  const asOf = typeof res?.as_of === "string" && /^\d{4}-\d{2}-\d{2}$/.test(res.as_of) ? res.as_of : "";
  return { verdict, reason, sources, asOf };
}

/** Calls the server with the ONE sentence, the domain and the archive date. Returns {verdict, reason, sources, ms}. Throws Error with .code "busy" | "not_available". */
export async function runWorkerCheck({ claim, domain, date }, fetchFn = fetch, url = CHECK_URL) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  let r;
  try {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), CHECK_TIMEOUT_MS) : null;
    try {
      r = await fetchFn(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claim, domain: domain || "", snapshot_date: date || "" }), ...(ctl ? { signal: ctl.signal } : {}) });
    } finally { if (timer) clearTimeout(timer); }
  } catch {
    throw Object.assign(new Error("Web checks are not available right now."), { code: "not_available" });
  }
  if (r.status === 429) throw Object.assign(new Error("Web checks are busy today"), { code: "busy" });
  if (!r.ok) throw Object.assign(new Error("Web checks are not available right now."), { code: "not_available" });
  const body = await r.json().catch(() => null);
  const ms = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0);
  return { ...normalizeCheck(body), ms };
}
