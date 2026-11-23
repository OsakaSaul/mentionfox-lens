# Real-page runs (2026-11-23)

Four real public pages (saved in `fixtures/real/`, URLs and fetch date in `fixtures/real/README.md`) were analysed through the REAL Firebase AI Logic cloud path (cloud model `gemini-3.5-flash-lite`, `PREFER_ON_DEVICE` mode). On-device Gemini Nano was NOT run: Chromium 151 here reports `LanguageModel.availability() = unavailable`, so every answer below came from the cloud and the mode said "Cloud" (the badge was later replaced by the large mode bar, e.g. "Cloud · 3.1 s", plus a status line "Done in 5.7 s on Cloud: ..."). Nothing here says anything about on-device quality.

Run each page with: `node scripts/live-probe.mjs --fixture fixtures/real/<page>.html` (writes `docs/real-runs/<page>/`: `result.json` with the raw model text and normalised output, `panel-claims.png`, `page-highlights.png`, `panel-geo.png`, `run-log.txt`). The App Check token is read from `.env.local` and redacted from every output.

## Final results (after tuning)

| Page | Claims | Highlighted | Not on page / hallucinated | Weak or mislabelled | Latency claims / GEO | Notes |
|---|---|---|---|---|---|---|
| Founder bio (paulgraham.com/bio.html, 1,017 chars) | 7 | 7 | 0 | 0 | 3.5 s / 2.8 s | All seven are real sentences. Missed: the books line (On Lisp, ANSI Common Lisp, Hackers & Painters) and "programmer, writer, and investor". "the first software as a service company" is labelled specific; it is a checkable (and arguable) claim, so acceptable. |
| Press release (Spotify Q4 2024 newsroom post, 1,560 chars) | 9 | 9 | 0 | 1 | 3.5 s / 2.5 s | Five metric sentences (green) and four vague statements (CEO quote, "stronger than ever"). One mixed claim, "closing Q4 stronger than ever ... first full year of profitability", is labelled vague although the second half is checkable. Page text itself reads "EUR 4.2billion" (no space) and the claim quotes it that way. |
| Company homepage (basecamp.com, 5,940 chars) | 12 | 12 | 0 | 5 | 4.1 s / 2.8 s | Good: release year, "nearly a million" users, 99.99% uptime, plus puffery ("easiest-to-use", "famously affordable") and testimonials. Weak: four bare stat fragments ("84 million accounts", "5 petabytes of data", "233 countries", "52,000 cities") are real page text but not sentences. "industry-leading 99.99% uptime" is labelled specific (mixed). Missed: "we own and run our hardware", "over 1,000 customer testimonials". |
| News article (BBC, Molly Meldrum obituary, 3,199 chars) | 8 | 8 | 0 | 0 | 3.1 s / 2.8 s | Five dated factual claims (age, 2011 injury, 1943 birth, 2014 ARIA Hall of Fame, 1977 interview) and three vague (family tribute, Elton John's opinion, "legacies"). The related-story headline that polluted the first run is gone. |

Highlight success: 36 of 36 claims were found and wrapped in place (the matcher tolerates whitespace, case, curly quotes and dashes). Zero claims were absent from the page text; I never saw a hallucinated quote in any run.

Extra, not saved as fixtures (checked only for the demo script): Wikipedia "Patrick Collison" (21,765 chars of main text, so the 12,000 char budget applies): 9 claims, 9 highlighted, all labelled specific, zero vague. Apple iPhone 15 Pro press release (49,350 chars): 10 claims, 10 highlighted, 1 vague (the "most pro lineup ... best iPhone camera system yet" sentence), 9 specific. Claims on long pages come from the first ~70% of the 12,000 chars plus a tail slice (see below), not the whole page.

### GEO lens verdict

| Page | Entities | Facts | Gaps ("missing") | Fixes | Score explanation |
|---|---|---|---|---|---|
| Founder bio | Correct (people, Viaweb, Yahoo, Y Combinator, Bel). | All six true to the page. | Plausible (birth date, current role). | Concrete (each names an exact sentence) but 2 of 3 ask for details that do not fit a bio ("valuation of the funded startups"). | Explanation reads sensibly; score 80. |
| Press release | Correct, includes Daniel Ek. | All true. | Real gaps (net income, full-year totals). | Concrete and mostly useful: "add net income to support the first full year of profitability" is a good one. | Sensible; score 84. |
| Homepage | Correct, includes customers named in testimonials (company type is loose for a church or a person's employer). | True. | Real: the page has "Pricing & trial" only as a menu item, no price; no headquarters. | Concrete wording ("In the section Pricing & trial, add the monthly price") but the third, "add the city where Basecamp is headquartered to the 'Take a 3-minute tour' sentence", is arbitrary. | Sensible; score 88. |
| News article | Correct. | True. | Real (exact date of death, hospital). | Concrete; fix 3 (years active as a broadcaster) is trivia. | Sensible; score 78. |

Overall GEO: entities, facts and gaps are reliable on these pages; fixes are concrete after tuning but about one in three is low-value.

The four scores are 80, 84, 88 and 78, all in the "Strong" band: the score does not discriminate much between these (already well-written) pages. That is a weakness, see below.

## What was tuned (and why)

First run (original prompt) problems, all on real pages:
- Spotify: the page's own headline and a "Up Next" related-story headline ("On Our $10 Billion Milestone") returned as claims; the byline "Daniel Ek, Spotify Founder & CEO" as a claim; the "first full year of profitability" and "stronger than ever" statements missed.
- Basecamp: contact line ("Jason Fried, jason@basecamp.com"), a bare job title ("Co-founder & CEO") and two testimonial attributions returned as claims.
- BBC: a related-story headline ("Miley Cyrus marries ...") returned as a claim.
- Founder bio: the 2001 essays and 25 million page views and the RISD line missed.
- GEO fixes were generic ("add a clear heading structure", "state the full date of birth"), one nonsensical ("clarify the year of his birth if there is any discrepancy").

Changes (`src/shared/prompts.js`):
1. Claims prompt: work on the main content; skip navigation, bylines, dates, contact details, testimonial attributions, and headlines/summaries of other or related stories; the page's own headline is not a claim; quote must be one complete sentence or clause with subject plus the number/date/name, never a bare name, title or number; 8 to 12 claims spread over the page; include pull quotes and puffery ("stronger than ever").
2. GEO prompt: use only the page's own content; entities at most 10; "missing" must be re-checked against the text; each fix must name the exact sentence or section of this page and say what to add or change, resolve one missing item or turn one vague statement checkable, and never invent figures, never call a number on the page wrong, and do no age or date arithmetic (one run had told the author their birth year was inconsistent).
3. New `preparePageText()`: long pages (over 12,000 chars) first lose short menu-like lines (under 25 chars, no digit or sentence punctuation), then keep the first 70% and last 30% of the budget with a `[...]` gap marker, instead of a blind cut at 12,000. Unit tested.
4. Dev-build only: `runTask` now returns the raw model text, the side panel exposes the last run as `window.__lensLast` (dev builds only, guarded by `__DEV_BUILD__`) so the probe can save raw output.
5. No change to the highlight matcher was needed: 36 of 36 quotes matched. A regression test (`test/real-runs.test.js`) re-matches every saved real-run claim against the saved real page.

Tuning iterations: four prompt versions were run on all four pages (initial; rules above; plus min 8 claims and a "prefer edits" clause for fixes, which made fixes worse (asked for purchase prices); final with the "resolve a missing item, never invent" clause).

## Residual weaknesses (honest)

- GEO scores clustered at 78 to 88 on four good pages. The 0 to 4 ratings from the model rarely go low (entity clarity and fact density were 4 almost every time), so the score is a coarse signal; it has not been tried on a poor page.
- Bare stat blocks on homepages come back as fragments ("233 countries"); they are real text but not sentences.
- A sentence with both a number and puffery ("industry-leading 99.99% uptime") gets one label; the model is inconsistent on mixed claims.
- GEO fixes name a real sentence but about one in three asks for trivia or a detail that does not belong on that kind of page. The model also types customers' employers as "company" when they are churches or schools.
- Coverage on long pages comes from the first 70% of the budget plus a tail slice; the middle of a very long page is not read. Wikipedia and Apple press release pages were cut this way.
- Only one cloud model was tested. Gemini Nano on-device (smaller context, weaker instruction following) has NOT been run; expect lower quality and more JSON retries there. The code retries once in the cloud when an on-device answer cannot be parsed.
- Label correctness ("specific" vs "vague") is my judgement from reading the pages, not an independent benchmark. Four pages is a small sample.
- Pages were served locally with scripts removed and a `<base href>` for CSS; real sites with client-side hydration may differ (not tested on live sites).

## T2960: verbatim quotes, tiered matching, anchor rule (2026-11-23)

Owner saw on en.wikipedia.org/wiki/Sam_Bankman-Fried (T2959 build): cards "Not found on the page" for sentences that were visibly on the page, and "Vague or puffery" with a cut-off reason ("The adjectives") on a claim with a date and a place.

Causes: (1) the model returned the quote with the footnote markers [1][15][16] and rewrote "Samuel Benjamin" as "Sam", or paraphrased the sentence; match.js findQuote only had exact, no-space and head/tail tiers, so both failed. (2) The prompt let one adjective ("upper-class") decide the label and nothing checked it in code; reasons were cut with slice() or arrived cut off from the model.

Fixes: the claims prompt now asks for an exact verbatim span (no name expansion or shortening, no markers), an optional separate summary, and defines specific as "has at least one checkable anchor"; the page text sent to the model has footnote markers removed; findQuote has five tiers (exact, no-space, head/tail, a run of 8 or more identical words, 80% of the words in one sentence-sized window) and returns the tier; highlight and jump both go through that one function; footnote links are never wrapped; anchors.js overrides a "vague" label on a claim with a date, number, amount or named place and adds "contains a subjective word: ..."; reasons are asked for as one complete sentence of at most 20 words and a cut-off reason is replaced, and any code-side cut is at a word boundary with an ellipsis.

Real cloud runs, new prompt (scripts/live-probe.mjs on saved pages, results in docs/real-runs/t2960-*):

| Page | Claims | Found on page | Tier | Vague | Vague claims and verdict |
|---|---|---|---|---|---|
| Sam Bankman-Fried (Wikipedia) | 8 | 8 (100%) | 8 exact | 0 | none |
| Patrick Collison (Wikipedia) | 8 | 8 (100%) | 8 exact | 0 | none |
| Theranos FDA press release (Archive copy), run 1 | 8 | 8 (100%) | 8 exact | 1 | "Theranos is deeply committed to transparency in the laboratory testing space." Reason: relies on subjective claims of deep commitment without checkable anchors. Right. |
| Theranos runs 2 and 3 | 8 and 8 | 8 and 8 | exact | 2 and 2 | the same sentence, plus "By doing so, Theranos is working to facilitate the early detection and prevention of disease, and to empower people to live their best lives": aspirational, nothing checkable. Right. |

The cloud model now copies verbatim, so the fuzzy tiers are exercised by unit tests (the exact two owner sentences against the saved Bankman-Fried page both match, in tier "run": a name was expanded, a sentence was reworded) rather than by these runs. They matter most for on-device Gemini Nano, which has not been run (not available on the build machine). The anchor override did not fire on these runs (the model labelled correctly); it is covered by tests. Known side effect: a vague sentence that names an organisation (the Theranos "FDA's decision provides independent validation ... ground breaking" sentence) now counts as checkable, which is the rule as specified, and is why that sentence is no longer an amber card.
