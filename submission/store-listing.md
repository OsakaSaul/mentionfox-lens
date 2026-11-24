# MentionFox Lens: Chrome Web Store listing (free)

OWNER FILLS: none. This listing uses no on-device timing, so neither {{ON_DEVICE_SECONDS}} nor {{ON_DEVICE_FIRST_CLAIM_SECONDS}} appears here; only the Devpost text and the demo script need them.

Filled in from the real manifest.json, UI and behaviour (version 0.1.1, build d4f4913 or later). Items marked OWNER CONFIRMS need a check in your own Chrome or dashboard.

## Name

MentionFox Lens

## Short description (limit 132 characters)

See which claims on a page are checkable and which are vague, on-device first. Free, open source, no account.

(Length check: 109 characters, limit 132.)

## Detailed description

MentionFox Lens helps you read any page the way a careful reviewer would. Click the icon and Lens works on the text of the page you are looking at.

Claim X-ray
Reads the main content of the page (navigation, infobox, references and footnote markers are left out), finds its factual claims, highlights each one in place and labels it specific-and-checkable or vague, with a one-line reason. Quotes are verbatim. A claim with a date, number, amount, named place, organisation or event stays checkable; it is called vague only when it has no such anchor. A side panel lists every claim; click one and the page jumps to that exact sentence. One matcher, tolerant of case, quotes, dashes, spacing and small rewording, drives both the highlight and the jump, and a card says "Not found on the page" only when the quote truly cannot be located.

Streaming and longer pages
On-device, Lens reads the page in chunks of about 1,500 characters and shows each claim card and highlight as soon as its chunk is done, with a "First claim in N seconds" line. One press reads about 6,000 characters on-device (a 12,000-character window in the cloud); "Analyze more of this page" reads the next part.

GEO lens
Shows how an AI assistant would summarise the page: the people, companies and products it would pick up, the facts it would state, what is missing or ambiguous, three concrete fixes, and a score from 0 to 100 with what each point means.

Private by design
Lens uses Firebase AI Logic hybrid inference. When your Chrome has its built-in on-device model (Gemini Nano), the analysis runs on your computer, the mode bar says "On-device · N seconds" and "Your page stayed in this browser." When it does not, Lens falls back to the cloud through Firebase AI Logic and the bar says "Cloud · N seconds". Either way you can see which mode ran and how many seconds it took.

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

Checked against manifest.json (version 0.1.3): the permissions are exactly activeTab, scripting, sidePanel and storage (storage only keeps the daily Check counter on this device). There are no host permissions and no content_scripts entry.

| Permission | Justification (draft) |
| --- | --- |
| activeTab | Lets Lens read and highlight the current tab only after the user clicks the extension, so it never touches other tabs. |
| scripting | Injects the code that extracts the page text and draws the highlights in the current tab after the user clicks (chrome.scripting.executeScript on the active tab). |
| sidePanel | Shows the list of claims, the GEO lens results and the mode badge in Chrome's side panel. |
| storage | Keeps one small counter on this device: how many free Check clicks were used today. Nothing else is stored; no page text, no claims. |
| Host permissions for the Firebase AI Logic cloud endpoint | Not declared. The cloud fallback request is made by the Firebase SDK from the side panel and worked in the live runs without host permissions. |
| Content scripts on all pages | Not used. The manifest has no content_scripts; Lens injects its script into the active tab on demand with activeTab. |

Remote code: none. All code is in the package; the Firebase SDK is bundled by esbuild, and a unit test checks the manifest CSP and that the bundle has no eval or remote scripts.

## Data usage disclosures (Developer Dashboard privacy tab)

Answers for the form (checked against the code: no analytics or telemetry; local storage only for the daily Check counter).

- Does the extension collect or use user data? Yes, in this limited way: the text of the current page is processed when the user clicks.
- Data types: Website content (the text of the current page, processed on the user's device when the on-device model is available; sent to Google's Firebase AI Logic cloud endpoint only when the on-device model is not available).
- Personally identifiable information, health, financial, authentication, location, web history, user activity (clicks and keystrokes), personal communications: not collected by Lens. The build has no analytics or telemetry.
- Is data sold to third parties? No.
- Is data used for purposes unrelated to the single purpose? No.
- Is data used to determine creditworthiness or for lending? No.
- Data sent to MentionFox servers: none.
- Certification: the three Limited Use statements apply (use only for the single purpose, no transfer except to provide the feature or as required by law, no human reading).

Note for the reviewer field: the on-device path sends nothing off the machine. The cloud fallback sends the page text to Google through Firebase AI Logic with App Check, subject to Google's terms.

## Package and images (built by scripts, version 0.1.1)

Package: release/mentionfox-lens-0.1.1.zip (version 0.1.1), built by `powershell -File scripts/package.ps1` from the release build. manifest.json is at the zip root, 13 files, no source maps, no .env files, no App Check debug token. The zip is not committed: the owner builds it, or uses the copy in the main checkout release/ folder.

Images are in store/ (made by `node scripts/store-images.mjs`; 24-bit PNG, no alpha). Page text, claims and AI-view text are the saved real runs in docs/real-runs/ on real saved pages (Wikipedia Patrick Collison, Wikipedia Sam Bankman-Fried, archived Theranos FDA press release). The test mock supplies only the mode state.

| File | Size | Shows |
| --- | --- | --- |
| store/screenshot-1-claim-xray.png | 1280 by 800 | Highlights in the page, side panel list, mode bar (Cloud, from a real run) |
| store/screenshot-2-jump-to-claim.png | 1280 by 800 | A claim selected in the panel and the exact sentence lit on the page |
| store/screenshot-3-ai-view.png | 1280 by 800 | AI view tab with the 0 to 100 score |
| store/screenshot-4-on-device.png | 1280 by 800 | On-device mode bar (state rendered with the test mock; see OWNER CONFIRMS) |
| store/screenshot-5-never-blocked.png | 1280 by 800 | Download percent chip while the cloud answers (state rendered with the test mock) |
| store/promo-tile-440x280.png | 440 by 280 | Small promo tile |
| store/marquee-1400x560.png | 1400 by 560 | Marquee promo tile |

The images carry no model or provider names and use the extension's own icon from icons/. The privacy paragraph at the foot of the panel (it names the cloud provider) is left out of the captures.

## Promo text used

Small tile: Spot the claims. Check what is checkable. / Free. On-device first. Open source.
Marquee: Spot the claims. Check what is checkable. / Highlights the claims on any page and shows how an AI assistant would read it. / Free. Private. No account.

## OWNER CONFIRMS

1. Chrome Web Store account, developer fee and listing (your step; no account was created by this work).
2. Category choice in the dashboard (Productivity or Search Tools).
3. Upload the images from store/ (swap in real on-device captures if you take them).
4. In the dashboard's permission form, justify the storage row: it only holds the daily Check counter.
5. Privacy policy URL: https://foxapis.com/lens/privacy/ was checked on 2026-11-23 and is live (HTTP 200, titled "MentionFox Lens Privacy"). Re-read it against the data disclosures above before submitting.
6. Replace screenshot 4 (and ideally 5) with real captures from your Chrome with the on-device model: the shipped ones are mock-state renders of the real UI, not an on-device run.
7. The release build has no App Check attestation provider, so cloud calls from the store build are rejected until an attestation path is added (a dev build with a registered debug token works). Decide before submitting; the on-device path is unaffected.
