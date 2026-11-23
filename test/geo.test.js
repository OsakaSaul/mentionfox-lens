import test from "node:test";
import assert from "node:assert/strict";
import { geoScore, geoBand, GEO_BANDS, GEO_WEIGHTS } from "../src/shared/geo.js";

const all = (n) => ({ entity_clarity: n, fact_density: n, structure: n, trust_signals: n, ambiguity: n });

test("weights sum to 100", () => {
  assert.equal(Object.values(GEO_WEIGHTS).reduce((a, b) => a + b, 0), 100);
});
test("score endpoints and midpoint", () => {
  assert.equal(geoScore(all(0)), 0);
  assert.equal(geoScore(all(4)), 100);
  assert.equal(geoScore(all(2)), 50);
});
test("score is weighted, clamped and tolerant of bad input", () => {
  assert.equal(geoScore({ entity_clarity: 4, fact_density: 0, structure: 0, trust_signals: 0, ambiguity: 0 }), 25);
  assert.equal(geoScore({ entity_clarity: 99, fact_density: -5 }), 25);
  assert.equal(geoScore(undefined), 0);
  assert.equal(geoScore({ entity_clarity: "x" }), 0);
});
test("bands cover 0..100 with no gap and no overlap", () => {
  for (let s = 0; s <= 100; s++) {
    const hits = GEO_BANDS.filter((b) => s >= b.min && s <= b.max);
    assert.equal(hits.length, 1, `score ${s}`);
  }
});
test("band boundaries", () => {
  assert.equal(geoBand(0).id, "weak");
  assert.equal(geoBand(24).id, "weak");
  assert.equal(geoBand(25).id, "patchy");
  assert.equal(geoBand(49).id, "patchy");
  assert.equal(geoBand(50).id, "good");
  assert.equal(geoBand(74).id, "good");
  assert.equal(geoBand(75).id, "strong");
  assert.equal(geoBand(100).id, "strong");
  assert.equal(geoBand(250).id, "strong");
  assert.equal(geoBand(NaN).id, "weak");
});
