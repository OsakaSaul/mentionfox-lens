// Creates a random UUID v4 App Check debug token in .env.local (gitignored) if none exists.
// Register the printed value in Firebase console > App Check > Apps > Manage debug tokens.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
const p = new URL("../.env.local", import.meta.url);
const has = existsSync(p) && /^APPCHECK_DEBUG_TOKEN=/m.test(readFileSync(p, "utf8"));
if (!has) appendFileSync(p, `APPCHECK_DEBUG_TOKEN=${randomUUID()}\n`);
console.log(has ? ".env.local already has APPCHECK_DEBUG_TOKEN" : "wrote APPCHECK_DEBUG_TOKEN to .env.local");
