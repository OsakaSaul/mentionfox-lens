// T2960: tiered matching (footnotes, name expansion, paraphrase), the anchor override and safe truncation.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { buildIndex, findQuote, stripMarkers, segmentsForRange, normalizeWithMap } from "../src/shared/match.js";
import { Highlighter } from "../src/shared/highlight.js";
import { findAnchor, findSubjectiveWord, reconcileKind } from "../src/shared/anchors.js";
import { normalizeClaims, safeSlice, reasonIsComplete } from "../src/shared/parse.js";
import { buildClaimsPrompt } from "../src/shared/prompts.js";

const load = (name) => new JSDOM(readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8"));

/* ---------- normalisation ---------- */
test("stripMarkers removes [n], [n][m], [a], [note 1], [citation needed] but keeps real brackets", () => {
  assert.equal(stripMarkers("born in 1992.[1][15][16] Next"), "born in 1992. Next");
  assert.equal(stripMarkers("x[a] y[note 1] z[Citation needed] w[12, 14] v[3-5]"), "x y z w v");
  assert.equal(stripMarkers("He said [we will win] loudly"), "He said [we will win] loudly");
});

test("normalizeWithMap: NBSP, zero-width, soft hyphen, curly quotes, dashes, case", () => {
  const raw = "The “Fox”​  is­ a well–known— animal−ish";
  const { norm } = normalizeWithMap(raw);
  assert.equal(norm, 'the "fox" is a well-known- animal-ish');
});

test("exact tier: footnote markers in the quote or the page do not matter", () => {
  const page = "Sam was born in 1992.[1][15] He studied physics.[a] Later he left.";
  const h1 = findQuote(page, "Sam was born in 1992.[1][15][16]");
  assert.equal(h1.method, "exact");
  assert.equal(page.slice(h1.start, h1.end), "Sam was born in 1992");
  const h2 = findQuote(page, "He studied physics. Later he left.");
  assert.equal(h2.method, "exact", "marker between sentences is ignored");
});

test("NBSP, curly quotes and dashes in the page match straight ones in the quote", () => {
  const page = "The firm’s “best-in-class” score—up 40 % – is real.";
  const h = findQuote(page, `The firm's "best-in-class" score-up 40 % - is real`);
  assert.ok(h);
  assert.equal(h.method, "exact");
});

/* ---------- fuzzy tiers ---------- */
test("run tier: 'Samuel Benjamin' vs 'Sam' still matches, and the whole sentence is the range", () => {
  const page = "Intro line here.\nSamuel Benjamin Bankman-Fried was born on March 5, 1992, to upper-class Jewish parents in Stanford, California.[1] He grew up there.";
  const h = findQuote(page, "Sam Bankman-Fried was born on March 5, 1992, to upper-class Jewish parents in Stanford, California.[1][15][16]");
  assert.equal(h.method, "run");
  assert.ok(h.score > 0.85);
  assert.equal(page.slice(h.start, h.end), "Samuel Benjamin Bankman-Fried was born on March 5, 1992, to upper-class Jewish parents in Stanford, California");
});

test("window tier: a paraphrase with fewer than 8 tokens in a row still matches by overlap", () => {
  const page = "Padding sentence one. Both of his parents were sued by the new owners of FTX, to return assets Sam had given the couple in the form of cash and a home valued at over $32 million. Tail sentence.";
  const q = "Bankman-Fried was sued by the new owners of FTX, to return assets Sam had given the couple";
  const h = findQuote(page, q);
  assert.ok(h, "paraphrase found");
  assert.ok(["run", "window"].includes(h.method));
  assert.match(page.slice(h.start, h.end), /^Both of his parents were sued by the new owners of FTX/);
});

test("window tier: unrelated text is NOT matched (no false positives)", () => {
  const page = "The company sells garden furniture across Europe and ships within five days. Customers can return items for thirty days.";
  assert.equal(findQuote(page, "Bankman-Fried was sued by the new owners of FTX to return assets"), null);
  assert.equal(findQuote(page, "The firm sells office chairs across Asia and ships within two weeks"), null);
});

test("window tier: reordered quote with 80% of its words in one sentence", () => {
  const page = "Revenue grew 40 percent in 2023 to reach 12 million dollars, driven by enterprise customers in Europe.";
  const h = findQuote(page, "Enterprise customers in Europe drove revenue growth of 40 percent in 2023 to 12 million dollars");
  assert.ok(h && h.method === "window");
});

/* ---------- fixtures: the owner's two examples on the real page ---------- */
const OWNER_1 = "Rowan Ashcombe was born on March 5, 1992, to upper-class Danish parents in Marlow, Oregon.[1][15][16]";
const OWNER_2 = "Ashcombe was sued by the new owners of Quillex, to return assets Rowan had given the couple in the form of cash and a home valued at over $32 million.";

for (const [label, quote, expectStart] of [
  ["footnotes + full name", OWNER_1, "Rowan Elias Ashcombe was born on March 5, 1992"],
  ["paraphrase", OWNER_2, "Both of his parents were sued by the new owners of Quillex"],
]) {
  test(`encyclopedia fixture, owner example (${label}): matched, highlighted and jumpable through ONE matcher`, () => {
    const dom = load("made-up/encyclopedia-rowan");
    const doc = dom.window.document;
    const idx = buildIndex(doc.body);
    const hit = findQuote(idx.text, quote);
    assert.ok(hit, "found");
    assert.ok(hit.tier >= 3, `tier reported: ${hit.method}`);
    assert.ok(idx.text.slice(hit.start, hit.end).startsWith(expectStart));
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    const hl = new Highlighter(doc, dom.window);
    const claim = { id: "c1", quote, kind: "specific", why: "" };
    const r = hl.apply(claim);
    assert.equal(r.found, true);
    assert.equal(r.tier, hit.method, "highlight reports the same tier as the matcher");
    const marks = [...doc.querySelectorAll("mark.mfl-hl")];
    assert.ok(marks.length >= 1);
    assert.ok(marks.every((m) => !m.closest("sup.reference")), "footnote links are never wrapped");
    assert.ok(marks[0].textContent.startsWith(expectStart.slice(0, 20)));
    assert.equal(doc.querySelectorAll("sup.reference").length > 5, true, "footnote markup intact");
    // jump uses the same record, even when asked before any explicit highlight
    const hl2 = new Highlighter(doc, dom.window);
    hl2.claims.set("c1", claim);
    assert.equal(hl2.jump("c1").ok, true);
  });
}

test("encyclopedia fixture: highlight wraps text around a footnote sup without breaking the DOM", () => {
  const dom = load("made-up/encyclopedia-rowan");
  const doc = dom.window.document;
  const before = doc.body.textContent;
  const idx = buildIndex(doc.body);
  // a quote that spans a footnote marker in the middle of two sentences
  const hit = findQuote(idx.text, "Rowan Elias Ashcombe was born on March 5, 1992");
  assert.ok(hit);
  const hl = new Highlighter(doc, dom.window);
  assert.equal(hl.apply({ id: "c9", quote: "Rowan Elias Ashcombe was born on March 5, 1992, to upper-class Danish parents in Marlow, Oregon.[1]", kind: "vague", why: "" }).found, true);
  hl.clear();
  assert.equal(doc.body.textContent, before, "clear() restores the exact text");
});

test("segmentsForRange skips marker text inside a range", () => {
  const dom = new JSDOM('<p>Born in 1992.<sup class="reference"><a><span>[</span>1<span>]</span></a></sup> He left.</p>');
  const doc = dom.window.document;
  const idx = buildIndex(doc.body);
  const hit = findQuote(idx.text, "Born in 1992. He left.");
  const segs = segmentsForRange(idx, hit.start, hit.end);
  assert.ok(segs.length >= 2);
  assert.ok(segs.every((s) => !/^[\[\]1]$/.test(s.node.nodeValue.slice(s.from, s.to))));
});

test("every claim-sized sentence from the short encyclopedia fixture matches exactly (sanity: matcher is not blind)", () => {
  const dom = load("made-up/encyclopedia-priya");
  const idx = buildIndex(dom.window.document.body);
  const sentences = idx.text.split(/(?<=\.)\s+/).filter((x) => x.length > 40 && x.length < 250);
  assert.ok(sentences.length >= 5);
  for (const sn of sentences) assert.ok(findQuote(idx.text, sn), sn.slice(0, 60));
});

/* ---------- anchors ---------- */
test("findAnchor: dates, numbers, amounts, named places and organisations", () => {
  assert.equal(findAnchor("born on March 5, 1992").type, "date");
  assert.equal(findAnchor("raised $40 million last year").type, "amount");
  assert.equal(findAnchor("grew 40% a year").type, "amount");
  assert.equal(findAnchor("serves 1,200 customers").type, "number");
  assert.equal(findAnchor("he moved to Stanford, California").type, "name");
  assert.equal(findAnchor("investors at Accel liked it").type, "name");
  assert.equal(findAnchor("Northgate Capital backed the round").type, "name");
  assert.equal(findAnchor("sued by the owners of FTX").text, "FTX");
});

test("findAnchor: puffery has no anchor", () => {
  for (const t of [
    "a visionary leader",
    "widely respected in the industry",
    "Our platform is the best in class and trusted by everyone",
    "We are passionate about delivering world-class experiences",
    "The best, most innovative solution on the market",
    "Our Leading Platform Delivers Amazing Results",
    "He is a Brilliant Thinker",
    "the #1 choice for teams",
    "Trusted by American businesses",
    "Our CEO is a genius",
  ]) assert.equal(findAnchor(t), null, t);
});

test("reconcileKind: 'upper-class' + date + place stays specific, with the subjective note", () => {
  const c = reconcileKind({ id: "c1", quote: OWNER_1.replace(/\[.*$/, ""), kind: "vague", why: "The adjectives" });
  assert.equal(c.kind, "specific");
  assert.equal(c.note, "contains a subjective word: upper-class");
  assert.match(c.why, /date/);
  assert.ok(reasonIsComplete(c.why));
});

test("reconcileKind: a model 'specific' stays specific and gets the note; no anchor stays vague", () => {
  const s = reconcileKind({ id: "c1", quote: "Born on March 5, 1992 to wealthy parents", kind: "specific", why: "Has a date." });
  assert.equal(s.kind, "specific");
  assert.equal(s.note, "contains a subjective word: wealthy");
  const v = reconcileKind({ id: "c2", quote: "He is a visionary leader, widely respected", kind: "vague", why: "Nothing to check." });
  assert.equal(v.kind, "vague");
  assert.equal(v.note, undefined);
  assert.equal(v.why, "Nothing to check.");
});

test("findSubjectiveWord: whole words only", () => {
  assert.equal(findSubjectiveWord("upper-class Jewish parents"), "upper-class");
  assert.equal(findSubjectiveWord("the bestowed honour"), null);
  assert.equal(findSubjectiveWord("a plain sentence"), null);
});

test("normalizeClaims applies the override and strips markers from quotes", () => {
  const [c] = normalizeClaims({ claims: [{ quote: OWNER_1, kind: "vague", why: "The adjectives 'upper-class' describe the parents' status" }] });
  assert.equal(c.kind, "specific");
  assert.ok(!/\[\d+\]/.test(c.quote));
  assert.equal(c.note, "contains a subjective word: upper-class");
});

test("normalizeClaims keeps the optional summary and stays backwards compatible without it", () => {
  const a = normalizeClaims({ claims: [{ quote: "He was born in 1992 in Stanford.", kind: "specific", why: "Names a year and a place.", summary: "He was born in Stanford in 1992." }] });
  assert.equal(a[0].summary, "He was born in Stanford in 1992.");
  const b = normalizeClaims({ claims: [{ quote: "He was born in 1992 in Stanford.", kind: "specific", why: "Names a year and a place." }] });
  assert.equal("summary" in b[0], false);
});

/* ---------- truncation ---------- */
test("safeSlice: word boundary with ellipsis, never splits a surrogate pair", () => {
  assert.equal(safeSlice("short", 20, { words: true }), "short");
  const t = "The founder explained the funding round in great detail to reporters";
  const cut = safeSlice(t, 30, { words: true });
  assert.ok(cut.length <= 30);
  assert.ok(cut.endsWith("…"));
  assert.ok(t.startsWith(cut.slice(0, -1)));
  assert.match(cut.slice(0, -1), /\w$/, "ends on a whole word");
  const emoji = "ab😀cd";
  assert.equal(safeSlice(emoji, 3), "ab", "high surrogate not left dangling");
  assert.equal(safeSlice(emoji, 4), "ab😀");
});

test("a cut-off reason is never shown: replaced by a complete sentence", () => {
  assert.equal(reasonIsComplete("The adjectives"), false);
  assert.equal(reasonIsComplete("Names a date and a place a reader can check."), true);
  const [c] = normalizeClaims({ claims: [{ quote: "He is a visionary leader and widely respected.", kind: "vague", why: "The adjectives" }] });
  assert.ok(reasonIsComplete(c.why), c.why);
  const long = "Names a date and a place " + "and many other things that go on for a very long time ".repeat(8) + "so it is cut.";
  const [d] = normalizeClaims({ claims: [{ quote: "Born in 1992 in Stanford, California.", kind: "specific", why: long }] });
  assert.ok(d.why.length <= 220 && d.why.endsWith("…"));
});

/* ---------- prompt ---------- */
test("claims prompt: verbatim rule, anchor rule, complete-reason rule; page footnote markers removed", () => {
  const p = buildClaimsPrompt("Sam was born in 1992.[1][15] Next [citation needed] line.");
  assert.match(p, /EXACT VERBATIM/);
  assert.match(p, /never write "Sam"/);
  assert.match(p, /checkable anchor/);
  assert.match(p, /ONLY when the claim has NO checkable anchor/);
  assert.match(p, /at most 20 words/);
  assert.ok(!/\[15\]|\[citation needed\]/.test(p.split("<<<PAGE")[1]));
  assert.doesNotMatch(p, /gemini|nano|flash/i, "no model names in the prompt");
});
