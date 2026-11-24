// Archived pages that hide the article in <noscript> (T3002). Pure functions over a DOM (browser or jsdom), unit tested.
//
// Problem: the 2014 Fortune theme wraps the whole article in <noscript>. With page scripts ON the browser never draws it (the noscript holds ONE unparsed text node), so the archived
// page looks empty and Lens reads nothing. With scripts OFF (Chrome's per-site setting) the noscript holds real elements, is drawn, and is read like any other article.
//
// noscriptArticle(): on web.archive.org ONLY, when the visible article text is under MIN_VISIBLE characters and a <noscript> holds article-shaped text, parse that text as HTML and
// return its extraction. Highlights cannot land on it (the text is not in the page), and the caller says so in a note.
export const MIN_VISIBLE = 500;
export const MIN_NOSCRIPT_RAW = 2000;

export const isArchiveHost = (host) => /(^|\.)web\.archive\.org$/i.test(String(host || ""));

/** @returns the extraction ({blocks, chars, rawChars, rootTag}) of the best <noscript> copy, or null. visibleChars = chars of the normal extraction. */
export function noscriptArticle(doc, extract, host, visibleChars) {
  if (!isArchiveHost(host) || visibleChars >= MIN_VISIBLE) return null;
  let best = null;
  for (const ns of doc.querySelectorAll("noscript")) {
    if (ns.firstElementChild) continue;   // scripts are off: its elements are drawn and already read
    const raw = ns.textContent || "";
    if (raw.length < MIN_NOSCRIPT_RAW) continue;
    let alt;
    try {
      alt = new doc.defaultView.DOMParser().parseFromString("<!doctype html><html><body>" + raw + "</body></html>", "text/html");
    } catch { continue; }
    const ex = extract(alt);
    if (ex && ex.chars >= MIN_VISIBLE && (!best || ex.chars > best.chars)) best = ex;
  }
  return best;
}
