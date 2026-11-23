// In-place highlighting. Primary: wrap the exact text range in <mark class="mfl-hl"> (text-node splitting).
// Fallback: CSS Custom Highlight API (no DOM mutation, safe for frameworks that own the DOM such as React).
import { buildIndex, findQuote, segmentsForRange } from "./match.js";

const COLORS = { specific: "#34D399", vague: "#F5C542" };

function styleMark(el, kind) {
  // CSSOM writes stay allowed under strict page CSP, unlike style attributes parsed from markup.
  el.style.backgroundColor = kind === "vague" ? "rgba(245,197,66,0.38)" : "rgba(52,211,153,0.32)";
  el.style.boxShadow = `0 0 0 2px ${kind === "vague" ? "rgba(245,197,66,0.38)" : "rgba(52,211,153,0.32)"}`;
  el.style.borderRadius = "3px";
  el.style.color = "inherit";
  el.style.borderBottom = `2px solid ${COLORS[kind]}`;
}

function wrapSegment(doc, seg, claim) {
  let node = seg.node;
  if (!node.isConnected) throw new Error("detached text node");
  if (seg.to < node.nodeValue.length) node.splitText(seg.to);
  if (seg.from > 0) node = node.splitText(seg.from);
  const mark = doc.createElement("mark");
  mark.className = `mfl-hl mfl-${claim.kind}`;
  mark.setAttribute("data-mfl-id", claim.id);
  styleMark(mark, claim.kind);
  node.parentNode.insertBefore(mark, node);
  mark.appendChild(node);
  return mark;
}

const hasHighlightApi = (win) => !!(win.CSS && win.CSS.highlights && typeof win.Highlight === "function");

/**
 * Highlighter keeps one record per claim: {marks[], range, method}.
 * highlight(claim) re-finds the quote in the current DOM each time, so it is safe to call again after the page re-renders.
 */
export class Highlighter {
  constructor(doc = document, win = doc.defaultView) {
    this.doc = doc;
    this.win = win;
    this.records = new Map();
    this.claims = new Map();
  }

  /** Apply (or re-apply) a claim. Returns {id, found, method, tier}. method: wrap | highlight-api | null; tier: which matcher tier hit. */
  apply(claim) {
    this.claims.set(claim.id, claim);
    this.removeOne(claim.id);
    const root = this.doc.body;
    const index = buildIndex(root);
    const hit = findQuote(index.text, claim.quote);
    if (!hit) return { id: claim.id, found: false, method: null };
    const segs = segmentsForRange(index, hit.start, hit.end);
    if (!segs.length) return { id: claim.id, found: false, method: null };

    // Build a Range for the fallback and for scrolling before the DOM is changed.
    const range = this.doc.createRange();
    range.setStart(segs[0].node, segs[0].from);
    range.setEnd(segs[segs.length - 1].node, segs[segs.length - 1].to);

    const marks = [];
    try {
      // Reverse order: splitting a node never shifts earlier nodes.
      for (const seg of [...segs].reverse()) marks.unshift(wrapSegment(this.doc, seg, claim));
      this.records.set(claim.id, { marks, method: "wrap", range: null });
      return { id: claim.id, found: true, method: "wrap", tier: hit.method };
    } catch (err) {
      for (const m of marks) this.unwrap(m);
      if (hasHighlightApi(this.win)) {
        try {
          const r = this.doc.createRange();
          r.setStart(segs[0].node, segs[0].from);
          r.setEnd(segs[segs.length - 1].node, segs[segs.length - 1].to);
          this.addApiHighlight(claim, r);
          this.records.set(claim.id, { marks: [], method: "highlight-api", range: r });
          return { id: claim.id, found: true, method: "highlight-api", tier: hit.method };
        } catch { /* fall through */ }
      }
      return { id: claim.id, found: false, method: null };
    }
  }

  addApiHighlight(claim, range) {
    const name = `mfl-${claim.kind}`;
    const reg = this.win.CSS.highlights;
    let h = reg.get(name);
    if (!h) { h = new this.win.Highlight(); reg.set(name, h); }
    h.add(range);
  }

  unwrap(mark) {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize?.();
  }

  removeOne(id) {
    const rec = this.records.get(id);
    if (!rec) return;
    for (const m of rec.marks) if (m.isConnected) this.unwrap(m);
    if (rec.range && hasHighlightApi(this.win)) {
      for (const h of this.win.CSS.highlights.values()) h.delete(rec.range);
    }
    this.records.delete(id);
  }

  clear() {
    for (const id of [...this.records.keys()]) this.removeOne(id);
    this.claims.clear();
    if (hasHighlightApi(this.win)) {
      this.win.CSS.highlights.delete("mfl-specific");
      this.win.CSS.highlights.delete("mfl-vague");
      this.win.CSS.highlights.delete("mfl-flash");
    }
  }

  /** True when a wrapped claim lost its marks (page re-rendered). */
  isBroken(id) {
    const rec = this.records.get(id);
    if (!rec || rec.method !== "wrap") return false;
    return rec.marks.some((m) => !m.isConnected);
  }

  /** Re-apply any claim whose marks disappeared. Returns number repaired. */
  repair() {
    let n = 0;
    for (const id of [...this.records.keys()]) {
      if (this.isBroken(id)) { this.apply(this.claims.get(id)); n++; }
    }
    return n;
  }

  /** Scroll to the claim and flash it. Returns {ok, method}. */
  jump(id) {
    // Same matcher as the highlight (apply -> findQuote): jump can only fail when the highlight itself has no match.
    if ((this.isBroken(id) || !this.records.has(id)) && this.claims.get(id)) this.apply(this.claims.get(id));
    const rec = this.records.get(id);
    if (!rec) return { ok: false, method: null };
    if (rec.method === "wrap") {
      const first = rec.marks[0];
      first.scrollIntoView({ block: "center", behavior: "smooth" });
      for (const m of rec.marks) {
        m.classList.remove("mfl-flash");
        void m.offsetWidth; // restart the animation
        m.classList.add("mfl-flash");
        this.win.setTimeout(() => m.classList.remove("mfl-flash"), 1800);
      }
      return { ok: true, method: "wrap" };
    }
    const rect = rec.range.getBoundingClientRect();
    this.win.scrollBy({ top: rect.top - this.win.innerHeight / 2, behavior: "smooth" });
    if (hasHighlightApi(this.win)) {
      const reg = this.win.CSS.highlights;
      let f = reg.get("mfl-flash");
      if (!f) { f = new this.win.Highlight(); reg.set("mfl-flash", f); }
      f.add(rec.range);
      this.win.setTimeout(() => f.delete(rec.range), 1800);
    }
    return { ok: true, method: "highlight-api" };
  }
}
