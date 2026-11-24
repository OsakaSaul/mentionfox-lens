// Main-content extraction and input windows. Pure functions over a DOM (browser or jsdom): no chrome.* calls, unit tested.
//
// Small own implementation (no Readability dependency), tuned for Wikipedia, news articles, company pages, press releases and
// LinkedIn / X profile pages. Deterministic: the same DOM always gives the same blocks. It works on a CLONE, so the live page is
// never touched, and it reads text through the same text-node walker as the highlighter (buildIndex), so every quote the model
// copies from these blocks can be found again on the live page.
import { buildIndex } from "./match.js";
import { pickArticleRoot, cleanArticle, dropInvisible } from "./article-root.js";   // T2998: article body only

/** Elements that never hold article text. */
const ALWAYS_REMOVE = "script,style,noscript,template,svg,canvas,iframe,form,button,select,input,textarea,dialog,audio,video,object,embed,nav,aside,footer," +
  "[role=navigation],[role=banner],[role=complementary],[role=contentinfo],[role=dialog],[role=alertdialog],[aria-modal=true],[hidden]";

/** MediaWiki / Wikipedia furniture: infobox, footnote markers and lists, tables of contents, edit links, hatnotes, navboxes, captions. */
const WIKI_REMOVE = [
  ".infobox", "table.infobox", ".infobox-above", ".sidebar", ".navbox", ".navbox-inner", ".vertical-navbox", ".metadata", ".ambox", ".hatnote", ".dablink",
  ".shortdescription", ".mw-editsection", ".mw-editsection-bracket", "sup.reference", ".reference", "sup[id^=cite_ref]", ".reflist", ".references", ".mw-references-wrap",
  "ol.references", ".refbegin", ".toc", "#toc", ".vector-toc", ".vector-toc-landmark", ".mw-jump-link", ".noprint", ".printfooter", ".catlinks", ".thumbcaption", ".infobox-caption",
  ".navigation-not-searchable", ".mw-empty-elt", ".sistersitebox", ".side-box", ".navbar", ".authority-control", ".mw-authority-control", ".portal", "[role=note]", ".cs1-visible-error",
].join(",");

/** Cookie banners, share bars, related-story lists and similar. Removed only when small (a real article wrapper that happens to match is kept). */
const BOILERPLATE_SMALL =
  "[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i],[class*=gdpr i],[id*=onetrust i],[class*=onetrust i],[class*=cc-window i]," +
  "[class*=share i],[class*=social i],[class*=breadcrumb i],[class*=newsletter i],[class*=subscribe i],[class*=related i],[class*=recommended i],[class*=up-next i],[class*=more-from i]," +
  "[class*=advert i],[class*=sponsor i],[class*=comments i],[id*=comments i],[class*=sidebar i]";
const SMALL_LIMIT = 1500; // characters

/** Section headings at the end of an article whose whole section is dropped. */
const TAIL_HEADINGS = /^(references|notes|footnotes|citations|further reading|external links|see also|bibliography|sources|works cited|explanatory notes)\b/i;

export const MIN_BLOCK_CHARS = 20;
export const MAX_BLOCK_CHARS = 1200;

const textOf = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();

/** Choose the element that holds the main content: the Wikipedia content area, else the largest article/main, else body. */
export function pickMainRoot(doc) {
  const wiki = doc.querySelector("#mw-content-text");
  if (wiki && textOf(wiki).length > 400) return wiki;
  let best = null, bestLen = 0;
  for (const c of doc.querySelectorAll("article, main, [role=main]")) {
    const len = textOf(c).length;
    if (len > bestLen) { best = c; bestLen = len; }
  }
  return bestLen > 400 ? best : doc.body;
}

function removeAll(root, selector, guard) {
  let list;
  try { list = [...root.querySelectorAll(selector)]; } catch { return; }
  for (const el of list) {
    if (el === root || !el.isConnected && !root.contains(el)) continue;
    if (guard && !guard(el)) continue;
    el.remove();
  }
}

/** Drop "References", "External links" ... and everything that follows them up to the next ordinary section. */
function removeTailSections(root) {
  const heads = [...root.querySelectorAll("h2, h3")].filter((h) => TAIL_HEADINGS.test(textOf(h).replace(/\[edit\]$/i, "").trim()));
  for (const h of heads) {
    if (!root.contains(h)) continue; // already removed with an earlier section
    const wrap = h.closest(".mw-heading") && root.contains(h.closest(".mw-heading")) ? h.closest(".mw-heading") : h;
    let sib = wrap.nextElementSibling;
    while (sib) {
      const head = sib.matches?.("h1,h2,h3,.mw-heading") ? sib : sib.querySelector?.("h2,h3");
      if (head && !TAIL_HEADINGS.test(textOf(head).replace(/\[edit\]$/i, "").trim())) break;
      const next = sib.nextElementSibling;
      sib.remove();
      sib = next;
    }
    wrap.remove();
  }
}

/** Split an over-long block at sentence boundaries into pieces of at most `max` characters. */
export function splitLong(text, max = MAX_BLOCK_CHARS) {
  if (text.length <= max) return [text];
  const sentences = text.split(/(?<=[.!?]["”’')\]]?)\s+(?=["“‘(\[]?[A-Z0-9])/);
  const out = [];
  let cur = "";
  for (let s of sentences) {
    while (s.length > max) { // a single run-on sentence: cut at a space
      const cut = s.lastIndexOf(" ", max);
      const at = cut > max * 0.5 ? cut : max;
      if (cur) { out.push(cur); cur = ""; }
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (cur && cur.length + 1 + s.length > max) { out.push(cur); cur = s; }
    else cur = cur ? cur + " " + s : s;
  }
  if (cur) out.push(cur);
  return out.filter(Boolean);
}

/** Keep real sentences and drop menu-like fragments (short, no digit, no sentence punctuation). */
const FOOTER_BLOCK = /^(?:top of page\s*)?(?:copyright|©|all rights reserved)/i;
const keepBlock = (t) => !FOOTER_BLOCK.test(t) && (t.length >= 40 || (t.length >= MIN_BLOCK_CHARS && /[.!?:;0-9]/.test(t)));

/**
 * Hand-wrapped HTML (2001 table-and-font pages) puts a newline inside a paragraph every 60 characters. buildIndex keeps node text as
 * is and the block splitter breaks at every newline, so one sentence became several fragments, short fragments were dropped as menu
 * junk and a quote spanning two source lines could never be copied. In HTML a newline in a text node is just a space, so turn every
 * whitespace run (outside pre) into one space before reading. Works on the clone only.
 */
function collapseSourceWhitespace(host) {
  const w = host.ownerDocument.createTreeWalker(host, 4 /* SHOW_TEXT */);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.parentElement && n.parentElement.closest("pre,textarea")) continue;
    n.nodeValue = n.nodeValue.replace(/[ \t\r\n\f]+/g, " ");
  }
  // A short bold lead-in ("respect", "our markets") that opens a paragraph is a label, not part of the first sentence: give it its own
  // line, where the short-fragment filter drops it, so quotes start at the real sentence.
  for (const b of host.querySelectorAll("b,strong")) {
    const t = (b.textContent || "").trim();
    if (!t || t.length > 40 || /[.!?:;]$/.test(t) || b.closest("pre,a")) continue;
    if (!/^\p{Ll}/u.test(t) || t.split(/\s+/).length > 4) continue; // lower-case lead-ins only: a capitalised bold name ("Sam Bankman-Fried (born ...)") is the subject, not a label
    const before = b.previousSibling;
    if (before && before.nodeType === 3 && before.nodeValue.trim()) continue; // mid-sentence bold
    const tw = host.ownerDocument.createTreeWalker(b, 4);
    let last = null;
    for (let n = tw.nextNode(); n; n = tw.nextNode()) last = n;
    if (last) last.nodeValue += "\n";
  }
}

/**
 * Extract the main content of a page as ordered text blocks (paragraphs, list items, quotes).
 * doc: a Document. Returns {blocks, rootTag, rawChars, chars}. rawChars is the visible text of the whole body before extraction.
 */
export function extractMainBlocks(doc, opts = {}) {
  const { useArticleRoot = true, clean = true } = opts;
  const body = doc.body;
  const rawChars = buildIndex(body).text.length;
  // T2998: Wikipedia keeps its own rule; every other page first looks for the ARTICLE BODY (articleBody, the <article> with the real H1, JSON-LD to locate it, the densest text block)
  const wiki = doc.querySelector("#mw-content-text");
  const picked = !useArticleRoot || (wiki && textOf(wiki).length > 400) ? null : pickArticleRoot(doc);
  const root = picked ? picked.root : pickMainRoot(doc);
  const rootKind = picked ? picked.kind : "legacy";
  const clone = root.cloneNode(true);
  const hidden = dropInvisible(root, clone); // only rendered, visible text is analysed
  const host = doc.createElement("div"); // keeps `closest()` and sibling walks working for a detached clone
  host.append(clone);
  removeAll(host, ALWAYS_REMOVE, (el) => !(el.tagName === "NOSCRIPT" && el.firstElementChild));   // T3002: a <noscript> with real elements (page scripts off) is drawn: keep it
  removeAll(host, WIKI_REMOVE);
  removeTailSections(host);
  removeAll(host, BOILERPLATE_SMALL, (el) => textOf(el).length < SMALL_LIMIT && !el.querySelector("article, main, h1"));
  const furniture = clean ? cleanArticle(host, !!picked) : {};   // inside a confirmed article the full list; elsewhere only tickers and ad slots // tickers, promos, related and headline lists, ads, the Wayback toolbar
  collapseSourceWhitespace(host);
  const { text } = buildIndex(host);
  const blocks = [];
  let prev = "";
  for (const raw of text.split("\n")) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!keepBlock(t) || t === prev) continue;
    prev = t;
    for (const piece of splitLong(t)) blocks.push(piece);
  }
  // T2998: text OUTSIDE the chosen root (a ticker line, a promo, a story on another subject) is never read at all. coherenceGuard() (article-root.js) is kept as a tested helper for a root
  // that could only be guessed; it is NOT applied by default because on a correct root it cut real numbered quotes of an interview.
  const out = blocks;
  const guarded = 0;
  return { blocks: out, rootTag: root.tagName, rootKind, rawChars, chars: out.reduce((n, b) => n + b.length + 1, 0), hiddenDropped: hidden, furniture, guarded };
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Index of the block that contains the viewport anchor text (the text under the middle of the screen), or -1. */
export function findAnchorIndex(blocks, anchorText) {
  const a = norm(anchorText).slice(0, 60);
  if (a.length < 12) return -1;
  for (let i = 0; i < blocks.length; i++) if (norm(blocks[i]).includes(a)) return i;
  const head = a.slice(0, 30);
  for (let i = 0; i < blocks.length; i++) if (norm(blocks[i]).includes(head)) return i;
  return -1;
}

const LEAD_CHARS = 1500;

/**
 * Pick the next input window.
 *  - blocks: output of extractMainBlocks; budget: characters; covered: Set of block indices already analysed;
 *    anchorIdx: block under the viewport centre (or -1/null when unknown or at the top).
 *  - First window: from the top (the lead) when the viewport is near the top; when the user has scrolled further down, the lead plus a
 *    stretch centred on the viewport. Later windows ("Analyze more"): the next not yet covered blocks in document order.
 * Returns {indices, text, chars, remaining} where remaining is the number of characters not yet covered after this window.
 */
export function pickWindow(blocks, { budget = 6000, covered = new Set(), anchorIdx = -1 } = {}) {
  const len = (i) => blocks[i].length + 1;
  const picked = new Set();
  let used = 0;
  const take = (i) => {
    if (i < 0 || i >= blocks.length || picked.has(i) || covered.has(i)) return false;
    if (used + len(i) > budget && used > 0) return false;
    picked.add(i);
    used += len(i);
    return true;
  };
  const free = blocks.map((_, i) => i).filter((i) => !covered.has(i));
  if (covered.size === 0 && anchorIdx >= 0) {
    let before = 0;
    for (let i = 0; i < anchorIdx; i++) before += len(i);
    if (before > budget * 0.6) {
      // Scrolled: the lead first, then outwards from the viewport block.
      let lead = 0;
      for (let i = 0; i < blocks.length && lead < LEAD_CHARS; i++) { if (!take(i)) break; lead += len(i); }
      let lo = anchorIdx, hi = anchorIdx;
      take(anchorIdx);
      for (;;) {
        let moved = false;
        while (hi + 1 < blocks.length && picked.has(hi + 1)) hi++;
        if (hi + 1 < blocks.length && take(hi + 1)) { hi++; moved = true; }
        while (lo - 1 >= 0 && picked.has(lo - 1)) lo--;
        if (lo - 1 >= 0 && take(lo - 1)) { lo--; moved = true; }
        if (!moved) break;
      }
    }
  }
  if (picked.size === 0) for (const i of free) if (!take(i)) break;
  const indices = [...picked].sort((x, y) => x - y);
  const remaining = blocks.reduce((n, b, i) => n + (covered.has(i) || picked.has(i) ? 0 : b.length + 1), 0);
  return { indices, text: indices.map((i) => blocks[i]).join("\n"), chars: used, remaining };
}

/** Sentence split used for chunking: after . ! ? (and a closing quote or bracket) followed by a capital letter, digit or opening quote. */
const SENTENCE_BREAK = /(?<=[.!?]["”’')\]]?)(?<!\b(?:[A-Z]|v|vs|Mr|Mrs|Ms|Dr|St|Inc|Ltd|Jr|Sr|No|U\.S|Corp|Co)\.)\s+(?=["“‘(\[]?[A-Z0-9])/;

/**
 * Pack blocks into chunks of about `target` characters. A chunk always ends at a sentence boundary (paragraph breaks are kept as line
 * breaks inside it), so no sentence is ever cut in half and a quote is always found whole inside one chunk.
 */
export function chunkBlocks(blocks, target = 1500) {
  const chunks = [];
  let cur = "";
  for (const b of blocks) {
    const sentences = b.length <= 200 ? [b] : b.split(SENTENCE_BREAK);
    sentences.forEach((sen, k) => {
      const sep = !cur ? "" : k === 0 ? "\n" : " ";
      if (cur && cur.length + sep.length + sen.length > target) { chunks.push(cur); cur = sen; }
      else cur += sep + sen;
    });
  }
  if (cur) chunks.push(cur);
  // A tiny tail chunk is not worth a model call of its own: fold it into the previous one.
  if (chunks.length > 1 && chunks[chunks.length - 1].length < 300 && chunks[chunks.length - 2].length + chunks[chunks.length - 1].length < target * 1.25) {
    chunks.splice(chunks.length - 2, 2, chunks[chunks.length - 2] + "\n" + chunks[chunks.length - 1]);
  }
  return chunks;
}
