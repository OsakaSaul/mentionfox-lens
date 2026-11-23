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

const QUOTES = /[‘’‛′]/;
const DQUOTES = /[“”‟″]/;
const DASHES = /[‐-―−]/;

/** Normalise a char for matching. Returns "" for chars that are dropped. */
function normChar(c) {
  if (QUOTES.test(c)) return "'";
  if (DQUOTES.test(c)) return '"';
  if (DASHES.test(c)) return "-";
  if (c === "​" || c === "﻿") return "";
  if (c === " ") return " ";
  return c.toLowerCase();
}

/** Normalise text; returns {norm, map} where map[i] is the original index of norm[i]. */
export function normalizeWithMap(text, { dropSpaces = false } = {}) {
  let norm = "";
  const map = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    let c = normChar(text[i]);
    if (c === "") continue;
    if (/\s/.test(c)) {
      if (dropSpaces || lastSpace) continue;
      norm += " ";
      map.push(i);
      lastSpace = true;
      continue;
    }
    lastSpace = false;
    norm += c;
    map.push(i);
  }
  if (norm.endsWith(" ")) { norm = norm.slice(0, -1); map.pop(); }
  return { norm, map };
}

/**
 * Find a claim quote in indexed text. Whitespace, case, curly quotes and dash variants are tolerated.
 * Strategy: exact normalised match, then match with all spaces removed, then head and tail anchors.
 * Returns {start, end, method} in index.text coordinates, or null.
 */
export function findQuote(indexText, quote) {
  const q = String(quote ?? "").trim().replace(/^["'“‘]+|["'”’.]+$/g, "");
  if (q.length < 6) return null;
  const a = normalizeWithMap(indexText);
  const qa = normalizeWithMap(q).norm;
  let i = qa ? a.norm.indexOf(qa) : -1;
  if (i >= 0) return { start: a.map[i], end: a.map[i + qa.length - 1] + 1, method: "exact" };

  const b = normalizeWithMap(indexText, { dropSpaces: true });
  const qb = normalizeWithMap(q, { dropSpaces: true }).norm;
  i = qb ? b.norm.indexOf(qb) : -1;
  if (i >= 0) return { start: b.map[i], end: b.map[i + qb.length - 1] + 1, method: "nospace" };

  // Model slightly altered the middle: anchor on head and tail (each 24+ chars) within a sane distance.
  if (qb.length >= 60) {
    const n = 24;
    const head = qb.slice(0, n), tail = qb.slice(-n);
    const h = b.norm.indexOf(head);
    if (h >= 0) {
      const t = b.norm.indexOf(tail, h + n);
      if (t >= 0 && t + n - h <= qb.length * 1.5) {
        return { start: b.map[h], end: b.map[t + n - 1] + 1, method: "anchors" };
      }
    }
  }
  return null;
}

/** Slice a [start,end) range of index.text into per-text-node pieces: [{node, from, to}]. */
export function segmentsForRange(index, start, end) {
  const out = [];
  for (const s of index.segs) {
    if (s.end <= start) continue;
    if (s.start >= end) break;
    const from = Math.max(start, s.start) - s.start;
    const to = Math.min(end, s.end) - s.start;
    if (to > from) out.push({ node: s.node, from, to });
  }
  return out;
}
