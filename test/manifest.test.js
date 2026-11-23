import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { mentionfoxLink, VERIFY_CLAIMS_URL, DECISION_MAKERS_URL } from "../src/shared/links.js";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
const read = (f) => readFileSync(new URL(f, root), "utf8");

test("manifest is MV3 with required keys", () => {
  assert.equal(manifest.manifest_version, 3);
  for (const k of ["name", "version", "description", "icons", "action", "side_panel", "background", "permissions"]) assert.ok(manifest[k], k);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.background.service_worker, "background.js");
});
test("permissions are minimal and there are no host permissions", () => {
  const allowed = new Set(["activeTab", "scripting", "sidePanel"]);
  for (const p of manifest.permissions) assert.ok(allowed.has(p), `unexpected permission ${p}`);
  for (const p of allowed) assert.ok(manifest.permissions.includes(p), `missing ${p}`);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined, "content script is injected on demand, not declared");
});
test("CSP forbids remote and eval code", () => {
  const csp = manifest.content_security_policy.extension_pages;
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline|https?:/);
});
test("no remote script or stylesheet references in extension pages", () => {
  for (const f of ["src/sidepanel/sidepanel.html", "src/popup/popup.html"]) {
    const html = read(f);
    assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i, f);
    assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i, f);
  }
});
test("manifest-referenced files exist", () => {
  for (const i of Object.values(manifest.icons)) assert.ok(existsSync(new URL(i, root)), i);
  assert.ok(existsSync(new URL("src/sidepanel/" + manifest.side_panel.default_path, root)));
  assert.ok(existsSync(new URL("src/popup/" + manifest.action.default_popup, root)));
});
test("bundled output (if built) has no eval and no dynamic script injection", () => {
  const dist = new URL("dist/", root);
  if (!existsSync(new URL("sidepanel.js", dist))) return; // build is a separate step
  for (const f of ["sidepanel.js", "content.js", "popup.js", "background.js"]) {
    const js = readFileSync(new URL(f, dist), "utf8");
    assert.doesNotMatch(js, /\beval\s*\(/, `${f} eval`);
    assert.doesNotMatch(js, /new Function\s*\(/, `${f} new Function`);
  }
});
test("release build (no debug provider) carries no debug token", () => {
  const p = new URL("dist/sidepanel.js", root);
  if (!existsSync(p) || !existsSync(new URL(".env.local", root))) return;
  const tok = read(".env.local").match(/APPCHECK_DEBUG_TOKEN=(\S+)/)?.[1];
  const js = readFileSync(p, "utf8");
  const isDevBundle = js.includes("sourceMappingURL=data:");
  if (!isDevBundle && tok) assert.ok(!js.includes(tok), "debug token leaked into a release bundle");
});
test("upgrade links: new-tab safe, UTM present, no page data", () => {
  for (const u of [VERIFY_CLAIMS_URL, DECISION_MAKERS_URL]) {
    const url = new URL(u);
    assert.equal(url.origin, "https://mentionfox.com");
    assert.equal(url.searchParams.get("utm_source"), "lens");
    assert.equal(url.searchParams.get("utm_medium"), "extension");
    assert.equal(url.searchParams.get("utm_campaign"), "hybridai");
  }
  assert.match(mentionfoxLink("/x", "c"), /utm_content=c/);
  const html = read("src/sidepanel/sidepanel.html");
  for (const id of ["linkVerify", "linkPeople"]) {
    const tag = html.match(new RegExp(`<a id="${id}"[^>]*>`))[0];
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
    assert.match(tag, /title="/);
    assert.match(tag, /aria-label="/);
  }
});
test("every button and link in the UI html has a tooltip and an accessible name", () => {
  for (const f of ["src/sidepanel/sidepanel.html", "src/popup/popup.html"]) {
    const html = read(f);
    for (const m of html.matchAll(/<(button|a)\b[^>]*>/g)) {
      assert.match(m[0], /title="/, `${f}: ${m[0]}`);
      assert.match(m[0], /aria-label="/, `${f}: ${m[0]}`);
    }
  }
});
test("no model names in user-facing UI strings", () => {
  for (const f of ["src/sidepanel/sidepanel.html", "src/popup/popup.html", "src/sidepanel/sidepanel.js", "src/popup/popup.js"]) {
    assert.doesNotMatch(read(f), /gemini|nano|gpt|claude|llama/i, f);
  }
  assert.doesNotMatch(JSON.stringify([manifest.name, manifest.description, manifest.action]), /gemini|nano/i);
});
