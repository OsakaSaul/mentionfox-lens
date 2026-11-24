import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, buildDocument, mapResult, validate, allowedOrigins } from "../lens-check/src/index.mjs";

const ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const kv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; };
const env = (over = {}) => ({ ALLOWED_ORIGINS: ORIGIN, DAILY_CAP: "100", FOXAPIS_TOKEN: "tok_test_secret_value", LENS_KV: kv(), ...over });
const req = (body, { origin = ORIGIN, method = "POST" } = {}) => new Request("https://lens-check.example.workers.dev/", { method, headers: { origin, "content-type": "application/json" }, body: method === "POST" ? JSON.stringify(body) : undefined });
const good = { claim: "The build-out of Enron's 18,000-mile global fiber network is near completion.", domain: "enron.com", snapshot_date: "2001-05-07" };
const CC = { mode: "snapshot", summary: { claims_checked: 1 }, claims: [{ claim: "x", verdict: "contradicted", reason: "Enron later filed for bankruptcy and its broadband unit was found to be largely unused.", sources: [{ url: "https://www.reuters.com/a", title: "" }, { url: "https://www.reuters.com/b", title: "" }, { url: "javascript:x", title: "bad" }, { url: "https://sec.gov/c", title: "SEC" }] }] };
const api = (calls, { jobs = ["pending", "done"], first = 202 } = {}) => async (url, init) => {
  calls.push({ url, init });
  if (url.endsWith("/v1/claims_check")) return new Response(JSON.stringify({ job_id: "j1", poll_url: "/v1/jobs/j1", status: "pending" }), { status: first });
  const s = jobs.shift() || "done";
  return new Response(JSON.stringify(s === "done" ? { status: "done", credits_used: 5, result: CC } : { status: s }), { status: 200 });
};
const deps = (calls, o) => ({ fetch: api(calls, o), sleep: async () => {}, now: new Date("2026-11-24T10:00:00Z") });

test("only the Lens origin is allowed; others get 403 and no CORS header", async () => {
  const e = env();
  for (const origin of ["", "https://evil.example", "chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"]) {
    const r = await handle(req(good, { origin }), e, deps([]));
    assert.equal(r.status, 403);
    assert.equal(r.headers.get("access-control-allow-origin"), null);
  }
  assert.equal((await handle(req(good, { origin: "", method: "OPTIONS" }), e, deps([]))).status, 403);
  const pre = await handle(req(null, { method: "OPTIONS" }), e, deps([]));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), ORIGIN);
  assert.deepEqual(allowedOrigins({ ALLOWED_ORIGINS: " a , b ,," }), ["a", "b"]);
  assert.equal((await handle(req(good), env({ ALLOWED_ORIGINS: "" }), deps([]))).status, 403, "empty list refuses everything");
});

test("no secret yet: 503 not_available, no upstream call, no cap used", async () => {
  const e = env({ FOXAPIS_TOKEN: undefined });
  const calls = [];
  const r = await handle(req(good), e, deps(calls));
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "not_available" });
  assert.equal(calls.length, 0);
  assert.equal(e.LENS_KV.m.size, 0);
});

test("a check: padded document of 50+ words, token sent upstream only, verdict mapped, secret never echoed", async () => {
  const e = env();
  const calls = [];
  const r = await handle(req(good), e, deps(calls));
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.verdict, "contradicted");
  assert.match(body.reason, /Enron later filed/);
  assert.deepEqual(body.sources.map((s) => s.url), ["https://www.reuters.com/a", "https://sec.gov/c"], "one per host, http(s) only");
  const post = calls[0];
  const sent = JSON.parse(post.init.body);
  assert.equal(sent.mode, "snapshot");
  assert.ok(sent.text.split(/\s+/).length >= 50, "claims_check needs 50+ words");
  assert.match(sent.text, /enron\.com/);
  assert.match(sent.text, /2001-05-07/);
  assert.match(sent.text, /18,000-mile/);
  assert.equal(post.init.headers.authorization, "Bearer tok_test_secret_value");
  assert.ok(!JSON.stringify(body).includes("tok_test_secret_value"));
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(e.LENS_KV.m.get("cap:2026-11-24"), "1");
});

test("global cap: the next check after the cap answers 429 'Web checks are busy today' without calling upstream", async () => {
  const e = env({ DAILY_CAP: "3" });
  const calls = [];
  for (let i = 0; i < 3; i++) assert.equal((await handle(req(good), e, deps(calls))).status, 200);
  const n = calls.length;
  const r = await handle(req(good), e, deps(calls));
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: "busy", message: "Web checks are busy today" });
  assert.equal(calls.length, n);
  const next = await handle(req(good), e, { ...deps(calls), now: new Date("2026-11-25T00:00:01Z") });
  assert.equal(next.status, 200, "a new UTC day starts at zero");
});

test("upstream failure: 503, the slot is given back, upstream text is never passed through", async () => {
  const e = env();
  const r = await handle(req(good), e, { fetch: async () => new Response("{}", { status: 500 }), sleep: async () => {}, now: new Date("2026-11-24T10:00:00Z") });
  assert.equal(r.status, 503);
  assert.equal(e.LENS_KV.m.get("cap:2026-11-24"), "0");
  const slow = await handle(req(good), e, { ...deps([], { jobs: Array(50).fill("running") }), pollMax: 0 });
  assert.equal(slow.status, 503, "a job that never finishes in time is not_available");
  const forbidden = await handle(req(good), e, { fetch: async () => new Response(JSON.stringify({ detail: "Claims Check is not open to this key yet." }), { status: 403 }), sleep: async () => {}, now: new Date("2026-11-24T10:00:00Z") });
  assert.equal(forbidden.status, 503);
  assert.ok(!(await forbidden.text()).includes("Claims Check"));
});

test("bad input is refused before the cap is touched", async () => {
  const e = env();
  for (const b of [{}, { claim: "short" }, { claim: "x".repeat(601) }, { claim: 5 }]) assert.equal((await handle(req(b), e, deps([]))).status, 400);
  assert.equal((await handle(req(good, { method: "GET" }), e, deps([]))).status, 405);
  assert.equal(e.LENS_KV.m.size, 0);
  const v = validate({ claim: 'He said "hello" to everyone present today', domain: "bad domain!", snapshot_date: "yesterday" });
  assert.equal(v.domain, "");
  assert.equal(v.date, "");
  assert.ok(!v.claim.includes('"'));
});

test("mapResult and buildDocument", () => {
  assert.equal(mapResult({ claims: [] }).verdict, "no_record");
  assert.equal(mapResult({ claims: [{ verdict: "cant_verify", reason: "r" }] }).verdict, "no_record");
  assert.equal(mapResult({ claims: [{ verdict: "partly", reason: "r" }] }).verdict, "no_record");
  assert.equal(mapResult({ claims: [{ verdict: "supported" }, { verdict: "contradicted" }] }).verdict, "contradicted", "contradicted wins");
  assert.match(buildDocument({ claim: "c", domain: "", date: "" }), /a company website/);
});
