// Firebase AI Logic hybrid inference: prefer the on-device model (Gemini Nano in Chrome), fall back to the cloud.
// This module runs in the side panel (an extension page), where Chrome's LanguageModel API is visible to the SDK.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, CustomProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource, Schema } from "firebase/ai";
import { firebaseConfig as baseConfig } from "./firebase-config.js";
import { parseModelJson } from "./shared/parse.js";
import { withTimeout } from "./shared/errors.js";
import { DEVICE_SYSTEM, DEVICE_CLAIMS_SCHEMA, buildDeviceChunkPrompt } from "./shared/prompts.js";

/* __FIREBASE_OVERRIDE__ and __APPCHECK_DEBUG_TOKEN__ are replaced at build time (scripts/build.mjs). */
const OVERRIDE = typeof __FIREBASE_OVERRIDE__ !== "undefined" ? __FIREBASE_OVERRIDE__ : {};
const DEBUG_TOKEN = typeof __APPCHECK_DEBUG_TOKEN__ !== "undefined" ? __APPCHECK_DEBUG_TOKEN__ : "";

export const firebaseConfig = { ...baseConfig, ...OVERRIDE };
// Cloud fallback model: the SDK's own hybrid default (see DEFAULT_HYBRID_IN_CLOUD_MODEL in @firebase/ai).
const CLOUD_MODEL = "gemini-3.5-flash-lite";

const TEXT_IO = [{ type: "text", languages: ["en"] }];
let aiInstance = null;

/** App Check first, then AI Logic. Dev builds register the debug provider; production builds have no attestation provider. */
export function getAiInstance() {
  if (aiInstance) return aiInstance;
  if (typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__) { // literal check so the release build drops this branch
    // Dev builds only: App Check debug token. Without a baked-in token the SDK prints a fresh one in the console.
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN || true;
  }
  const app = initializeApp(firebaseConfig);
  initializeAppCheck(app, {
    // Extensions cannot load reCAPTCHA (remote code). In dev the debug token replaces this provider entirely;
    // in a release build cloud calls will be rejected by App Check until an attestation path is added.
    provider: new CustomProvider({
      getToken: async () => {
        throw new Error("No App Check attestation provider in this build. Use a dev build with a registered debug token.");
      },
    }),
    isTokenAutoRefreshEnabled: true,
  });
  aiInstance = getAI(app, { backend: new GoogleAIBackend() });
  return aiInstance;
}

/** Convert the small JSON Schema subset used in prompts.js into a Firebase AI Logic Schema (cloud structured output). */
export function toFirebaseSchema(s) {
  if (s.type === "object") {
    const props = {};
    for (const [k, v] of Object.entries(s.properties || {})) props[k] = toFirebaseSchema(v);
    const optional = Object.keys(props).filter((k) => !(s.required || []).includes(k));
    return Schema.object({ properties: props, optionalProperties: optional, description: s.description });
  }
  if (s.type === "array") return Schema.array({ items: toFirebaseSchema(s.items), description: s.description });
  if (s.type === "integer") return Schema.integer({ description: s.description });
  if (s.enum) return Schema.enumString({ enum: s.enum, description: s.description });
  return Schema.string({ description: s.description });
}

/**
 * Build a hybrid model for one task.
 *  - mode PREFER_ON_DEVICE: Gemini Nano when available, cloud otherwise (SDK decides per request).
 *  - mode ONLY_IN_CLOUD: used for a retry when the on-device answer could not be parsed.
 */
export function createHybridModel(jsonSchema, mode = InferenceMode.PREFER_ON_DEVICE) {
  return getGenerativeModel(getAiInstance(), {
    mode,
    onDeviceParams: {
      createOptions: { expectedInputs: TEXT_IO, expectedOutputs: TEXT_IO }, // text only: no multimodal flag needed
      // The Prompt API enforces this JSON Schema while Nano decodes (structured output on device).
      promptOptions: { responseConstraint: jsonSchema },
    },
    inCloudParams: {
      model: CLOUD_MODEL,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: toFirebaseSchema(jsonSchema),
      },
    },
  });
}

/** Chrome's LanguageModel availability, read directly (UI hint only; the SDK makes the real routing decision). */
export async function probeDevice() {
  const LM = self.LanguageModel;
  if (!LM || typeof LM.availability !== "function") return "unsupported";
  try {
    return await LM.availability({ expectedInputs: TEXT_IO, expectedOutputs: TEXT_IO });
  } catch {
    return "unsupported";
  }
}

const models = new Map();
const getModel = (key, schema, mode) => {
  const k = key + ":" + mode;
  if (!models.has(k)) models.set(k, createHybridModel(schema, mode));
  return models.get(k);
};

let deviceInit = null;
const progressListeners = new Set();
/**
 * Must be called from a user gesture (Analyze click or the Download button). Starts the on-device model download
 * if needed and reports progress 0..1 to every registered listener (the SDK's initializeDeviceModel(progress) path).
 * Safe to call again while a download runs (the new listener is added). Resolves when finished; never rejects
 * (falling back to cloud is not an error in PREFER_ON_DEVICE).
 */
export function initDevice(schema, onProgress) {
  if (onProgress) progressListeners.add(onProgress);
  if (deviceInit) return deviceInit;
  const model = getModel("init", schema, InferenceMode.PREFER_ON_DEVICE);
  const fan = (p) => progressListeners.forEach((fn) => { try { fn(p); } catch { /* UI listener failed */ } });
  deviceInit = model
    .initializeDeviceModel(fan)
    .catch(() => {})
    .finally(() => { deviceInit = null; }); // allow a later retry (e.g. after a failed download)
  return deviceInit;
}

/**
 * Run one task. Returns {value, source, inferred, ms, retried}.
 *  source: "on_device" | "in_cloud" (from response.inferenceSource)
 *  inferred: true only when the SDK did not report a source and we guessed from availability.
 */
export async function runTask({ key, schema, prompt, normalize, deviceStatus, onlyCloud = false }) {   // onlyCloud (T3003, Deep scan): never the on-device model
  const t0 = performance.now();
  let retried = false;
  const attempt = async (mode) => {
    const model = getModel(key, schema, mode);
    const result = await withTimeout(model.generateContent(prompt));   // T3007: no silent hang
    const response = result.response;
    const text = response.text();
    let source = response.inferenceSource;
    let inferred = false;
    if (source !== InferenceSource.ON_DEVICE && source !== InferenceSource.IN_CLOUD) {
      inferred = true;
      source = deviceStatus === "available" && mode !== InferenceMode.ONLY_IN_CLOUD ? InferenceSource.ON_DEVICE : InferenceSource.IN_CLOUD;
    }
    return { text, source, inferred };
  };

  let out = await attempt(onlyCloud ? InferenceMode.ONLY_IN_CLOUD : InferenceMode.PREFER_ON_DEVICE);
  let value;
  try {
    value = normalize(parseModelJson(out.text));
  } catch (parseErr) {
    if (out.source !== InferenceSource.ON_DEVICE) throw parseErr;
    // On-device answer unusable: retry once in the cloud (hybrid fallback on quality, not only availability).
    retried = true;
    out = await attempt(InferenceMode.ONLY_IN_CLOUD);
    value = normalize(parseModelJson(out.text));
  }
  return { value, source: out.source, inferred: out.inferred, ms: Math.round(performance.now() - t0), retried, raw: out.text };
}

/**
 * The on-device claims model: the short system prompt rides along as the Prompt API's system initial prompt (the SDK's on-device adapter
 * ignores systemInstruction), and as the cloud systemInstruction in case the SDK routes a call to the cloud.
 * The SDK creates one Chrome session per call and keeps the last one alive; it does not expose the session (no clone, no reuse).
 */
function createDeviceClaimsModel() {
  return getGenerativeModel(getAiInstance(), {
    mode: InferenceMode.PREFER_ON_DEVICE,
    systemInstruction: DEVICE_SYSTEM,
    onDeviceParams: {
      createOptions: {
        expectedInputs: TEXT_IO,
        expectedOutputs: TEXT_IO,
        initialPrompts: [{ role: "system", content: [{ type: "text", value: DEVICE_SYSTEM }] }],
      },
      promptOptions: { responseConstraint: DEVICE_CLAIMS_SCHEMA },
    },
    inCloudParams: {
      model: CLOUD_MODEL,
      generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: toFirebaseSchema(DEVICE_CLAIMS_SCHEMA) },
    },
  });
}
let deviceClaimsModel = null;
const getDeviceClaimsModel = () => (deviceClaimsModel ||= createDeviceClaimsModel());

let warmPromise = null;
/**
 * Warm-up, called when the side panel opens (no user gesture needed once the model is downloaded): one tiny streamed call through the
 * same model object that the real chunks use. That loads the model into memory (Chrome unloads an idle model) and leaves the SDK's session
 * alive, so the first real chunk does not pay for the cold start. Resolves {ms} or {ms, error}; never rejects.
 */
export function warmDevice() {
  if (warmPromise) return warmPromise;
  const t0 = performance.now();
  warmPromise = (async () => {
    try {
      const { stream } = await getDeviceClaimsModel().generateContentStream(buildDeviceChunkPrompt("Acme Corp was founded in 2019."));
      for await (const c of stream) c.text(); // drain
      return { ms: Math.round(performance.now() - t0) };
    } catch (err) {
      warmPromise = null; // allow a later retry
      return { ms: Math.round(performance.now() - t0), error: String(err?.message || err).slice(0, 160) };
    }
  })();
  return warmPromise;
}

/**
 * Stream one on-device chunk. onText(fullTextSoFar) is called as text arrives. Resolves {text, source, ms, firstTokenMs}.
 * Throws when the model cannot answer (the caller counts the chunk as failed).
 */
export async function streamDeviceChunk(chunkText, onText) {
  const t0 = performance.now();
  const { stream, response } = await getDeviceClaimsModel().generateContentStream(buildDeviceChunkPrompt(chunkText));
  let text = "";
  let source = null;
  let firstTokenMs = null;
  for await (const chunk of stream) {
    if (firstTokenMs == null) firstTokenMs = Math.round(performance.now() - t0);
    source = chunk.inferenceSource || source;
    text += chunk.text();
    try { onText(text); } catch { /* UI callback failed: keep streaming */ }
  }
  if (!source) { try { source = (await response).inferenceSource; } catch { /* no source */ } }
  return { text, source: source || InferenceSource.IN_CLOUD, ms: Math.round(performance.now() - t0), firstTokenMs };
}

export { InferenceSource };
