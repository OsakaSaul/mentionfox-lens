// TEST HARNESS ONLY. Bundled only by `npm run build:e2e`; never part of `npm run build` or `build:dev`.
// It replaces the model with canned answers so the extension shell (content script, highlights, side panel UI)
// can be exercised in CI without Gemini Nano or a registered App Check debug token. Output is labelled as a mock.
import { InferenceSource } from "firebase/ai";

export function mockEngine(modeName) {
  const source = modeName === "device" ? InferenceSource.ON_DEVICE : InferenceSource.IN_CLOUD;
  return {
    probeDevice: async () => (modeName === "device" ? "available" : "unsupported"),
    initDevice: async (_s, onProgress) => { onProgress?.(0.5); onProgress?.(1); },
    runTask: async ({ key, normalize }) => {
      const t0 = performance.now();
      const canned = window.__MFL_MOCK__?.[key];
      if (!canned) throw new Error("no mock for " + key);
      await new Promise((r) => setTimeout(r, 30));
      return { value: normalize(canned), source, inferred: false, ms: Math.round(performance.now() - t0), retried: false };
    },
  };
}
