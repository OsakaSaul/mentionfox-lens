// Deterministic GEO score: the model rates five dimensions 0..4, the score is computed here.
// Keeping the arithmetic out of the model makes the score explainable and stable between modes.

export const GEO_WEIGHTS = { entity_clarity: 25, fact_density: 25, structure: 20, trust_signals: 15, ambiguity: 15 };

export const GEO_DIMENSION_LABELS = {
  entity_clarity: "Clear who and what",
  fact_density: "Checkable facts",
  structure: "Easy to quote",
  trust_signals: "Trust signals",
  ambiguity: "Low ambiguity",
};

export const GEO_BANDS = [
  { min: 75, max: 100, id: "strong", label: "Strong", meaning: "An assistant can name the right people and companies and quote checkable facts without guessing." },
  { min: 50, max: 74, id: "good", label: "Good", meaning: "An assistant can summarise this page, but the gaps invite guesses or generic wording." },
  { min: 25, max: 49, id: "patchy", label: "Patchy", meaning: "Some facts would be picked up, but key details are missing or unclear, so answers may be vague or wrong." },
  { min: 0, max: 24, id: "weak", label: "Weak", meaning: "An assistant would mostly guess. There is little here it can safely quote." },
];

/** ratings: {dimension: 0..4}. Returns integer 0..100. */
export function geoScore(ratings) {
  let total = 0;
  for (const [k, w] of Object.entries(GEO_WEIGHTS)) {
    const v = Math.max(0, Math.min(4, Number(ratings?.[k]) || 0));
    total += (v / 4) * w;
  }
  return Math.round(total);
}

export function geoBand(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return GEO_BANDS.find((b) => s >= b.min && s <= b.max);
}
