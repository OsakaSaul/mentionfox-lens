// Card quality (T3003). Pure functions, unit tested (test/quality.test.js).
//
//   isAttributionFragment(quote)  "Robertson told me in an interview." is an attribution tag, not a claim: never a card.
//   orderCards(claims)            red flags first, then everything else in the order it came (page order).
//   cardSummary(claims)           "3 red flags · 6 specific · 1 vague".

const ATTRIBUTION_VERB = "told|tells|said|says|asked|asks|added|adds|noted|notes|explained|explains|wrote|writes|recalled|recalls|continued|replied|replies|responded|insisted|remarked|observed";
const ATTRIBUTION_ONLY = new RegExp(`^["“'(]?[A-Z][\\w.'’-]*(?:\\s+[A-Z][\\w.'’-]*){0,3}\\s+(?:${ATTRIBUTION_VERB})\\b[^.,;:]{0,45}[.:]?["”']?$`);
const LEAD_IN = new RegExp(`^["“'(]?(?:[A-Z][\\w.'’-]*\\s+){1,3}(?:${ATTRIBUTION_VERB})\\b[^.]{0,60}:$`);
const CONJUNCTION_START = /^(?:and|but|or|which|that|so|then|also|because|while|whereas|although)\b/i;

/** A piece of a sentence that cannot be checked on its own: an attribution tag ("X told me in an interview"), a lead-in that ends with a colon, or a clause that starts with a conjunction. */
export function isAttributionFragment(quote) {
  const q = String(quote || "").replace(/\s+/g, " ").trim();
  if (!q) return true;
  const words = q.split(" ").length;
  if (/\d/.test(q) && words > 4) return false;   // a number makes it a claim, unless it is just "said on May 3"
  if (LEAD_IN.test(q)) return true;
  if (words <= 9 && ATTRIBUTION_ONLY.test(q)) return true;
  if (CONJUNCTION_START.test(q) && words <= 12 && !/[.!?]["”']?$/.test(q)) return true;
  return false;
}

/** Red flags first, then the rest in their original order. Stable; returns a new array. */
export function orderCards(claims) {
  const red = [], rest = [];
  for (const c of claims || []) (c.kind === "redflag" ? red : rest).push(c);
  return [...red, ...rest];
}

/** "3 red flags · 6 specific · 1 vague" (zero counts are left out). */
export function cardSummary(claims) {
  const n = { red: 0, specific: 0, vague: 0 };
  for (const c of claims || []) {
    if (c.kind === "redflag") n.red++;
    else if (c.kind === "vague") n.vague++;
    else n.specific++;
  }
  const parts = [];
  if (n.red) parts.push(`${n.red} red flag${n.red === 1 ? "" : "s"}`);
  if (n.specific) parts.push(`${n.specific} specific`);
  if (n.vague) parts.push(`${n.vague} vague`);
  return parts.join(" · ");
}

// ---- card order (T3003, Saul): red flags first, then amber (vague), then AT MOST 2 green (specific) cards, the 2 most consequential. The rest sit behind a collapsed
// "Show N more checkable claims" row. People want to know what sticks, not what smells sweet.
export const MAX_GREEN_SHOWN = 2;
export const MORE_ROW_TIP = "Claims with a date, number or name that look checkable";

/** How consequential a green claim is: big amounts and percentages, any figure, an unsourced figure, named organisations. Higher = shown first. */
export function consequence(c) {
  const q = String(c.quote || "");
  let n = 0;
  if (/[$€£¥]\s?\d|\b\d[\d,.]*\s?(?:%|percent|billion|million|trillion|thousand)\b/i.test(q)) n += 3;
  else if (/\d/.test(q)) n += 2;
  if (c.unsourced) n += 2;
  if (/\b(?:more than|over|up to|as many as|at least|nearly|about)\s+\d/i.test(q)) n += 1;
  n += Math.min(2, (q.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g) || []).length > 3 ? 1 : 0);
  return n;
}

/**
 * Split the claims into what is shown and what is collapsed. shown = red flags (page order), then vague (page order), then at most `maxGreen` green cards by consequence.
 * more = the other green cards, in page order. Nothing is dropped: every claim is in exactly one list.
 */
export function pickCards(claims, maxGreen = MAX_GREEN_SHOWN) {
  const list = claims || [];
  const red = list.filter((c) => c.kind === "redflag");
  const vague = list.filter((c) => c.kind === "vague");
  const green = list.filter((c) => c.kind !== "redflag" && c.kind !== "vague");
  const ranked = green.map((c, i) => ({ c, i, s: consequence(c) })).sort((a, b) => b.s - a.s || a.i - b.i);
  const top = ranked.slice(0, maxGreen).map((x) => x.c);
  const more = green.filter((c) => !top.includes(c));
  return { shown: [...red, ...vague, ...top], more };
}
