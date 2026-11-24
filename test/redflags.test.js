import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, applyRedFlags, extraordinaryTest, isPuffery, isUnsourced, sentencesOf, signalLabel } from "../src/shared/redflags.js";
import { mergeClaims } from "../src/shared/chunked.js";
import { reconcileKind } from "../src/shared/anchors.js";
import { normalizeClaims } from "../src/shared/parse.js";

const flagsOf = (text, ctx) => detect(text, ctx).flags;

// ---- Saul's calibration (T2992): no citation ALONE is not a red flag ----
test("founder: 'we run 70 tests from one finger prick' is a red flag (all three hold)", () => {
  const s = "We run 70 tests from one finger prick, and our founder says it works every time.";
  const t = extraordinaryTest(s, {});
  assert.deepEqual([t.extraordinary, t.benefits, t.evidenceAbsent, t.fires], [true, true, true, true]);
  const f = flagsOf("Our company was founded in Palo Alto. " + s + " The office has a large lobby.");
  assert.equal(f.length, 1);
  assert.equal(f[0].signal, "extraordinary_claim");
  assert.equal(f[0].quote, s);
});

test("founder: 'our app has 10,000 users' is an unsourced tag only, never a red flag", () => {
  const text = "Our app has 10,000 users across 40 countries and growing every week.";
  assert.equal(flagsOf(text).length, 0);
  assert.equal(detect(text).unsourced.length, 1);
  const claims = [{ id: "c1", quote: text, kind: "specific", why: "Names a number." }];
  const r = applyRedFlags(claims, text);
  assert.equal(claims[0].kind, "specific");
  assert.equal(claims[0].unsourced, true);
  assert.equal(r.flagged, 0);
});

test("news: 'the drug cut deaths by 40%' citing a named trial gets no flag and no tag", () => {
  const text = "The drug cut deaths by 40% in the ASCEND clinical trial, published in the New England Journal of Medicine.";
  assert.equal(flagsOf(text).length, 0);
  assert.equal(detect(text).unsourced.length, 0);
});

test("an extraordinary claim by a founder with evidence in the next sentence is not flagged", () => {
  const text = "We run 70 tests from one finger prick. The method was validated in a peer-reviewed study published in a journal last year.";
  assert.equal(flagsOf(text).length, 0);
});

test("an extraordinary claim in a neutral third-party voice (no seller) is not flagged", () => {
  const text = "Researchers reported that 70 tests from one finger prick may someday be possible, though nobody has built it.";
  assert.equal(extraordinaryTest(text, {}).benefits, false);
  assert.equal(flagsOf(text).length, 0);
});

// ---- Saul's hubris example stays amber ----
test("'MentionFox is going to be really big and the de facto solution ...' is puffery: never red", () => {
  const q = "MentionFox is going to be really big and the de facto solution for checking veracity of nearly anything";
  assert.equal(isPuffery(q), true);
  assert.equal(flagsOf(q + ".").length, 0);
  assert.equal(extraordinaryTest(q, {}).fires, false);
  assert.equal(isUnsourced(q), false);
  const claims = normalizeClaims({ claims: [{ quote: q, kind: "vague", why: "It is praise with nothing to check." }] });
  assert.equal(claims[0].kind, "vague");
  applyRedFlags(claims, q + ".");
  assert.equal(claims[0].kind, "vague");
  assert.equal(claims[0].unsourced, undefined);
});

test("a model red flag on puffery is demoted back to amber", () => {
  const q = "We will be the leading provider of blood testing worldwide and the best in the industry.";
  const claims = [{ id: "c1", quote: q, kind: "redflag", signal: "extraordinary_claim", why: "Big claim." }];
  const r = applyRedFlags(claims, q, { reconcile: reconcileKind });
  assert.equal(claims[0].kind, "vague");
  assert.equal(claims[0].signal, undefined);
  assert.equal(r.demoted, 1);
});

// ---- the other signals ----
test("(b) a generic answer where a method was asked for", () => {
  const text = "Asked how the tests work, Holmes says they use the same fundamental chemical methods that every laboratory uses. The lobby is large.";
  const f = flagsOf(text);
  assert.equal(f.length, 1);
  assert.equal(f[0].signal, "evasive_answer");
  assert.match(f[0].quote, /same fundamental chemical methods/);
});

test("(b) a how question answered with a mission statement", () => {
  const f = flagsOf("How do you get accuracy that high?\nOur mission is to make healthcare accessible to everyone, and we believe in people.");
  assert.equal(f.length, 1);
  assert.equal(f[0].signal, "evasive_answer");
});

test("(c) numbers that do not agree on the same page", () => {
  const text = "The lab offers 200 tests to patients and doctors. Each sample runs up to 70 tests from a small amount of blood.";
  const f = flagsOf(text);
  assert.equal(f.length, 1);
  assert.equal(f[0].signal, "inconsistent_numbers");
  assert.match(f[0].why, /200/);
  assert.equal(flagsOf("The company has 200 employees in the US. The company has 210 employees in total.").length, 0, "close numbers are not a conflict");
});

test("(e) secrecy as a feature", () => {
  for (const s of ["We do not publish our results because the technology is proprietary.", "The research is done in stealth mode, so nothing has been published about it."]) {
    const f = flagsOf(s);
    assert.equal(f.length, 1, s);
    assert.equal(f[0].signal, "secrecy");
  }
});

// ---- applying ----
test("applyRedFlags: an existing green card becomes a red flag; a missed sentence becomes a new card; ids continue", () => {
  const a = "We run 70 tests from one finger prick, and our founder says it works every time.";
  const b = "We do not publish our results because the technology is proprietary.";
  const claims = [{ id: "c1", quote: a, kind: "specific", why: "Names a number." }, { id: "c2", quote: "Founded in 2003 in Palo Alto.", kind: "specific", why: "Names a year." }];
  const r = applyRedFlags(claims, a + " Founded in 2003 in Palo Alto. " + b, { merge: mergeClaims });
  assert.equal(claims[0].kind, "redflag");
  assert.equal(claims[0].signal, "extraordinary_claim");
  assert.equal(claims.length, 3);
  assert.equal(claims[2].id, "c3");
  assert.equal(claims[2].signal, "secrecy");
  assert.equal(r.flagged, 2);
  assert.equal(r.added, 1);
  assert.equal(claims[1].kind, "specific");
});

test("a model red flag with no support in the rules is demoted and says why it was not kept", () => {
  const q = "Our platform supports 12 integrations including Slack and Zoom.";
  const claims = [{ id: "c1", quote: q, kind: "redflag", signal: "extraordinary_claim", why: "x" }];
  const r = applyRedFlags(claims, q, { reconcile: reconcileKind });
  assert.equal(claims[0].kind, "specific");
  assert.equal(r.demoted, 1);
});

test("labels and helpers", () => {
  assert.equal(signalLabel("secrecy"), "Secrecy as a feature");
  assert.equal(signalLabel("nope"), "Red flag");
  assert.deepEqual(sentencesOf("First is long enough to count. Short. Second also long enough to count!"), ["First is long enough to count.", "Second also long enough to count!"]);
});
