// Article body only (T2998). Pure functions over a DOM (browser or jsdom), no chrome.* calls, unit tested.
//
// Problem: on a news page the readable text includes a news ticker, event promos, "add us on Google" boxes, related-story headline lists and ads that sit INSIDE <main>.
// Lens turned a Bessent/Nvidia ticker line and a "Join Fortune 500 leaders" promo into "Specific and checkable" claims of a 2014 Theranos article.
//
// pickArticleRoot() finds the article (or transcript) body in this order:
//   1. the element marked itemprop="articleBody";
//   2. the <article> that contains the page's real H1 (the H1 that matches the title), else the first <article> that follows it;
//   3. the element whose text best matches the JSON-LD articleBody or description (used only to LOCATE the visible body: the JSON-LD text itself is never analysed);
//   4. the densest text block (Readability style: the container with the most paragraph text and the fewest links);
//   else null, and the caller keeps its older rule (Wikipedia, largest article/main, body).
// cleanArticle() then drops what is never article text: invisible text, tickers and marquees, promo/event/newsletter/follow boxes, related and headline lists, ads, cookie banners,
// image credits, share bars, the Wayback toolbar. Only RENDERED, VISIBLE text is analysed: hidden or paywalled-away text is dropped.
// coherenceGuard() is the last safety net for a page where no article root could be found.

const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const textOf = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
/** Length of the text a reader could see: text nodes outside script, style, noscript and template (textContent of <body> includes the page's script text). */
function visibleLen(el) {
  const doc = el.ownerDocument;
  const w = doc.createTreeWalker(el, 4 /* SHOW_TEXT */);
  let n = 0;
  for (let x = w.nextNode(); x; x = w.nextNode()) {
    // T3002: a text node directly inside <noscript> is the unparsed copy (scripts on) and is not visible; elements inside a noscript are drawn when scripts are off
    if (x.parentElement && (x.parentElement.closest("script,style,template") || x.parentElement.tagName === "NOSCRIPT")) continue;
    n += x.nodeValue.replace(/\s+/g, " ").trim().length;
  }
  return n;
}

// ---------------------------------------------------------------- page facts
function jsonLdArticle(doc) {
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let j;
    try { j = JSON.parse(s.textContent || ""); } catch { continue; }
    const list = [];
    const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { list.push(x); if (x["@graph"]) walk(x["@graph"]); } };
    walk(j);
    const a = list.find((x) => /(?:^|,)(News|Blog|Tech|Scholarly|Report)?Article(?:$|,)|Posting/i.test([].concat(x["@type"] || []).join(",")));
    if (a) return { headline: String(a.headline || a.name || ""), articleBody: String(a.articleBody || ""), description: String(a.description || "") };
  }
  return null;
}

const isTickerLike = (el) => TICKER_RE.test(tokens(el)) || !!el.closest("[role=marquee],[aria-live]");

/** The page's real H1: the one that matches the title / og:title / JSON-LD headline, else the longest H1 outside tickers and navigation. */
export function realHeadline(doc) {
  const ld = jsonLdArticle(doc);
  const metaTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
  const wants = [metaTitle, ld?.headline, doc.title, ...(doc.title || "").split(/\s[|–—-]\s/)].map(norm).filter((x) => x.length >= 8);
  const h1s = [...doc.querySelectorAll("h1")].filter((h) => !h.closest("nav,aside,footer") && !isTickerLike(h) && norm(textOf(h)).length >= 8);
  for (const h of h1s) { const t = norm(textOf(h)); if (wants.some((w) => w.includes(t) || t.includes(w))) return h; }
  return h1s.filter((h) => textOf(h).split(" ").length >= 3).sort((a, b) => textOf(b).length - textOf(a).length)[0] || null;
}

/** The page says it is an article (JSON-LD Article/NewsArticle or og:type article). A bare <article> element does not count: company pages use them for cards. */
export function isNewsLike(doc) {
  return !!jsonLdArticle(doc) || doc.querySelector('meta[property="og:type"]')?.getAttribute("content") === "article";
}

// ---------------------------------------------------------------- root
/** A heuristic root must hold most of the page's text: a guess that drops 80% of the page is a wrong guess. */
const dominates = (el, doc) => visibleLen(el) >= 0.6 * visibleLen(doc.body);

function densest(doc) {
  let best = null, bestScore = 0;
  for (const el of doc.querySelectorAll("div,section,article,main,td")) {
    const ps = [...el.children].filter((c) => c.tagName === "P" && textOf(c).length >= 60);
    if (ps.length < 3) continue;
    const text = ps.reduce((n, p) => n + textOf(p).length, 0);
    const links = ps.reduce((n, p) => n + [...p.querySelectorAll("a")].reduce((m, a) => m + textOf(a).length, 0), 0);
    const score = text * (1 - Math.min(0.9, links / Math.max(1, text)));
    if (score > bestScore) { best = el; bestScore = score; }
  }
  return bestScore >= 800 ? best : null;
}

/** {root, kind, headline} or null. kind: articleBody | article-h1 | article-after-h1 | jsonld | dense. */
export function pickArticleRoot(doc) {
  const MIN = 400;
  // 1. schema.org articleBody
  let best = null;
  for (const el of doc.querySelectorAll('[itemprop="articleBody"]')) if (!best || textOf(el).length > textOf(best).length) best = el;
  if (best && textOf(best).length >= 300) return { root: best, kind: "articleBody", headline: realHeadline(doc) };
  // 2. the <article> with the real H1
  const h1 = realHeadline(doc);
  if (h1) {
    const inside = h1.closest("article");
    if (inside && textOf(inside).length >= MIN) return { root: inside, kind: "article-h1", headline: h1 };
    const mainLen = Math.max(0, ...[...doc.querySelectorAll("main,[role=main]")].map(visibleLen), visibleLen(doc.body) * 0.6);
    for (const a of doc.querySelectorAll("article")) {
      if (a.closest("aside,nav,footer") || visibleLen(a) < Math.max(800, mainLen * 0.6)) continue;   // a card or teaser <article> on a home page does not dominate the page; a story does
      if (h1.compareDocumentPosition(a) & 4 /* FOLLOWING */) return { root: a, kind: "article-after-h1", headline: h1 };
    }
  }
  // 3. JSON-LD text only locates the body
  const ld = jsonLdArticle(doc);
  const needle = norm((ld?.articleBody || ld?.description || "")).slice(0, 70);
  if (needle.length >= 40) {
    let hit = null;
    for (const el of doc.querySelectorAll("p,div,section,article,span,h2")) {
      if (el.closest("script,style")) continue;
      const t = norm(textOf(el));
      if (t.includes(needle) && (!hit || t.length < norm(textOf(hit)).length)) hit = el;
    }
    if (hit) {
      const art = hit.closest("article");
      if (art && textOf(art).length >= MIN) return { root: art, kind: "jsonld", headline: h1 };
      for (let e = hit; e && e !== doc.body; e = e.parentElement) if (textOf(e).length >= 1500 && dominates(e, doc)) return { root: e, kind: "jsonld", headline: h1 };
    }
  }
  // 4. densest text block
  const d0 = isNewsLike(doc) ? densest(doc) : null;   // a company page is not a news page: it keeps the older rule
  const d = d0 && dominates(d0, doc) ? d0 : null;   // and a small block among many (a FAQ, a card list) is not the page
  return d ? { root: d, kind: "dense", headline: h1 } : null;
}

// ---------------------------------------------------------------- furniture
const tokens = (el) => (String(el.getAttribute?.("class") || "") + " " + String(el.id || "")).toLowerCase();
const word = (list) => new RegExp("(?:^|[\\s_-])(?:" + list + ")(?:[\\s_-]|$)");
const TICKER_RE = word("ticker|marquee|breaking|trending|crawl|newsstrip|headline-strip|scroller|topbar|top-bar|latest-news");
const AD_RE = word("ad|ads|adslot|advert|advertisement|sponsor|sponsored|dfp|gpt|outbrain|taboola|adsbygoogle");
const PROMO_RE = word("promo|promos|promotion|event|events|newsletter|subscribe|subscription|signup|sign-up|add-us|cta|popup|modal|overlay|interstitial|marketing|membership|follow|share|social|bookmark|photo-credit|image-credit|img-credit|credit-line|creditline|photographer|copyright");
const RELATED_RE = word("related|recommended|recommendation|more-from|read-next|read-more|up-next|most-read|most-popular|popular|also-read|you-may-like|recirc|taboola|outbrain|trending|latest|top-stories|more-stories");
const ALWAYS_SELECT = "ins.adsbygoogle,[role=marquee],[id^=wm-ipp],#donato,#wm-ipp-base,#wm-ipp-print,.wb-autocomplete-suggestions,[aria-label*=advertisement i],[data-ad],[data-ad-slot],[data-ad-unit]";
const PROMO_TEXT = /\b(join (?:us|fortune|[\w ]{0,40}leaders)|add [\w ]{1,20} on google|sign up (?:for|to|now)|subscribe|newsletter|register (?:now|today)|get tickets|follow us|download (?:the )?app|innovation forum|preferred source|read more from|you may also like)\b/i;
const LOW = 1500;
const ACCORDION = "details,[aria-expanded],[aria-controls],[role=tabpanel],[role=tab],[class*=accordion i],[class*=collapse i],[class*=faq i],[class*=tab-panel i],[class*=tabpanel i],[class*=toggle i]";
// Outside a confirmed article only this narrow set is removed: nothing here can be a company page's own content.
const SAFE_TICKER_RE = word("ticker|marquee|breaking|crawl|newsstrip|headline-strip");

/** A small element that holds no article: fewer than 3 long paragraphs and no H1/article/main inside. */
function isSmallFurniture(el, limit = LOW) {
  if (textOf(el).length >= limit || el.querySelector("h1,article,main")) return false;
  let longP = 0;
  for (const p of el.querySelectorAll("p")) if (textOf(p).length >= 140 && ++longP >= 3) return false;
  return true;
}

function removeIf(root, pred) {
  let n = 0;
  for (const el of [...root.querySelectorAll("*")]) {
    if (!root.contains(el) || el === root) continue;
    let hit = false;
    try { hit = pred(el); } catch { hit = false; }
    if (hit) { el.remove(); n++; }
  }
  return n;
}

/** Text that is not rendered: compare each clone element with its original (the clone has lost the page's styles) and drop display:none, visibility:hidden, hidden and zero-size clips. */
export function dropInvisible(origRoot, cloneRoot) {
  const win = origRoot.ownerDocument?.defaultView;
  if (!win || typeof win.getComputedStyle !== "function") return 0;
  const o = [origRoot, ...origRoot.querySelectorAll("*")], c = [cloneRoot, ...cloneRoot.querySelectorAll("*")];
  if (o.length !== c.length) return 0;
  const kill = [];
  for (let i = 1; i < o.length; i++) {
    let s;
    try { s = win.getComputedStyle(o[i]); } catch { continue; }
    if (!s) continue;
    if (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse" || s.contentVisibility === "hidden" || o[i].hasAttribute("hidden")) {
      if (o[i].closest(ACCORDION)) continue;   // a collapsed FAQ answer or tab panel is one click from visible, not hidden away
      kill.push(c[i]);
    }
  }
  let n = 0;
  for (const el of kill) if (el.isConnected || cloneRoot.contains(el)) { el.remove(); n++; }
  return n;
}

/** Climb to the biggest ancestor that adds no text of its own beyond the matched element (so the empty wrapper goes too). */
function wrapperOf(el, root) {
  const base = textOf(el).length;
  let top = el;
  while (top.parentElement && top.parentElement !== root && textOf(top.parentElement).length <= base + 40 && !top.parentElement.querySelector("h1,article,main")) top = top.parentElement;
  return top;
}

/** Remove tickers, promos, related lists, ads and other non-article furniture from a clone. Returns how many elements were removed (by kind) for the report. */
export function cleanArticle(host, strict = true) {
  const stats = { ticker: 0, promo: 0, ad: 0, related: 0, list: 0, text: 0, select: 0, duplicate: 0 };
  try { for (const el of [...host.querySelectorAll(ALWAYS_SELECT)]) { el.remove(); stats.select++; } } catch { /* selector not supported */ }
  if (!strict) {   // not a confirmed article: only tickers and ad slots, by name
    stats.ticker += removeIf(host, (el) => (SAFE_TICKER_RE.test(tokens(el)) || el.matches("[aria-live=polite],[aria-live=assertive]")) && isSmallFurniture(el, 2500));
    stats.ad += removeIf(host, (el) => AD_RE.test(tokens(el)) && isSmallFurniture(el, 2500));
    return stats;
  }
  stats.ticker += removeIf(host, (el) => (TICKER_RE.test(tokens(el)) || el.matches("[aria-live=polite],[aria-live=assertive]")) && isSmallFurniture(el, 2500));
  stats.ad += removeIf(host, (el) => AD_RE.test(tokens(el)) && isSmallFurniture(el, 2500));
  stats.promo += removeIf(host, (el) => PROMO_RE.test(tokens(el)) && isSmallFurniture(el));
  stats.related += removeIf(host, (el) => RELATED_RE.test(tokens(el)) && isSmallFurniture(el, 2500));
  // a strip whose items repeat (a scrolling ticker duplicates its content)
  stats.duplicate += removeIf(host, (el) => {
    const kids = [...el.children].map((k) => norm(textOf(k))).filter((t) => t.length >= 20 && t.length <= 250);
    if (kids.length < 4 || !isSmallFurniture(el, 2500)) return false;
    return new Set(kids).size < kids.length;
  });
  // a list of headlines: three or more items, mostly link text, each short
  stats.list += removeIf(host, (el) => {
    if (!isSmallFurniture(el, 4000) || el.children.length < 3) return false;
    const items = [...el.children];
    if (items.some((k) => textOf(k).length > 220 || textOf(k).length < 12)) return false;
    const total = items.reduce((n, k) => n + textOf(k).length, 0);
    const links = items.reduce((n, k) => n + [...k.querySelectorAll("a")].reduce((m, a) => m + textOf(a).length, 0), 0);
    return total > 0 && links / total >= 0.7;
  });
  // promo sentences by their words ("Join ... leaders", "Add Fortune on Google")
  for (const el of [...host.querySelectorAll("div,section,p,li,span,a,aside,h2,h3,h4")]) {
    if (!host.contains(el)) continue;
    const t = textOf(el);
    if (t.length < 12 || t.length > 400 || !PROMO_TEXT.test(t) || el.querySelector("h1,article,main")) continue;
    const top = wrapperOf(el, host);
    if (textOf(top).length <= 400) { top.remove(); stats.text++; }
  }
  return stats;
}

// ---------------------------------------------------------------- coherence guard
const STOP = new Set(["the", "this", "that", "these", "those", "and", "for", "with", "from", "his", "her", "its", "their", "when", "while", "after", "before", "says", "said", "about", "have", "will", "would", "could", "not", "but"]);
const entities = (s) => new Set((String(s || "").match(/\b[A-Z][\p{L}'’-]{2,}\b/gu) || []).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w)));

/** For a page where no article root was found: drop a short block that names two or more entities and shares none with the headline or the lead (a ticker line on someone else's story). The first three blocks always stay. */
export function coherenceGuard(blocks, { headline = "", leadBlocks = 3 } = {}) {
  const lead = blocks.slice(0, leadBlocks).join(" ");
  const anchor = entities(headline + " " + lead);
  if (anchor.size < 2) return { blocks, dropped: 0 };
  const kept = [];
  let dropped = 0;
  blocks.forEach((b, i) => {
    if (i < leadBlocks || b.length >= 300) { kept.push(b); return; }
    const e = entities(b);
    if (e.size >= 2 && ![...e].some((w) => anchor.has(w))) { dropped++; return; }
    kept.push(b);
  });
  return { blocks: kept, dropped };
}
