import test from "node:test";
import assert from "node:assert/strict";
import { friendlyError, withTimeout } from "../src/shared/errors.js";

const refused = new Error("AI: Error fetching from https://firebasevertexai.googleapis.com: [401 ] Firebase App Check token is invalid. (AI/fetch-error)");

test("a refused Quick scan says so briefly and points to Deep scan", () => {
  assert.equal(friendlyError(refused), "Quick private scan could not run on this computer. Try Deep scan.");
});

test("a refused Deep scan never points to itself and shows no SDK text", () => {
  const t = friendlyError(refused, { deep: true });
  assert.equal(t, "Deep scan is not available right now. The cloud model refused this copy of Lens.");
});

test("unknown model errors stay short; page errors pass through", () => {
  assert.equal(friendlyError(new Error("x".repeat(500))), "Quick private scan could not run on this computer. Try Deep scan.");
  assert.equal(friendlyError(new Error("Not enough readable text on this page.")), "Not enough readable text on this page.");
});

test("a hung call ends with a timeout", async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20), /timed out/);
  assert.equal(await withTimeout(Promise.resolve(7), 20), 7);
});
