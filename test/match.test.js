import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { buildIndex, findQuote, segmentsForRange, normalizeWithMap } from "../src/shared/match.js";
import { Highlighter } from "../src/shared/highlight.js";

const fixture = (name) => new JSDOM(readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8"));
const textOf = (r) => r.segs && r.text;

test("normalizeWithMap collapses whitespace and maps back to original offsets", () => {
  const { norm, map } = normalizeWithMap("a  \n b c");
  assert.equal(norm, "a b c");
  assert.equal(map[2], 5);
});

test("findQuote: exact, whitespace, case, curly quote and dash tolerant", () => {
  const t = "Our robots pick  \n   up to 1,200 items per hour. It’s a “big” claim – really.";
  const a = findQuote(t, "pick up to 1,200 items per hour");
  assert.equal(t.slice(a.start, a.end), "pick  \n   up to 1,200 items per hour");
  const b = findQuote(t, "IT'S A \"BIG\" CLAIM - REALLY");
  assert.ok(b);
  assert.equal(findQuote(t, "never said this anywhere on the page"), null);
  assert.equal(findQuote(t, "abc"), null, "too short to match safely");
});

test("findQuote: falls back to no-space and head/tail anchors", () => {
  const t = "Founded in Austin, Texas in 2019 by Maria Lopez and Tom Reed, the company grew quickly across many regions.";
  assert.equal(findQuote(t, "Foundedin Austin,Texas in 2019").method, "nospace");
  const long = "Founded in Austin, Texas in 2019 by Maria Lopez and Tom Reed, the company has grown quickly across many regions.";
  const hit = findQuote(t, long); // model changed words in the middle
  assert.ok(hit && hit.method === "anchors");
});

const CASES = [
  ["linkedin-profile", "grew Northwind Analytics from $2M to $18M ARR between 2021 and 2024", "$2M"],
  ["linkedin-profile", "6 years at Stripe on the Billing team", "Stripe"],
  ["x-post", "just closed a $12M Series A led by Accel", "$12M Series A"],
  ["x-post", "world's leading platform for ops teams", "leading platform"],
  ["company-site", "pick up to 1,200 items per hour with 99.7% accuracy", "1,200"],
  ["company-site", "SOC 2 Type II certified since March 2023", "SOC 2"],
  ["company-site", "Our \"innovative\" approach is second to none.", "innovative"],
  ["news-article", "raised $40 million in a Series B round led by Northgate Capital", "$40 million"],
  ["news-article", "\"more than €2 billion\" in transactions a year", "billion"],
];

for (const [name, quote, needle] of CASES) {
  test(`fixture ${name}: finds "${quote.slice(0, 40)}..." and wraps exactly that text`, () => {
    const dom = fixture(name);
    const doc = dom.window.document;
    const idx = buildIndex(doc.body);
    const hit = findQuote(idx.text, quote);
    assert.ok(hit, "quote found in index");
    assert.ok(!idx.text.includes("Hidden panel text") && !/var x =|window\.ads/.test(idx.text), "hidden and script text excluded");
    const hl = new Highlighter(doc, dom.window);
    const r = hl.apply({ id: "c1", quote, kind: "specific", why: "" });
    assert.equal(r.found, true);
    assert.equal(r.method, "wrap");
    const marks = [...doc.querySelectorAll("mark.mfl-hl[data-mfl-id=c1]")];
    assert.ok(marks.length >= 1);
    const wrapped = marks.map((m) => m.textContent).join("");
    assert.ok(wrapped.includes(needle), `wrapped text "${wrapped}" contains ${needle}`);
    // The visible text of the page must be unchanged by wrapping.
    const before = buildIndex(fixture(name).window.document.body).text.replace(/\s+/g, "");
    const after = buildIndex(doc.body).text.replace(/\s+/g, "");
    assert.equal(after, before);
    hl.clear();
    assert.equal(doc.querySelectorAll("mark.mfl-hl").length, 0, "clear removes marks");
    assert.equal(buildIndex(doc.body).text.replace(/\s+/g, ""), before, "clear restores text");
  });
}

test("a claim spanning several inline elements is wrapped piecewise (X layout)", () => {
  const dom = fixture("x-post");
  const doc = dom.window.document;
  const hl = new Highlighter(doc, dom.window);
  const r = hl.apply({ id: "c1", quote: "Thrilled to announce that @Lumen just closed a $12M Series A", kind: "specific", why: "" });
  assert.equal(r.found, true);
  assert.ok(doc.querySelectorAll("mark[data-mfl-id=c1]").length >= 3);
});

test("missing quote reports found:false and changes nothing", () => {
  const dom = fixture("company-site");
  const doc = dom.window.document;
  const before = doc.body.innerHTML;
  const hl = new Highlighter(doc, dom.window);
  const r = hl.apply({ id: "c9", quote: "We have offices on the Moon and Mars", kind: "vague", why: "" });
  assert.deepEqual([r.found, r.method], [false, null]);
  assert.equal(doc.body.innerHTML, before);
});

test("re-render recovery: marks removed by the page are re-applied on repair/jump", () => {
  const dom = fixture("linkedin-profile");
  const doc = dom.window.document;
  doc.defaultView.HTMLElement.prototype.scrollIntoView = () => {};
  const hl = new Highlighter(doc, dom.window);
  const claim = { id: "c1", quote: "led a team of 14", kind: "specific", why: "" };
  hl.apply(claim);
  const section = doc.querySelector("main section:nth-of-type(2)");
  section.innerHTML = section.innerHTML; // simulate a framework re-render: replaces nodes, marks go stale
  const stale = [...hl.records.get("c1").marks];
  assert.ok(stale.some((m) => !m.isConnected), "old marks detached");
  assert.equal(hl.isBroken("c1"), true);
  assert.equal(hl.repair(), 1);
  assert.equal(hl.isBroken("c1"), false);
  assert.ok(doc.querySelector("mark[data-mfl-id=c1]"));
});

test("fallback to the CSS Custom Highlight API when wrapping fails", () => {
  const dom = fixture("company-site");
  const win = dom.window;
  const doc = win.document;
  const store = new Map();
  win.CSS = { highlights: store };
  win.Highlight = class { constructor() { this.s = new Set(); } add(r) { this.s.add(r); } delete(r) { this.s.delete(r); } };
  // Force wrapping to fail: make splitText throw (a page that guards its text nodes).
  win.Text.prototype.splitText = () => { throw new Error("blocked"); };
  const hl = new Highlighter(doc, win);
  const r = hl.apply({ id: "c1", quote: "Founded in Austin, Texas in 2019", kind: "specific", why: "" });
  assert.equal(r.found, true);
  assert.equal(r.method, "highlight-api");
  assert.equal(store.get("mfl-specific").s.size, 1);
  assert.equal(doc.querySelectorAll("mark").length, 0, "no DOM mutation in fallback");
  win.scrollBy = () => {};
  win.Range.prototype.getBoundingClientRect = () => ({ top: 100 });
  assert.equal(hl.jump("c1").method, "highlight-api");
  hl.clear();
  assert.equal(store.has("mfl-specific"), false);
});

test("segmentsForRange covers partial first and last nodes", () => {
  const dom = new JSDOM("<body><p>Hello <b>big</b> world</p></body>");
  const idx = buildIndex(dom.window.document.body);
  const hit = findQuote(idx.text, "lo big wor");
  const segs = segmentsForRange(idx, hit.start, hit.end);
  assert.deepEqual(segs.map((s) => s.node.nodeValue.slice(s.from, s.to)), ["lo ", "big", " wor"]);
});
