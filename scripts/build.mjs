// Bundles the extension into dist/ with esbuild. No remote code: the Firebase SDK is bundled.
//   npm run build       release build (no App Check debug provider, no token)
//   npm run build:dev   dev build (App Check debug token from .env.local, or the SDK prints a fresh one)
//   npm run build:e2e   dev build + test mock (test harness only)
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const dev = process.argv.includes("--dev");
const e2e = process.argv.includes("--e2e");
const showCheck = process.env.LENS_SHOW_CHECK === "true"; // T3010: the Check button is off unless asked for

function readEnv() {
  const p = resolve(root, ".env.local");
  const env = {};
  if (!existsSync(p)) return env;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = readEnv();

// Optional override of the committed public Firebase config: FIREBASE_API_KEY, FIREBASE_PROJECT_ID, ...
const map = { FIREBASE_API_KEY: "apiKey", FIREBASE_AUTH_DOMAIN: "authDomain", FIREBASE_PROJECT_ID: "projectId", FIREBASE_STORAGE_BUCKET: "storageBucket", FIREBASE_MESSAGING_SENDER_ID: "messagingSenderId", FIREBASE_APP_ID: "appId" };
const override = {};
for (const [k, v] of Object.entries(map)) if (env[k]) override[v] = env[k];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
  bundle: true,
  format: "iife",
  target: "chrome139",
  platform: "browser",
  minify: !dev,
  minifySyntax: true, // also in dev builds, so code behind an off flag is left out of the bundle
  sourcemap: dev ? "inline" : false,
  legalComments: "none",
  logLevel: "info",
  define: {
    __FIREBASE_OVERRIDE__: JSON.stringify(override),
    __APPCHECK_DEBUG_TOKEN__: JSON.stringify(dev ? env.APPCHECK_DEBUG_TOKEN || "" : ""),
    __DEV_BUILD__: JSON.stringify(dev),
    __USE_PROXY__: JSON.stringify(!dev), // T3230: the public build's cloud path is our own server; dev builds keep Firebase AI Logic
    __E2E__: JSON.stringify(e2e),
    __SHOW_CHECK__: JSON.stringify(showCheck),
  },
};

await build({
  ...common,
  entryPoints: {
    sidepanel: resolve(root, "src/sidepanel/sidepanel.js"),
    popup: resolve(root, "src/popup/popup.js"),
    content: resolve(root, "src/content.js"),
    background: resolve(root, "src/background.js"),
  },
  outdir: dist,
});

cpSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
const panelHtml = readFileSync(resolve(root, "src/sidepanel/sidepanel.html"), "utf8");
// T3230: the public build sends cloud text to our own server, so its privacy line says that. The dev build keeps the line it has.
const PRIVACY_DEV = "sends the page text to Firebase AI Logic, only when you click. Nothing goes to MentionFox.";
const PRIVACY_PUBLIC = "sends the page text to our server, where an AI provider working for us reads it, only when you click. Our server does not store the text; it counts requests to enforce a free daily limit.";
if (!panelHtml.includes(PRIVACY_DEV)) throw new Error("privacy line not found in sidepanel.html");
writeFileSync(resolve(dist, "sidepanel.html"), (dev ? panelHtml : panelHtml.replace(PRIVACY_DEV, PRIVACY_PUBLIC)).replace(/<!--check-start-->([\s\S]*?)<!--check-end-->/g, (_, inner) => (showCheck ? inner : "")));
cpSync(resolve(root, "src/sidepanel/ui.css"), resolve(dist, "ui.css"));
cpSync(resolve(root, "src/popup/popup.html"), resolve(dist, "popup.html"));
cpSync(resolve(root, "src/content.css"), resolve(dist, "content.css"));
mkdirSync(resolve(dist, "icons"), { recursive: true });
for (const n of [16, 32, 48, 128]) cpSync(resolve(root, `icons/icon${n}.png`), resolve(dist, `icons/icon${n}.png`));
console.log(`built dist/ (${dev ? "dev" : "release"}${e2e ? ", e2e mock" : ""})`);
