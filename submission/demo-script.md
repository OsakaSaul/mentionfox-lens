# MentionFox Lens: demo video script (#BuildHybridAI)

Target length: 2:50 (hard limit 3:00, the contest evaluates only the first 3 minutes). Language: English. Upload to YouTube as public, then paste the link in the Devpost form. Record on Chrome desktop with the unpacked build loaded.

Filled in from the real build. Items marked OWNER CONFIRMS need your own Chrome (Gemini Nano was not available on the build machine, so no on-device run was seen). Do not read a latency number aloud until it has been measured on the recording machine. For reference, cloud runs on the build machine took about 3 to 4 s for the claims and 2.3 to 2.8 s for the AI view.

## Pages to use (fetched and confirmed to resolve on 2026-11-23, HTTP 200)

- Founder bio: https://en.wikipedia.org/wiki/Patrick_Collison (a real, public founder biography full of dates, roles and figures: good for specific-and-checkable claims, and for a few vague ones).
- Press release: https://www.apple.com/newsroom/2023/09/apple-unveils-iphone-15-pro-and-iphone-15-pro-max/ (a real public press release mixing hard specs with superlatives: good for the vague/puffery label).
- GEO lens page: the same Apple press release. (Both pages were run in the real build on 2026-11-23: Wikipedia returned 9 claims, all green, no amber; the Apple release returned 10 claims, 9 green and 1 amber, all highlighted.) The demo only labels claims as checkable or vague; it never says a real person or company is wrong.

## Voiceover (spoken words, timed)

0:00 Scene 1. "Every profile, bio and press release is a pile of claims. Some you can check. Some are just fog. And now AI assistants read these pages and repeat them. This is MentionFox Lens: a free Chrome extension that shows you which is which, privately, using Firebase AI Logic hybrid inference."

0:20 Scene 2. "Here is a founder biography. I click Analyze. Watch the badge: On-device, private. Gemini Nano is running inside Chrome, so the page text never leaves this laptop. It took a moment, and the latency is shown right here."

0:45 Scene 3. "Every factual claim is highlighted in place. Green means specific and checkable: a date, a role, a figure. Amber, which we will see on the next page, means vague. Each one has a one-line reason, so you see why it was marked, not just that it was. Tooltips explain every control. I click a claim in the side panel and the page jumps to exactly that sentence and lights it up."

1:15 Scene 4. "Now a press release. Same click. Specs, dates and figures come out green. Statements like the most pro lineup we have ever created, the best iPhone camera system yet, come out amber, because nobody can check them. In a pitch or a bio, that is exactly the difference between a claim and a slogan, and Lens puts it in front of you in seconds."

1:40 Scene 5. "Hybrid means the app never assumes. On a browser with no local model, the same click falls back. The badge flips to Cloud, the request goes through Firebase AI Logic, protected by App Check, and the result looks the same. Same code, same answer shape, the privacy of on-device when it is available, and the reach of the cloud when it is not."

2:05 Scene 6. "Next, GEO lens. It shows how an AI assistant would summarise this page: the people, companies and products it picks up, the facts it would state, what is missing, and three concrete fixes, with a score out of one hundred and what each point means."

2:30 Scene 7. "Nothing here needs an account, and nothing from the page is ever sent to MentionFox. If you want to verify these claims against public registers, there is an optional link that opens in a new tab. Lens is free and open source, under the MIT licence. Built by one person in Osaka with Firebase AI Logic, Gemini Nano and App Check. Install it from GitHub, and tell me what you would check first. Thank you."

## Shot list

| Scene | Screen | Action | Voiceover line | Duration |
| --- | --- | --- | --- | --- |
| 1 | Title card, then Chrome with the MentionFox Lens toolbar icon (the family fox head) visible | Show the repo name, MentionFox Lens logo and the words Firebase AI Logic hybrid inference. Cut to the Wikipedia page. | "Every profile, bio and press release is a pile of claims..." | 0:00 to 0:20 |
| 2 | Patrick Collison Wikipedia page, Lens side panel open | Click the Lens icon, click Open Lens side panel, then Analyze this page (one click runs both checks; the Claim X-ray tab opens first). Zoom on the mode badge reading On-device (private) with the latency in ms next to it [OWNER CONFIRMS: not seen on the build machine; read the real label and number on your Chrome]. | "Here is a founder biography..." | 0:20 to 0:45 |
| 3 | Same page, highlights visible | Scroll slowly past the green highlights (the Wikipedia page returned no amber ones). Hover a tooltip. Click a claim in the side panel list: the page scrolls to and flashes that sentence. | "Every factual claim is highlighted in place..." | 0:45 to 1:15 |
| 4 | Apple iPhone 15 Pro press release | Click Analyze this page. Pause on one green spec claim, for example the 3-nanometer chip or the 14 countries sentence, then on the amber sentence "This is the most pro lineup we have ever created..." with its one-line reason. | "Now a press release..." | 1:15 to 1:40 |
| 5 | A browser state with no Gemini Nano available: a second Chrome profile or a Chromium where the built-in model is not installed (the build has no dev toggle; the status chip then reads "On-device not available ...: cloud fallback") | Click Analyze this page. Badge shows Cloud and the latency in ms (about 3 to 4 s in the build machine's runs). Show the same result layout. Do not show any key or token on screen. | "Hybrid means the app never assumes..." | 1:40 to 2:05 |
| 6 | Press release page, AI view tab (GEO lens) | Open the AI view tab (the GEO lens). Show the 0 to 100 score with its band and what each range means, then the headings "People, companies and products it would pick up", "Facts it would state", "Missing or ambiguous", "3 fixes" and "How the score is built". | "Next, GEO lens..." | 2:05 to 2:30 |
| 7 | Side panel footer, then GitHub repo page | Scroll to "Go further" and hover the optional link "Verify these claims against public registers" (opens the MentionFox Source Check page in a new tab), then show the GitHub README and MIT license in the About box (the repo is public). End card: repo URL. | "Nothing here needs an account..." | 2:30 to 2:50 |

## Recording notes

- Show the on-device badge on a machine where the built-in model is already downloaded, so the demo does not wait on a download. First-run behaviour in the build: when the model is downloadable, Analyze starts the download from the click, shows a progress bar, and the cloud answers meanwhile [OWNER CONFIRMS: not seen on the build machine].
- Never show the Firebase config, App Check debug token or any key on screen.
- Add English captions. Keep the final export under 3:00.
- Do not claim speed, accuracy or privacy beyond what the build does: the privacy line is true only if the build sends the page text nowhere except the on-device model or, on fallback, Firebase AI Logic.

## OWNER CONFIRMS

1. The On-device (private) badge and its real latency in your Chrome 139+ with Gemini Nano (README, "What the owner must test"). Read the number off the screen; do not state one from this script.
2. First-run model download behaviour on your machine (progress bar, then badge).
3. How you force the Cloud badge for scene 5 (second profile or browser without the model).
4. Final voiceover word count after any label changes (this draft is about 390 words, spoken in about 2:45 at a calm pace).
5. If the on-device result on Wikipedia or Apple looks different from the cloud one, change the scene wording to what you see.
