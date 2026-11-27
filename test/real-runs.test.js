// Claim lists about made-up pages (hand-written, in the way a model quotes): every one must be found in its page's text by the
// matcher. Until T3188 this ran on saved third-party pages with real cloud answers; those copies were removed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { buildIndex, findQuote } from "../src/shared/match.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const [list, page] of [
  ["sample-founder-bio", "sample-founder-bio"], ["sample-press-release", "sample-press-release"], ["sample-homepage", "sample-homepage"], ["sample-news", "sample-news"],
  ["rowan-a", "encyclopedia-rowan"], ["priya-a", "encyclopedia-priya"], ["release-a", "veridrop-release"],
  ["rowan-b", "encyclopedia-rowan"], ["priya-b", "encyclopedia-priya"], ["release-b", "veridrop-release"],
]) {
  test(`claim list ${list}: every claim is found in the page`, () => {
    const html = readFileSync(resolve(root, `test/fixtures/made-up/${page}.html`), "utf8").replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");
    const index = buildIndex(new JSDOM(html).window.document.body);
    const claims = JSON.parse(readFileSync(resolve(root, `test/fixtures/claims/${list}.json`), "utf8")).claims;
    assert.ok(claims.length >= 5);
    for (const c of claims) assert.ok(findQuote(index.text, c.quote), `not found: ${c.quote}`);
  });
}
