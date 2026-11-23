// Deterministic second opinion on "vague or puffery". A claim that carries a checkable anchor (a date, a number, an amount,
// a named place, organisation, person or event) is specific and checkable, even when one subjective word sits in it.
// Used after the model answers, on both the on-device and the cloud path. Kept conservative: no anchor found means the model's label stands.

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE_RES = [
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, "i"), // March 5, 1992
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\.?(?:,?\\s+\\d{4})?\\b`, "i"), // 5 March 1992
  new RegExp(`\\b(?:${MONTHS})\\.?,?\\s+(?:of\\s+)?(?:1[5-9]|20)\\d{2}\\b`, "i"), // March 1992
  /\b(?:in|since|from|by|until|before|after|during|circa|c\.)\s+(?:1[5-9]|20)\d{2}\b/i,
  /\b(?:1[5-9]|20)\d{2}\b/, // a bare year
  /\b(?:Q[1-4]|H[12])\s*(?:'?\d{2,4})?\b/,
];
const AMOUNT_RES = [
  /[$€£¥]\s?\d[\d,.]*(?:\s?(?:k|m|bn|b|million|billion|trillion|thousand))?\b/i,
  /\b\d[\d,.]*\s?(?:%|percent|per cent)/i,
  /\b\d[\d,.]*\s?(?:million|billion|trillion|thousand|k|m|bn|x)\b/i,
  /\b\d{1,3}(?:,\d{3})+\b/, // 1,200
  /\b\d+(?:\.\d+)?\b/, // any other number
];
// "#1", "number one", "No. 1" are ranking puffery unless a source is named, so they are not anchors.
const RANK_PUFF = /(?:#\s?1\b|\bno\.?\s?1\b|\bnumber\s+(?:one|1)\b|\b100\s?%\s+(?:satisfaction|guaranteed|safe|secure|reliable)|\b24\/7\b)/gi;

// Capitalised words that do not name anything checkable.
const NOT_NAMES = new Set(
  ("i we our ours us you your he she it its his her they their them this that these those the a an and or but if so as at by in of on to for with from into about after before " +
    "mr mrs ms dr sir best leading top greatest ultimate premier trusted innovative revolutionary world-class worldclass award-winning global industry-leading " +
    "monday tuesday wednesday thursday friday saturday sunday " +
    "american british english french german spanish italian chinese japanese korean indian russian canadian australian european african asian latin western eastern " +
    "jewish christian muslim catholic protestant buddhist hindu irish scottish welsh dutch swiss swedish danish norwegian greek turkish arab israeli mexican brazilian " +
    "new great big small first last next one two three ceo cto cfo coo api saas roi seo cpo vp").split(" "),
);
const NAME_JOINERS = new Set(["of", "de", "la", "le", "van", "von", "the", "and", "&", "for", "del", "da", "du"]);

const SUBJECTIVE = [
  "upper-class", "lower-class", "middle-class", "world-class", "best-in-class", "industry-leading", "state-of-the-art", "cutting-edge", "award-winning",
  "visionary", "revolutionary", "innovative", "world-renowned", "renowned", "legendary", "iconic", "brilliant", "genius", "amazing", "incredible",
  "beautiful", "wonderful", "excellent", "outstanding", "exceptional", "remarkable", "stunning", "powerful", "seamless", "robust", "trusted",
  "passionate", "dedicated", "talented", "successful", "prominent", "famous", "infamous", "controversial", "wealthy", "affluent", "elite",
  "leading", "premier", "unparalleled", "unmatched", "unrivaled", "best", "greatest", "finest", "top", "ultimate", "ambitious", "charismatic",
];

for (const w of SUBJECTIVE) NOT_NAMES.add(w); // a capitalised praise word never names anything

function dateOrAmount(text) {
  const t = text.replace(RANK_PUFF, " ");
  for (const re of DATE_RES) { const m = re.exec(t); if (m) return { type: "date", text: m[0].trim() }; }
  for (const re of AMOUNT_RES) { const m = re.exec(t); if (m) return { type: /[$€£¥%]|percent|per cent|million|billion|trillion/i.test(m[0]) ? "amount" : "number", text: m[0].trim() }; }
  return null;
}

/** Runs of capitalised words (joined by of/de/and...), leading pronouns and articles dropped. Returns [{text, words, first, prev}] */
function nameRuns(text) {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.&-]*|[,;:.!?()"“”]/gu) || [];
  const runs = [];
  let cur = [];
  let sentenceFirst = true;
  let prev = "";
  const flush = () => {
    while (cur.length && (NOT_NAMES.has(cur[0].w.toLowerCase()) || NAME_JOINERS.has(cur[0].w.toLowerCase()))) cur.shift();
    while (cur.length && NAME_JOINERS.has(cur[cur.length - 1].w.toLowerCase())) cur.pop();
    const caps = cur.filter((c) => !NAME_JOINERS.has(c.w.toLowerCase()));
    if (caps.length) runs.push({ text: cur.map((c) => c.w).join(" "), words: caps.length, first: cur[0].first, prev: cur[0].prev, acronym: caps.length === 1 && /^\p{Lu}{3,6}$/u.test(caps[0].w) });
    cur = [];
  };
  for (const w of words) {
    if (/^[,;:.!?()"“”]$/.test(w)) {
      flush();
      if (/[.!?]/.test(w)) sentenceFirst = true;
      prev = "";
      continue;
    }
    const lower = w.toLowerCase();
    if (/^\p{Lu}/u.test(w) && !NOT_NAMES.has(lower)) {
      cur.push({ w, first: sentenceFirst && cur.length === 0, prev: cur.length ? cur[0].prev : prev });
    } else if (cur.length && NAME_JOINERS.has(lower)) {
      cur.push({ w, first: false, prev: cur[0].prev });
    } else flush();
    sentenceFirst = false;
    prev = lower;
  }
  flush();
  return runs;
}

const NAME_PREPS = new Set(["in", "at", "from", "by", "with", "of", "for", "to", "near", "on", "into", "across", "via", "under", "over", "than", "like", "founded", "acquired", "joined", "led", "backed", "named", "called", "against", "after", "before", "between"]);

/** Most longer words start with a capital: slogan or headline style, where capitals say nothing about names. */
function isTitleCase(text) {
  const ws = (text.match(/\p{L}[\p{L}'’-]*/gu) || []).filter((w) => w.length > 3);
  if (ws.length < 4) return false;
  return ws.filter((w) => /^\p{Lu}/u.test(w)).length / ws.length >= 0.6;
}

/**
 * The first checkable anchor in a claim, or null.
 * Returns {type: "date"|"number"|"amount"|"name", text}. A name counts when it has two or more capitalised words (Sam Bankman-Fried,
 * Northgate Capital), or one capitalised word after a preposition (in Stanford, at Stripe) or an acronym of 3 to 6 letters (FTX).
 */
export function findAnchor(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const d = dateOrAmount(t);
  if (d) return d;
  if (isTitleCase(t)) return null; // Every Word Capitalised: a headline or slogan, names cannot be told apart
  for (const r of nameRuns(t)) {
    if (r.words >= 2 || r.acronym || (!r.first && NAME_PREPS.has(r.prev))) return { type: "name", text: r.text };
  }
  return null;
}

/** The first subjective word in a claim, or null. Whole-word match, hyphenated forms included. */
export function findSubjectiveWord(text) {
  const t = String(text ?? "").toLowerCase();
  for (const w of SUBJECTIVE) {
    const re = new RegExp(`(?<![\\p{L}-])${w.replace(/[-]/g, "[-‐-―]")}(?![\\p{L}])`, "u");
    if (re.test(t)) return w;
  }
  return null;
}

const TYPE_LABEL = { date: "a date", number: "a number", amount: "an amount", name: "a named place, person or organisation" };

/**
 * Deterministic override: a claim labelled vague that carries a checkable anchor becomes specific.
 * Adds `note` when a subjective word is present ("contains a subjective word: upper-class") and replaces the model's reason,
 * which argued for "vague", with one that names the anchor. Claims with no anchor are returned unchanged.
 */
export function reconcileKind(claim) {
  const anchor = findAnchor(claim.quote);
  const word = findSubjectiveWord(claim.quote);
  if (claim.kind !== "vague" || !anchor) {
    return word && claim.kind === "specific" && anchor ? { ...claim, note: `contains a subjective word: ${word}` } : claim;
  }
  const note = word ? `contains a subjective word: ${word}` : "";
  const why = `Names ${TYPE_LABEL[anchor.type]} (${anchor.text}) that a reader can check against a public source.`;
  return { ...claim, kind: "specific", why, note, overridden: true, anchor };
}
