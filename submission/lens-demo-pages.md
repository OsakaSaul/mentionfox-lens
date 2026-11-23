# Lens demo pages: hype pages (task T2970, 2026-11-23)

Goal: pages where Lens shows a lot of amber. Method: Wayback Machine snapshots of company pages written before the company collapsed. Raw bytes saved in `fixtures/demo/` (see its README; one third-party public map token was replaced by REDACTED-MAPBOX-TOKEN in the WeWork file). Runs used the current main code (T2960 matcher and anchor rule, T2963 extraction) on the cloud path, `node scripts/live-probe.mjs --fixture <file>`; results in `docs/demo/t2970-*`. The model varies per run, so the counts below are ranges over all runs.

URL verification (curl -sIL, browser User-Agent, final status): 2026-11-23T05:50Z.

## Ranked table

| Rank | Company and page | Archive URL (open this) | Claims | Green / amber | Load (curl, first byte to end) | Render | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Enron, "Vision and values" (Jan 2001) | https://web.archive.org/web/20010124060900/http://www4.enron.com:80/corp/inside/vision/ | 8 in 4 of 6 runs (4 and 5 in the other two) | 2 / 6 in 4 of 6 runs; 2 / 2 and 2 / 3 in the low runs | 1.7 s (200); 9 s to full load in Chromium | Clean. Static 67 px Archive toolbar pushes the page down, covers nothing. All text in the first screen. No cookie wall. Two broken small images (cosmetic). | TOP PICK |
| 2 | WeWork, "Our Mission" (Apr 2019) | https://web.archive.org/web/20190411023244/https://www.wework.com/mission | 8 to 10 (4 runs) | 2 to 3 / 5 to 8 (5, 8, 6, 8 amber) | 3.1 s (200); 29.5 s to full load in Chromium on first open | Clean. Full-width photo hero under the toolbar; the Our Values text starts about 2,000 px down (scroll or let Lens jump). No wall. | TOP 2. Open the tab a minute before recording (slow first load). |
| 3 | Enron, "Inside Enron" (Jan 2001) | https://web.archive.org/web/20010111075200/http://www4.enron.com:80/corp/inside/index.html | 6 to 9 (4 runs) | 2 to 3 / 3 to 7 | 1.8 s (200) | Clean, plain old HTML, text at y 320. | Backup for #1 (same values text plus a site menu). |
| 4 | Celsius Network, "About" (Apr 2021) | https://web.archive.org/web/20210410195712/https://celsius.network/about/ | 8 | 5 to 6 / 2 to 3 | 2.2 s (200); 13.8 s in Chromium | A cookie banner element is present. Text below the fold (y about 2,900). | Weak. Marketing copy has many numbers. |
| 5 | Terra, home (Jan 2022) | https://web.archive.org/web/20220104181236/https://www.terra.money/ | 8 to 9 (3 runs) | 6 to 7 / 1 to 3 | 2.2 s (200) | Page text at y about 4,800 (long). | Weak. The page is mostly green. |
| 6 | Lordstown Motors, home (Feb 2020) | https://web.archive.org/web/20200218042055/https://lordstownmotors.com/ | 7 | 5 / 2 | 2.2 s (200) | Not browser-tested. | Weak. |
| 7 | Fyre Festival, FAQ (Jan 2017) | https://web.archive.org/web/20170108052742/http://www.fyrefestival.com:80/faq/ | 8 to 9 (2 runs) | 6 to 7 / 2 | 1.8 s (200) | Not browser-tested. | Weak. |
| 8 | Fyre Festival, home (Dec 2016) | https://web.archive.org/web/20161214192720/http://fyrefestival.com:80/ | 8 (2 runs) | 6 / 2 | 19.9 s (200, slow) | Not browser-tested. | Weak and slow. |
| 9 | Theranos, press release of 2 Jul 2015 (T2958 pick) | https://web.archive.org/web/20151218013228/https://www.theranos.com/news/posts/theranos-receives-fda-clearance-and-review-and-validation-of-revolutionary-finger-stick-technology-test-and-associated-test-system | 7 to 8 | 6 to 7 / 1 to 2 | 1.3 s (200) | As in T2958 notes. | Keep as candidate only; little amber. |

Tried and dropped (no usable text or all green): FTX home and FTX US home (JavaScript shell), Juicero 2016 (shell), Nikola home (about 700 characters of text), Nikola Hydrogen (8 of 8 green), Nikola About (1 claim), Celsius home and Why Trust Celsius (10 of 10 green), WeWork home 2019 (1 claim), Terra about (URL check returned no response at verification time, dropped), Theranos leadership page (10 of 10 green), SVB and Lehman (not hype pages). The WeWork S-1 letter was not used (it is long, names the founder, and the owner asked to avoid it).

Why Enron and WeWork win: both pages are values and mission statements. They contain almost no number, date or named thing, which is exactly what the Lens rule (an anchor is a date, number, amount, place, organisation, person or event) calls vague. Product pages and press releases carry numbers, so they come out green.

## The best 3 amber lines (exact text from the page)

Enron, Vision and values (appearing in the amber list in 6 of 6, 5 of 6 and 4 of 6 runs):
1. "That's why we employ the best and the brightest people."
2. "Together we're creating the leading energy company in the world."
3. "We believe in the inherent wisdom of open markets."

WeWork, Our Mission (all four runs):
1. "We never settle."
2. "We do what we love and are connected to something greater than ourselves."
3. "We are grateful for each other, our members, and to be part of this movement."
(Also amber in all four runs: "We are creators, leaders, and self-starters." Do NOT click the amber line "We get shit done and we get it done well." on camera: profanity.)

## Exact path for the top 2 (owner, in Chrome with the unpacked Lens loaded)

Page 1, Enron: paste the Enron URL, wait until the page shows "our values" in red (about 10 seconds), do not scroll. Click the Lens toolbar icon, click "Open Lens side panel", click "Analyze this page". Wait for the status line "Done in N seconds on ...". Point at the mode bar, then at the amber cards (about 6 of 8). Click the amber card "That's why we employ the best and the brightest people." (always present; the page scrolls to it in the right column under "innovation"), then the amber card "Together we're creating the leading energy company in the world." (at the bottom, under "together"; if it is not in your result, use "We believe in the inherent wisdom of open markets."). If a take returns only 4 or 5 claims, click Run again (the model varies).

Page 2, WeWork: paste the WeWork URL 1 minute before you need it and leave the tab open (first load took 29 seconds in our test). Click the tab, click the Lens icon, Analyze this page, wait for "Done". Click the amber card "We never settle." (page jumps down to the Our Values list), then "We do what we love and are connected to something greater than ourselves."

## Does the Wayback toolbar cover the content?

No. Measured in a real Chromium with a normal desktop User-Agent (`scripts/demo-render-check.mjs`, screenshots `docs/demo/t2970-archive-*.png`): the toolbar is 67 px high and in the page flow, so it pushes the page down and covers no text. The probe text was not covered on any page. On Enron the toolbar sits over the page's own red header strip (cosmetic). The Archive toolbar has a close button (X) at the top right if you want it gone. No robot or consent wall appeared on these pages; the Celsius page contains a cookie banner element.

## Editorial safety (what you may say)

Lens only labels claims "checkable" or "vague". On camera say what Lens does. At most say "both companies later collapsed", which is public record (sources below). Do not say fraud, scam, criminal or anything about a person. Do not read the irony of the page ("Integrity", "We are always honest") out loud, and do not click the Enron "integrity" or "respect" cards.

| Company | Collapse fact (public record) | Source |
|---|---|---|
| Enron | Filed for Chapter 11 bankruptcy on 2 Dec 2001 | https://en.wikipedia.org/wiki/Enron (primary: SEC page https://www.sec.gov/spotlight/enron.htm: opens in a browser, returns 403 to curl) |
| WeWork | Filed for Chapter 11 bankruptcy on 6 Nov 2023 | https://www.cnbc.com/2023/11/07/wework-files-for-bankruptcy.html |
| Celsius | Chapter 11 filing July 2022 (court claims site) | https://restructuring.ra.kroll.com/celsius/ |
| Terra (Terraform Labs) | Chapter 11 filing Jan 2024 (court claims site) | https://restructuring.ra.kroll.com/terraform/ |
| Fyre Festival | Festival cancelled in April 2017; US Attorney press release | https://www.justice.gov/usao-sdny/pr/founder-and-ceo-fyre-media-sentenced |
| Theranos | Ceased operations 2018; SEC and DOJ actions | https://www.justice.gov/usao-sdny/pr/theranos-founder-elizabeth-holmes-sentenced |
| FTX | Chapter 11 filing Nov 2022 (court claims site) | https://restructuring.ra.kroll.com/FTX/ |

Legally sensitive content on the pages themselves:
- Enron Vision and values: no person named. It makes statements about integrity, honesty and respect. Not read aloud; not clicked.
- WeWork Our Mission: a photo caption names the founders (not in the claims). The text includes the phrases "honest" and "transparent" and one profane line. Avoid those cards.
- Celsius About: names the CEO and calls banks "greedy". Not used.
- Terra: names a community, no person in the amber lines. Not used.
- Fyre: names no person in the text we use, but the Fyre story involves criminal convictions of an individual: not used as a top pick.
- Theranos: names the CEO in the press release; the page is the regulatory-clearance claim. Avoid.
- Juicero and WeWork were not called frauds anywhere in the script.

## Facts about the runs

- Cloud path only (Gemini Nano was unavailable on the build machine). Claims 4 to 10 per page, 3.3 to 4.5 seconds per claims call.
- Variation: Enron Vision and values returned 8 claims four times (6 amber each) and 4 and 5 claims twice (2 and 3 amber). WeWork Our Mission always had at least 5 amber. If a take is thin, press Run again.
- Patrick Collison, Wikipedia (live, 2026-11-23): 8 claims, 8 green, 0 amber, 8 of 8 found on the page.
