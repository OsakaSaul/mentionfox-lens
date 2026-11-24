import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { detect, profiledSubjects, extraordinaryTest } from "../src/shared/redflags.js";

let JSDOM = null;
try { ({ JSDOM } = await import("jsdom")); } catch { /* the fixture test is skipped without jsdom */ }
const { extractMainBlocks } = await import("../src/shared/extract.js");
const articleDoc = () => new JSDOM(fs.readFileSync(new URL("../fixtures/demo/holmes-fortune-2014-wayback-20141231-unwrapped.html", import.meta.url), "utf8")).window.document;
const sig = (flags, signal) => flags.filter((x) => x.signal === signal);

test("T3002: the Fortune 2014 article read as the extension reads it: every juicy line is red, with the PUBLISHER (fortune) as the site", { skip: !JSDOM }, () => {
  const doc = articleDoc();
  const text = extractMainBlocks(doc).blocks.join("\n");
  const { flags } = detect(text, { company: "fortune", title: doc.title });
  const ext = sig(flags, "extraordinary_claim").map((x) => x.quote);
  assert.ok(ext.some((q) => /^Theranos can run as many as 70 tests/.test(q)), "caption: " + JSON.stringify(ext));
  assert.ok(ext.some((q) => /^It currently offers more than 200/.test(q)), "200 tests: " + JSON.stringify(ext));
  assert.ok(ext.some((q) => /performed as many as 70 different tests from a single draw/.test(q)), "70 tests, single draw");
  assert.ok(sig(flags, "secrecy").some((x) => /trade secret/.test(x.quote)));
  const ev = sig(flags, "evasive_answer").map((x) => x.quote);
  assert.equal(ev.filter((q) => /same fundamental chemical methods/.test(q)).length, 2, "both 'same fundamental chemical methods' lines (incl. 'peer-review ... unnecessary and inappropriate')");
  assert.ok(ev.some((q) => /unnecessary and inappropriate/.test(q)));
  assert.ok(flags.length <= 8, "not a wall of flags: " + flags.length);
});

test("T3002: an ordinary reported fact is not a red flag, and journalist puffery stays amber", { skip: !JSDOM }, () => {
  const doc = articleDoc();
  const text = extractMainBlocks(doc).blocks.join("\n");
  const { flags } = detect(text, { company: "fortune", title: doc.title });
  assert.ok(!flags.some((x) => /has 500 employees/.test(x.quote)), "500 employees / $400 million is a plain reported fact");
  assert.ok(!flags.some((x) => /262,000-square-foot/.test(x.quote)));
  assert.equal(detect("Theranos will be the leading name in diagnostics, a really big idea that is revolutionary.\nTheranos has 500 employees.", { company: "fortune" }).flags.length, 0);
});

test("T3002: the profiled subject is read from the article, never from the publisher", () => {
  const t = ("Theranos opened a lab. Holmes said Theranos grows. ").repeat(10) + "Fortune ran the story. ".repeat(20);
  const s = profiledSubjects(t, { company: "fortune" });
  assert.ok(s.includes("Theranos") && s.includes("Holmes") && !s.includes("Fortune"), JSON.stringify(s));
});

test("T3002: a capability about the profiled subject counts as the company's claim only with an extraordinary cue and no evidence", () => {
  const ctx = { subjects: ["Theranos"], neighbours: "" };
  const big = "Theranos can run as many as 70 tests on a sample this size, obtained by pricking a finger.";
  assert.equal(extraordinaryTest(big, ctx).fires, true);
  assert.equal(extraordinaryTest(big, { company: "fortune" }).benefits, false, "without a known subject the journalist's voice does not count (old behaviour)");
  assert.equal(extraordinaryTest("Theranos offers a basic metabolic panel for four dollars.", ctx).fires, false, "no extraordinary cue");
  assert.equal(extraordinaryTest(big, { ...ctx, neighbours: "The method was validated in a peer-reviewed study.", neighbourList: ["The method was validated in a peer-reviewed study."] }).fires, false, "evidence present");
  // evidence the text says is WITHHELD is not evidence present
  const withheld = ["Holmes counters that peer-review publication of validation studies is both unnecessary and inappropriate."];
  assert.equal(extraordinaryTest(big, { ...ctx, neighbours: withheld[0], neighbourList: withheld }).fires, true, "declined peer review is absence");
  // "independent lab prices" is not validation evidence
  const prices = ["Its prices are a quarter of independent lab prices."];
  assert.equal(extraordinaryTest(big, { ...ctx, neighbours: prices[0], neighbourList: prices }).fires, true);
});
