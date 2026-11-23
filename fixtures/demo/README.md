# Demo candidate pages (fetched 2026-11-23)

Saved for the demo-video page search (task T2958). Every page loads in a normal browser through the Internet Archive (HTTP 200 with a browser User-Agent, real body text). Lens runs on these through `node scripts/live-probe.mjs --fixture fixtures/demo/<file>` (scripts removed, no base URL, so CSS and images are missing; text and highlights behave as on the live page). Runs are in `docs/demo/<name>/`; runs against the real Archive URL (what the owner will open) are in `docs/demo/url-*`.

| File | Original page | Archive URL (open this in Chrome) | How saved |
|---|---|---|---|
| theranos-1.html | Press release, 2 Jul 2015: FDA clearance | https://web.archive.org/web/20151218013228/https://www.theranos.com/news/posts/theranos-receives-fda-clearance-and-review-and-validation-of-revolutionary-finger-stick-technology-test-and-associated-test-system | Rendered DOM (the 2015 site is a JavaScript app: the raw `id_` bytes are an empty shell). Archive toolbar, scripts and inline handlers removed. |
| theranos-2.html | Press release, 16 Jul 2015: CLIA waiver | https://web.archive.org/web/20151218013226/https://www.theranos.com/news/posts/theranos-receives-clia-waiver-paving-the-way-for-greater-accessibility-of-health-information-at-the-time-and-place-it-matters | Rendered DOM, same cleanup |
| theranos-3.html | Press release, 3 Jul 2015: milestone / Arizona | https://web.archive.org/web/20151023195450/https://www.theranos.com/news/posts/theranos-recognizes-milestone-in-new-era-of-preventive-health | Rendered DOM, same cleanup |
| theranos-4.html | Leadership page (CEO and board bios), Dec 2015 | https://web.archive.org/web/20151218012710/https://www.theranos.com/leadership | Rendered DOM, same cleanup |
| ftx-1.html | FTX Research blog "End of Year 2021" | https://web.archive.org/web/20220521212506/https://blog.ftx.com/blog/end-of-year-2021/ | Raw `id_` bytes, unmodified |
| ftx-2.html | FTX Research blog "FTX in 2021H1 review" | https://web.archive.org/web/20220521211157/https://blog.ftx.com/blog/mid_year_review_2021/ | Raw `id_` bytes, unmodified |
| ftx-3.html | FTX blog "Raising the bar" (2020) | https://web.archive.org/web/20220604230352/https://blog.ftx.com/blog/raising-the-bar/ | Raw `id_` bytes. Not a usable demo page: Lens returned 0 and 1 claims in two runs. |
| ftx-4.html | FTX blog "One Year Later" | https://web.archive.org/web/20220625140921/https://blog.ftx.com/blog/one-year-later/ | Raw `id_` bytes, unmodified |

All files are under 400 KB, so nothing was stripped except as noted. The pages are third-party content kept only as test inputs.

## T2970 additions (fetched 2026-11-23, hype-page search)

All are the raw original bytes from `https://web.archive.org/web/<timestamp>id_/<original URL>` (nothing stripped; every file is under 400 KB; the probe removes scripts when it serves them). Text was in the raw HTML for all of them (no JavaScript app shells). The Archive URL to open in Chrome is the same address without `id_`. Runs: `docs/demo/t2970-<name>*`.

| File | Original page | Snapshot |
|---|---|---|
| enron-vision-values.html | Enron "Vision and values" (www4.enron.com/corp/inside/vision/) | 20010124060900 |
| enron-inside.html | Enron "Inside Enron" (www4.enron.com/corp/inside/index.html) | 20010111075200 |
| enron-our-businesses.html | Enron "Our businesses" (www4.enron.com/corp/inside/profile.html) | 19991128191958 |
| wework-mission-2019.html | WeWork "Our Mission" (wework.com/mission) (a third-party public map token in a script tag was replaced by REDACTED-MAPBOX-TOKEN before commit) | 20190411023244 |
| (WeWork home 2019 not kept: 1 claim) | | |
| celsius-about.html | Celsius Network "About" | 20210410195712 |
| celsius-why-trust.html | Celsius "Why Trust Celsius" (10 of 10 green, not usable) | 20210410193914 |
| celsius-home.html | Celsius home (10 of 10 green, not usable) | 20211230214643 |
| terra-home.html | Terra home (www.terra.money) | 20220104181236 |
| terra-about.html | Terra about | 20211023014849 |
| fyre-home.html, fyre-home-apr2017.html | Fyre Festival home (Dec 2016 and Apr 2017 versions) | 20161214192720, 20170411000000 |
| fyre-faq.html | Fyre Festival FAQ | 20170108052742 |
| nikola-hydrogen.html, nikola-about.html | Nikola "Hydrogen" and "About" | 20191119021847, 20191119034220 |
| lordstown-home-2020.html | Lordstown Motors home | 20200218042055 |

Pages that are JavaScript shells in the raw bytes (FTX home, FTX US, Juicero 2016, Theranos 2014 and 2015 technology pages, Fyre 2024) were not usable.
