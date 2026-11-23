# MentionFox Lens: Devpost submission text (#BuildHybridAI)

OWNER FILLS (measure in your own Chrome 139+ with Gemini Nano ready, read both off the mode bar, then replace the placeholder everywhere in this file):
- {{ON_DEVICE_SECONDS}}: the total on the bar, "On-device · N seconds". Used in "Accomplishments".
- {{ON_DEVICE_FIRST_CLAIM_SECONDS}}: the number in "First claim in N seconds". Used in "Accomplishments".
No on-device timing is claimed anywhere else in this file.

Hackathon: https://firebasehybridaihackathon.devpost.com/ (deadline Nov 30, 2026, 2:00pm PST). Platform to select: Web (Chrome), a Chrome extension with Gemini Nano via Firebase AI Logic.

Status: filled in from the current build (version 0.1.1; run notes in docs/real-runs/NOTES.md). Items marked OWNER CONFIRMS need a check in the owner's own Chrome: Gemini Nano on-device was NOT available in the build machine's Chromium (LanguageModel.availability() = unavailable), so every real run so far used the cloud path.

## Tagline

See which claims on any page can be checked and which are just fog, and how an AI assistant would summarise it. Free Chrome extension, on-device first.

## Inspiration

Bios, profiles, pitches and press releases are piles of claims, and AI assistants now read those pages and repeat them. People have no quick way to see which claims are specific and checkable and which are vague or puffery, and page owners have no quick way to see what an assistant would pick up or miss. Doing this with an on-device model means the text of the page you are reading never has to leave your machine.

## What it does

MentionFox Lens is a free, open-source Manifest V3 Chrome extension. It works on the current tab's text, only when you click, on normal web pages: company sites, bios, press releases and news articles. Tested on saved copies of a founder bio, a press release, a company homepage and a news article, plus Wikipedia and an Apple newsroom page. LinkedIn and X were not tested live (no logins were used); they are covered only by hand-written test pages shaped like them.

1. Claim X-ray (tab). Reads the main content of the page (navigation, infobox, references and footnote markers are dropped first), extracts the factual claims, highlights each one in place, and labels it specific-and-checkable or vague/puffery with a one-line reason. Quotes are verbatim. A claim with a checkable anchor (a date, number, amount, named place, organisation or event) stays specific and checkable; it is vague only without an anchor. A side panel lists every claim, and clicking one scrolls to and highlights the exact sentence. One matcher with five tiers finds each quote on the page (exact normalized match, no-space match, head and tail match, a run of 8 or more identical words, 80 percent word overlap in a sentence-sized window) and drives both the green highlight and the jump; a card says "Not found on the page" only when every tier fails.
   - Streaming: on-device, the page is read in chunks of about 1,500 characters, and each claim card and highlight appears as its chunk finishes (status "Finding claims: chunk 2 of 4, 3 claims so far..."). A "First claim in N seconds" line shows how fast the first card came.
   - Windows: one on-device run reads about 6,000 characters of the main content; in the cloud it is one call over a 12,000-character window of the same extraction. "Analyze more of this page" reads the next window (on-device: about 6,000 more characters per press).
2. GEO lens (tab named AI view). Shows how an AI assistant would summarise the page: the entities (people, companies, products) it would pick up, the facts it would state, what is missing or ambiguous, three concrete fixes, and a score from 0 to 100 with what each point means.
3. Mode bar. A large colour bar at the top of both tabs reads "On-device · N seconds" or "Cloud · N seconds" for each run, so the hybrid behaviour is visible; under it, on-device runs say "Your page stayed in this browser." A status chip above the button says whether the on-device model is ready (green), downloading (live percent) or not available so the cloud is used.
4. Optional outbound links to MentionFox ("Verify these claims against public registers" opens the MentionFox Source Check page; "Find contact details for a decision maker" opens the MentionFox Find Contact page). They open in a new tab. Nothing inside Lens needs an account or payment; the extension is free.

Nothing from the page is sent to MentionFox servers.

## How hybrid inference is used

Lens uses the Firebase AI Logic hybrid inference SDK for every model call. Inference runs on-device through Gemini Nano in Chrome (Chrome built-in AI) when the browser has it available, and falls back to the cloud model through Firebase AI Logic when it does not. The same prompts and the same structured-output parsing are used in both modes, so the result looks the same. The mode bar reports which path ran and how long it took. App Check protects the cloud path (debug provider accepted for this submission).

Code pointers (all in the public repo): src/ai.js has getAiInstance() (App Check, then getAI with GoogleAIBackend), createHybridModel() (getGenerativeModel with mode PREFER_ON_DEVICE, onDeviceParams and inCloudParams, structured output on both paths), initDevice() (initializeDeviceModel with a download progress bar from the Analyze click) and runTask() (generateContent, inferenceSource for the mode bar, and one retry with ONLY_IN_CLOUD if an on-device answer cannot be parsed). src/sidepanel/sidepanel.js analyze() runs the claim extraction call and the GEO lens call. Prompts and schemas: src/shared/prompts.js; tolerant JSON parsing: src/shared/parse.js; main-content extraction and windows: src/shared/extract.js; chunked streaming: src/shared/chunked.js; the checkable-anchor rule: src/shared/anchors.js; the five-tier matcher: src/shared/match.js (findQuote), with highlight.js.

## How we built it

- Firebase AI Logic (hybrid inference, on-device preferred, cloud fallback)
- Gemini Nano via Chrome built-in AI
- Firebase App Check (debug token provider for submission)
- Chrome Extension Manifest V3 (side panel, a content script injected on demand with activeTab and scripting, a service worker; permissions are only activeTab, scripting and sidePanel)
- esbuild for bundling the Firebase SDK into the package (no remote code)
- Unit tests (106 pass) for JSON parsing, extraction, chunked streaming, the five matcher tiers, the anchor rule, the mode bar text, the GEO score, the manifest rules and real-run regression; a Playwright end-to-end run with a mocked model; a live probe against the real cloud path
- Built with Claude Code

## Challenges

On-device availability: Gemini Nano needs Chrome 139 or newer, enabled flags and a model download, and the build machine's Chromium could not run it, so the on-device path is built to the SDK's documented API but was not exercised here (OWNER CONFIRMS). Structured output: the cloud model returns schema-shaped JSON; for the on-device path the same JSON Schema is passed as a responseConstraint and parsing is tolerant (fences, trailing commas, truncation) with a cloud retry. Highlighting: models rewrite quotes (a name expanded, footnote markers copied, a sentence reworded), so the claims prompt asks for verbatim spans and one five-tier matcher finds each quote (exact, no-space, head and tail, a run of 8 or more identical words, 80 percent overlap in a sentence-sized window), wrapping the exact text range in place with the CSS Custom Highlight API as a fallback; in the saved cloud runs every returned quote was found on the page. Labels: one adjective must not turn a dated, named claim into fog, so a claim with a date, number, amount, named place, organisation or event stays specific and checkable. Prompt quality: the first runs on real pages returned related-story headlines and bylines as claims and generic GEO fixes; tightening the prompts fixed most of that (docs/real-runs/NOTES.md lists what remains).

## Accomplishments

- On-device speed work: on-device analysis reads the main content only, about 6,000 characters per press (the lead plus the viewport), in chunks of about 1,500 characters, streaming each claim card and highlight as it is written, with a warm-up when the panel opens and an Analyze more of this page button. Measured on the owner's Chrome with Gemini Nano: On-device · {{ON_DEVICE_SECONDS}} seconds in total, first claim in {{ON_DEVICE_FIRST_CLAIM_SECONDS}} seconds. The streaming logic is also proven with a mock model.
- Runs end to end through Firebase AI Logic with App Check: on four real pages the cloud path returned claims in about 3.1 to 4.1 seconds and the AI view in about 2.5 to 2.8 seconds; the claims call took about 3.5 to 3.6 seconds on the Bankman-Fried, Collison and Theranos pages (cloud, measured on the build machine, one run each).
- 36 of 36 returned claims on the four real pages, and 8 of 8 on each of the Wikipedia and Theranos runs of the new prompt, were real text from the page and were highlighted in place; none were invented. Some are weak (bare statistics) and some labels are debatable; see the run notes.
- Free, MIT licensed, public repo, no account, no MentionFox backend, permissions limited to activeTab, scripting and sidePanel.
- No on-device accuracy figure is claimed; the on-device timings above are the owner's own measurement.

## What is next

Broader page support, more languages, more automatic coverage of very long pages (today one press reads one window of the main content and Analyze more of this page reads the next), a stronger GEO score for weaker pages, and further features that keep the page text on the device.

## Mapping to the four judging criteria

The hackathon page lists four criteria. The Official Rules say they are equally weighted, each scored 1 to 5 and averaged; Stage One is pass/fail on including all submission requirements. No other weights are published.

1. Technological Implementation: how well is the project built, and how effectively does it use Firebase AI Logic hybrid inference.
   - Every model call goes through the Firebase AI Logic hybrid SDK, imported and called at runtime (see the code pointers above).
   - On-device first with a real cloud fallback, visible per run through the mode bar and its seconds.
   - App Check on the cloud path (debug provider, verified working with a registered debug token); structured output parsed by unit-tested code.
2. Design: a complete, coherent product experience, not a proof of concept.
   - One flow: click, see highlights in place, jump from the side panel to the exact sentence, read the GEO lens fixes, optionally follow a link.
   - Tooltips and accessible names on every control (checked by a test), green and amber colour coding with text labels, light and dark colour schemes.
3. Potential Impact: a credible, specific case for a real problem and audience.
   - Audience: people who read or vet bios and pitches (recruiters, journalists, investors, founders), and page owners who care how AI assistants describe them.
   - Problem: telling checkable facts from vague claims fast, and seeing what an assistant would say about a page.
   - Private by default, free, open source, no account.
4. Quality of the Idea: creative, non-obvious use of Firebase AI Logic, with real understanding of the problem space.
   - Hybrid inference fits the problem because page text can be sensitive: on-device keeps it local, and the cloud fallback keeps the tool usable on every machine.
   - Two lenses on the same text: a reader's view (which claims can I check) and a publisher's view (what would an assistant say).

## Links

- Code repository (public, MIT): https://github.com/OsakaSaul/mentionfox-lens (public on GitHub with the MIT license detected, verified 2026-11-23)
- Demo video (YouTube, public, under 3 minutes): [PLACEHOLDER: paste YouTube URL after upload]
- Chrome Web Store listing: [PLACEHOLDER: link after review; unpacked install instructions are in the README until then]
- Privacy policy: https://foxapis.com/lens/privacy/ (hosted on foxapis.com because the mentionfox.com public pages are frozen until 2026-11-24)
- Testing instructions: README, section "Judges' path" (clone, npm install, npm run build:dev, load unpacked, App Check debug token). The owner's registered debug token is not in the repo; see the README for how a judge gets one.

## Required submission checklist

| Item | Status |
| --- | --- |
| Gen AI app built on Firebase AI Logic hybrid inference, Web (Chrome extension) selected | Yes: src/ai.js, Firebase JS SDK firebase/ai, Web (Chrome extension) |
| Uses Gemini Nano on-device with cloud fallback | Code path built (PREFER_ON_DEVICE with cloud fallback; cloud fallback verified live). On-device run: OWNER CONFIRMS in his own Chrome |
| App Check in place (debug token accepted) | Debug token registered; live cloud run through App Check succeeded on 2026-11-23 |
| Public repo URL, source, assets and instructions | Public: https://github.com/OsakaSaul/mentionfox-lens |
| Open-source license visible in the repo About section | MIT LICENSE file; GitHub detects it (PUBLIC, MIT License) |
| Firebase AI Logic imported and actually called in code (not only named in README) | Yes: import from firebase/ai, getGenerativeModel and generateContent called on every Analyze (src/ai.js) |
| Demo video, English, public on YouTube, 3 minutes or less | Script in demo-script.md (Enron, WeWork, Collison, 2:42); not recorded |
| Text description: how Firebase AI Logic is used, features, value proposition | Drafted here |
| URL to the project for testing (Chrome extension or hosted) | Pending Chrome Web Store or unpacked instructions |
| Free of charge, no paywall inside | Per spec: upgrade links are outbound only |
| All materials in English | Yes |
| Existing-app summary | Not needed: new project (first commit 2026-11-23) |
| Submit before Nov 30, 2026, 2:00pm PST | Open |

## OWNER CONFIRMS

1. On-device run: in your own Chrome 139+ with Gemini Nano enabled (README, "What the owner must test"), click Analyze and read the mode bar. It must say On-device · N seconds, with a First claim in N seconds line. Put those two numbers into {{ON_DEVICE_SECONDS}} and {{ON_DEVICE_FIRST_CLAIM_SECONDS}}; the build has not measured anything on-device.
2. Forcing the Cloud bar in the video: use a second Chrome profile or browser without the built-in model (no dev toggle exists in the build).
3. YouTube demo link and Chrome Web Store link (your accounts; none were created by this work).
4. Submitting the App Check debug token: if the hackathon form asks for it, give it in the submission instructions only, never in the repo.
