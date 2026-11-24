// T3007: every scan failure ends in a short sentence a first-time user (a judge) can act on. Never a silent hang, never raw SDK text.
export const CLOUD_TIMEOUT_MS = 60000;

/** Rejects with a "timed out" error when the promise has not settled after ms. */
export function withTimeout(promise, ms = CLOUD_TIMEOUT_MS) {
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("The model call timed out.")), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/** deep: true when the failed run was a Deep scan. */
export function friendlyError(err, { deep = false } = {}) {
  const m = String(err?.message || err);
  const next = deep ? "Deep scan is not available right now." : "Quick private scan could not run on this computer. Try Deep scan.";
  if (/app.?check|40[13]|permission|api.?key/i.test(m)) return deep ? next + " The cloud model refused this copy of Lens." : next;
  if (/quota|429|RESOURCE/i.test(m)) return "The free cloud quota is used up for now. Try again later.";
  if (/timed out/i.test(m)) return deep ? next + " The cloud took too long to answer." : next;
  if (/network|fetch/i.test(m)) return "Could not reach the cloud model. Check your connection and try again.";
  if (/^(Open a normal web page|Lens needs permission|Not enough readable text|Nothing more to analyse)/.test(m)) return m;
  return next;
}
