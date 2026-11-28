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
The Quick private scan runs on your computer when your Chrome has its built-in on-device model: nothing from the page leaves your computer, and the panel says On-device. Deep scan, and the Quick private scan when there is no on-device model, send the page text to our server, where an AI provider working for us reads it, only when you click; the panel says Cloud. Our server does not store the text. The AI provider may keep it for a short time under its own terms. To enforce a free daily limit, Lens also sends a random install ID, and our server sees your IP address; the limit counters keep only scrambled forms of both and are deleted after about two days. No account, no sign-up, no ads, and nothing is sold.

Free and open source
Lens is free to use, with no paywall inside it, and the source code is public on GitHub under the MIT license: https://github.com/OsakaSaul/mentionfox-lens

Optional links to MentionFox (for example the MentionFox Source Check page, or Find Contact) open in a new tab. You never need them.

Privacy policy: https://foxapis.com/lens/privacy/

## Category

Productivity (alternative: Search Tools; OWNER CONFIRMS in the dashboard)

## Language

English

## Single-purpose statement

MentionFox Lens analyses the text of the page the user is viewing, only when the user clicks it, to highlight and label its factual claims and to show how an AI assistant would summarise the page.

## Permission justifications

Checked against manifest.json (version 0.2.2): the permissions are exactly activeTab, scripting, sidePanel and storage. There are no host permissions and no content_scripts entry.

| Permission | Justification |
| --- | --- |
| activeTab | Lets Lens read and highlight the current tab only after the user opens it, so it never touches other tabs. |
| scripting | Adds the code that reads the page text and draws the highlights to that tab (chrome.scripting.executeScript on the active tab). |
| sidePanel | Shows the claims, the AI view and the mode bar in Chrome's side panel. |
| storage | Keeps small settings in the browser, including a random install ID used only for the free daily limit. No page text or claims are stored. |
| Host permissions | Not declared. Cloud scans are an ordinary request from the side panel to our server, which answers with the needed headers for this extension only. |
| Content scripts on all pages | Not used. Lens adds its script to the active tab on demand. |

Remote code: none. All code is in the package, bundled by esbuild, and a unit test checks the manifest CSP and that the bundle has no eval or remote scripts.

## Data usage disclosures (Developer Dashboard privacy tab)

- Does the extension collect or use user data? Yes.
- Tick **Website content**: the text (and, for the AI view, the title) of the current page, sent to our server for Deep scan and for the Quick scan when there is no on-device model.
- Tick **Location**: our server sees the IP address (the dashboard lists IP address under Location). Used only for the daily limit.
- Tick **Personally identifiable information** (the cautious choice): a random install ID, created by the extension, used only for the daily limit. It is not a name or an email.
- Do not tick: health, financial and payment, authentication, personal communications, web history, user activity.
- Sold to third parties: No. Used for purposes unrelated to the single purpose: No. Used for creditworthiness or lending: No.
- Certify all three Limited Use statements. The AI provider working for us processes the page text only to provide the feature.
- Privacy policy URL: https://foxapis.com/lens/privacy/

Reviewer note: on-device Quick scan sends nothing off the machine. Cloud scans go to our server, which has a free daily limit per install, per address and in total; if the reviewer sees "Free daily limit reached, try again tomorrow", the limit for the day is used up.

## Package and images (version 0.2.2)

Package: lens-0.2.2.zip on the GitHub release v0.2.2, the same content `powershell -File scripts/package.ps1` builds from the release build. manifest.json is at the zip root, 13 files, no source maps, no .env files, no debug token. Cloud scans work from the store install; an unpacked copy of the zip has a different extension id and our server refuses its cloud scans.

Images are in store/ (made by `node scripts/store-images.mjs`; 24-bit PNG, no alpha). The pages shown are made up (test/fixtures/made-up) and the claims and AI-view text are hand-written examples (test/fixtures/claims/store-examples.json), drawn by the real extension with a stand-in model; no run time is shown. Each large screenshot says "Example on a made-up page".

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
4. In the dashboard's permission form, use the storage row above.
5. Privacy policy URL: https://foxapis.com/lens/privacy/ was checked on 2026-11-23 and is live (HTTP 200, titled "MentionFox Lens Privacy"). Re-read it against the data disclosures above before submitting.
6. Replace screenshot 4 (and ideally 5) with real captures from your Chrome with the on-device model: the shipped ones are mock-state renders of the real UI, not an on-device run.
