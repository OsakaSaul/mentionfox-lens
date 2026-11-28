import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, Counter, take, MODES, PROVIDERS } from "../lens-api/src/index.mjs";
import { runProxy, installId, LIMIT_MESSAGE } from "../src/shared/proxy.js";
import { friendlyError } from "../src/shared/errors.js";

const ORIGIN = "chrome-extension://abc";
const ID = "11111111-2222-4333-8444-555555555555";
const ID2 = "21111111-2222-4333-8444-555555555555";
const PAGE = "Acme Corp was founded in Austin in 2019 and now serves 3,400 customers in 41 countries.";

function counterBinding() {
  const days = new Map();
  const make = () => {
    const mem = new Map();
    let alarm = null;
    return new Counter({ blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => structuredClone(mem.get(k)), put: async (k, v) => void mem.set(k, v), getAlarm: async () => alarm, setAlarm: async (t) => void (alarm = t), deleteAll: async () => mem.clear() } });
  };
  return { idFromName: (n) => n, get: (n) => { if (!days.has(n)) days.set(n, make()); return { fetch: (u, i) => days.get(n).fetch(new Request(u, i)) }; } };
}
const env = (extra = {}) => ({ ALLOWED_ORIGINS: ORIGIN, ANTHROPIC_API_KEY: "k", COUNTER: counterBinding(), ...extra });
const req = ({ mode = "deep", text = PAGE, id = ID, origin = ORIGIN, ip = "1.2.3.4" } = {}) => new Request("https://x/", { method: "POST", headers: { origin, "cf-connecting-ip": ip }, body: JSON.stringify({ mode, text, install_id: id }) });
const answer = (obj) => Response.json({ content: [{ type: "text", text: "```json\n" + JSON.stringify(obj) + "\n```" }], usage: { input_tokens: 10, output_tokens: 5 } });
const CLAIMS = { claims: [{ quote: PAGE, kind: "specific", why: "A year and a place." }] };
const quiet = () => {};

test("returns the model's JSON; the server fixes model, prompt and output size", async () => {
  let sent;
  const r = await handle(req({ text: PAGE }), env(), async (u, i) => { sent = JSON.parse(i.body); return answer(CLAIMS); }, quiet);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), CLAIMS);
  assert.equal(sent.model, PROVIDERS[0].model);
  assert.equal(sent.max_tokens, MODES.deep.maxTokens);
  assert.equal(sent.messages[0].content, MODES.deep.prompt(PAGE));
});

test("a long text is cut to the extension's own window", async () => {
  let sent;
  await handle(req({ mode: "quick", text: "x1. ".repeat(20000) }), env(), async (u, i) => { sent = JSON.parse(i.body); return answer(CLAIMS); }, quiet);
  assert.ok(sent.messages[0].content.length < MODES.quick.chars + MODES.quick.prompt("").length + 100);
});

test("falls back to the second model, then fails closed", async () => {
  const models = [];
  const ok = await handle(req(), env(), async (u, i) => { models.push(JSON.parse(i.body).model); return models.length === 1 ? new Response("", { status: 529 }) : answer(CLAIMS); }, quiet);
  assert.equal(ok.status, 200);
  assert.deepEqual(models, PROVIDERS.map((p) => p.model));
  assert.equal((await handle(req(), env(), async () => answer({ nope: 1 }), quiet)).status, 503);
});

test("never logs page text", async () => {
  const lines = [];
  await handle(req(), env(), async () => answer(CLAIMS), (l) => lines.push(l));
  await handle(req(), env(), async () => new Response("echo " + PAGE, { status: 500 }), (l) => lines.push(l));
  await handle(req(), env(), async () => { throw new Error(PAGE); }, (l) => lines.push(l));
  assert.ok(lines.length >= 3);
  assert.ok(!lines.join("\n").includes("Acme"));
});

test("refuses a wrong origin, bad input, an oversized body and a missing key", async () => {
  const f = async () => answer(CLAIMS);
  assert.equal((await handle(req({ origin: "https://evil.test" }), env(), f, quiet)).status, 403);
  assert.equal((await handle(req({ id: "x" }), env(), f, quiet)).status, 400);
  assert.equal((await handle(req({ mode: "__proto__" }), env(), f, quiet)).status, 400);
  assert.equal((await handle(req({ text: "short" }), env(), f, quiet)).status, 400);
  assert.equal((await handle(req({ text: "a".repeat(500000) }), env(), f, quiet)).status, 413);
  assert.equal((await handle(req(), env({ ANTHROPIC_API_KEY: "" }), f, quiet)).status, 503);
});

for (const [scope, vars, second] of [["install", { CAP_INSTALL: "1" }, { ip: "9.9.9.9" }], ["ip", { CAP_IP: "1" }, { id: ID2 }], ["all", { CAP_ALL: "1" }, { id: ID2, ip: "8.8.8.8" }]]) {
  test(`the daily ${scope} cap refuses with 429 and calls no model`, async () => {
    const e = env(vars);
    let calls = 0;
    const f = async () => { calls++; return answer(CLAIMS); };
    assert.equal((await handle(req(), e, f, quiet)).status, 200);
    const r = await handle(req(second), e, f, quiet);
    assert.equal(r.status, 429);
    assert.deepEqual(await r.json(), { error: "busy", scope, message: LIMIT_MESSAGE });
    assert.equal(calls, 1);
  });
}

test("a refused request uses up nothing", () => {
  const counts = { i: 1 };
  assert.equal(take(counts, { install: "i", ip: "p", all: "all" }, { install: 1, ip: 5, all: 5 }).ok, false);
  assert.deepEqual(counts, { i: 1 });
});

test("client: one stable install id, only the prompt window is sent, plain errors", async () => {
  const mem = {};
  const storage = { get: async (k) => ({ [k]: mem[k] }), set: async (o) => void Object.assign(mem, o) };
  assert.equal(await installId(storage, () => ID), ID);
  assert.equal(await installId(storage, () => "other"), ID);
  let body;
  const out = await runProxy({ mode: "quick", text: "y2. ".repeat(20000) }, { storage, url: "https://x/", fetchFn: async (u, i) => { body = JSON.parse(i.body); return new Response('{"claims":[]}'); } });
  assert.equal(out, '{"claims":[]}');
  assert.ok(body.text.length <= MODES.quick.chars);
  assert.equal(body.install_id, ID);
  await assert.rejects(runProxy({ mode: "deep", text: PAGE }, { storage, url: "https://x/", fetchFn: async () => new Response("", { status: 429 }) }), (e) => friendlyError(e, { deep: true }) === LIMIT_MESSAGE);
  await assert.rejects(runProxy({ mode: "deep", text: PAGE }, { storage, url: "https://x/", fetchFn: async () => { throw new TypeError("fetch failed"); } }), /Network error/);
});
