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
