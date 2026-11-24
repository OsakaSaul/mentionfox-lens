// TEST HARNESS ONLY. Bundled only by `npm run build:e2e`; never part of `npm run build` or `build:dev`.
// It replaces the model with canned answers so the extension shell (content script, highlights, side panel UI)
// can be exercised in CI without Gemini Nano or a registered App Check debug token. Output is labelled as a mock.
// It also simulates the on-device availability states and the download progress callback:
//   ?mock=<state> where state is one of: available | unavailable | unsupported | downloadable | downloading | failed
//   (legacy: "device" = available, "cloud" = unavailable)
//   window.__mflProgress(p) fires the SDK-style progress callback; window.__MFL_MS__ overrides the reported latency.
import { InferenceSource } from "firebase/ai";
import { normalizeCheck } from "./shared/check.js";

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
    // Warm-up (panel open): records that it ran and when, so the e2e can prove it happens before any Analyze click.
    warmDevice: async () => { window.__mflWarm = { at: performance.now(), clicked: !!window.__mflClickedAt }; await new Promise((r) => setTimeout(r, 20)); return { ms: 20 }; },
    // Chunked on-device run: canned claims are spread over the chunks (claim j goes to chunk j mod N) and streamed object by object,
    // window.__MFL_CHUNK_MS__ per chunk (default 30), so the e2e can prove the first card appears before the last chunk is done.
    streamChunk: async (chunk, onText, info) => {
      (window.__mflChunks ||= []).push(chunk.length);
      if (modeName === "failed") throw new Error("mock on-device failure");
      const t0 = performance.now();
      const all = window.__MFL_MOCK__?.claims?.claims || [];
      const mine = all.filter((_, j) => j % info.total === info.index).map((c) => JSON.stringify(c));
      const per = Number(window.__MFL_CHUNK_MS__ ?? 30);
      let text = '{"claims":[';
      for (let k = 0; k < mine.length; k++) {
        await new Promise((r) => setTimeout(r, per / (mine.length + 1)));
        text += (k ? "," : "") + mine[k];
        onText(text);
      }
      await new Promise((r) => setTimeout(r, per / (mine.length + 1)));
      text += "]}";
      onText(text);
      (window.__mflChunkLog ||= []).push({ index: info.index, total: info.total, ms: Math.round(performance.now() - t0) });
      return { text, source: InferenceSource.ON_DEVICE, ms: Math.round(performance.now() - t0) };
    },
    // Check: a canned Worker reply {verdict, reason, sources} from window.__MFL_MOCK__.check; records every request that would be sent ({claim, domain, date}).
    runCheck: async (req) => {
      (window.__mflCheckPrompts ||= []).push(req);
      const c = window.__MFL_MOCK__?.check;
      if (!c) throw new Error("no mock for check");
      if (c.error) throw Object.assign(new Error(c.error), { code: c.code || "not_available" });
      await new Promise((r) => setTimeout(r, 30));
      return { ...normalizeCheck(c), ms: window.__MFL_MS__ != null ? Number(window.__MFL_MS__) : 30 };
    },
    runTask: async ({ key, normalize, prompt }) => {
      const t0 = performance.now();
      (window.__mflPrompts ||= {})[key] = prompt; // lets the e2e check what text would have been sent
      const canned = window.__MFL_MOCK__?.[key];
      if (!canned) throw new Error("no mock for " + key);
      await new Promise((r) => setTimeout(r, 30));
      const onDevice = availability === "available" && modeName !== "failed";
      const ms = window.__MFL_MS__ != null ? Number(window.__MFL_MS__) : Math.round(performance.now() - t0);
      return { value: normalize(canned), source: onDevice ? InferenceSource.ON_DEVICE : InferenceSource.IN_CLOUD, inferred: false, ms, retried: false };
    },
  };
}
