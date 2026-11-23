# MentionFox Lens: demo video script (#BuildHybridAI)

Target length: 2:40 (hard limit 3:00; the contest evaluates only the first 3 minutes; this script ends under 2:50 even with a slow take). Language: English. Upload to YouTube as public, then paste the link in the Devpost form. Record on Chrome desktop with the unpacked build loaded.

Spoken text is 277 words, 111 seconds at 150 words per minute, plus about 49 seconds of silent screen time (loading, waiting for the answer, clicking), so the cut is 2:40.

Items marked OWNER CONFIRMS need your own Chrome (Gemini Nano was not available on the build machine, so no on-device run was seen). Do not read a latency number aloud until you have read it off your screen. On the build machine the cloud path took 3.3 to 4.5 seconds for the claims and 2.6 to 5.3 seconds for the AI view.

Hackathon requirements, where they appear: the hybrid inference mode bar on screen (scenes 2, 3, 4 and 6), the code snippet showing Firebase AI Logic (scene 6), the open-source repo (scene 7).

## Pages to use (all HTTP 200 on web.archive.org, verified 2026-11-23T05:50Z; details, runs and alternatives in submission/lens-demo-pages.md)

1. Opening page, Enron "Vision and values" (company page of 2001, saved by the Internet Archive): https://web.archive.org/web/20010124060900/http://www4.enron.com:80/corp/inside/vision/
   Our runs: 8 claims, 2 green and 6 amber in 4 of 6 runs (4 and 5 claims, 2 and 3 amber in the other two: if your take is thin, press Run again).
2. Second page, WeWork "Our Mission" (2019): https://web.archive.org/web/20190411023244/https://www.wework.com/mission
   Our runs: 8 to 10 claims, 5 to 8 amber, 4 of 4 runs. Slow first load (29 seconds in our test): open this tab about a minute before recording.
3. Honest page: https://en.wikipedia.org/wiki/Patrick_Collison (8 claims, all green, 0 amber, run 2026-11-23).
4. Fallback if either Archive page is slow on the day: Enron "Inside Enron", https://web.archive.org/web/20010111075200/http://www4.enron.com:80/corp/inside/index.html (6 to 9 claims, 3 to 7 amber).

The Archive toolbar (67 px, in the page flow) does not cover any page text. Saved copies are in fixtures/demo/; do not use them on camera, open the Archive URL.

Editorial rule (do not break it, the owner is a solo founder): Lens only labels claims as checkable or vague. The voiceover never says or implies that a person or company did anything wrong. The only fact about the companies is "later collapsed", which is public record (sources in submission/lens-demo-pages.md). Never say fraud or scam. Do not read the words integrity, honest or respect aloud, and do not click those cards.

## Voiceover (spoken words, timed)

0:00 Scene 1 (20 seconds of speech). "Every company page is a pile of claims. Some you can check. Some are fog. This is MentionFox Lens, a free, open source Chrome extension built on Firebase AI Logic hybrid inference. It sorts the two for you. Here is a company values page from 2001, saved by the Internet Archive."

0:22 Scene 2 (21 seconds). "I click Lens, then Analyze. One click. The mode bar shows where the model ran, on-device with Gemini Nano or in the cloud, and the seconds it took. Green means checkable: a date, a number, a name. Amber means vague. Look at all the amber. Each card has a one line reason."

0:52 Scene 3 (19 seconds). "I click an amber card. The page jumps to that sentence and lights it up. The best and the brightest people: no number, no source, nothing to check. Lens does not say who is right. It only separates claims you can verify from words you cannot."

1:20 Scene 4 (15 seconds). "Second page: a mission page from 2019. Same click. Again mostly amber. We never settle. Something greater than ourselves. Both companies later collapsed, which is public record. Lens says nothing about why. It only reads the words."

1:52 Scene 5 (8 seconds). "Now the opposite: a founder biography on Wikipedia. Same click. Eight claims, all green. Lens is not just negative."

2:10 Scene 6 (21 seconds). "Under the hood: the code calls getGenerativeModel from Firebase AI Logic with prefer on-device mode. If Gemini Nano is in this browser, the badge says On-device and the page text stays on the laptop. If not, the same call falls back to the cloud, protected by App Check, and the badge says Cloud."

2:32 Scene 7 (7 seconds). "No account, nothing sent to MentionFox, MIT licensed, on GitHub. Built by one person in Osaka. Thank you."

Cut ends 2:40.

Timeline (speech seconds at 150 wpm plus silent time): scene 1 0:00 to 0:22 (20 + 2), scene 2 0:22 to 0:52 (21 + 9), scene 3 0:52 to 1:20 (19 + 9), scene 4 1:20 to 1:52 (15 + 17), scene 5 1:52 to 2:10 (8 + 10), scene 6 2:10 to 2:32 (21 + 1), scene 7 2:32 to 2:40 (7 + 1): 111 seconds of speech in a 160 seconds cut.

## Shot list with exact clicks

All pages are opened in tabs BEFORE recording (tab 1 Enron, tab 2 WeWork, tab 3 Wikipedia, tab 4 the code in your editor or on GitHub, tab 5 the repo). Lens side panel closed at the start. Wait until each Archive page shows its text.

| Scene | Screen | Exact clicks | Time |
| --- | --- | --- | --- |
| 1 | Title card (repo name, MentionFox Lens logo, "Firebase AI Logic hybrid inference"), then Chrome tab 1 (Enron) | Show the title card for 3 seconds, then click tab 1. The page shows the red heading "our values" at the top (Archive toolbar above it is normal). Do not scroll. | 0:00 to 0:22 |
| 2 | Tab 1, Lens side panel | Click the Lens toolbar icon, click "Open Lens side panel", click "Analyze this page". Wait until the status line says "Done in N seconds" (about 5 seconds on the cloud). Point the cursor at the mode bar and the seconds [OWNER CONFIRMS: read the real label on your Chrome; "On-device" in teal if Gemini Nano is ready, otherwise "Cloud" in blue]. Slowly move the cursor down the card list: about 6 amber cards, 2 green. If it shows only 4 or 5 claims, click "Run again" next to the status line and wait again before talking about the amber. | 0:22 to 0:52 |
| 3 | Tab 1, Claim X-ray tab | Click the amber card "That's why we employ the best and the brightest people." The page jumps to that sentence and flashes it. Hold 3 seconds. Then click the amber card "Together we're creating the leading energy company in the world." (if it is not in your take, click "We believe in the inherent wisdom of open markets."). Show the one-line reason on a card. Do NOT click the cards about integrity, respect or honesty. | 0:52 to 1:20 |
| 4 | Tab 2 (WeWork) | Click tab 2 (already loaded; if it is still blank wait for the hero photo to appear). Click Lens icon, "Analyze this page" (the side panel may already be open: then just click "Analyze this page"). Wait for "Done". Click the amber card "We never settle." (page jumps down to the Our Values list), then the amber card "We do what we love and are connected to something greater than ourselves." Do not click any card that contains profanity. | 1:20 to 1:52 |
| 5 | Tab 3 (Patrick Collison, Wikipedia) | Click tab 3, click "Analyze this page", wait for "Done", scroll the card list slowly so the green cards show (no amber). | 1:52 to 2:10 |
| 6 | Side panel plus the code | Show the mode bar once more (zoom on it), then switch to tab 4: src/ai.js, the getGenerativeModel call with InferenceMode.PREFER_ON_DEVICE (README table "How hybrid inference is used" has the line numbers). Keep the code on screen for the whole scene. Do not show any key, Firebase config or token on screen. | 2:10 to 2:32 |
| 7 | GitHub repo page, README and MIT licence | Click tab 5. End card with the repo URL: github.com/OsakaSaul/mentionfox-lens | 2:32 to 2:40 |

## Recording notes

- Show the on-device mode bar on a machine where the built-in model is already downloaded, so the demo does not wait on a download. First-run behaviour in the build: when the model is downloadable, Analyze starts the download from the click, shows the download percent, and the cloud answers meanwhile [OWNER CONFIRMS: not seen on the build machine].
- Never show the Firebase config, App Check debug token or any key on screen.
- Model output varies from run to run (claim count 4 to 10 on the same page, amber 2 to 8). Judge the take by what you see; if the amber count is low, press Run again and record the better take. Say "all the amber" only if you really see most cards amber.
- Add English captions. Keep the final export under 3:00.
- Do not claim speed, accuracy or privacy beyond what the build does: the privacy line is true only if the page text goes nowhere except the on-device model or, on fallback, Firebase AI Logic.

## OWNER CONFIRMS

1. The On-device mode bar and its real latency in your Chrome 139+ with Gemini Nano (README, "What the owner must test"). Read the number off the screen; do not state one from this script.
2. First-run model download behaviour on your machine (percent and progress bar, then the green ready chip, then Run again).
3. How you show the Cloud bar for scene 6: run Analyze before the download finishes (see "How to show Cloud, then On-device" below).
4. If the on-device result on these pages looks different from the cloud one, change the scene wording to what you see.


## How to show Cloud, then On-device (no switch needed)

1. Cloud take: with the on-device model still downloading (chip: "On-device model: downloading NN%", progress bar visible), press Analyze. The bar is blue: "Cloud (on-device not ready) · X seconds" and the status line says "Done in X seconds on Cloud (on-device not ready): N claims." If the chip says "not downloaded yet", click **Download on-device model** first, or press Analyze (it starts the download too).
2. Wait until the chip turns green: "On-device model ready" (it updates by itself; no page reload).
3. On-device take: press **Run again** next to the status line. The bar is teal with a shield: "On-device · X seconds" and the status line says "Done in X seconds on-device: N claims."
4. Show both tabs: the same mode bar sits at the top of Claim X-ray and AI view.
