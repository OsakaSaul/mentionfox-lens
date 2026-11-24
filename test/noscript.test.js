import { test } from "node:test";
import assert from "node:assert/strict";

let JSDOM = null;
try { ({ JSDOM } = await import("jsdom")); } catch { /* skipped without jsdom */ }
const { extractMainBlocks } = await import("../src/shared/extract.js");
const { noscriptArticle, isArchiveHost } = await import("../src/shared/noscript.js");
const { buildIndex } = await import("../src/shared/match.js");

const SENT = "The company has performed as many as 70 different tests from a single draw of blood.";
const paras = () => Array.from({ length: 14 }, (_, i) => `<p>${i === 3 ? SENT : "A paragraph of ordinary article text number " + i + " that says something plain about the subject and runs long enough to count."} It has some more words so that the block is clearly a paragraph of prose.</p>`).join("");
const ARTICLE = `<div id="content"><article><h1>This CEO's out for blood</h1>${paras()}</article></div>`;

// scripts OFF (Chrome's per-site setting): the <noscript> holds real elements; jsdom parses it that way by default
const scriptsOff = () => new JSDOM(`<!doctype html><html><head><title>This CEO's out for blood - Fortune</title></head><body><header>FORTUNE</header><noscript>${ARTICLE}</noscript><footer>c Time Inc</footer></body></html>`).window.document;
// scripts ON: the <noscript> holds ONE unparsed text node
function scriptsOn() {
  const win = new JSDOM(`<!doctype html><html><head><title>This CEO's out for blood - Fortune</title></head><body><header>FORTUNE</header><footer>c Time Inc</footer></body></html>`).window;
  const ns = win.document.createElement("noscript");
  ns.textContent = ARTICLE;   // one text node, as a scripts-on parser makes it
  win.document.body.insertBefore(ns, win.document.querySelector("footer"));
  return win.document;
}

test("T3002 scripts OFF: the article inside <noscript> is read, and its text is in the page index (so 'Show on page' can mark it)", { skip: !JSDOM }, () => {
  const doc = scriptsOff();
  const ex = extractMainBlocks(doc);
  assert.ok(ex.chars >= 500, "chars " + ex.chars);
  assert.ok(ex.blocks.some((b) => b.includes("performed as many as 70 different tests")));
  assert.ok(buildIndex(doc.body).text.includes("performed as many as 70 different tests"), "the highlighter's text index includes the noscript text");
});

test("T3002 scripts OFF: a body with only a <noscript> article (no <article> tag) is still read, not removed as noscript furniture", { skip: !JSDOM }, () => {
  const doc = new JSDOM(`<!doctype html><html><body><noscript><div>${paras()}</div></noscript></body></html>`).window.document;
  assert.ok(extractMainBlocks(doc).chars >= 500);
});

test("T3002 scripts ON: the unparsed <noscript> text is not in the page index and the normal extraction finds nothing", { skip: !JSDOM }, () => {
  const doc = scriptsOn();
  assert.ok(!buildIndex(doc.body).text.includes("performed as many as 70"), "unparsed noscript text is not page text");
  assert.ok(extractMainBlocks(doc).chars < 500);
});

test("T3002 fallback: on web.archive.org with an empty-looking page, the no-script copy is read", { skip: !JSDOM }, () => {
  const doc = scriptsOn();
  const seen = extractMainBlocks(doc);
  const alt = noscriptArticle(doc, extractMainBlocks, "web.archive.org", seen.chars);
  assert.ok(alt && alt.chars >= 500, JSON.stringify(alt && alt.chars));
  assert.ok(alt.blocks.some((b) => b.includes("performed as many as 70 different tests")));
});

test("T3002 fallback: never on another site, never when the page already shows an article, never when scripts are off", { skip: !JSDOM }, () => {
  const doc = scriptsOn();
  assert.equal(noscriptArticle(doc, extractMainBlocks, "fortune.com", 20), null, "another site");
  assert.equal(noscriptArticle(doc, extractMainBlocks, "web.archive.org", 900), null, "visible text is enough");
  const off = scriptsOff();
  assert.equal(noscriptArticle(off, extractMainBlocks, "web.archive.org", 20), null, "noscript has elements: already read normally");
  assert.ok(isArchiveHost("web.archive.org") && isArchiveHost("WEB.ARCHIVE.ORG") && !isArchiveHost("archive.org.evil.com") && !isArchiveHost("fortune.com"));
});

test("T3002 fallback: a short <noscript> (a tracking pixel) is not an article", { skip: !JSDOM }, () => {
  const win = new JSDOM(`<!doctype html><html><body><p>x</p></body></html>`).window;
  const ns = win.document.createElement("noscript");
  ns.textContent = '<img src="https://t.example/p.gif" width="1" height="1">';
  win.document.body.append(ns);
  assert.equal(noscriptArticle(win.document, extractMainBlocks, "web.archive.org", 5), null);
});
