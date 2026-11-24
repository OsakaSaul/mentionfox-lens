// Page text index and claim-to-range matching. Works on any DOM (browser or jsdom).

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "DD", "DIV", "DL", "DT", "FIGCAPTION", "FIGURE", "FOOTER", "FORM",
  "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TD", "TH", "TR", "UL",
]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "SVG", "CANVAS", "IFRAME", "TEMPLATE", "HEAD", "TITLE"]);

function blockAncestor(node, root) {
  for (let el = node.parentNode; el && el !== root; el = el.parentNode) {
    if (el.nodeType === 1 && BLOCK_TAGS.has(el.tagName)) return el;
  }
  return root;
}

function isHidden(el) {
  // aria-hidden is NOT visual hiding (LinkedIn puts its visible text inside aria-hidden spans), so it is not checked.
  if (el.hasAttribute?.("hidden")) return true;
  // Screen-reader-only duplicates of visible text (LinkedIn, X, many sites) would double every claim.
  if (el.classList && (el.classList.contains("visually-hidden") || el.classList.contains("sr-only"))) return true;
  const st = el.style;
  return !!st && (st.display === "none" || st.visibility === "hidden");
}

/**
 * Collect visible text nodes under root in document order.
 * Skips script/style, hidden subtrees and Lens's own nodes (data-mfl-ui).
 */
export function collectTextNodes(root, { includeMarks = true } = {}) {
  const doc = root.ownerDocument || root;
  const nodes = [];
  const walker = doc.createTreeWalker(root, 1 | 4 /* SHOW_ELEMENT | SHOW_TEXT */, {
    acceptNode(n) {
      if (n.nodeType === 1) {
        // T3002: with page scripts OFF (Chrome's per-site setting) a <noscript> holds real elements and is drawn: its text is visible and can be marked. With scripts ON its content is one unparsed text node: skipped.
        if (n.tagName.toUpperCase() === "NOSCRIPT" && n.firstElementChild) return 3;
        if (SKIP_TAGS.has(n.tagName.toUpperCase()) || n.hasAttribute("data-mfl-ui") || isHidden(n)) return 2; // REJECT subtree
        if (!includeMarks && n.classList?.contains("mfl-hl")) return 3; // SKIP element, keep children
        return 3; // SKIP (descend)
      }
      return n.nodeValue && n.nodeValue.trim() ? 1 : 3;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeType === 3) nodes.push(n);
  return nodes;
}

/**
 * Build an index: concatenated text with a virtual separator at block boundaries,
 * and the start offset of every text node inside that string.
 */
export function buildIndex(root) {
  const nodes = collectTextNodes(root);
  let text = "";
  const segs = [];
  let prevBlock = null;
  for (const node of nodes) {
    const blk = blockAncestor(node, root);
    if (prevBlock && blk !== prevBlock) text += "\n";
    segs.push({ node, start: text.length, end: text.length + node.nodeValue.length });
    text += node.nodeValue;
    prevBlock = blk;
  }
  return { text, segs };
}


const QUOTES = /[‘’‛′`´]/;
const DQUOTES = /[“”‟″«»„]/;
const DASHES = /[‐-―−﹘﹣－]/;
const INVISIBLE = /[­​-‍⁠﻿]/; // soft hyphen, zero-width space/joiners, word joiner, BOM

// Reference markers that sit inside running text: [1], [15][16], [a], [note 3], [citation needed] and friends.
const MARKER_RE = new RegExp(
  "\\[\\s*(?:\\d{1,4}(?:\\s*[,\\u2013\\u2014-]\\s*\\d{1,4})*|[a-z]{1,2}|(?:note|nb|n)\\s*\\d{1,3}|" +
    "citation needed|clarification needed|verification needed|better source needed|failed verification|dubious(?:\\s*[\\u2013\\u2014-]\\s*discuss)?|" +
    "when\\?|who\\?|where\\?|why\\?|how\\?|which\\?|according to whom\\?|by whom\\?|original research\\?|unreliable source\\?|vague|sic)\\s*\\]",
  "gi",
);

/** Boolean mask over text: 1 where a reference marker ([1], [citation needed], ...) sits. */
export function markerMask(text) {
  const mask = new Uint8Array(text.length);
  const re = new RegExp(MARKER_RE.source, "gi");
  for (let m = re.exec(text); m; m = re.exec(text)) mask.fill(1, m.index, m.index + m[0].length);
  return mask;
}

/** Remove reference markers from text (used on prompts and on displayed quotes). */
export function stripMarkers(text) {
  return String(text ?? "").replace(new RegExp(MARKER_RE.source, "gi"), "");
}

/** Normalise a char for matching. Returns "" for chars that are dropped. */
function normChar(c) {
  if (INVISIBLE.test(c)) return "";
  if (QUOTES.test(c)) return "'";
  if (DQUOTES.test(c)) return '"';
  if (DASHES.test(c)) return "-";
  if (c === "…") return "...";
  return c.toLowerCase();
}

/**
 * Normalise text; returns {norm, map} where map[i] is the original index of norm[i].
 * Dropped: reference markers, soft hyphens, zero-width chars. Collapsed: any whitespace run (NBSP and thin spaces included).
 * Unified: curly and straight quotes, every dash and minus. Case is ignored.
 */
export function normalizeWithMap(text, { dropSpaces = false } = {}) {
  const mask = markerMask(text);
  let norm = "";
  const map = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    if (mask[i]) continue;
    const c = normChar(text[i]);
    if (c === "") continue;
    if (/\s/.test(c)) {
      if (dropSpaces || lastSpace) continue;
      norm += " ";
      map.push(i);
      lastSpace = true;
      continue;
    }
    lastSpace = false;
    for (let k = 0; k < c.length; k++) { norm += c[k]; map.push(i); }
  }
  if (norm.endsWith(" ")) { norm = norm.slice(0, -1); map.pop(); }
  return { norm, map };
}

/** Word tokens of a normalised string with offsets into it: [{t, s, e}]. Hyphenated names split into parts on both sides alike. */
function tokenize(norm) {
  const out = [];
  const re = /[\p{L}\p{N}]+/gu;
  for (let m = re.exec(norm); m; m = re.exec(norm)) out.push({ t: m[0], s: m.index, e: m.index + m[0].length });
  return out;
}

const MIN_RUN = 8; // tokens in a row that must agree for the long-run tier
const MIN_OVERLAP = 0.8; // share of the claim's tokens found in the best sentence-sized window

/** Longest run of consecutive claim tokens that also appear consecutively in the page tokens. */
function longestCommonRun(pt, ct) {
  let best = { len: 0, pEnd: -1 };
  let prev = new Uint16Array(ct.length + 1);
  let cur = new Uint16Array(ct.length + 1);
  for (let i = 0; i < pt.length; i++) {
    cur.fill(0);
    for (let j = 0; j < ct.length; j++) {
      if (pt[i].t === ct[j].t) {
        cur[j + 1] = prev[j] + 1;
        if (cur[j + 1] > best.len) best = { len: cur[j + 1], pEnd: i };
      }
    }
    [prev, cur] = [cur, prev];
  }
  return best;
}

/** Best sentence-sized window by token overlap. Returns {from, to (inclusive token idx), recall} or null. */
function bestWindow(pt, ct) {
  const n = ct.length;
  const need = new Map();
  for (const c of ct) need.set(c.t, (need.get(c.t) || 0) + 1);
  let best = null;
  const widths = [...new Set([0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2].map((f) => Math.min(pt.length, Math.ceil(n * f))))].filter((w) => w >= 3);
  for (const w of widths) {
    const have = new Map();
    let hit = 0;
    const add = (t, d) => {
      const want = need.get(t);
      if (!want) return;
      const h = have.get(t) || 0;
      if (d > 0 && h < want) hit++;
      if (d < 0 && h <= want) hit--;
      have.set(t, h + d);
    };
    for (let i = 0; i < pt.length; i++) {
      add(pt[i].t, 1);
      if (i >= w) add(pt[i - w].t, -1);
      if (i >= w - 1) {
        const recall = hit / n;
        const dice = (2 * hit) / (n + w);
        if (recall >= MIN_OVERLAP && (!best || dice > best.dice)) best = { from: i - w + 1, to: i, recall, dice };
      }
    }
  }
  if (!best) return null;
  // Tighten to the first and last token that belongs to the claim.
  while (best.from < best.to && !need.has(pt[best.from].t)) best.from++;
  while (best.to > best.from && !need.has(pt[best.to].t)) best.to--;
  return best;
}

/** True when a sentence or block ends in the raw text between two tokens (reference markers ignored). */
function boundaryBetween(rawText, mask, aEnd, bStart) {
  let gap = "";
  for (let i = aEnd; i < bStart; i++) if (!mask[i]) gap += rawText[i];
  return /\n/.test(gap) || /[.!?]["'”’)\]]*\s/.test(gap);
}

/**
 * Find a claim quote in indexed text, in tiers. This is the ONE matcher: highlight, jump and the card state all come through here.
 *  exact    normalised text equal (whitespace, case, quotes, dashes, footnote markers ignored)
 *  nospace  equal when all spaces are ignored
 *  anchors  same head and tail (long quotes, middle reworded)
 *  run      at least 8 tokens in a row agree (a name was expanded or shortened, a word swapped)
 *  window   at least 80% of the quote's tokens sit in one sentence-sized window of the page (paraphrase)
 * Returns {start, end, method, tier (1..5), score} in index.text coordinates, or null.
 */
export function findQuote(indexText, quote) {
  const q = stripMarkers(String(quote ?? "")).trim().replace(/^["'“‘”’]+|["'”’.]+$/g, "");
  if (q.length < 6) return null;
  const a = normalizeWithMap(indexText);
  const qa = normalizeWithMap(q).norm;
  if (!qa) return null;
  let i = a.norm.indexOf(qa);
  if (i >= 0) return { start: a.map[i], end: a.map[i + qa.length - 1] + 1, method: "exact", tier: 1, score: 1 };

  const b = normalizeWithMap(indexText, { dropSpaces: true });
  const qb = normalizeWithMap(q, { dropSpaces: true }).norm;
  i = qb ? b.norm.indexOf(qb) : -1;
  if (i >= 0) return { start: b.map[i], end: b.map[i + qb.length - 1] + 1, method: "nospace", tier: 2, score: 1 };

  // Model slightly altered the middle: anchor on head and tail (each 24+ chars) within a sane distance.
  if (qb.length >= 60) {
    const n = 24;
    const head = qb.slice(0, n), tail = qb.slice(-n);
    const h = b.norm.indexOf(head);
    if (h >= 0) {
      const t = b.norm.indexOf(tail, h + n);
      if (t >= 0 && t + n - h <= qb.length * 1.5) {
        return { start: b.map[h], end: b.map[t + n - 1] + 1, method: "anchors", tier: 3, score: 0.95 };
      }
    }
  }

  // Fuzzy tiers work on word tokens.
  const pt = tokenize(a.norm), ct = tokenize(qa);
  if (ct.length < 3 || !pt.length) return null;
  const mask = markerMask(indexText);
  const origStart = (tok) => a.map[tok.s];
  const origEnd = (tok) => a.map[tok.e - 1] + 1;
  // Grow a token range to the sentence it sits in (bounded, so a long run-on never swallows the section).
  const toSentence = (from, to) => {
    const maxExtra = Math.max(4, Math.ceil(ct.length * 0.5));
    let f = from, t = to, k = 0;
    while (f > 0 && k < maxExtra && !boundaryBetween(indexText, mask, origEnd(pt[f - 1]), origStart(pt[f]))) { f--; k++; }
    k = 0;
    while (t < pt.length - 1 && k < maxExtra && !boundaryBetween(indexText, mask, origEnd(pt[t]), origStart(pt[t + 1]))) { t++; k++; }
    return [f, t];
  };

  const run = longestCommonRun(pt, ct);
  if (run.len >= Math.min(MIN_RUN, ct.length)) {
    const [f, t] = toSentence(run.pEnd - run.len + 1, run.pEnd);
    return { start: origStart(pt[f]), end: origEnd(pt[t]), method: "run", tier: 4, score: Math.min(1, run.len / ct.length) };
  }
  const win = bestWindow(pt, ct);
  if (win) {
    const [f, t] = toSentence(win.from, win.to);
    return { start: origStart(pt[f]), end: origEnd(pt[t]), method: "window", tier: 5, score: win.recall };
  }
  return null;
}

/**
 * Slice a [start,end) range of index.text into per-text-node pieces: [{node, from, to}].
 * Reference markers ([1], [citation needed]) inside the range are skipped, so the highlight wraps visible words only
 * and never the footnote links themselves; the text on each side of a marker is wrapped separately.
 */
export function segmentsForRange(index, start, end) {
  const out = [];
  if (!index.mask) index.mask = markerMask(index.text);
  const mask = index.mask;
  for (const s of index.segs) {
    if (s.end <= start) continue;
    if (s.start >= end) break;
    const lo = Math.max(start, s.start), hi = Math.min(end, s.end);
    let runStart = -1;
    for (let p = lo; p <= hi; p++) {
      const skip = p === hi || mask[p];
      if (!skip && runStart < 0) runStart = p;
      if (skip && runStart >= 0) {
        if (p > runStart) out.push({ node: s.node, from: runStart - s.start, to: p - s.start });
        runStart = -1;
      }
    }
  }
  return out;
}
