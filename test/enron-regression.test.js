// T2982: Enron "Vision and values" (2001, table-and-font HTML) gave 2 claims, both green. Extraction, chunk window, on-device prompt and the
// reconcile rule are all covered here, through the same code path the on-device run uses, with a mock in place of the model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { extractMainBlocks, pickWindow, chunkBlocks } from "../src/shared/extract.js";
import { DEVICE_WINDOW_CHARS, DEVICE_CHUNK_CHARS, DEVICE_SYSTEM } from "../src/shared/prompts.js";
import { runChunkedClaims } from "../src/shared/chunked.js";
import { normalizeClaims } from "../src/shared/parse.js";
import { reconcileDecision, setSelfNames, deriveSelfNames } from "../src/shared/anchors.js";
import { debugReset, debugSnapshot } from "../src/shared/debug.js";
import { mockDeviceModel } from "./helpers/mock-device.js";

const ENRON_URL = "https://web.archive.org/web/20010124060900/http://www4.calderon.example:80/corp/inside/vision/";
const doc = () => new JSDOM(readFileSync(new URL("./fixtures/made-up/calderon-vision.html", import.meta.url), "utf8")).window.document;

const AMBER_LINES = [
  "That's why we hire only the most talented people we can find.",
  "Together we're building the most forward-looking energy company anywhere.",
  "We believe in the lasting good sense of free and open markets.",
];

test("extract: hand-wrapped table-and-font HTML keeps whole sentences, drops labels and the footer", () => {
  const ex = extractMainBlocks(doc());
  assert.ok(ex.chars > 2200, "chars " + ex.chars);
  for (const q of AMBER_LINES) assert.ok(ex.blocks.some((b) => b.includes(q)), "whole sentence in one block: " + q);
  assert.ok(!ex.blocks.some((b) => /copyright/i.test(b)), "footer dropped");
  assert.ok(!ex.blocks.some((b) => /^(respect|integrity|our markets|innovation)\s/.test(b)), "bold labels are not glued to the first sentence");
  assert.ok(!ex.blocks.some((b) => /^[a-z]/.test(b) && !/^(our|this|it|we)\b/i.test(b)), "no block starts mid-sentence");
});

test("deriveSelfNames: finds the company in a web.archive.org address and in the title", () => {
  const n = deriveSelfNames({ title: "Calderon: Vision and values -- What we believe", url: ENRON_URL });
  assert.ok(n.includes("calderon"), JSON.stringify(n));
  assert.ok(!n.includes("archive") && !n.includes("web"));
});

test("reconcile: puffery stays amber, with or without the company name known, whatever the model said", () => {
  for (const names of [true, false]) {
    setSelfNames(names ? deriveSelfNames({ title: "Calderon: Vision and values", url: ENRON_URL }) : []);
    for (const q of AMBER_LINES) for (const kind of ["vague", "specific"]) {
      const r = reconcileDecision({ id: "c1", quote: q, kind, why: "x" });
      assert.equal(r.claim.kind, "vague", `${names} ${kind}: ${q} -> ${r.decision.reason}`);
      assert.equal(r.decision.before, kind);
      assert.equal(r.decision.after, "vague");
    }
  }
});

test("reconcile: puffery that names its own company is not anchored by the company name", () => {
  setSelfNames(deriveSelfNames({ title: "Calderon: Vision and values", url: ENRON_URL }));
  for (const q of ["Calderon is a workshop for new ideas.", "Calderon Corp. is the leading energy company in the world.", "We work with customers in a long-term partnership with Calderon."]) {
    const r = reconcileDecision({ id: "c1", quote: q, kind: "specific", why: "x" });
    assert.equal(r.claim.kind, "vague", q + " -> " + r.decision.reason);
  }
  setSelfNames([]);
});

test("reconcile: do not over-correct, true factual sentences stay green", () => {
  setSelfNames(deriveSelfNames({ title: "Calderon: Vision and values", url: ENRON_URL }));
  for (const q of [
    "Calderon was founded in 1986 through the merger of Redmont Gas and NorthPipe.",
    "The company reported revenues of $100.8 billion in 2000.",
    "In 2003, Calderon filed for bankruptcy in New York.",
    "Rowan Elias Ashcombe was born on March 5, 1992, in Marlow, Oregon.",
  ]) {
    const r = reconcileDecision({ id: "c1", quote: q, kind: "specific", why: "x" });
    assert.equal(r.claim.kind, "specific", q + " -> " + r.decision.reason);
  }
  const flip = reconcileDecision({ id: "c1", quote: "The company reported revenues of $100.8 billion in 2000.", kind: "vague", why: "x" });
  assert.equal(flip.claim.kind, "specific");
  setSelfNames([]);
});

test("pipeline: extract -> chunk -> prompt -> parse -> reconcile on the values page lists the page, and the amber lines stay amber", async () => {
  setSelfNames(deriveSelfNames({ title: "Calderon: Vision and values", url: ENRON_URL }));
  const ex = extractMainBlocks(doc());
  const win = pickWindow(ex.blocks, { budget: DEVICE_WINDOW_CHARS });
  assert.equal(win.remaining, 0, "the whole values text is inside the on-device window");
  const chunks = chunkBlocks(win.indices.map((i) => ex.blocks[i]), DEVICE_CHUNK_CHARS);
  assert.ok(chunks.length >= 2);
  const claims = [];
  const raws = [];
  debugReset({ version: "test", mode: "on-device" });
  await runChunkedClaims({ chunks, claims, now: () => 0, streamChunk: async (c) => { const text = mockDeviceModel(c, "plausible", DEVICE_SYSTEM); raws.push(text); return { text, source: "on_device" }; } });
  assert.ok(claims.length >= 15, "claims " + claims.length);
  for (const q of AMBER_LINES) {
    const c = claims.find((x) => x.quote === q);
    assert.ok(c, "listed: " + q);
    assert.equal(c.kind, "vague", q);
  }
  const dbg = debugSnapshot();
  assert.equal(dbg.chunks.length, chunks.length);
  assert.equal(dbg.rawPerChunk.length, chunks.length);
  assert.ok(dbg.decisions.length >= claims.length);
  assert.ok(dbg.decisions.every((d) => d.sentence && d.before && d.after && d.reason));
  setSelfNames([]);
});

test("device prompt asks for every claim and for labelled puffery, and names the anchor rule", () => {
  assert.match(DEVICE_SYSTEM, /EVERY claim/);
  assert.match(DEVICE_SYSTEM, /vague/);
  assert.match(DEVICE_SYSTEM, /company talking about itself does not count/);
});

test("debug snapshot holds no keys or config", () => {
  debugReset({ version: "0.1.2", mode: "cloud", url: "https://example.com/" });
  normalizeClaims({ claims: [{ quote: "We believe in the lasting good sense of free and open markets.", kind: "specific", why: "x" }] });
  const s = JSON.stringify(debugSnapshot());
  assert.doesNotMatch(s, /apiKey|token|secret|appId/i);
  assert.deepEqual(Object.keys(debugSnapshot()).sort(), ["chunks", "decisions", "extractedChars", "mode", "notes", "rawPerChunk", "url", "version", "windowChars"]);
});
