import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCheck, runWorkerCheck, CHECK_URL } from "../src/shared/check.js";

test("normalizeCheck: the three verdicts, garbage is never red or green, http(s) sources only, max 3", () => {
  assert.equal(normalizeCheck({ verdict: "contradicted", reason: "Later reported as not existing." }).verdict, "contradicted");
  assert.equal(normalizeCheck({ verdict: "supported", reason: "Filed." }).verdict, "supported");
  assert.equal(normalizeCheck({ verdict: "no_record", reason: "Nothing." }).verdict, "none");
  for (const bad of [null, undefined, {}, { verdict: "CONTRADICTED" }, { verdict: "partly" }, "x"]) assert.equal(normalizeCheck(bad).verdict, "none");
  assert.match(normalizeCheck({}).reason, /No clear public record/);
  const r = normalizeCheck({ verdict: "supported", reason: "x", sources: [{ url: "https://a.com/1", title: "A" }, { url: "javascript:alert(1)", title: "bad" }, { url: "https://b.com" }, { url: "https://c.com", title: "C" }, { url: "https://d.com", title: "D" }] });
  assert.deepEqual(r.sources.map((s) => s.title), ["A", "b.com", "C"]);
  assert.equal(r.sources[0].uri, "https://a.com/1");
});

test("runWorkerCheck: sends only claim, domain and date; maps busy and failures", async () => {
  let sent = null;
  const ok = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ verdict: "contradicted", reason: "Later reported.", sources: [{ url: "https://x.org/a", title: "X" }] }) }; };
  const out = await runWorkerCheck({ claim: "The network is near completion.", domain: "enron.com", date: "2001-05-07" }, ok);
  assert.deepEqual(Object.keys(sent.body).sort(), ["claim", "domain", "snapshot_date"]);
  assert.equal(sent.url, CHECK_URL);
  assert.equal(out.verdict, "contradicted");
  assert.equal(typeof out.ms, "number");
  await assert.rejects(runWorkerCheck({ claim: "x" }, async () => ({ ok: false, status: 429, json: async () => ({}) })), (e) => e.code === "busy" && e.message === "Web checks are busy today");
  await assert.rejects(runWorkerCheck({ claim: "x" }, async () => ({ ok: false, status: 503, json: async () => ({}) })), (e) => e.code === "not_available");
  await assert.rejects(runWorkerCheck({ claim: "x" }, async () => { throw new TypeError("Failed to fetch"); }), (e) => e.code === "not_available");
});
