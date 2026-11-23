// Firebase AI Logic hybrid inference: prefer the on-device model (Gemini Nano in Chrome), fall back to the cloud.
// This module runs in the side panel (an extension page), where Chrome's LanguageModel API is visible to the SDK.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, CustomProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource, Schema } from "firebase/ai";
import { firebaseConfig as baseConfig } from "./firebase-config.js";
import { parseModelJson } from "./shared/parse.js";

/* __FIREBASE_OVERRIDE__ and __APPCHECK_DEBUG_TOKEN__ are replaced at build time (scripts/build.mjs). */
const OVERRIDE = typeof __FIREBASE_OVERRIDE__ !== "undefined" ? __FIREBASE_OVERRIDE__ : {};
const DEBUG_TOKEN = typeof __APPCHECK_DEBUG_TOKEN__ !== "undefined" ? __APPCHECK_DEBUG_TOKEN__ : "";
const IS_DEV = typeof __DEV_BUILD__ !== "undefined" ? __DEV_BUILD__ : false;

export const firebaseConfig = { ...baseConfig, ...OVERRIDE };
// Cloud fallback model: the SDK's own hybrid default (see DEFAULT_HYBRID_IN_CLOUD_MODEL in @firebase/ai).
const CLOUD_MODEL = "gemini-3.5-flash-lite";

const TEXT_IO = [{ type: "text", languages: ["en"] }];
let aiInstance = null;

/** App Check first, then AI Logic. Dev builds register the debug provider; production builds have no attestation provider. */
export function getAiInstance() {
  if (aiInstance) return aiInstance;
  if (IS_DEV) {
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
/**
 * Must be called from a user gesture (Analyze click). Starts the on-device model download if needed and reports
 * progress 0..1. Resolves when ready; never rejects (falling back to cloud is not an error in PREFER_ON_DEVICE).
 */
export function initDevice(schema, onProgress) {
  if (deviceInit) return deviceInit;
  const model = getModel("init", schema, InferenceMode.PREFER_ON_DEVICE);
  deviceInit = model.initializeDeviceModel(onProgress).catch(() => {});
  return deviceInit;
}

/**
 * Run one task. Returns {value, source, inferred, ms, retried}.
 *  source: "on_device" | "in_cloud" (from response.inferenceSource)
 *  inferred: true only when the SDK did not report a source and we guessed from availability.
 */
export async function runTask({ key, schema, prompt, normalize, deviceStatus }) {
  const t0 = performance.now();
  let retried = false;
  const attempt = async (mode) => {
    const model = getModel(key, schema, mode);
    const result = await model.generateContent(prompt);
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

  let out = await attempt(InferenceMode.PREFER_ON_DEVICE);
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
  return { value, source: out.source, inferred: out.inferred, ms: Math.round(performance.now() - t0), retried };
}

export { InferenceSource };
