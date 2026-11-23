# MentionFox Lens: demo video script (#BuildHybridAI)

Target length: 2:45 (hard limit 3:00, the contest evaluates only the first 3 minutes). Language: English. Upload to YouTube as public, then paste the link in the Devpost form. Record on Chrome desktop with the unpacked build loaded.

Spoken text is about 355 words, about 2:22 at 150 words per minute, plus about 23 s of silent screen time (waiting for the answer, scrolling, clicking), so the cut ends at about 2:45.

Items marked OWNER CONFIRMS need your own Chrome (Gemini Nano was not available on the build machine, so no on-device run was seen). Do not read a latency number aloud until you have read it off your screen. On the build machine the cloud path took 3.3 to 4.2 s for the claims and 2.6 to 3.1 s for the AI view (2026-11-23 runs on the pages below).

Hackathon requirements, where they appear: the hybrid inference mode bar on screen (scenes 2 and 5), the code snippet showing Firebase AI Logic (scene 5), the open-source repo (scene 7).

## Pages to use (all load in a normal browser, HTTP 200, confirmed 2026-11-23)

- Opening page (top pick): Theranos press release of 2 July 2015, as saved by the Internet Archive: https://web.archive.org/web/20151218013228/https://www.theranos.com/news/posts/theranos-receives-fda-clearance-and-review-and-validation-of-revolutionary-finger-stick-technology-test-and-associated-test-system
  Real 2015 company copy with hard numbers (818 subjects, sixty-nine devices, $9.07, 153 tests, founded 2003) next to adjectives ("ground breaking", "most rigorous ... in the world"). Three runs: 10 claims, 7 green and 3 amber, 9 of 10 highlighted (the first card, "Theranos today announced...", is not found on the page because the model dropped a parenthesis; do not click it, click the $9.07 card).
- Contrast page: https://en.wikipedia.org/wiki/Patrick_Collison (8 to 9 claims, all green, no amber in our two runs).
- Runner-up if the Archive is slow on the day: FTX blog "FTX in 2021H1 review", https://web.archive.org/web/20220521211157/https://blog.ftx.com/blog/mid_year_review_2021/ (10 to 11 claims, 7 to 9 green, 2 to 3 amber).
- Saved copies of every candidate are in fixtures/demo/ (see fixtures/demo/README.md), with the runs in docs/demo/. Do not use the saved copies on camera; open the Archive URL.

The demo only labels claims as checkable or vague. It never says a real person or company is right or wrong, and the voiceover must not either: say what Lens does, not what the company did.

## Voiceover (spoken words, timed)

0:00 Scene 1. "Every company page is a pile of claims. Some you can check. Some are just fog. AI assistants read these pages and repeat them. This is MentionFox Lens, a free, open source Chrome extension that shows you which is which, using Firebase AI Logic hybrid inference. Here is a real company press release from 2015, saved by the Internet Archive."

0:25 Scene 2. "I click Lens, then Analyze. One click. Watch the big mode bar at the top of the results: it says where the model ran, on-device inside Chrome with Gemini Nano, or in the cloud, and the latency is right next to it. Now the claims. Green means specific and checkable: a date, a price, a count. Amber means vague: ground breaking, most rigorous in the world. Each card has a one-line reason."

0:55 Scene 3. "I click the price claim. The page jumps to that exact sentence and lights it up. A reader could check that figure against pricing records. The amber one next to it has no number to check at all. Lens does not decide who is right. It only separates claims you can verify from words you cannot."

1:22 Scene 4. "For contrast, a founder biography on Wikipedia. Same click. Almost everything comes out green: dates, roles, figures. A page full of checkable facts looks very different from a page full of adjectives."

1:40 Scene 5. "Under the hood, this is the hackathon requirement. The code calls getGenerativeModel from Firebase AI Logic with prefer on-device mode. If Gemini Nano is in this browser, the badge says On-device and the page text never leaves the laptop. If not, the same call falls back to the cloud, protected by App Check, and the bar says Cloud. Same code, same answer shape."

2:08 Scene 6. "The second tab, AI view, shows how an assistant would summarise the page: the people, companies and products it picks up, the facts it would state, what is missing, and a score out of one hundred. That score measures how readable the page is to an AI, not whether it is true."

2:30 Scene 7. "No account, nothing sent to MentionFox, MIT licensed, on GitHub. Built by one person in Osaka. Tell me what you would check first. Thank you."

Timeline (spoken seconds at 150 wpm): scene 1 24 s, 2 26 s, 3 24 s, 4 13 s, 5 25 s, 6 21 s, 7 10 s: 142 s of speech in a 165 s cut.

## Shot list

| Scene | Screen | Action | Duration |
| --- | --- | --- | --- |
| 1 | Title card (repo name, MentionFox Lens logo, "Firebase AI Logic hybrid inference"), then Chrome on the opening page | Cut to the Archive URL above. Let the page load fully (about 5 s; the Archive toolbar shows at the top, that is normal). | 0:00 to 0:25 |
| 2 | Same page, Lens side panel | Click the Lens icon, click Open Lens side panel, click Analyze this page (one click runs both checks). Wait about 4 s. Zoom on the mode bar and the latency [OWNER CONFIRMS: read the real label on your Chrome; "On-device (private)" in teal if Gemini Nano is ready, otherwise "Cloud" in blue]. Show the green and amber cards. | 0:25 to 0:55 |
| 3 | Same page, highlights | In the Claim X-ray tab click the card that quotes the price ("Theranos' HSV-1 test costs $9.07 ..."). The page scrolls to the sentence and flashes it. Then click the amber card ("The FDA's decision provides independent validation ... ground breaking ...") and show its one-line reason. | 0:55 to 1:22 |
| 4 | Patrick Collison Wikipedia page | Open the page, click Analyze this page, scroll past the green highlights (no amber). | 1:22 to 1:40 |
| 5 | Side panel plus the code | Show the mode bar again, then the code: src/ai.js, the getGenerativeModel call with InferenceMode.PREFER_ON_DEVICE (README table "How hybrid inference is used" has the line numbers). If you have a browser without Gemini Nano, run Analyze there once to show the Cloud bar. Do not show any key or token on screen. | 1:40 to 2:08 |
| 6 | Opening page, AI view tab | Open the AI view tab: the 0 to 100 score and its band, then the headings for the people, companies and products, the facts, what is missing, and the 3 fixes. Do not dwell on the "missing" list. | 2:08 to 2:30 |
| 7 | GitHub repo page, README and MIT licence | End card with the repo URL: github.com/OsakaSaul/mentionfox-lens | 2:30 to 2:45 |

## Recording notes

- Show the on-device mode bar on a machine where the built-in model is already downloaded, so the demo does not wait on a download. First-run behaviour in the build: when the model is downloadable, Analyze starts the download from the click, shows the download percent, and the cloud answers meanwhile [OWNER CONFIRMS: not seen on the build machine].
- Never show the Firebase config, App Check debug token or any key on screen.
- Model output varies a little from run to run (claim count 8 to 11 on the same page). Judge the take by what you see; if the first card on the opening page is "Not found on the page", just do not click it.
- Add English captions. Keep the final export under 3:00.
- Do not claim speed, accuracy or privacy beyond what the build does: the privacy line is true only if the page text goes nowhere except the on-device model or, on fallback, Firebase AI Logic.

## OWNER CONFIRMS

1. The On-device (private) mode bar and its real latency in your Chrome 139+ with Gemini Nano (README, "What the owner must test"). Read the number off the screen; do not state one from this script.
2. First-run model download behaviour on your machine (percent and progress bar, then the green ready chip, then Run again).
3. How you show the Cloud bar for scene 5: run Analyze before the download finishes (see "How to show Cloud, then On-device" below).
4. If the on-device result on these pages looks different from the cloud one, change the scene wording to what you see.


## How to show Cloud, then On-device (no switch needed)

1. Cloud take: with the on-device model still downloading (chip: "On-device model: downloading NN%", progress bar visible), press Analyze. The bar is blue: "Cloud (on-device not ready) · X s" and the status line says "Done in X s on Cloud (on-device not ready): N claims." If the chip says "not downloaded yet", click **Download on-device model** first, or press Analyze (it starts the download too).
2. Wait until the chip turns green: "On-device model ready" (it updates by itself; no page reload).
3. On-device take: press **Run again** next to the status line. The bar is teal with a shield: "On-device (private) · X s" and the status line says "Done in X s on-device (private): N claims."
4. Show both tabs: the same mode bar sits at the top of Claim X-ray and AI view.
