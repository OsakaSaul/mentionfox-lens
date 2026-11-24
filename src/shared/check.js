// "Check" button: verify ONE claim sentence against the web (cloud model with Google Search grounding).
// Pure helpers (prompt, parsing, daily quota, archive date) so they can be unit tested without a browser.

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

export const CHECK_SYSTEM =
  "You check one sentence that a company or organisation published about itself. Use only what the web search returns. " +
  "Decide whether the public record SUPPORTS it, CONTRADICTS it, or has NO CLEAR record. " +
  "The sentence was a statement made at the stated date, so later reports, filings or court records can contradict it. " +
  "Wording rules: say 'later reported', 'alleged' or 'found by a court' as the sources say; never call anyone a fraud unless a court found it. " +
  "Answer in exactly two lines, nothing else:\nVERDICT: SUPPORTED or CONTRADICTED or NO_CLEAR_RECORD\nREASON: one short sentence.";

export function buildCheckPrompt({ claim, domain, date }) {
  return `Sentence: "${String(claim).replace(/"/g, "'")}"\nPublished by or on the website: ${domain || "unknown"}\n` + (date ? `Stated as of: ${date} (web archive snapshot date)\n` : "Stated as of: the page's own date, unknown\n") + "Check this one sentence.";
}

const VERDICTS = { SUPPORTED: "supported", CONTRADICTED: "contradicted", NO_CLEAR_RECORD: "none" };

/** Model text -> {verdict: "supported"|"contradicted"|"none", reason}. Unparseable text is "none" (never a made-up red or green). */
export function parseCheck(text) {
  const t = String(text || "");
  const v = /VERDICT\s*:\s*\**\s*(SUPPORTED|CONTRADICTED|NO[_ ]CLEAR[_ ]RECORD)/i.exec(t);
  const r = /REASON\s*:\s*([^\n]+)/i.exec(t);
  const verdict = v ? VERDICTS[v[1].toUpperCase().replace(/ /g, "_")] : "none";
  const reason = (r ? r[1] : v ? "" : t.split("\n").find((l) => l.trim()) || "").replace(/\*+/g, "").trim().slice(0, 300);
  return { verdict, reason: reason || "No clear public record was found for this sentence." };
}

/** groundingMetadata -> up to 3 distinct http(s) sources [{title, uri}]. */
export function pickSources(meta, max = 3) {
  const out = [];
  const seen = new Set();
  for (const c of meta?.groundingChunks || []) {
    const w = c?.web;
    if (!w?.uri || !/^https?:\/\//i.test(w.uri)) continue;
    const key = w.title || w.uri;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: String(w.title || w.domain || new URL(w.uri).hostname).slice(0, 80), uri: w.uri });
    if (out.length >= max) break;
  }
  return out;
}

/** Google's display rules apply to any response that carries search suggestions. */
export const searchSuggestionsHtml = (meta) => meta?.searchEntryPoint?.renderedContent || "";
