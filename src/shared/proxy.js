// T3230: the public build's cloud path: page text goes to our own server (lens-api/), which fixes the model, the prompt and the output size.
// Pure helpers (no chrome.* here) so they can be unit tested.
import { preparePageText, MAX_PAGE_CHARS } from "./prompts.js";
import { stripMarkers } from "./match.js";
import { DEEP_PAGE_CHARS } from "./deep.js";

export const PROXY_URL = "https://lens-api.osakasaul.workers.dev/"; // our deployed Worker (lens-api/)
export const INSTALL_KEY = "lensInstallId";
export const PROXY_TIMEOUT_MS = 90000;
export const LIMIT_MESSAGE = "Free daily limit reached, try again tomorrow";
const WINDOW = { deep: DEEP_PAGE_CHARS, quick: MAX_PAGE_CHARS, geo: MAX_PAGE_CHARS };

/** A random id made on this computer, used only to count free cloud requests per install per day. */
export async function installId(storage, uuid = () => crypto.randomUUID()) {
  const got = (await storage.get(INSTALL_KEY))?.[INSTALL_KEY];
  if (typeof got === "string" && got) return got;
  const id = uuid();
  await storage.set({ [INSTALL_KEY]: id });
  return id;
}

/** {mode, text, title} -> the model's JSON as text. Only the same window of the page that the prompt would use leaves the browser. */
export async function runProxy({ mode, text, title }, { storage, url = PROXY_URL, fetchFn = fetch, timeoutMs = PROXY_TIMEOUT_MS }) {
  const body = { mode, text: preparePageText(stripMarkers(text), WINDOW[mode]), install_id: await installId(storage) };
  if (title) body.title = String(title).slice(0, 200);
  let r;
  try {
    r = await fetchFn(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new Error(err?.name === "TimeoutError" ? "The model call timed out." : "Network error: could not reach the cloud.");
  }
  if (r.status === 429) throw new Error(LIMIT_MESSAGE);
  if (!r.ok) throw new Error("Cloud not available (" + r.status + ").");
  return r.text();
}
