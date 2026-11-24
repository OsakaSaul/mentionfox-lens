import { test } from "node:test";
import assert from "node:assert/strict";
import { quotaState, quotaAfterUse, quotaText, archiveDate, claimDomain, normalizeCheck, runWorkerCheck, CHECK_URL, localDay, DAILY_FREE_CHECKS } from "../src/shared/check.js";

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

