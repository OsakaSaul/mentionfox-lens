// TEST HARNESS ONLY. Bundled only by `npm run build:e2e`; never part of `npm run build` or `build:dev`.
// It replaces the model with canned answers so the extension shell (content script, highlights, side panel UI)
// can be exercised in CI without Gemini Nano or a registered App Check debug token. Output is labelled as a mock.
// It also simulates the on-device availability states and the download progress callback:
//   ?mock=<state> where state is one of: available | unavailable | unsupported | downloadable | downloading | failed
//   (legacy: "device" = available, "cloud" = unavailable)
//   window.__mflProgress(p) fires the SDK-style progress callback; window.__MFL_MS__ overrides the reported latency.
import { InferenceSource } from "firebase/ai";

export function mockEngine(modeName) {
  let availability = { device: "available", cloud: "unavailable", failed: "available" }[modeName] || modeName;
  const listeners = new Set();
  window.__mflProgress = (p) => {
    listeners.forEach((fn) => fn(p));
    if (p >= 1) availability = "available";
  };
  window.__mflSetAvailability = (a) => { availability = a; };
  return {
    probeDevice: async () => availability,
    initDevice: async (_s, onProgress) => {
      if (onProgress) listeners.add(onProgress);
      if (availability === "downloadable") availability = "downloading";
    },
    runTask: async ({ key, normalize }) => {
      const t0 = performance.now();
      const canned = window.__MFL_MOCK__?.[key];
      if (!canned) throw new Error("no mock for " + key);
      await new Promise((r) => setTimeout(r, 30));
      const onDevice = availability === "available" && modeName !== "failed";
      const ms = window.__MFL_MS__ != null ? Number(window.__MFL_MS__) : Math.round(performance.now() - t0);
      return { value: normalize(canned), source: onDevice ? InferenceSource.ON_DEVICE : InferenceSource.IN_CLOUD, inferred: false, ms, retried: false };
    },
  };
}
