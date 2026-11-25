// T3010: with the flag off (the default) the built extension has no Check button, no Check text and no Check call.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const CHECK_TEXT = /Checking the web|check-btn|free checks|Deep check in MentionFox|Web checks are|lens\/check|Check this claim|The Check button/;

const bundle = async (show, minify) => {
  const r = await build({ entryPoints: ["src/sidepanel/sidepanel.js"], bundle: true, write: false, format: "iife", platform: "browser", target: "chrome139", minify, minifySyntax: true, legalComments: "none", logLevel: "silent",
    define: { __FIREBASE_OVERRIDE__: "{}", __APPCHECK_DEBUG_TOKEN__: '""', __DEV_BUILD__: "false", __E2E__: "false", __SHOW_CHECK__: JSON.stringify(show) } });
  return r.outputFiles[0].text;
};

test("flag off: no Check text or Check route in the side panel bundle, minified or not", async () => {
  for (const minify of [false, true]) assert.doesNotMatch(await bundle(false, minify), CHECK_TEXT);
});

test("flag on: the Check code is still there", async () => {
  const out = await bundle(true, false);
  assert.match(out, /Checking the web/);
  assert.match(out, /lens\/check/);
});

test("the Check sentence in the panel footer sits inside the build markers", () => {
  const html = readFileSync("src/sidepanel/sidepanel.html", "utf8");
  assert.doesNotMatch(html.replace(/<!--check-start-->[\s\S]*?<!--check-end-->/g, ""), /Check button/);
});
