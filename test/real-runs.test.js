// Regression test on real data: every claim the real cloud model returned for the saved real pages
// (docs/real-runs/<page>/result.json) must still be found in the page text by the matcher.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { buildIndex, findQuote } from "../src/shared/match.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of ["founder-bio", "press-release", "homepage", "news-article"]) {
  const result = resolve(root, `docs/real-runs/${name}/result.json`);
  const page = resolve(root, `fixtures/real/${name}.html`);
  test(`real run ${name}: every returned claim is found in the saved page`, { skip: !existsSync(result) || !existsSync(page) }, () => {
    const html = readFileSync(page, "utf8").replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");
    const doc = new JSDOM(html).window.document;
    const index = buildIndex(doc.body);
    const claims = JSON.parse(readFileSync(result, "utf8")).claims.normalized;
    assert.ok(claims.length >= 5);
    for (const c of claims) assert.ok(findQuote(index.text, c.quote), `not found: ${c.quote}`);
  });
}

// T2960 runs: the claims the cloud model returned for the two Wikipedia fixtures and the Theranos Archive copy.
for (const [run, pageFile] of [
  ["t2960-sam-bankman-fried", "test/fixtures/wikipedia-sam-bankman-fried.html"],
  ["t2960-patrick-collison", "test/fixtures/wikipedia-patrick-collison.html"],
  ["t2960-theranos-1", "fixtures/demo/theranos-1.html"],
  // T2963: the same pages through the main-content extraction (cloud path, 12,000-character window)
  ["t2963-sam-bankman-fried", "test/fixtures/wikipedia-sam-bankman-fried.html"],
  ["t2963-patrick-collison", "test/fixtures/wikipedia-patrick-collison.html"],
  ["t2963-theranos-1", "fixtures/demo/theranos-1.html"],
]) {
  const result = resolve(root, `docs/real-runs/${run}/result.json`);
  const page = resolve(root, pageFile);
  test(`T2960 run ${run}: every returned claim is found, with an exact or fuzzy tier`, { skip: !existsSync(result) || !existsSync(page) }, () => {
    const html = readFileSync(page, "utf8").replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");
    const index = buildIndex(new JSDOM(html).window.document.body);
    const claims = JSON.parse(readFileSync(result, "utf8")).claims.normalized;
    assert.ok(claims.length >= 5);
    for (const c of claims) assert.ok(findQuote(index.text, c.quote), `not found: ${c.quote}`);
  });
}
