import test from "node:test";
import assert from "node:assert/strict";
import { formatSeconds, modeInfo, statusLine, chipState, HYBRID_TIP } from "../src/shared/mode.js";

test("formatSeconds", () => {
  assert.equal(formatSeconds(3200), "3.2 s");
  assert.equal(formatSeconds(1449), "1.4 s");
  assert.equal(formatSeconds(0), "0.0 s");
  assert.equal(formatSeconds(undefined), "");
  assert.equal(formatSeconds(-5), "");
});

test("modeInfo: the four states", () => {
  const dl = modeInfo({ source: "in_cloud", ms: 3200, deviceStatus: "downloading" });
  assert.equal(dl.mode, "cloud_fallback");
  assert.equal(dl.text, "Cloud (on-device not ready) · 3.2 s");
  const un = modeInfo({ source: "in_cloud", ms: 3200, deviceStatus: "unavailable" });
  assert.equal(un.mode, "cloud");
  assert.equal(un.text, "Cloud · 3.2 s");
  const od = modeInfo({ source: "on_device", ms: 1400, deviceStatus: "available" });
  assert.equal(od.mode, "on_device");
  assert.equal(od.text, "On-device (private) · 1.4 s");
  const failed = modeInfo({ source: "in_cloud", ms: 3200, deviceStatus: "available" });
  assert.equal(failed.text, "Cloud (on-device failed) · 3.2 s");
  const retried = modeInfo({ source: "on_device", ms: 5000, deviceStatus: "available", retried: true });
  assert.equal(retried.mode, "cloud_fallback");
  assert.match(retried.text, /^Cloud \(on-device failed\)/);
  assert.ok(od.tip.includes(HYBRID_TIP) && dl.tip.includes(HYBRID_TIP));
});

test("statusLine", () => {
  const c = modeInfo({ source: "in_cloud", ms: 1600, deviceStatus: "unavailable" });
  assert.equal(statusLine({ totalMs: 3200, infos: [c, c], claims: 10 }), "Done in 3.2 s on Cloud: 10 claims. Click a claim to jump to it.");
  const d = modeInfo({ source: "on_device", ms: 700, deviceStatus: "available" });
  assert.equal(statusLine({ totalMs: 1400, infos: [d, d], claims: 10 }), "Done in 1.4 s on-device (private): 10 claims. Click a claim to jump to it.");
  assert.equal(statusLine({ totalMs: 3200, infos: [c, c], claims: 1, missing: 2 }), "Done in 3.2 s on Cloud: 1 claim, 2 not found on the page. Click a claim to jump to it.");
  assert.match(statusLine({ totalMs: 3000, infos: [c, d], claims: 3 }), /on Cloud and on-device:/);
  const n = modeInfo({ source: "in_cloud", ms: 1600, deviceStatus: "downloading" });
  assert.match(statusLine({ totalMs: 3200, infos: [n, n], claims: 10 }), /^Done in 3\.2 s on Cloud \(on-device not ready\): 10 claims/);
});

test("chipState", () => {
  assert.equal(chipState("downloading", 0.42).text, "On-device model: downloading 42%");
  assert.equal(chipState("downloading", 0).text, "On-device model: downloading 0%");
  assert.equal(chipState("downloading", 1).pct, 100);
  assert.equal(chipState("downloading", null).text, "On-device model: downloading");
  assert.equal(chipState("downloading", 0.5).showBar, true);
  assert.equal(chipState("available").text, "On-device model ready");
  assert.match(chipState("available").cls, /chip-ready/);
  assert.equal(chipState("available").showBar, false);
  assert.equal(chipState("downloadable").canStart, true);
  assert.equal(chipState("unavailable").text, "On-device not available on this device: using cloud");
  assert.match(chipState("whatever").text, /not available in this browser/);
  assert.equal(chipState("downloading", 7).pct, 100);
});
