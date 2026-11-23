# MentionFox Lens: Chrome Web Store listing (free)

Filled in from the real manifest.json, UI and behaviour (build 3aedb16 plus tuning). Items marked OWNER CONFIRMS need a check in your own Chrome or dashboard.

## Name

MentionFox Lens

## Short description (limit 132 characters)

Spot which claims on a page are checkable and which are vague, and see how an AI assistant would summarise it. Free, private.

(Length check: 125 characters; matches the final features.)

## Detailed description

MentionFox Lens helps you read any page the way a careful reviewer would. Click the icon and Lens works on the text of the page you are looking at.

Claim X-ray
Finds the factual claims on the page (a profile, a bio, a press release, a pitch, a post), highlights each one in place, and labels it specific-and-checkable or vague, with a one-line reason. A side panel lists them all; click one and the page jumps to that exact sentence.

GEO lens
Shows how an AI assistant would summarise the page: the people, companies and products it would pick up, the facts it would state, what is missing or ambiguous, three concrete fixes, and a score from 0 to 100 with what each point means.

Private by design
Lens uses Firebase AI Logic hybrid inference. When your Chrome has its built-in on-device model (Gemini Nano), the analysis runs on your computer and the badge says On-device (private). When it does not, Lens falls back to the cloud through Firebase AI Logic, and the badge says Cloud. Either way you can see which mode ran and how long it took in milliseconds.

Nothing from the page is sent to MentionFox. No account, no sign-up, no ads. Lens only reads the page when you click.

Free and open source
Lens is free to use, with no paywall inside it, and the source code is public on GitHub under the MIT license: https://github.com/OsakaSaul/mentionfox-lens

Optional links to MentionFox (for example the MentionFox Source Check page, or Find Contact) open in a new tab. You never need them.

Built for the #BuildHybridAI hackathon with Firebase AI Logic.

Privacy policy: https://foxapis.com/lens/privacy/

## Category

Productivity (alternative: Search Tools; OWNER CONFIRMS in the dashboard)

## Language

English

## Single-purpose statement

MentionFox Lens analyses the text of the page the user is viewing, only when the user clicks it, to highlight and label its factual claims and to show how an AI assistant would summarise the page.

## Permission justifications

Checked against manifest.json (version 0.1.0): the permissions are exactly activeTab, scripting and sidePanel. There is no storage permission, no host permissions and no content_scripts entry.

| Permission | Justification (draft) |
| --- | --- |
| activeTab | Lets Lens read and highlight the current tab only after the user clicks the extension, so it never touches other tabs. |
| scripting | Injects the code that extracts the page text and draws the highlights in the current tab after the user clicks (chrome.scripting.executeScript on the active tab). |
| sidePanel | Shows the list of claims, the GEO lens results and the mode badge in Chrome's side panel. |
| storage | Not requested. Lens stores nothing. (Delete this row from the dashboard form.) |
| Host permissions for the Firebase AI Logic cloud endpoint | Not declared. The cloud fallback request is made by the Firebase SDK from the side panel and worked in the live runs without host permissions. |
| Content scripts on all pages | Not used. The manifest has no content_scripts; Lens injects its script into the active tab on demand with activeTab. |

Remote code: none. All code is in the package; the Firebase SDK is bundled by esbuild, and a unit test checks the manifest CSP and that the bundle has no eval or remote scripts.

## Data usage disclosures (Developer Dashboard privacy tab)

Answers for the form (checked against the code: no analytics, telemetry or storage).

- Does the extension collect or use user data? Yes, in this limited way: the text of the current page is processed when the user clicks.
- Data types: Website content (the text of the current page, processed on the user's device when the on-device model is available; sent to Google's Firebase AI Logic cloud endpoint only when the on-device model is not available).
- Personally identifiable information, health, financial, authentication, location, web history, user activity (clicks and keystrokes), personal communications: not collected by Lens. The build has no analytics or telemetry.
- Is data sold to third parties? No.
- Is data used for purposes unrelated to the single purpose? No.
- Is data used to determine creditworthiness or for lending? No.
- Data sent to MentionFox servers: none.
- Certification: the three Limited Use statements apply (use only for the single purpose, no transfer except to provide the feature or as required by law, no human reading).

Note for the reviewer field: the on-device path sends nothing off the machine. The cloud fallback sends the page text to Google through Firebase AI Logic with App Check, subject to Google's terms.

## Screenshot shot list (1280 by 800, up to 5)

1. Claim X-ray on a founder biography (https://en.wikipedia.org/wiki/Patrick_Collison): highlights in the page, side panel list, mode badge On-device (private). [OWNER CONFIRMS: take this one on your Chrome with Gemini Nano; the build machine could only produce the Cloud badge. A Cloud-badge capture of the same page is in docs/real-runs/ if needed.]
2. Claim X-ray on a press release (https://www.apple.com/newsroom/2023/09/apple-unveils-iphone-15-pro-and-iphone-15-pro-max/): green checkable claims and amber vague ones with reasons.
3. Jump to highlight: a claim selected in the side panel and the exact sentence lit on the page.
4. GEO lens: entities, facts, what is missing, 3 fixes and the 0 to 100 score.
5. Mode badge showing Cloud with latency next to the on-device one (two crops side by side).

Use real captures from the final build only. Do not show Firebase config, tokens or keys.

## Promo tile text

Small tile (440 by 280):
Headline: See the claims behind any page
Subline: Free. On-device first. Open source.

Marquee tile (1400 by 560):
Headline: Checkable or just fog?
Subline: MentionFox Lens highlights the claims on any page and shows how an AI assistant would summarise it.
Footer line: Free, private, no account.

Use the family fox head from the brand folder only; never draw a new fox.

## OWNER CONFIRMS

1. Chrome Web Store account, developer fee and listing (your step; no account was created by this work).
2. Category choice in the dashboard (Productivity or Search Tools).
3. Screenshots and tiles from your final build; the On-device (private) screenshot needs your Chrome with Gemini Nano.
4. Delete the storage row in the dashboard's permission form: the manifest does not request it.
5. The privacy policy URL (https://foxapis.com/lens/privacy/) must be live before submitting; it was not checked by this work.
