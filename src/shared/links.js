// Outbound links only. Opening them is the user's choice; nothing from the page is attached.
const UTM = { utm_source: "lens", utm_medium: "extension", utm_campaign: "hybridai" };

export function mentionfoxLink(path, content) {
  const u = new URL(path, "https://mentionfox.com");
  for (const [k, v] of Object.entries(UTM)) u.searchParams.set(k, v);
  if (content) u.searchParams.set("utm_content", content);
  return u.toString();
}

// People Intelligence is the MentionFox page that covers claim verification against public registers.
export const VERIFY_CLAIMS_URL = mentionfoxLink("/people-intelligence", "verify_claims");
// No dedicated decision-maker page exists on the site, so this goes to the homepage.
export const DECISION_MAKERS_URL = mentionfoxLink("/", "decision_makers");
