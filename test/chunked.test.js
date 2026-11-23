import test from "node:test";
import assert from "node:assert/strict";
import { runChunkedClaims, mergeClaims, progressText } from "../src/shared/chunked.js";
import { extractCompleteClaimObjects } from "../src/shared/parse.js";

const claimJson = (quote, kind = "specific") => JSON.stringify({ quote, kind, why: "A date, number or name a reader can check against a public source." });
const answer = (...quotes) => `{"claims":[${quotes.map((q) => claimJson(q)).join(",")}]}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("extractCompleteClaimObjects: only finished objects, in order, never throws", () => {
  const a = claimJson("Acme was founded in 2019 in Austin.");
  const b = claimJson("It raised $12 million in 2021.");
  assert.deepEqual(extractCompleteClaimObjects('{"claims":['), []);
  assert.deepEqual(extractCompleteClaimObjects(`{"claims":[${a.slice(0, 20)}`), []);
  assert.equal(extractCompleteClaimObjects(`{"claims":[${a},`).length, 1);
  assert.equal(extractCompleteClaimObjects(`{"claims":[${a},${b.slice(0, 30)}`).length, 1);
  const two = extractCompleteClaimObjects(`{"claims":[${a},${b}]}`);
  assert.equal(two.length, 2);
  assert.equal(two[1].quote, "It raised $12 million in 2021.");
  // braces and quotes inside strings do not confuse the scan
  assert.equal(extractCompleteClaimObjects('{"claims":[{"quote":"a {brace} and \\"quote\\" here ok","kind":"vague","why":"x"}]}').length, 1);
  assert.deepEqual(extractCompleteClaimObjects(""), []);
  assert.deepEqual(extractCompleteClaimObjects("no json at all"), []);
});

test("mergeClaims: de-duplicates by normalised quote and numbers ids on", () => {
  const list = [{ id: "c1", quote: "Acme was founded in 2019." }];
  const added = mergeClaims(list, [
    { quote: "ACME was founded in 2019!" }, // same after normalisation
    { quote: "It raised $12 million in 2021." },
    { quote: "It raised $12 million in 2021." },
  ]);
  assert.equal(added.length, 1);
  assert.equal(added[0].id, "c2");
  assert.equal(list.length, 2);
});

test("progressText", () => {
  assert.equal(progressText({ chunk: 2, total: 4, claims: 3 }), "Finding claims: chunk 2 of 4, 3 claims so far...");
  assert.equal(progressText({ chunk: 1, total: 4, claims: 1 }), "Finding claims: chunk 1 of 4, 1 claim so far...");
  assert.equal(progressText({ chunk: 1, total: 1, claims: 0 }), "Finding claims: 0 claims so far...");
});

test("MOCK on-device model, 2 seconds-style latency scaled down: the first card arrives long before the last chunk is done", async () => {
  const PER_CHUNK = 200; // ms per chunk in this test (the real-time demo uses 2000 ms; same logic)
  const chunks = ["c1 text", "c2 text", "c3 text", "c4 text"];
  const answers = [
    [answer("Acme was founded in 2019 in Austin, Texas."), answer("Acme was founded in 2019 in Austin, Texas.", "Maria Lopez is the chief executive of Acme.")],
    [answer("Acme raised a $12 million Series A in March 2021.")],
    [answer("The company employs 140 people in 3 countries.")],
    [answer("Acme was founded in 2019 in Austin, Texas.", "It is certified SOC 2 Type II since 2023.")], // repeats claim 1: de-duplicated
  ].map((x) => x[x.length - 1]);
  const events = [];
  const claims = [];
  const t0 = performance.now();
  const run = await runChunkedClaims({
    chunks,
    claims,
    now: () => performance.now(),
    streamChunk: async (_c, onText, info) => {
      const text = answers[info.index];
      // stream: the first object completes after one third of the chunk time
      const cut = text.indexOf("},") >= 0 ? text.indexOf("},") + 1 : text.length - 2;
      await sleep(PER_CHUNK / 3);
      onText(text.slice(0, cut));
      await sleep((PER_CHUNK * 2) / 3);
      onText(text);
      return { text, source: "on_device", ms: PER_CHUNK };
    },
    onClaims: (added) => events.push({ t: performance.now() - t0, ids: added.map((a) => a.id), n: claims.length }),
    onProgress: (p) => events.push({ progress: p }),
  });
  const total = performance.now() - t0;
  const first = events.find((e) => e.ids);
  assert.ok(first.t < PER_CHUNK, `first card at ${Math.round(first.t)} ms, before chunk 1 finished`);
  assert.ok(total > PER_CHUNK * 3.5, `whole run ${Math.round(total)} ms`);
  assert.ok(first.t < total / 3, "first card well before the end");
  assert.equal(run.failed, 0);
  assert.deepEqual(run.sources, ["on_device", "on_device", "on_device", "on_device"]);
  assert.ok(run.firstClaimAt - t0 < PER_CHUNK);
  // progress was reported for every chunk, with the running claim count
  const progress = events.filter((e) => e.progress).map((e) => e.progress);
  assert.deepEqual([...new Set(progress.map((p) => p.chunk))], [1, 2, 3, 4]);
  assert.ok(progress.some((p) => p.chunk === 2 && p.claims >= 1), "chunk 2 starts with claims from chunk 1 already shown");
  // merged and de-duplicated
  assert.equal(new Set(claims.map((c) => c.quote)).size, claims.length);
  assert.ok(claims.length >= 3);
  assert.deepEqual(claims.map((c) => c.id), claims.map((_, i) => "c" + (i + 1)));
});

test("a failing or unparsable chunk is skipped; the run goes on", async () => {
  const claims = [];
  const run = await runChunkedClaims({
    chunks: ["a", "b", "c"],
    claims,
    streamChunk: async (_c, _on, info) => {
      if (info.index === 0) throw new Error("model said no");
      if (info.index === 1) return { text: "I cannot help with that", source: "on_device", ms: 1 };
      return { text: answer("Acme was founded in 2019 in Austin, Texas."), source: "on_device", ms: 1 };
    },
  });
  assert.equal(run.failed, 2);
  assert.equal(claims.length, 1);
});

test("all chunks failing is reported (the caller then falls back to the cloud)", async () => {
  const claims = [];
  const run = await runChunkedClaims({ chunks: ["a", "b"], claims, streamChunk: async () => { throw new Error("x"); } });
  assert.equal(run.failed, 2);
  assert.equal(claims.length, 0);
  assert.equal(run.firstClaimAt, null);
});

test("a chunk with no claims is not a failure", async () => {
  const claims = [];
  const run = await runChunkedClaims({ chunks: ["a"], claims, streamChunk: async () => ({ text: '{"claims":[]}', source: "on_device", ms: 1 }) });
  assert.equal(run.failed, 0);
  assert.equal(claims.length, 0);
});
