// A stand-in for the on-device model (it cannot run in node). It reads the SAME system prompt the extension sends and behaves the way a
// small model plausibly does with it: an instruction that asks for "1 to 3" claims gets one or two sentences, labelled specific; an
// instruction that asks for EVERY claim gets most sentences, praise labelled vague, but it still mislabels praise that names the company
// as specific (the reconcile step must catch that). This is a mock, not a measurement of Gemini Nano.
import { DEVICE_SYSTEM } from "../../src/shared/prompts.js";

const sentences = (t) => t.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter((s) => s.length >= 25);
const PRAISE = /\b(best|brightest|leading|believe|inherent|outstanding|very best|great|success|creating|committed)\b/i;

export function mockDeviceModel(chunk, mode = "plausible", system = DEVICE_SYSTEM) {
  const sens = sentences(chunk);
  const wantsEvery = /EVERY claim/.test(system) && mode !== "terse";
  let picked;
  if (!wantsEvery) picked = sens.slice(0, mode === "terse" ? 1 : 2).map((q) => ({ quote: q, kind: "specific", why: "A reader can check this against a public source." }));
  else picked = sens.slice(0, 12).map((q) => ({ quote: q, kind: PRAISE.test(q) && !/\bEnron\b/.test(q) ? "vague" : "specific", why: "A reader can check what is said." }));
  return JSON.stringify({ claims: picked });
}
