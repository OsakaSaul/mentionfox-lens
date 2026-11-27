import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { detect } from "../src/shared/redflags.js";

let JSDOM = null;
try { ({ JSDOM } = await import("jsdom")); } catch { /* the fixtures test is skipped without jsdom */ }
const { extractMainBlocks } = await import("../src/shared/extract.js");
const pageText = (f) => extractMainBlocks(new JSDOM(fs.readFileSync(new URL(`./fixtures/made-up/${f}.html`, import.meta.url), "utf8")).window.document).blocks.join("\n");
const sig = (flags, signal) => flags.filter((x) => x.signal === signal);

test("sentences from the interview page: the generic non-answer and 'never used commercially available equipment' are flagged", () => {
  const f1 = detect('Marlowe said she realized from the paper\'s recent articles that "People just didn\'t understand what we actually do."').flags;
  assert.equal(f1.length, 1);
  assert.equal(f1[0].signal, "evasive_answer");
  const f2 = detect('3. "We have never used commercially available lab equipment for finger-stick based tests."').flags;
  assert.equal(f2.length, 1);
  assert.equal(f2[0].signal, "extraordinary_claim");
});

test("a rival's number next to the company's is not 'numbers that do not agree'", () => {
  const t = "Veridrop can run as many as 70 tests on a sample this size, obtained by pricking a finger. The results are available within hours, though stat labs can usually perform only a limited menu of maybe 40 tests.";
  assert.equal(sig(detect(t).flags, "inconsistent_numbers").length, 0);
});

test("a cover story: the 70-tests claim, the 'same fundamental chemical methods' line and the trade secret are flagged", { skip: !JSDOM }, () => {
  const { flags } = detect(pageText("harbor-cover"), { company: "veridrop" });
  assert.ok(sig(flags, "extraordinary_claim").some((x) => /as many as 70 tests/.test(x.quote)), "70 tests: " + JSON.stringify(flags.map((x) => x.signal)));
  assert.ok(sig(flags, "evasive_answer").some((x) => /same fundamental chemical methods/.test(x.quote)));
  assert.ok(sig(flags, "secrecy").some((x) => /trade secret/.test(x.quote)));
  assert.equal(sig(flags, "inconsistent_numbers").length, 0);
  assert.ok(flags.length <= 6, "not a wall of flags: " + flags.length);
});

test("an interview report: flagged lines are the ones a careful reader would question, and there are few", { skip: !JSDOM }, () => {
  const { flags } = detect(pageText("harbor-interview"), { company: "veridrop" });
  assert.ok(flags.some((x) => /never used commercially available/.test(x.quote)), JSON.stringify(flags));
  assert.ok(flags.some((x) => /didn't understand what we actually do/.test(x.quote)));
  assert.ok(flags.length <= 5, "flags " + flags.length);
});
