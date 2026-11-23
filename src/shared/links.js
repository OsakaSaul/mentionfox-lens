// Outbound links only. Opening them is the user's choice; nothing from the page is attached.
const UTM = { utm_source: "lens", utm_medium: "extension", utm_campaign: "hybridai" };

export function mentionfoxLink(path, content) {
  const u = new URL(path, "https://mentionfox.com");
  for (const [k, v] of Object.entries(UTM)) u.searchParams.set(k, v);
  if (content) u.searchParams.set("utm_content", content);
  return u.toString();
}

// Source Check: the public MentionFox page that explains checking a named person's stated credentials against public registers.
// (Chosen over /people-intelligence, a recruiter landing page, and /claims-check, the noindex app route.)
export const VERIFY_CLAIMS_URL = mentionfoxLink("/source-check", "verify_claims");
// Find Contact: the public MentionFox tool page for finding a professional's work email and contact details.
export const DECISION_MAKERS_URL = mentionfoxLink("/tools/find-contact", "decision_makers");
