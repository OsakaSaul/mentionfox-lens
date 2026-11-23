import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { extractMainBlocks, pickWindow, chunkBlocks, findAnchorIndex, splitLong } from "../src/shared/extract.js";
import { buildIndex, findQuote } from "../src/shared/match.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (file) => new JSDOM(readFileSync(resolve(root, file), "utf8").replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")).window.document;
const joined = (ex) => ex.blocks.join("\n");

test("Wikipedia SBF: infobox, nav, language list, table of contents and tail sections are gone; the lead stays", () => {
  const doc = load("test/fixtures/wikipedia-sam-bankman-fried.html");
  const ex = extractMainBlocks(doc);
  const t = joined(ex);
  assert.match(ex.blocks[0], /^Samuel Benjamin Bankman-Fried \(born March 5, 1992\), commonly known as SBF, is an American entrepreneur/);
  for (const gone of ["Bankman-Fried in 2021", "Toggle the table of contents", "28 languages", "Afrikaans", "Edit links", "Jump to content", "From Wikipedia, the free encyclopedia", "American entrepreneur and fraudster (born 1992)"]) {
    assert.ok(!t.includes(gone), "should be gone: " + gone);
  }
  assert.ok(!/^(Notes|References|External links)$/m.test(t));
  assert.ok(ex.chars < ex.rawChars, "extraction is smaller than the raw body text");
  assert.ok(ex.blocks.length > 20);
});

test("Wikipedia Collison: the lead is kept, short fragments and menu lines are dropped", () => {
  const ex = extractMainBlocks(load("test/fixtures/wikipedia-patrick-collison.html"));
  assert.match(ex.blocks[0], /^Patrick Collison \(born 9 September 1988\) is an Irish entrepreneur/);
  assert.ok(ex.blocks.every((b) => b.length >= 20));
  assert.ok(ex.rawChars > ex.chars);
});

test("Theranos press release: the article is kept; the site menu and share bar are dropped", () => {
  const doc = load("fixtures/demo/theranos-1.html");
  const ex = extractMainBlocks(doc);
  const t = joined(ex);
  assert.match(t, /PALO ALTO, Cal\. \(July 2, 2015\)/);
  assert.match(t, /HSV-1 test costs \$9\.07/);
  assert.ok(ex.rawChars > ex.chars);
  const raw = buildIndex(doc.body).text;
  assert.ok(raw.length - ex.chars > 300, "some site furniture was removed");
});

const WIKI_SYNTH = `<!doctype html><html><body>
<nav>Home Pricing Login</nav>
<div id="mw-content-text"><div class="mw-parser-output">
<div class="hatnote">Not to be confused with Acme Industries.</div>
<table class="infobox"><tr><th>Founded</th><td>INFOBOX-FOUNDED-1999</td></tr></table>
<div id="toc" class="toc"><h2>Contents</h2><ul><li>TOC-ENTRY-History</li></ul></div>
<p>Acme Corp is an American company founded in 1999 in Austin, Texas.<sup class="reference">[1]</sup> It makes anvils for roadrunner hunters worldwide.</p>
<div class="mw-heading mw-heading2"><h2 id="History">History</h2><span class="mw-editsection">[<a>edit-link-text</a>]</span></div>
<p>In 2005 the company opened a factory in Phoenix, Arizona, which employed 400 people at its peak.</p>
<div class="navbox">NAVBOX-TEXT-Related-companies</div>
<div class="mw-heading mw-heading2"><h2 id="References">References</h2></div>
<ol class="references"><li>REFERENCE-LIST-ITEM-Smith-2004 Anvils Monthly, page 12.</li></ol>
<div class="mw-heading mw-heading2"><h2 id="External_links">External links</h2></div>
<ul><li>EXTERNAL-LINK-ITEM Official website of Acme Corp</li></ul>
</div></div>
<footer>Footer legal text copyright Acme</footer>
</body></html>`;

test("synthetic Wikipedia page: references, footnotes, infobox, hatnote, navbox, toc, edit links, tail sections and nav are all dropped", () => {
  const ex = extractMainBlocks(new JSDOM(WIKI_SYNTH).window.document);
  const t = joined(ex);
  assert.match(t, /Acme Corp is an American company founded in 1999 in Austin, Texas\. It makes anvils/);
  assert.match(t, /In 2005 the company opened a factory in Phoenix, Arizona/);
  for (const gone of ["INFOBOX-FOUNDED", "TOC-ENTRY", "edit-link-text", "NAVBOX-TEXT", "REFERENCE-LIST-ITEM", "EXTERNAL-LINK-ITEM", "Not to be confused", "Home Pricing", "Footer legal", "[1]"]) {
    assert.ok(!t.includes(gone), "should be gone: " + gone);
  }
});

test("cookie banner and a share bar are dropped; a small related-stories list too; the article body stays", () => {
  const html = `<html><body><div id="cookie-banner">We use cookies to improve your experience on this site, accept all.</div>
  <article><h1>Orbit raises $40 million in a Series B round</h1>
  <div class="share-bar">Share on Facebook Twitter LinkedIn</div>
  <p>Orbit, a Lisbon-based payments startup, said on Thursday it raised $40 million in a Series B round led by Northgate Capital.</p>
  <p>The company was founded in 2020 and processes more than 2 billion euros in transactions a year, according to its chief executive.</p>
  <div class="related-stories"><h3>Related stories</h3><p>Another fintech raises $5 million in seed funding this week</p></div></article></body></html>`;
  const t = joined(extractMainBlocks(new JSDOM(html).window.document));
  assert.match(t, /said on Thursday it raised \$40 million/);
  assert.match(t, /founded in 2020/);
  for (const gone of ["We use cookies", "Share on Facebook", "Another fintech raises"]) assert.ok(!t.includes(gone), "should be gone: " + gone);
});

test("every extracted block can still be found on the live page by the shared matcher (quotes stay matchable)", () => {
  const doc = load("test/fixtures/wikipedia-patrick-collison.html");
  const ex = extractMainBlocks(doc);
  const index = buildIndex(doc.body);
  for (const b of ex.blocks.slice(0, 15)) assert.ok(findQuote(index.text, b.slice(0, 160)), "not found: " + b.slice(0, 60));
});

test("extraction does not touch the live document", () => {
  const doc = load("test/fixtures/wikipedia-sam-bankman-fried.html");
  const before = doc.body.innerHTML.length;
  extractMainBlocks(doc);
  assert.equal(doc.body.innerHTML.length, before);
});

test("extraction is deterministic", () => {
  const a = extractMainBlocks(load("test/fixtures/wikipedia-sam-bankman-fried.html"));
  const b = extractMainBlocks(load("test/fixtures/wikipedia-sam-bankman-fried.html"));
  assert.deepEqual(a.blocks, b.blocks);
});

test("small pages (company site, LinkedIn profile, X post, news) keep their text", () => {
  for (const [f, needle] of [["company-site", "99.7% accuracy"], ["linkedin-profile", "$2M to $18M ARR"], ["x-post", "$12M Series A"], ["news-article", "raised $40 million"]]) {
    const ex = extractMainBlocks(load(`test/fixtures/${f}.html`));
    assert.ok(joined(ex).includes(needle), f);
  }
});

test("splitLong cuts at sentence boundaries and never exceeds the limit", () => {
  const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} says something checkable about 20${10 + i}.`).join(" ");
  const parts = splitLong(text, 300);
  assert.ok(parts.length > 4);
  assert.ok(parts.every((p) => p.length <= 300 && /\.$/.test(p)));
  assert.equal(splitLong("short text", 300)[0], "short text");
});

const mk = (n, len = 400) => Array.from({ length: n }, (_, i) => `Block ${i} ` + "word ".repeat(Math.floor(len / 5)).trim() + ".");

test("pickWindow: first window starts at the lead and stays within the budget; the next window continues where it stopped", () => {
  const blocks = mk(40);
  const w1 = pickWindow(blocks, { budget: 6000 });
  assert.equal(w1.indices[0], 0);
  assert.ok(w1.chars <= 6000);
  assert.deepEqual(w1.indices, w1.indices.slice().sort((a, b) => a - b));
  assert.ok(w1.remaining > 0);
  const covered = new Set(w1.indices);
  const w2 = pickWindow(blocks, { budget: 6000, covered });
  assert.ok(w2.indices.every((i) => !covered.has(i)));
  assert.equal(w2.indices[0], Math.max(...w1.indices) + 1);
});

test("pickWindow: a scrolled reader gets the lead plus the viewport stretch", () => {
  const blocks = mk(60);
  const w = pickWindow(blocks, { budget: 6000, anchorIdx: 45 });
  assert.ok(w.indices.includes(0), "lead kept");
  assert.ok(w.indices.includes(45), "viewport block kept");
  assert.ok(w.indices.includes(44) && w.indices.includes(46), "centred on the viewport");
  assert.ok(w.chars <= 6000);
  assert.ok(!w.indices.includes(20), "the middle gap is not included");
});

test("pickWindow: an anchor near the top still starts at the lead", () => {
  const blocks = mk(60);
  const w = pickWindow(blocks, { budget: 6000, anchorIdx: 3 });
  assert.equal(w.indices[0], 0);
  assert.ok(w.indices.includes(3));
});

test("pickWindow: a huge single block is still taken when it is the only one; cloud budget takes more", () => {
  assert.equal(pickWindow(["x".repeat(5000)], { budget: 1000 }).indices.length, 1);
  const blocks = mk(60);
  assert.ok(pickWindow(blocks, { budget: 12000 }).chars > pickWindow(blocks, { budget: 6000 }).chars);
});

test("findAnchorIndex locates the block holding the viewport text", () => {
  const blocks = ["First paragraph about something else entirely here.", "The company opened a factory in Phoenix, Arizona, in 2005 and hired 400 people.", "Third."];
  assert.equal(findAnchorIndex(blocks, "The company opened a factory in Phoenix, Arizona, in 2005 and hired 400 people. Then more"), 1);
  assert.equal(findAnchorIndex(blocks, ""), -1);
  assert.equal(findAnchorIndex(blocks, "text that is nowhere on the page at all, honestly"), -1);
});

test("chunkBlocks: about 1,500 characters, cut only at sentence boundaries, nothing lost", () => {
  const doc = load("test/fixtures/wikipedia-sam-bankman-fried.html");
  const ex = extractMainBlocks(doc);
  const w = pickWindow(ex.blocks, { budget: 6000 });
  const blocks = w.indices.map((i) => ex.blocks[i]);
  const chunks = chunkBlocks(blocks, 1500);
  assert.ok(chunks.length >= 3 && chunks.length <= 6, "chunks: " + chunks.length);
  for (const c of chunks) {
    assert.ok(c.length <= 1900, "chunk size " + c.length);
    assert.match(c, /[.!?”"')\]]$/, "ends at a sentence end: " + c.slice(-40));
  }
  const squash = (x) => x.replace(/\s+/g, " ");
  assert.equal(squash(chunks.join(" ")), squash(blocks.join(" ")));
});
