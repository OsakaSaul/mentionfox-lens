import { test } from "node:test";
import assert from "node:assert/strict";
import { quotaState, quotaAfterUse, quotaText, archiveDate, claimDomain, buildCheckPrompt, parseCheck, pickSources, localDay, DAILY_FREE_CHECKS } from "../src/shared/check.js";

test("quota: fresh day has 5 left, counts up, exhausts at 5", () => {
  const now = new Date(2026, 10, 24, 10, 0);
  let rec = null;
  assert.equal(quotaState(rec, now).left, 5);
  for (let i = 0; i < 5; i++) rec = quotaAfterUse(rec, now);
  const q = quotaState(rec, now);
  assert.equal(q.used, 5);
  assert.equal(q.exhausted, true);
  assert.equal(quotaAfterUse(rec, now).used, 5, "never counts past the limit");
});

test("quota: resets at local midnight, broken records count as unused", () => {
  const rec = { day: "2026-11-24", used: 5 };
  assert.equal(quotaState(rec, new Date(2026, 10, 24, 23, 59)).exhausted, true);
  assert.equal(quotaState(rec, new Date(2026, 10, 25, 0, 0)).left, DAILY_FREE_CHECKS);
  for (const bad of [undefined, "x", { day: "2026-11-24", used: "5" }, { day: "2026-11-24", used: -3 }]) assert.equal(quotaState(bad, new Date(2026, 10, 24)).used, 0);
  assert.equal(localDay(new Date(2026, 0, 5)), "2026-01-05");
});

test("quota text", () => {
  assert.equal(quotaText(quotaState({ day: localDay(), used: 2 })), "3 of 5 free checks left today");
});

test("archive date and domain", () => {
  const u = "https://web.archive.org/web/20010507225240/http://www4.enron.com:80/corp/investors/annuals/2000/broadband.html";
  assert.equal(archiveDate(u), "2001-05-07");
  assert.equal(archiveDate("https://web.archive.org/web/20010507225240id_/http://x.com/"), "2001-05-07");
  assert.equal(archiveDate("https://example.com/"), null);
  assert.equal(claimDomain(u), "enron.com");
  assert.equal(claimDomain("https://www.wirecard.com/ir"), "wirecard.com");
  assert.equal(claimDomain("not a url"), "");
});

test("prompt carries only the claim, the domain and the date", () => {
  const p = buildCheckPrompt({ claim: 'We hold "EUR 1.9 billion" in trust.', domain: "wirecard.com", date: "2019-06-01" });
  assert.match(p, /wirecard\.com/);
  assert.match(p, /2019-06-01/);
  assert.match(p, /EUR 1\.9 billion/);
  assert.ok(!/"EUR/.test(p), "inner double quotes are neutralised");
  assert.match(buildCheckPrompt({ claim: "x", domain: "a.com" }), /unknown/);
});

test("parseCheck: the three verdicts, markdown, and garbage", () => {
  assert.deepEqual(parseCheck("VERDICT: CONTRADICTED\nREASON: Later reported as not existing."), { verdict: "contradicted", reason: "Later reported as not existing." });
  assert.equal(parseCheck("**VERDICT:** SUPPORTED\nREASON: Filed.").verdict, "supported");
  assert.equal(parseCheck("VERDICT: NO_CLEAR_RECORD\nREASON: Nothing found.").verdict, "none");
  assert.equal(parseCheck("VERDICT: no clear record\nREASON: x").verdict, "none");
  const junk = parseCheck("I think it is probably fine.");
  assert.equal(junk.verdict, "none", "unparseable text is never red or green");
  assert.equal(parseCheck("").verdict, "none");
});

test("pickSources: web only, distinct, max 3, http(s) only", () => {
  const meta = { groundingChunks: [
    { web: { uri: "https://a.com/1", title: "A" } }, { web: { uri: "https://a.com/2", title: "A" } },
    { web: { uri: "javascript:alert(1)", title: "bad" } }, { maps: {} }, { web: { uri: "https://b.com", title: "B" } },
    { web: { uri: "https://c.com", title: "C" } }, { web: { uri: "https://d.com", title: "D" } },
  ] };
  assert.deepEqual(pickSources(meta).map((s) => s.title), ["A", "B", "C"]);
  assert.deepEqual(pickSources(null), []);
});
