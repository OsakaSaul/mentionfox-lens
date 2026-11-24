// Red flags (T2992): signals a careful reader COULD have caught on the page's own date, judged from the text alone (no hindsight, no outside facts).
// Pure functions, no browser needed. The on-device model may label a card "redflag" too; applyRedFlags() re-checks every such card against the same rules and
// demotes it when the rules do not hold, and it adds the flags the small model missed.
//
// Signals (SIGNALS): extraordinary_claim, evasive_answer, inconsistent_numbers, secrecy.
//
// CALIBRATION (Saul, T2992): "no citation" ALONE is never a red flag (most interviews cite nothing; Lens would cry wolf).
//   extraordinary_claim fires ONLY when ALL THREE hold:
//     (1) the claim is extraordinary against the field: it overturns standard practice or is about ten times the norm;
//     (2) the speaker benefits if it is believed: a founder, seller or issuer talking about its own product;
//     (3) the evidence such a claim normally comes with is absent or withheld: peer-reviewed data, regulator approval, independent validation, named customers.
//   An ordinary unsourced claim (an exact figure from the company itself with nothing to back it) gets a small grey "unsourced" tag on its green card and is NOT a red flag.
//   Obvious puffery ("we will be the leading ...") stays amber Vague: a puffery sentence is never flagged.
import { stripMarkers } from "./match.js";

export const SIGNALS = {
  extraordinary_claim: "Extraordinary claim, key evidence missing",
  evasive_answer: "Evasive answer",
  inconsistent_numbers: "Numbers that do not agree",
  secrecy: "Secrecy as a feature",
};
export const signalLabel = (s) => SIGNALS[s] || "Red flag";

const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Sentences of a text, each trimmed, in order. Splits at . ! ? followed by a space or a line break, and at line breaks. */
export function sentencesOf(text) {
  const out = [];
  for (const line of String(text || "").split(/\n+/)) {
    for (const s of line.split(/(?<=[.!?]["'”’)]?)\s+(?=["'“‘(]?[A-Z0-9])/)) {
      const t = s.trim();
      if (t.length >= 20) out.push(t);
    }
  }
  return out;
}

// ---------- puffery: never a flag ----------
const PUFFERY = /\b(will be|going to be|are going to|is going to|aim(?:s)? to be|strive(?:s)? to be|the leading|a leading|world[- ]class|best[- ]in[- ]class|de facto|really big|number one|market leader|game[- ]chang|revolutionar|visionary|passionate|second to none|unrivall?ed)\b/i;
export const isPuffery = (s) => PUFFERY.test(s) && !/\d/.test(s);

// ---------- (3) the evidence such a claim normally comes with ----------
const EVIDENCE = /\b(peer[- ]reviewed|published in|journal|study|studies|clinical trial|randomi[sz]ed|trial|FDA|cleared by|approved by|approval|regulator|validated|validation|independent(?:ly)?(?!\s+(?:labs?|laborator\w+|hospitals?|clinics?|providers?|firms?|companies|retailers?|pharmac\w+|prices?))|audited|audit|according to|data (?:show|from)|researchers? at|university|institute|reported by|filing|10-k|SEC)\b/i;
const WITHHELD = /\b(not (?:been )?(?:published|peer[- ]reviewed)|unpublished|haven'?t published|have not published|don'?t publish|do not publish|no peer[- ]reviewed|without (?:peer )?review|peer[- ]review\w*[^.]{0,80}(?:unnecessary|inappropriate|not needed)|(?:declin|refus)\w+ to (?:publish|share|release|disclose)|stealth)\b/i;

// ---------- (2) the speaker benefits if believed ----------
const SELLER_VOICE = /\b(we|our|us|my|i)\b/i;
const SELLER_ATTRIB = /\b(founder|co-?founder|ceo|chief executive|president|the company|the startup|its (?:technology|system|platform|product|devices?|tests?)|she says|he says|says (?:she|he|it|the company)|claims? (?:it|that)|said (?:she|he)|boasts?|touts?|promises|insists?)\b/i;
// T3002: an article that PROFILES a company or its founder speaks in the journalist's voice, but a capability it states about that subject ("Theranos can run as many as 70 tests",
// "It currently offers more than 200 ...") is the company's own claim as reported: rule (2) holds when the sentence names the profiled subject, or opens with "it/the company", and
// presents a capability or an offering. Rules (1) and (3) still have to hold.
const CAPABILITY = /\b(can|could|will|is able to|are able to|offers?|offered|offering|provides?|performs?|performed|runs?|ran|delivers?|ramping up to offer|plans? to offer)\b/i;
const COMPANY_LEAD = /^(?:it|its|the company|the startup|the firm)\b/i;
function namesSubject(sentence, subjects) {
  return (subjects || []).some((n) => n && new RegExp("\\b" + String(n).replace(/[^a-z0-9]/gi, "") + "\\b", "i").test(sentence.replace(/[^a-z0-9 ]/gi, " ")));
}
function sellerBenefits(sentence, ctx) {
  if (SELLER_VOICE.test(sentence) || SELLER_ATTRIB.test(sentence)) return true;
  if (CAPABILITY.test(sentence) && (namesSubject(sentence, ctx && ctx.subjects) || (ctx && ctx.subjects && ctx.subjects.length && COMPANY_LEAD.test(sentence.trim())))) return true;
  const name = ctx && ctx.company;
  return !!(name && name.length >= 3 && new RegExp("\\b" + name.replace(/[^a-z0-9]/gi, "") + "\\b", "i").test(sentence.replace(/[^a-z0-9 ]/gi, "")));
}

// ---------- (1) extraordinary against the field ----------
function extraordinaryVsField(s) {
  const cues = [];
  // many results from a minimal sample: "70 tests from a finger prick", "dozens of diseases from one drop of blood"
  let m = /\b(\d[\d,]*|dozens|hundreds|thousands)\s+(?:different\s+)?(tests?|diseases?|conditions?|assays?|cancers?|diagnoses|results?|analytes?|biomarkers?)\b[^.]{0,60}\b(?:from|with|using|on)\s+(?:a|one|just one|a single|a few|a tiny|one tiny)\s+(?:single\s+)?(?:tiny\s+)?(?:finger[- ]?prick|drop|sample|swab|scan|photo|image|draw|vial|microliters?)\b/i.exec(s);
  if (m) { const n = Number(String(m[1]).replace(/,/g, "")); if (!(Number.isFinite(n) && n < 10)) cues.push("many results from one tiny sample"); }
  if (/\bas many as (\d[\d,]*)\b/i.test(s) && /\b(finger[- ]?prick(?:ing)?|pricking a finger|single drop|one drop|one sample|a few drops|single draw|microliters?|nanotainer|tiny vial)\b/i.test(s)) cues.push("many results from one tiny sample");
  // "offers more than 200 tests, all without the need for a syringe": a long menu with no blood draw, against how labs work
  if (/\d[\d,]*[^.]{0,80}\b(?:tests?|assays?)\b[^.]{0,120}\bwithout (?:the need for )?(?:a |any )?(?:syringe|needle|blood draw|venipuncture)\b/i.test(s)) cues.push("many tests without a blood draw");
  // about ten times the norm
  m = /\b(\d[\d,]*)\s*(?:x|times)\s+(?:faster|cheaper|more accurate|smaller|better|more efficient|less)\b/i.exec(s);
  if (m && Number(String(m[1]).replace(/,/g, "")) >= 8) cues.push("ten times the norm");
  m = /\b(\d{2,3})%\s+(?:cheaper|faster|smaller|less|lower)\b/i.exec(s);
  if (m && Number(m[1]) >= 90) cues.push("ten times the norm");
  // overturns standard practice
  if (/\b(100% accura\w+|99\.9\d*% accura\w+|no false (?:positives|negatives)|never (?:wrong|misses)|zero (?:errors|false)|cures?\b|eliminates? the need for|replac(?:es|ing) (?:all|every|the need for)|without (?:any )?(?:lab|laborator\w+|clinic\w*|equipment|a doctor)|no (?:lab|laboratory|equipment|doctor|blood draw) (?:needed|required))/i.test(s)) cues.push("overturns standard practice");
  if (/\b(first (?:ever|in the world|company to)|only (?:company|technology|test|device) (?:that|to|in)|breakthrough)\b/i.test(s) && /\d/.test(s)) cues.push("first of its kind, with a number");
  // "we have never used commercially available equipment": a claim that the whole method is proprietary, against how the field works
  if (/\b(?:never|not once) (?:used|relied on|run|ran) (?:any )?(?:commercially available|commercial|off[- ]the[- ]shelf|standard|third[- ]party)\b/i.test(s)) cues.push("a method nobody else uses, stated as fact");
  return cues;
}

/** The three-part test for signal (a). Returns {fires, extraordinary, benefits, evidenceAbsent} (for the unit tests and the card's one-line why). */
export function extraordinaryTest(sentence, ctx = {}) {
  const s = String(sentence || "");
  if (isPuffery(s)) return { fires: false, extraordinary: false, benefits: false, evidenceAbsent: false };
  const cues = extraordinaryVsField(s);
  const extraordinary = cues.length > 0;
  const benefits = extraordinary && sellerBenefits(s, ctx);
  const near = String(ctx.neighbours || "");
  // T3002: evidence that the text says is WITHHELD or declined ("peer-review publication ... is unnecessary and inappropriate") is not evidence present
  const present = (t) => EVIDENCE.test(t) && !WITHHELD.test(t);
  const evidenceAbsent = extraordinary && !present(s) && (Array.isArray(ctx.neighbourList) ? !ctx.neighbourList.some(present) : !present(near));
  return { fires: extraordinary && benefits && evidenceAbsent, extraordinary, benefits, evidenceAbsent, cues };
}

// ---------- (b) evasive answer ----------
const GENERIC_METHOD = /\bthe same (?:fundamental |basic |standard |well[- ]known |established )?(?:chemical |scientific |analytical |laboratory |engineering )?(?:methods?|techniques?|principles?|science|technology|processes)\b|\bstandard (?:industry )?(?:methods|practices|techniques)\b|\bsecret sauce\b|\bspecial sauce\b/i;
const GENERIC_ANSWER = /\b(our mission|our vision|we believe|at (?:its|our) core|fundamentally|simply put|it'?s (?:all )?about|that'?s what makes us|the way we always|that'?s what we do)\b/i;
const SPEECH = /\b(says|said|answers?|answered|replied|replies|responds?|responded|explains?|explained|adds?|added|insists?|insisted)\b/i;
const HOW_QUESTION = /\b(how|how much|how many|what|which|why)\b[^?]*\?\s*$/i;
function evasive(sentence, prev) {
  if (GENERIC_METHOD.test(sentence) && (SPEECH.test(sentence) || /["“”]/.test(sentence) || /\?\s*$/.test(String(prev || "")))) return "gives a generic answer where a specific one was asked for";
  if (HOW_QUESTION.test(String(prev || "")) && GENERIC_ANSWER.test(sentence) && !/\d/.test(sentence)) return "answers a how or what question with a mission statement";
  // pressed on a criticism, the speaker says the critics did not understand instead of answering it
  if (/\bpeople (?:just |simply )?(?:don'?t|didn'?t|do not|did not) (?:actually )?understand\b|\bconflated\b|\btaken out of context\b/i.test(sentence) && (SPEECH.test(sentence) || /["“”]/.test(sentence))) return "answers a criticism by saying people did not understand, with no specifics";
  return null;
}

// ---------- (e) secrecy as a feature ----------
const SECRECY = /\b(we (?:do not|don'?t|won'?t|will not|never) (?:publish|share|disclose|reveal|release|discuss|comment)|stealth(?: mode| research)?|proprietary,? (?:so|which means|and)|(?:can(?:no|')t|cannot) (?:say|discuss|share|disclose|reveal)|trade secret|keeps? (?:it|that|this|them|the details) (?:a )?secret|(?:not|never) (?:been )?(?:published|peer[- ]reviewed))\b/i;

// ---------- (c) inconsistent numbers within the page ----------
const COUNT_NOUN = /\b(\d[\d,]*)\s+(tests?|diagnostics?|assays?|employees?|customers?|clients?|patients?|hospitals?|countries|stores|locations|users|partners)\b/gi;
const COMPARATIVE = /\b(than|versus|vs\.?|compared (?:to|with)|stat labs?|competitors?|rivals?|other (?:labs?|companies|providers)|existing (?:labs?|companies|tests?)|typical(?:ly)?|average|industry|for instance|for example|such as|maybe|roughly|about|around)\b/i;
const singular = (n) => String(n).toLowerCase().replace(/ies$/, "y").replace(/s$/, "");

// ---------- (d) unsourced precision: a grey tag, never a red flag ----------
const COMPANY_VOICE = /\b(we|our|us)\b/i;
const EXACT_FIGURE =/(\$\s?\d[\d,.]*\s?(?:k|m|bn|b|million|billion)?|\b\d{1,3}(?:,\d{3})+\b|\b\d+\.\d+\s?%|\b\d{2,3}\s?%|\b\d{4,}\b)/i;
const ATTRIBUTION = /\b(according to|source:|per the|reported by|reports? that|a study|survey|audited|filing|10-k|press release by|quoted|data from|as of (?:the )?(?:latest|its))\b/i;
export function isUnsourced(sentence) {
  const s = String(sentence || "");
  return !isPuffery(s) && EXACT_FIGURE.test(s) && COMPANY_VOICE.test(s) && !ATTRIBUTION.test(s) && !EVIDENCE.test(s);   // the company speaking about itself (we, our, us): an author's "I" or a quoted person is not
}

const NOT_A_NAME = new Set("the this that these those with from when while after before there their they about over more most many some such what which where because however today also still just only even than then them were was are has have had been being would could should will can may might one two three four five and but for not its his her she him who whom whose into onto upon each every both either neither another other others".split(" ").concat("monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december medicare medicaid photograph company".split(" ")));
/** T3002: the one or two names an article is about (a company, its founder): the capitalised words that recur through the text (15 times or more, or 6 times and named in the lead or title). Never the publisher (ctx.company is the site). */
export function profiledSubjects(text, ctx = {}) {
  const t = String(text || "");
  const counts = new Map();
  for (const m of t.matchAll(/(?<![A-Za-z])[A-Z][a-z]{3,}(?![A-Za-z])/g)) {
    const w = m[0];
    if (NOT_A_NAME.has(w.toLowerCase())) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const lead = t.slice(0, 1800) + " " + String(ctx.title || "");
  const publisher = String(ctx.company || "").toLowerCase();
  return [...counts.entries()].filter(([w, n]) => (n >= 15 || (n >= 6 && lead.includes(w))) && w.toLowerCase() !== publisher).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);   // a name that recurs 15+ times is what the article is about wherever it first appears
}

/** Every flag and every unsourced sentence of a page text. flags: [{quote, signal, why}], unsourced: [quote]. */
export function detect(text, ctx = {}) {
  const sents = sentencesOf(stripMarkers(String(text || "")));
  const flags = [], unsourced = [];
  const seen = new Set();
  const add = (quote, signal, why) => { const k = norm(quote) + "|" + signal; if (!seen.has(k)) { seen.add(k); flags.push({ quote, signal, why }); } };
  const firstCount = new Map();
  const subjects = ctx.subjects || profiledSubjects(sents.join(" "), ctx);
  sents.forEach((s, i) => {
    if (isPuffery(s)) return;
    const neighbourList = [sents[i - 2], sents[i - 1], sents[i + 1], sents[i + 2]].filter(Boolean);
    const near = neighbourList.join(" ");
    const t = extraordinaryTest(s, { ...ctx, subjects, neighbours: near, neighbourList });
    if (t.fires) add(s, "extraordinary_claim", "A big claim from the seller about its own product, with no study, approval or named validator in the text.");
    const ev = evasive(s, sents[i - 1]);
    if (ev) add(s, "evasive_answer", "The speaker " + ev + ".");
    if (SECRECY.test(s)) add(s, "secrecy", "The text offers secrecy or no publication as the reason nothing can be checked.");
    // numbers that disagree
    for (const m of s.matchAll(COUNT_NOUN)) {
      const n = Number(m[1].replace(/,/g, "")), noun = singular(m[2]);
      if (!Number.isFinite(n)) continue;
      if (COMPARATIVE.test(s)) continue;   // "stat labs ... maybe 40 tests" compares someone else's number with the company's: not a conflict
      const prev = firstCount.get(noun);
      if (!prev) { firstCount.set(noun, { n, s }); continue; }
      const hi = Math.max(prev.n, n), lo = Math.min(prev.n, n);
      if (prev.n !== n && lo > 0 && hi / lo >= 1.5 && prev.s !== s) add(s, "inconsistent_numbers", `Gives ${n.toLocaleString("en-US")} ${noun}s here but ${prev.n.toLocaleString("en-US")} elsewhere on the page.`);
    }
    if (isUnsourced(s) && !flags.some((f) => f.quote === s)) unsourced.push(s);
  });
  // one card per quote: a sentence that only wraps another flagged quote ('Holmes said "People just didn't understand..."') collapses into the shorter quote
  const kept = flags.filter((a) => !flags.some((b) => b !== a && b.signal === a.signal && norm(b.quote).length >= 25 && norm(a.quote).length > norm(b.quote).length && norm(a.quote).includes(norm(b.quote))));
  return { flags: kept, unsourced };
}

const contains = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

/**
 * Applies red flags and unsourced tags to the claim list IN PLACE and returns {changed, flagged, added, demoted, unsourced}.
 *  - a card the model labelled "redflag" is kept only when the rules hold for its quote; otherwise it goes back to specific or vague (reconcile) with no signal;
 *  - each detected flag turns the matching card into a red flag (kind "redflag", signal, why), or becomes a new card;
 *  - a green card whose sentence is an unsourced exact figure gets unsourced: true (a small grey tag).
 * ctx: {company} (the site's own name, from the domain), merge(existing, incoming) -> added claims (mergeClaims), reconcile(claim) -> claim.
 */
const MAX_FRESH_FLAGS = 8;
export function applyRedFlags(claims, pageText, ctx = {}) {
  const { flags, unsourced } = detect(pageText, ctx);
  const sents = sentencesOf(stripMarkers(String(pageText || "")));
  const res = { changed: false, flagged: 0, added: 0, demoted: 0, unsourced: 0 };
  // 1. re-check the model's own red flags
  for (const c of claims) {
    if (c.kind !== "redflag") continue;
    const i = sents.findIndex((s) => contains(s, c.quote));
    const near = i >= 0 ? [sents[i - 2], sents[i - 1], sents[i + 1], sents[i + 2]].filter(Boolean).join(" ") : "";
    const holds = flags.some((f) => contains(f.quote, c.quote) && (!c.signal || f.signal === c.signal))
      || (c.signal === "extraordinary_claim" && extraordinaryTest(c.quote, { ...ctx, subjects: ctx.subjects || profiledSubjects(sents.join(" "), ctx), neighbours: near }).fires);
    if (isPuffery(c.quote) || !holds) {
      const back = ctx.reconcile ? ctx.reconcile({ ...c, kind: "specific" }) : { ...c, kind: /\d/.test(c.quote) ? "specific" : "vague" };
      Object.assign(c, back); delete c.signal; res.demoted++; res.changed = true;
    }
  }
  // 2. detected flags
  const fresh = [];
  for (const f of flags) {
    const c = claims.find((x) => contains(x.quote, f.quote));
    if (c) {
      if (c.kind !== "redflag" || c.signal !== f.signal) { c.kind = "redflag"; c.signal = f.signal; c.why = f.why; delete c.note; delete c.overridden; res.flagged++; res.changed = true; }
    } else fresh.push({ quote: f.quote, kind: "redflag", signal: f.signal, why: f.why });
  }
  if (fresh.length > MAX_FRESH_FLAGS) fresh.length = MAX_FRESH_FLAGS;   // T3002: the rules read the whole page; a very long page cannot turn into a wall of red
  if (fresh.length) {
    const added = ctx.merge ? ctx.merge(claims, fresh) : fresh.map((x, i) => { const y = { ...x, id: "c" + (claims.length + i + 1) }; claims.push(y); return y; });
    res.added = added.length; res.flagged += added.length; if (added.length) res.changed = true;
  }
  // 3. the small grey tag
  for (const c of claims) {
    if (c.kind !== "specific") continue;
    const hit = unsourced.some((u) => contains(u, c.quote));
    if (hit && !c.unsourced) { c.unsourced = true; res.unsourced++; res.changed = true; }
  }
  return res;
}
