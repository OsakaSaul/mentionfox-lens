# MentionFox Lens: demo video script (#BuildHybridAI)

OWNER FILLS (measure in your own Chrome 139+ with Gemini Nano ready, then replace the placeholder everywhere in this file):
- {{ON_DEVICE_SECONDS}}: the total on the mode bar, "On-device · N seconds". Used in the scene 2 voice-over and the scene 2 caption.
- {{ON_DEVICE_FIRST_CLAIM_SECONDS}}: the number in the "First claim in N seconds" line. Used in the scene 2 voice-over and the scene 2 caption.
Read both off your screen on the take you keep. If the bar says Cloud on your take, the on-device lines in scene 2 are wrong: re-take, or reword to what you see.

Target length: 2:42 (hard limit 3:00; the contest evaluates only the first 3 minutes). Language: English. Upload to YouTube as public, then paste the link in the Devpost form. Record on Chrome desktop with the unpacked build, version 0.1.1.

Spoken text is about 300 words, 120 seconds at 150 words per minute, plus about 41 seconds of silent screen time, so the cut is 2:42. The on-device wait is not fixed: cut or speed up the waiting in the edit so each scene keeps the length in the timeline (show at most about 6 seconds of waiting per page).

Backup page: Theranos FDA release remains the backup page (fixtures/demo/theranos-1.html). The opening stays Enron, then WeWork, then Patrick Collison (T2970 decision: hype pages where Lens flags lots of amber).

Do not say any speed you have not read off the screen. The only measured numbers are cloud ones (the claims call took about 3.5 to 3.6 seconds on the Bankman-Fried, Collison and Theranos pages, docs/real-runs/NOTES.md); this script does not use them.

Hackathon requirements, where they appear: the hybrid inference mode bar on screen (scenes 2 to 6), the Firebase AI Logic code snippet (scene 6), the open-source repo (scene 7).

## What the build shows (so the words match the screen)

- Mode bar, top of both tabs: "On-device · N seconds" (teal) or "Cloud · N seconds" (blue). The line under it says "Your page stayed in this browser." when the run was on-device. A "First claim in N seconds" line shows the time to the first claim.
- Streaming (on-device): the page text is read in chunks of about 1,500 characters. Each claim card and its highlight appears as its chunk finishes. Status line: "Finding claims: chunk 2 of 4, 3 claims so far..."
- One on-device run reads about 6,000 characters of the page's main content (the lead plus the part in view); in the cloud it is one call over a 12,000-character window of the same main-content extraction. The button "Analyze more of this page" reads the next window (on-device: about 6,000 more characters per press). It shows only when there is more text left.
- Main-content extraction drops navigation, infobox, references, footnote markers and similar furniture before the model sees the text.
- Quotes are verbatim. One matcher finds each quote on the page in five tiers: exact normalized match, no-space match, head and tail match, a run of 8 or more identical words, 80 percent word overlap in a sentence-sized window. The same matcher gives the green highlight and the jump. "Not found on the page" appears only when all five tiers fail.
- Checkable-anchor rule: a claim with a date, number, amount, named place, organisation or event stays Specific and checkable; it is Vague only when it has no anchor. So a sentence that names an organisation or a year can be green even if it sounds like marketing.

## Pages to use (all HTTP 200 on web.archive.org, verified 2026-11-23T05:50Z; details, runs and alternatives in submission/lens-demo-pages.md)

1. Opening page, Enron "Vision and values" (company page of 2001, saved by the Internet Archive): https://web.archive.org/web/20010124060900/http://www4.enron.com:80/corp/inside/vision/
   Our runs (before the anchor rule): 8 claims, 2 green and 6 amber in 4 of 6 runs. The anchor rule can turn a sentence that names an organisation green, so the amber count may differ: judge your own take and press Run again if it is thin.
2. Second page, WeWork "Our Mission" (2019): https://web.archive.org/web/20190411023244/https://www.wework.com/mission
   Our runs: 8 to 10 claims, 5 to 8 amber, 4 of 4 runs. Slow first load (29 seconds in our test): open this tab about a minute before recording.
3. Contrast page: https://en.wikipedia.org/wiki/Patrick_Collison (8 claims, all green, 0 amber, cloud run 2026-11-23).
4. Fallback if either Archive page is slow on the day: Enron "Inside Enron", https://web.archive.org/web/20010111075200/http://www4.enron.com:80/corp/inside/index.html (6 to 9 claims, 3 to 7 amber).

The Archive toolbar (67 px, in the page flow) does not cover any page text. Saved copies are in fixtures/demo/; do not use them on camera, open the Archive URL.

Editorial rule (do not break it, the owner is a solo founder): Lens only labels claims as checkable or vague. The voice-over never says or implies that a person or company did anything wrong, and never says a named person committed a crime. The only fact about the companies is "later collapsed", which is public record (sources in submission/lens-demo-pages.md). Never say fraud or scam. Do not read the words integrity, honest or respect aloud, and do not click those cards.

## Voice-over (spoken words, timed)

0:00 Scene 1 (18 seconds of speech). "Every company page is a pile of claims. Some you can check. Some are fog. This is MentionFox Lens, a free, open source Chrome extension built on Firebase AI Logic hybrid inference. Here is a company values page from 2001, saved by the Internet Archive."

0:20 Scene 2 (27 seconds). "I click Lens, then Analyze. The mode bar shows where the model ran and how long it took: On-device, {{ON_DEVICE_SECONDS}} seconds. The first claim came in {{ON_DEVICE_FIRST_CLAIM_SECONDS}} seconds, and the cards stream in as each chunk finishes. Your page stayed in this browser. Green means checkable: a date, a number, a name. Amber means vague. Look at all the amber."

0:53 Scene 3 (19 seconds). "I click an amber card. The page jumps to that sentence and lights it up. The best and the brightest people: no number, no source, nothing to check. Lens does not say who is right. It only separates claims you can verify from words you cannot."

1:20 Scene 4 (15 seconds). "Second page: a mission page from 2019. Same click. Again mostly amber. We never settle. Something greater than ourselves. Both companies later collapsed, which is public record. Lens says nothing about why. It only reads the words."

1:47 Scene 5 (14 seconds). "Now the opposite: a founder biography on Wikipedia. Same click. Claims with a date, a number or a place stay green. Lens is not just negative. Analyze more of this page reads the next part."

2:11 Scene 6 (21 seconds). "Under the hood: the code calls getGenerativeModel from Firebase AI Logic with prefer on-device mode. If Gemini Nano is in this browser, the bar says On-device and the page text stays on the laptop. If not, the same call falls back to the cloud, protected by App Check, and the bar says Cloud."

2:34 Scene 7 (7 seconds). "No account, nothing sent to MentionFox, MIT licensed, on GitHub. Built by one person in Osaka. Thank you."

Cut ends 2:42.

Captions: English, the voice-over text above. Scene 2 also gets an on-screen caption: "On-device · {{ON_DEVICE_SECONDS}} seconds, first claim in {{ON_DEVICE_FIRST_CLAIM_SECONDS}} seconds".

## Timeline (about 150 spoken words per minute plus silent screen time)

| Scene | Start to end | Speech (s) | Silent (s) | Total (s) |
| --- | --- | --- | --- | --- |
| 1 Enron, title | 0:00 to 0:20 | 18 | 2 | 20 |
| 2 Analyze Enron | 0:20 to 0:53 | 27 | 6 | 33 |
| 3 Jump to amber cards | 0:53 to 1:20 | 19 | 8 | 27 |
| 4 WeWork | 1:20 to 1:47 | 15 | 12 | 27 |
| 5 Collison, Analyze more | 1:47 to 2:11 | 14 | 10 | 24 |
| 6 Code and mode bar | 2:11 to 2:34 | 21 | 2 | 23 |
| 7 Repo end card | 2:34 to 2:42 | 7 | 1 | 8 |

Total 2:42 (162 seconds: 121 speech, 41 silent): 18 seconds under the 3:00 limit and 8 under 2:50.

## Shot list with exact clicks

All pages are opened in tabs BEFORE recording (tab 1 Enron, tab 2 WeWork, tab 3 Wikipedia, tab 4 src/ai.js in your editor or on GitHub, tab 5 the repo page). The Lens side panel is closed at the start. Wait until each Archive page shows its text. Do not show any key, Firebase config or token.

| Scene | Screen | Exact clicks | Time |
| --- | --- | --- | --- |
| 1 | Title card (repo name, MentionFox Lens logo, "Firebase AI Logic hybrid inference"), then Chrome tab 1 (Enron) | Show the title card for 3 seconds, then click tab 1. The page shows the red heading "our values" (the Archive toolbar above it is normal). Do not scroll. | 0:00 to 0:20 |
| 2 | Tab 1, Lens side panel | Click the Lens toolbar icon, click "Open Lens side panel", click "Analyze this page". Wait: the status line shows "Finding claims: chunk 1 of N, ..." and the cards and highlights appear one by one. Point the cursor at the mode bar ("On-device · N seconds", teal), at the line "Your page stayed in this browser." and at "First claim in N seconds". Wait for "Done in N seconds on-device". Then slowly move the cursor down the card list: mostly amber. If only 4 or 5 claims show, click "Run again" next to the status line and wait again before you talk about the amber. Read the two numbers off the screen and fill the placeholders. | 0:20 to 0:53 |
| 3 | Tab 1, Claim X-ray tab | Click the amber card "That's why we employ the best and the brightest people." The page jumps to that sentence and flashes it. Hold 3 seconds. Then click another amber card that shows in your take, for example "Together we're creating the leading energy company in the world." (or "We believe in the inherent wisdom of open markets."). Point at the one-line reason on a card. Do NOT click the cards about integrity, respect or honesty. If a card says "Not found on the page", skip it. | 0:53 to 1:20 |
| 4 | Tab 2 (WeWork) | Click tab 2 (already loaded; if blank, wait for the hero photo). The side panel stays open: click "Analyze this page" and wait for "Done". Click the amber card "We never settle." (the page jumps down to the Our Values list), then the amber card "We do what we love and are connected to something greater than ourselves." Do not click any card that contains profanity. | 1:20 to 1:47 |
| 5 | Tab 3 (Patrick Collison, Wikipedia) | Click tab 3, click "Analyze this page", wait for "Done". Scroll the card list slowly so the green cards show. Then click "Analyze more of this page" once (the button under the list; it shows only when text is left) and show the new cards being added. | 1:47 to 2:11 |
| 6 | Side panel, then the code | Zoom on the mode bar once more, then click tab 4: src/ai.js, the getGenerativeModel call with InferenceMode.PREFER_ON_DEVICE (the README table "How hybrid inference is used" gives the line numbers). Keep the code on screen for the whole scene. | 2:11 to 2:34 |
| 7 | GitHub repo page | Click tab 5, show the README and the MIT license. End card with the repo URL: github.com/OsakaSaul/mentionfox-lens | 2:34 to 2:42 |

## Recording notes

- Show the on-device mode bar on a machine where the built-in model is already downloaded, so the demo does not wait on a download. When the model is downloadable, Analyze starts the download from the click, shows the download percent, and the cloud answers meanwhile [OWNER CONFIRMS: not seen on the build machine].
- Model output varies from run to run (claim count 4 to 10 on the same page, amber 2 to 8). Judge the take by what you see; say "all the amber" only if you really see most cards amber.
- Add English captions. Keep the final export under 3:00.
- Do not claim speed, accuracy or privacy beyond what the build does: the privacy line is true only if the page text goes nowhere except the on-device model or, on fallback, Firebase AI Logic.

## How to show Cloud, then On-device (no switch needed)

1. Cloud take: with the on-device model still downloading (chip: "On-device model: downloading NN%", progress bar visible), press Analyze. The bar is blue: "Cloud (on-device not ready) · X seconds" and the status line says "Done in X seconds on Cloud (on-device not ready): N claims."
2. Wait until the chip turns green: "On-device model ready" (it updates by itself).
3. On-device take: press "Run again" next to the status line. The bar is teal: "On-device · X seconds" and the status line says "Done in X seconds on-device: N claims."
4. The same mode bar sits at the top of Claim X-ray and AI view.

## Scene: Analyze on-device, then Check one claim, then the verdict (0.1.4, T2989)

STATUS (0.1.4): Check calls our own server (api.foxapis.com/v1/lens/check) for one sentence. Record the scene only after one real Check shows a verdict on your own screen; read the colour and the reason off your screen. Note that a check can come back Supported: the Enron Broadband claim "the build-out of Enron's 18,000-mile global fiber network is near completion" came back Supported in our test (the annual report did say it). Use a sentence that came back Contradicted for the red card, such as the Wirecard trust-account sentence on the test page.

Order on screen: Analyze (the mode bar says On-device, teal), then click Check on the Enron Broadband claim, then read the verdict. Page: https://web.archive.org/web/20010507225240/http://www4.enron.com:80/corp/investors/annuals/2000/broadband.html . The Specific and checkable card to use is "The build-out of Enron's 18,000-mile global fiber network is near completion." Click Check; the card shows "Checking the web..." and then Contradicted, No clear record or Supported with a one-line reason and up to 3 sources. The mode bar line on the result says "Cloud · N seconds". Say: "Analysis stayed on my device. Check sends just this one sentence, the site and the date to a web check." Read the colour and the reason off your screen; say only what the card says. Never say fraud. Do not click Check more than the 5 free ones; "3 of 5 free checks left today" is on screen.

## Round 3 result (T2991): the Holmes pages do not give a clean red

On the Fortune June 2014 page nothing went red on Check (Supported or No clear record). On the WSJDLive page two sentences went red but their sources do not support the verdict, so do not film them. Keep the Enron Broadband claim as a GREEN (Supported) contrast only. For a guaranteed red card see the recommendation at the end of submission/lens-demo-pages.md (round 3).
