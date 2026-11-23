# MentionFox Lens: Devpost submission text (#BuildHybridAI)

Hackathon: https://firebasehybridaihackathon.devpost.com/ (deadline Nov 30, 2026, 2:00pm PST). Platform to select: Web (Chrome), a Chrome extension with Gemini Nano via Firebase AI Logic.

Status: filled in from the real build (first build 3aedb16 plus the tuning commit; run notes in docs/real-runs/NOTES.md). Items marked OWNER CONFIRMS need a check in the owner's own Chrome: Gemini Nano on-device was NOT available in the build machine's Chromium (LanguageModel.availability() = unavailable), so every real run so far used the cloud path.

## Tagline

See which claims on any page can be checked and which are just fog, and how an AI assistant would summarise it. Free Chrome extension, on-device first.

## Inspiration

Bios, profiles, pitches and press releases are piles of claims, and AI assistants now read those pages and repeat them. People have no quick way to see which claims are specific and checkable and which are vague or puffery, and page owners have no quick way to see what an assistant would pick up or miss. Doing this with an on-device model means the text of the page you are reading never has to leave your machine.

## What it does

MentionFox Lens is a free, open-source Manifest V3 Chrome extension. It works on the current tab's text, only when you click, on normal web pages: company sites, bios, press releases and news articles. Tested on saved copies of a founder bio, a press release, a company homepage and a news article, plus Wikipedia and an Apple newsroom page. LinkedIn and X were not tested live (no logins were used); they are covered only by hand-written test pages shaped like them.

1. Claim X-ray (tab). Extracts the factual claims on the page (profile, bio, press release, pitch, post), highlights each one in place, and labels it specific-and-checkable or vague/puffery with a one-line reason. A side panel lists every claim, and clicking one scrolls to and highlights the exact sentence.
2. GEO lens (tab named AI view). Shows how an AI assistant would summarise the page: the entities (people, companies, products) it would pick up, the facts it would state, what is missing or ambiguous, three concrete fixes, and a score from 0 to 100 with what each point means.
3. Mode bar. A large colour bar at the top of both tabs shows On-device or Cloud for each run, plus latency (for example Cloud · 3.5 seconds), so the hybrid behaviour is visible. A status chip above the button says whether the on-device model is ready (green), downloading (live percent) or not available so the cloud is used.
4. Optional outbound links to MentionFox ("Verify these claims against public registers" opens the MentionFox Source Check page; "Find contact details for a decision maker" opens the MentionFox Find Contact page). They open in a new tab. Nothing inside Lens needs an account or payment; the extension is free.

Nothing from the page is sent to MentionFox servers.

## How hybrid inference is used

Lens uses the Firebase AI Logic hybrid inference SDK for every model call. Inference runs on-device through Gemini Nano in Chrome (Chrome built-in AI) when the browser has it available, and falls back to the cloud model through Firebase AI Logic when it does not. The same prompts and the same structured-output parsing are used in both modes, so the result looks the same. The mode badge reports which path ran and how long it took. App Check protects the cloud path (debug provider accepted for this submission).

Code pointers (all in the public repo): src/ai.js has getAiInstance() (App Check, then getAI with GoogleAIBackend), createHybridModel() (getGenerativeModel with mode PREFER_ON_DEVICE, onDeviceParams and inCloudParams, structured output on both paths), initDevice() (initializeDeviceModel with a download progress bar from the Analyze click) and runTask() (generateContent, inferenceSource for the badge, and one retry with ONLY_IN_CLOUD if an on-device answer cannot be parsed). src/sidepanel/sidepanel.js analyze() runs the claim extraction call and the GEO lens call. Prompts and schemas: src/shared/prompts.js; tolerant JSON parsing: src/shared/parse.js; highlight matching: src/shared/match.js and highlight.js.

## How we built it

- Firebase AI Logic (hybrid inference, on-device preferred, cloud fallback)
- Gemini Nano via Chrome built-in AI
- Firebase App Check (debug token provider for submission)
- Chrome Extension Manifest V3 (side panel, a content script injected on demand with activeTab and scripting, a service worker; permissions are only activeTab, scripting and sidePanel)
- esbuild for bundling the Firebase SDK into the package (no remote code)
- Unit tests (49) for JSON parsing, claim-to-text matching, the GEO score, the manifest rules and real-run regression; a Playwright end-to-end run with a mocked model (31 checks); a live probe against the real cloud path
- Built with Claude Code

## Challenges

On-device availability: Gemini Nano needs Chrome 139 or newer, enabled flags and a model download, and the build machine's Chromium could not run it, so the on-device path is built to the SDK's documented API but was not exercised here (OWNER CONFIRMS). Structured output: the cloud model returns schema-shaped JSON; for the on-device path the same JSON Schema is passed as a responseConstraint and parsing is tolerant (fences, trailing commas, truncation) with a cloud retry. Highlighting: models paraphrase slightly, so matching tolerates whitespace, case, curly quotes and dashes, wraps the exact text range in place and falls back to the CSS Custom Highlight API; on four real pages 36 of 36 claims were found. Prompt quality: the first runs on real pages returned related-story headlines and bylines as claims and generic GEO fixes; tightening the prompts fixed most of that (docs/real-runs/NOTES.md lists what remains).

## Accomplishments

- Speed work (T2963): on-device analysis reads the main content only, about 6,000 characters per press (the lead plus the viewport), in chunks of about 1,500 characters, streaming each claim card and highlight as it is written, with a warm-up when the panel opens and an Analyze more of this page button. On-device speed is not yet measured (owner to read the bar: total and First claim in X seconds); the streaming logic is proven with a mock model.
- Runs end to end through Firebase AI Logic with App Check: on four real pages the cloud path returned claims in about 3.0 to 4.1 seconds and the AI view in about 2.3 to 2.8 seconds (cloud, measured on the build machine, one run each).
- 36 of 36 returned claims on those pages were real text from the page and were highlighted in place; none were invented. Some are weak (bare statistics) and some labels are debatable; see the run notes.
- Free, MIT licensed, public repo, no account, no MentionFox backend, permissions limited to activeTab, scripting and sidePanel.
- No on-device speed or accuracy figure is claimed because on-device was not run.

## What is next

Broader page support, more languages, better handling of very long pages (today Lens reads the first part and a tail slice of the main text), a stronger GEO score for weaker pages, and further features that keep the page text on the device.

## Mapping to the four judging criteria

The hackathon page lists four criteria. The Official Rules say they are equally weighted, each scored 1 to 5 and averaged; Stage One is pass/fail on including all submission requirements. No other weights are published.

1. Technological Implementation: how well is the project built, and how effectively does it use Firebase AI Logic hybrid inference.
   - Every model call goes through the Firebase AI Logic hybrid SDK, imported and called at runtime (see the code pointers above).
   - On-device first with a real cloud fallback, visible per run through the mode badge and latency.
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
| Demo video, English, public on YouTube, 3 minutes or less | Script drafted in demo-script.md; not recorded |
| Text description: how Firebase AI Logic is used, features, value proposition | Drafted here |
| URL to the project for testing (Chrome extension or hosted) | Pending Chrome Web Store or unpacked instructions |
| Free of charge, no paywall inside | Per spec: upgrade links are outbound only |
| All materials in English | Yes |
| Existing-app summary | Not needed: new project (first commit 2026-11-23) |
| Submit before Nov 30, 2026, 2:00pm PST | Open |

## OWNER CONFIRMS

1. On-device run: in your own Chrome 139+ with Gemini Nano enabled (README, "What the owner must test"), click Analyze and read the badge. It must say On-device with a latency. Note the latency before recording; nothing on-device has been measured.
2. Forcing the Cloud badge in the video: use a second Chrome profile or browser without the built-in model (no dev toggle exists in the build).
3. YouTube demo link and Chrome Web Store link (your accounts; none were created by this work).
4. Submitting the App Check debug token: if the hackathon form asks for it, give it in the submission instructions only, never in the repo.
