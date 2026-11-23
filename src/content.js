// Content script, injected on demand (activeTab + chrome.scripting) when the user clicks Analyze.
// It reads the visible text of the current tab and highlights claim quotes in place.
// It never sends anything anywhere: results only go back to the side panel through chrome.runtime messaging.
import { Highlighter } from "./shared/highlight.js";
import { extractMainBlocks } from "./shared/extract.js";

(() => {
  if (window.__mflLoaded) return;
  window.__mflLoaded = true;

  const hl = new Highlighter(document, window);
  let observer = null;
  let repairTimer = null;

  /** Text of the paragraph under the middle of the screen (empty when the page is at the top), so Lens can start where the reader is. */
  function viewportAnchor() {
    if ((window.scrollY || 0) < 300) return "";
    for (const f of [0.4, 0.55, 0.3, 0.7]) {
      let el = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight * f));
      for (let i = 0; el && i < 6; i++, el = el.parentElement) {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t.length >= 40 && t.length <= 2500) return t.slice(0, 120);
      }
    }
    return "";
  }

  /** Main content only (no nav, infobox, references, table of contents ...), as ordered text blocks; see shared/extract.js. */
  function extract() {
    const ex = extractMainBlocks(document);
    return { title: document.title || "", url: location.href, blocks: ex.blocks, anchorText: viewportAnchor(), textLength: ex.chars, rawChars: ex.rawChars, rootTag: ex.rootTag };
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      clearTimeout(repairTimer);
      repairTimer = setTimeout(() => {
        observer.disconnect();
        try { hl.repair(); } finally { observer.observe(document.body, { childList: true, subtree: true }); }
      }, 800);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target !== "lens-content") return;
    try {
      if (msg.type === "extract") sendResponse({ ok: true, page: extract() });
      else if (msg.type === "highlight") {
        hl.clear();
        const results = (msg.claims || []).map((c) => hl.apply(c));
        startObserver();
        sendResponse({ ok: true, results });
      } else if (msg.type === "highlightAdd") {
        // One entry point (Highlighter.apply -> findQuote), applied card by card as the claims stream in. Nothing is cleared.
        const results = (msg.claims || []).map((c) => hl.apply(c));
        startObserver();
        sendResponse({ ok: true, results });
      } else if (msg.type === "jump") sendResponse(hl.jump(msg.id));
      else if (msg.type === "clear") {
        hl.clear();
        observer?.disconnect();
        observer = null;
        sendResponse({ ok: true });
      } else sendResponse({ ok: false, error: "unknown message" });
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    }
    return false;
  });
})();
