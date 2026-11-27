import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let JSDOM = null;
try { ({ JSDOM } = await import("jsdom")); } catch { /* skipped without jsdom */ }
const { extractMainBlocks } = await import("../src/shared/extract.js");
const { buildDeepCards, buildDeepPrompt, DEEP_PAGE_CHARS } = await import("../src/shared/deep.js");
const { pickCards, cardSummary, isAttributionFragment, MAX_GREEN_SHOWN } = await import("../src/shared/quality.js");
const { normalizeClaims } = await import("../src/shared/parse.js");

const html = readFileSync(new URL("./fixtures/made-up/harbor-archived-plain.html", import.meta.url), "utf8");
const RECORDED = readFileSync(new URL("./fixtures/deep-answer.json", import.meta.url), "utf8");   // hand-written in the shape the cloud model returns, about the made-up article
const LINES = {
  a: "tests can be performed on just a few drops of blood, or about 1/100th to 1/1,000th",
  b: "performed as many as 70 different tests from a single draw of 25 to 50 microliters",
  c: "Its prices are often a half to a quarter of what independent labs charge",
  d: "Precisely how Veridrop accomplishes all of this is a trade secret",
};
const blocks = () => extractMainBlocks(new JSDOM(html).window.document).blocks;
const find = (cards, frag) => cards.find((c) => c.quote.includes(frag));

test("T3003 Deep scan path, a saved answer: (a) (b) (d) are red flags, (c) is not", { skip: !JSDOM }, () => {
  const cards = buildDeepCards(RECORDED, blocks(), { title: "This founder wants your blood" });
  for (const k of ["a", "b", "d"]) assert.equal(find(cards, LINES[k])?.kind, "redflag", k);
  assert.equal(find(cards, LINES.d).signal, "secrecy");
  assert.notEqual(find(cards, LINES.c)?.kind, "redflag", "price undercut: unsourced tag, not red");
  assert.ok(find(cards, LINES.c)?.unsourced, "price claim carries the unsourced tag");
  assert.ok(find(cards, "same fundamental chemical methods")?.kind === "redflag", "evasive line");
});

test("T3003 rule layer alone (empty cloud answer) still flags (a) (b) (d)", { skip: !JSDOM }, () => {
  const cards = buildDeepCards([], blocks(), { title: "This founder wants your blood" });
  for (const k of ["a", "b", "d"]) assert.equal(find(cards, LINES[k])?.kind, "redflag", k);
  assert.notEqual(find(cards, LINES.c)?.kind, "redflag");
});

test("T3003 order: red first, then vague, at most 2 green, the rest collapsed; summary line", { skip: !JSDOM }, () => {
  const cards = buildDeepCards(RECORDED, blocks(), {});
  const { shown, more } = pickCards(cards);
  const kinds = shown.map((c) => c.kind);
  const lastRed = kinds.lastIndexOf("redflag"), firstOther = kinds.findIndex((k) => k !== "redflag");
  assert.ok(lastRed < firstOther || firstOther === -1);
  assert.ok(kinds.filter((k) => k === "specific").length <= MAX_GREEN_SHOWN);
  assert.equal(shown.length + more.length, cards.length, "nothing dropped");
  assert.ok(more.every((c) => c.kind === "specific"));
  assert.match(cardSummary(cards), /^\d+ red flags? · \d+ specific/);
});

test("T3003 no fragment cards: attribution tags are dropped, a full claim is kept", () => {
  assert.ok(isAttributionFragment("Robertson told me in an interview"));
  assert.ok(isAttributionFragment("Robertson told me in an interview."));
  assert.ok(isAttributionFragment("Holmes said:"));
  assert.ok(!isAttributionFragment("Theranos can run as many as 70 tests on a sample this size, obtained by pricking a finger."));
  const out = normalizeClaims({ claims: [{ quote: "Robertson told me in an interview", kind: "vague", why: "No claim." }, { quote: "The company has 500 employees in Palo Alto.", kind: "specific", why: "Headcount can be checked." }] });
  assert.equal(out.length, 1);
});

test("T3003 merge duplicates; summary wording; the prompt takes the whole article", () => {
  const dup = [{ quote: "The company has 500 employees in Palo Alto.", kind: "specific", why: "x." }, { quote: "the company has 500 employees in palo alto", kind: "specific", why: "y." }];
  assert.equal(buildDeepCards(dup, ["The company has 500 employees in Palo Alto."], {}).length, 1);
  assert.equal(cardSummary([{ kind: "redflag" }, { kind: "redflag" }, { kind: "redflag" }, ...Array(6).fill({ kind: "specific" }), { kind: "vague" }]), "3 red flags · 6 specific · 1 vague");
  const long = "Sentence number one has a figure of 12 percent. ".repeat(900);   // ~43,000 characters
  assert.ok(buildDeepPrompt(long).length > 40000 && DEEP_PAGE_CHARS >= 60000);
});
