// Content script, injected on demand (activeTab + chrome.scripting) when the user clicks Analyze.
// It reads the visible text of the current tab and highlights claim quotes in place.
// It never sends anything anywhere: results only go back to the side panel through chrome.runtime messaging.
import { buildIndex } from "./shared/match.js";
import { Highlighter } from "./shared/highlight.js";

(() => {
  if (window.__mflLoaded) return;
  window.__mflLoaded = true;

  const hl = new Highlighter(document, window);
  let observer = null;
  let repairTimer = null;

  function pickRoot() {
    const candidates = [...document.querySelectorAll("article, main, [role=main]")];
    let best = null, bestLen = 0;
    for (const c of candidates) {
      const len = (c.innerText || "").length;
      if (len > bestLen) { best = c; bestLen = len; }
    }
    return bestLen > 400 ? best : document.body;
  }

  function extract() {
    const root = pickRoot();
    const index = buildIndex(root);
    const text = index.text.replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    return { title: document.title || "", url: location.href, text, textLength: text.length, rootTag: root.tagName };
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
