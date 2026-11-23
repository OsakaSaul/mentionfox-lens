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
export function findAnchor(text) { return findAnchorDetail(text).anchor; }

// The page's own organisation. Puffery that names its own company ("Enron is a laboratory of innovation") is still puffery: the
// speaker's own name is not something a reader can check. Set per page from the title and the address (see deriveSelfNames).
const CORP_WORDS = new Set(["inc", "corp", "corporation", "co", "company", "ltd", "llc", "plc", "group", "holdings", "gmbh", "the"]);
let selfNames = new Set();
const bare = (w) => String(w).toLowerCase().replace(/['’]s$/, "").replace(/[^\p{L}\p{N}-]+/gu, "");

export function setSelfNames(list) { selfNames = new Set((list || []).map(bare).filter((w) => w.length >= 3)); }

/** Names the page speaks as: the first part of the title (before a colon, bar or dash) and the site name from the address (web.archive.org unwrapped). */
export function deriveSelfNames({ title = "", url = "" } = {}) {
  const out = new Set();
  const head = String(title).split(/\s[|–—-]\s|\s--\s|:|\|/)[0].trim();
  if (head.split(/\s+/).length <= 4) for (const w of head.match(/[\p{L}\p{N}][\p{L}\p{N}'’&-]*/gu) || []) out.add(bare(w));
  let u = String(url);
  const wb = /\/web\/\d+[a-z_]*\/(https?:\/\/.+)$/i.exec(u);
  if (wb) u = wb[1];
  try {
    const labels = new URL(u).hostname.toLowerCase().split(".").filter((l) => !/^(www\d*|m|en|web|archive|com|org|net|io|co|gov|edu|uk|jp|de|fr|ai|app|dev|me|us)$/.test(l));
    for (const l of labels) out.add(bare(l));
  } catch { /* not a URL */ }
  return [...out].filter((w) => w.length >= 3 && !CORP_WORDS.has(w));
}

const isSelfRun = (text) => {
  const real = text.split(/\s+/).map(bare).filter((w) => w && !CORP_WORDS.has(w) && !NAME_JOINERS.has(w));
  return real.length > 0 && real.every((w) => selfNames.has(w));
};

/** Like findAnchor, plus selfOnly: true when the only name found was the page's own organisation (never an anchor). */
export function findAnchorDetail(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { anchor: null, selfOnly: false };
  const d = dateOrAmount(t);
  if (d) return { anchor: d, selfOnly: false };
  if (isTitleCase(t)) return { anchor: null, selfOnly: false }; // Every Word Capitalised: a headline or slogan, names cannot be told apart
  let selfOnly = false;
  let named = false;
  for (const r of nameRuns(t)) {
    if (isSelfRun(r.text)) { selfOnly = true; continue; }
    if (!r.first) named = true; // the speaker naming itself, even as a lone sentence-initial word
    if (r.words >= 2 || r.acronym || (!r.first && NAME_PREPS.has(r.prev))) return { anchor: { type: "name", text: r.text }, selfOnly: false };
  }
  return { anchor: null, selfOnly, named };
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

// Statements of belief, values and praise: nothing a reader can check even when the model calls them specific.
const PUFF_RES = [
  /\b(?:we|our)\s+(?:believe|value|are committed|are convinced|strive|aim|think|will continue|are satisfied|operate|take)\b/i,
  /\b(?:we|together,?\s+we|here,?\s+we)(?:'re|’re|\s+are)?\s+(?:creating|defining|building|changing|dedicated|passionate|focused)\b/i,
  /\bbest and (?:the )?brightest\b/i,
  /\b(?:inherent|true|real)\s+(?:wisdom|value|power|passion)\b/i,
  /\bour (?:mission|vision|values|purpose|culture)\b/i,
];
const FIRST_PERSON = /^(?:(?:together|here|so|and|that['’]s why|but),?\s+)?(?:we|our)\b/i;

/**
 * Deterministic second opinion on the model's label. Returns {claim, decision}; decision = {sentence, before, after, reason}.
 *  - vague with a checkable anchor -> specific (a date, number, amount, named place, person, organisation or event).
 *  - specific with NO checkable anchor and a puffery signal (praise word, belief or values statement, first-person "we", or only the
 *    page's own company name) -> vague. The speaker naming itself is never an anchor.
 *  - anything else: the model's label stands.
 */
export function reconcileDecision(claim) {
  const { anchor, selfOnly, named } = findAnchorDetail(claim.quote);
  const word = findSubjectiveWord(claim.quote);
  const decision = (after, reason) => ({ sentence: claim.quote, before: claim.kind, after, reason });
  if (claim.kind === "vague" && anchor) {
    const note = word ? `contains a subjective word: ${word}` : "";
    const why = `Names ${TYPE_LABEL[anchor.type]} (${anchor.text}) that a reader can check against a public source.`;
    return { claim: { ...claim, kind: "specific", why, note, overridden: true, anchor }, decision: decision("specific", `vague -> specific: checkable ${anchor.type} anchor '${anchor.text}'`) };
  }
  if (claim.kind === "specific" && !anchor) {
    const signal = word ? `praise word '${word}'` : PUFF_RES.some((re) => re.test(claim.quote)) ? "belief or values statement" : FIRST_PERSON.test(String(claim.quote).trim()) ? "first-person statement of intent" : selfOnly ? "names only the page's own company" : !named ? "nothing in it is named, dated or counted" : "";
    if (signal) {
      const why = "Nothing in it gives a date, number, amount or named event to check; it is a statement of belief or praise.";
      return { claim: { ...claim, kind: "vague", why, note: word ? `contains a subjective word: ${word}` : "", overridden: true }, decision: decision("vague", `specific -> vague: no checkable anchor, ${signal}`) };
    }
  }
  if (claim.kind === "specific" && anchor && word) return { claim: { ...claim, note: `contains a subjective word: ${word}` }, decision: decision("specific", `kept: anchor ${anchor.type} '${anchor.text}' with subjective word '${word}'`) };
  return { claim, decision: decision(claim.kind, anchor ? `kept: anchor ${anchor.type} '${anchor.text}'` : "kept: no anchor and no puffery signal, model label stands") };
}

/** The reconciled claim only. */
export function reconcileKind(claim) { return reconcileDecision(claim).claim; }
