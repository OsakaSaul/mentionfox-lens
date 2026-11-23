// Per-stage counts for a fixture through the on-device code path (extract -> window -> chunk -> prompt -> parse -> reconcile),
// with a mock standing in for the on-device model (test/helpers/mock-device.js).
//   node scripts/stage-counts.mjs <fixture.html> [--src=<dir holding shared/>] [--url=<page address>] [--mode=terse|plausible] [--list]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const arg = (k, d) => (process.argv.find((a) => a.startsWith("--" + k + "=")) || "").slice(k.length + 3) || d;
const file = process.argv[2];
const src = pathToFileURL(resolve(arg("src", "src")) + "/").href;
const imp = (p) => import(src + p);
const { extractMainBlocks, pickWindow, chunkBlocks } = await imp("shared/extract.js");
const { DEVICE_WINDOW_CHARS, DEVICE_CHUNK_CHARS, DEVICE_SYSTEM } = await imp("shared/prompts.js");
const { runChunkedClaims } = await imp("shared/chunked.js");
const anchors = await imp("shared/anchors.js");
const { mockDeviceModel } = await import("../test/helpers/mock-device.js");

const doc = new JSDOM(readFileSync(file, "utf8")).window.document;
if (anchors.setSelfNames) anchors.setSelfNames(anchors.deriveSelfNames({ title: doc.title, url: arg("url", "") }));
const ex = extractMainBlocks(doc);
const win = pickWindow(ex.blocks, { budget: DEVICE_WINDOW_CHARS });
const chunks = chunkBlocks(win.indices.map((i) => ex.blocks[i]), DEVICE_CHUNK_CHARS);
const claims = [];
let rawCount = 0;
const run = await runChunkedClaims({
  chunks, claims, now: () => 0,
  streamChunk: async (c) => { const text = mockDeviceModel(c, arg("mode", "plausible"), DEVICE_SYSTEM); rawCount += JSON.parse(text).claims.length; return { text, source: "on_device" }; },
});
console.log(JSON.stringify({ file, rawChars: ex.rawChars, extractedChars: ex.chars, blocks: ex.blocks.length, windowChars: win.chars, chunks: chunks.length, rawClaimsFromModel: rawCount, afterParseAndReconcile: claims.length, green: claims.filter((c) => c.kind === "specific").length, amber: claims.filter((c) => c.kind === "vague").length, failedChunks: run.failed }));
if (process.argv.includes("--list")) for (const c of claims) console.log(c.kind === "vague" ? "AMBER" : "GREEN", c.quote);
