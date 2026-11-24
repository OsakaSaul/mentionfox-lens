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

---

# Round 2 (task T2986, 2026-11-24): pages with SPECIFIC claims

Saul's feedback on 0.1.2: the WeWork mission page gives only "values that cannot be checked" amber cards. He wants pages that state specific things which later proved false. Method as in round 1 (Wayback `id_` raw bytes in `fixtures/demo/`, current main code, cloud path, `node scripts/live-probe.mjs --no-build --fixture <file>`, runs in `docs/demo/t2986-*`, three runs each).

## What Lens can and cannot say (read before recording)

Lens does NOT detect false claims. A specific claim (a number, a date, a named thing) comes out as a green "checkable" card; Lens does not check it. The contradiction comes from the public record, which the owner states aloud or shows in a second tab. Round 2 pages therefore show mostly GREEN specific cards, not amber. Say: "Lens finds the claims you can check. This one, we checked." Do not say Lens found the lie.

## Result

| Rank | Page | Archive URL (open this) | Claims | Specific (green) / vague (amber) | Verdict |
|---|---|---|---|---|---|
| 1 | Enron 2000 Annual Report, "Enron Broadband Services" (snapshot 7 May 2001) | https://web.archive.org/web/20010507225240/http://www4.enron.com:80/corp/investors/annuals/2000/broadband.html | 8, 4, 5 (3 runs) | 3 / 5, 3 / 1, 3 / 2 | TOP PICK for the story: network and "video on demand" claims later named in a DOJ indictment. |
| 2 | Enron 2000 Annual Report, "Enron Energy Services" (snapshot 7 May 2001) | https://web.archive.org/web/20010507230423/http://www4.enron.com:80/corp/investors/annuals/2000/energy.html | 8, 9, 8 (3 runs) | 4 / 4, 5 / 4, 4 / 4 | TOP 2 for the dollar figures ($103 million, $16 billion, $30 billion). |

Both pages are plain static HTML, about 2,000 characters of text, all in the first screen. Not browser-tested in Chromium for the toolbar (round 1 measured the same 67 px toolbar on other Enron snapshots). These two are from the same Enron annual report, so they are one company, not two. Honest note: the contradiction for rank 2 is weaker than for rank 1 (see below).

Specific claims on the pages (exact text, green in all runs):
Broadband:
1. "The build-out of Enron's 18,000-mile global fiber network is near completion, bandwidth intermediation transaction volume is growing exponentially, and we are testing the first commercially sound premium content-on-demand service."
2. "We currently operate 25 pooling points: 18 in the United States, and one each in Tokyo, London, Brussels, Amsterdam, Paris, Dusseldorf and Frankfurt."
3. "We expect to add at least 10 more in 2001."
Energy Services:
1. "Enron Energy Services recorded its first profitable quarter as expected at the end of 1999, and continued to grow rapidly through 2000, with increasing profits in all four quarters of 2000 and aggregate recurring income before interest and taxes (IBIT) of $103 million for the year."
2. "The value of our contracts in 2000 totaled more than $16 billion, increasing Enron Energy Services' cumulative contract value to more than $30 billion since late 1997."
3. "Retail energy earnings will be fueled by the rapid growth of our U.S. and European businesses and the strong execution and extension of existing contracts."

## Public record that contradicts them (state as "later reported / alleged / pleaded", never "fraud" unless a court found it)

| Claim | Public record | URL | Status (curl, 2026-11-24) |
|---|---|---|---|
| Broadband network and content-on-demand "testing" | DOJ, 26 Mar 2003: two Enron Broadband executives indicted for securities fraud, conspiracy and false statements about the division. Later: Kenneth Rice pleaded guilty to securities fraud; Joseph Hirko pleaded guilty (2008) to one count of wire fraud over statements about the technical viability of the division. | https://www.justice.gov/archive/opa/pr/2003/March/03_crm_191.htm ; sentencing: https://www.fbi.gov/houston/press-releases/2009/ho092809-1.htm | both 200 |
| Energy Services "increasing profits" | SEC complaints and releases allege Enron moved a large part of EES business into Enron North America in 2001 and hid EES losses (over $700 million in Q1 2001, over $300 million more in Q2) while saying EES performed profitably. These concern 2001, not the 2000 figure itself. The 2000 $103 million figure was not shown wrong by what I fetched. | https://www.sec.gov/litigation/litreleases/lr18435.htm ; https://www.sec.gov/litigation/complaints/comp18403.htm | 403 to curl, opens in a browser (same as the SEC page in round 1). Not independently opened by me. |

I did NOT find, and do not claim, a source saying the 2000 EES profit number was false. Use the Broadband page for the "later proved false" story; use the Energy page only for "specific dollar claims Lens marks checkable".

## Tried and dropped in round 2

- Luckin Coffee Q3 2019 results (PR Newswire and company pages): no Wayback snapshot found for the release URLs I tried.
- Wirecard press and investor pages: closest snapshots are 2010 and 2013, before any alleged cash problem; not used.
- Nikola home (Aug 2020): the fetch timed out (HTTP 000); not retried. Nikola pages from round 1 were already dropped.
- VW "Clean Diesel" (vw.com Jetta page, Aug 2015, saved as `fixtures/demo/vw-jetta-2015.html`): a product page with a 46 mpg line; the clean-diesel claim is a label, little to check. Saved, not probed.
- FTX US home (Oct 2022, `fixtures/demo/ftxus-home-oct2022.html`): about 5,000 characters, mostly marketing ("safe and easy way", "over 1 million users"); no custody/segregation statement. Saved, not probed.
- Wirecard 2013 investor page saved, not probed (wrong period).
- Theranos: round 1 candidates only; no new snapshot tried.
- Enron "Financial highlights" page: figures are images, no text.

## Verification

Archive URLs of the two picks returned 200 when fetched as raw bytes (`id_`) on 2026-11-24; the plain Archive URLs above are the same snapshots without `id_`. Run counts are from `docs/demo/t2986-*/result.json`.

---

# Round 3 (task T2991, 2026-11-24): Elizabeth Holmes, two pages (narrowed by the owner)

Check route used: POST https://api.foxapis.com/v1/lens/check (T2989), with the exact sentence as the extension would send it: live Fortune page with no snapshot date; the Business Insider page as its web.archive.org snapshot (2015-10-25). Runs: `docs/demo/t2991-A-run1..4` and `t2991-B-run1..4` (Lens extraction, 4 runs per page), `docs/demo/t2991-exact-verdicts.json` (verdicts). Saved pages: `fixtures/demo/holmes-fortune-2014-06-cover.html`, `fixtures/demo/holmes-bi-wsjd-2015-10.html`. Other candidate pages were skipped on the owner's instruction.

## Pages (every URL returned 200 on 2026-11-24 unless marked)

| | Page | Open this | Lens claims (4 runs) |
|---|---|---|---|
| A | Fortune cover story, 12 Jun 2014 | https://fortune.com/2014/06/12/theranos-blood-holmes/ (live, not paywalled) | 8 per run, 7 to 8 specific |
| B (backup) | Business Insider transcript of the WSJDLive interview, Oct 2015 | https://web.archive.org/web/20151025011830/http://www.businessinsider.com:80/theranos-ceo-elizabeth-holmes-wsjdlive-interview-2015-10 (live: https://www.businessinsider.com/theranos-ceo-elizabeth-holmes-wsjdlive-interview-2015-10) | 7 to 8 per run |

Contradiction record:
- Fortune's own follow-up, https://fortune.com/2015/12/17/how-theranos-misled-me-elizabeth-holmes/ : a former employee said that as of December 2014 only about 15 finger-stick tests ran on Theranos's own technology and the rest on conventional third-party analyzers such as Siemens; the author had reported "more than 200" in June 2014.
- For B: https://www.businessinsider.com/theranos-technology-is-only-used-for-one-test-2015-10 (Holmes told Bloomberg the technology was used for only one test, the FDA-cleared herpes test).
- The jury verdict: https://www.justice.gov/usao-ndca/pr/theranos-founder-elizabeth-holmes-found-guilty-investor-fraud . SEC press release of 2018: https://www.sec.gov/news/press-release/2018-41 (403 to curl, opens in a browser). Wall Street Journal links among the Check sources are paywalled (401 to curl).

## What Check said (exact sentences from the pages)

| # | Sentence (short) | Check verdict | Honest reading |
|---|---|---|---|
| A1 | "Theranos can run as many as 70 tests on a sample this size, obtained by pricking a finger." | Supported | The engine confirmed that Fortune reported it, using the Fortune article itself (a US v. Holmes trial exhibit) as the source. It did not test whether it was true. NOT red. |
| A2 | "It currently offers more than 200 ... of the most commonly ordered blood diagnostic tests" | No clear record | Grey. NOT red. |
| A3 | "The company has performed as many as 70 different tests from a single draw ..." | Supported | Its sources only confirm the "nanotainer" name. NOT red. |
| A4 | "Holmes will only say ... the same fundamental chemical methods ..." | Supported | The quote is accurately attributed. Evasive, but green. |
| A5 | "... her tests employ the same fundamental chemical methods ... peer-review publication ... unnecessary" | Supported | As A4. |
| B1 | "We have never used commercially available lab equipment for finger-stick based tests." | Contradicted (red) | Red, but the two sources shown (a Quest Diagnostics page on fingerstick accuracy and a C&EN article on fingertip blood tests) do not show Theranos using anyone's equipment, and the reason is one generic line. Do not show this card on camera: a viewer who clicks the sources finds nothing about Theranos. Stated as a plain third-person sentence ("Theranos has never used commercially available lab equipment for finger-stick based tests") the same engine returned Contradicted with Wall Street Journal sources (secretly bought outside lab gear; hid its use of third-party machines), so the first-person quote form is what weakens it. |
| B2 | "Right now, Theranos is only collecting finger-prick blood samples for its herpes test ..." | Contradicted (red) | This sentence is Holmes's own admission, accurately reported by Business Insider; the red comes from the engine reading "partly off" nuances. Misleading as a red card. |
| B3 | "We don't actually use the technology that's being referred to as Edison for anything ..." | Supported | Quote accurately attributed. |
| B4 | "Theranos has many proprietary devices that we develop and manufacture ourselves." | Supported | Quote accurately attributed. |

Counts: of 9 exact sentences, 2 Contradicted (B1 and B2, both unreliable as camera material), 6 Supported, 1 No clear record. Nothing on the Fortune page went red.

## Do the evasive lines come out amber?

Amber is Lens's own label (no checkable anchor), set at extraction, and amber cards have no Check button. In 4 extraction runs per page:
- "the same fundamental chemical methods" (A4, A5) was never extracted at all (no card).
- "Edison ... for anything" was amber in the one earlier run where it was extracted; if classed specific, Check says Supported.
- "many proprietary devices" was amber once in 4 runs.
- "never used commercially available lab equipment" and the herpes-only admission were not extracted in any of the 4 runs on B, although the text is inside the analysed window (the extractor returns about 8 claims and picks others).
- The "200 tests" and "70 tests" sentences appeared in 3 and 2 of 4 runs on A, as green cards.
So amber is possible but not dependable; a take needs Run again until the wanted card appears.

## Recommendation

Do not record the Holmes pages as the red scene. Check verifies the sentence as written and often answers "Supported" for an accurately reported quote. If a guaranteed red card is needed, the strongest real one found while testing is outside the two pages asked for: Theranos's own press release of 3 Jul 2015 (archive https://web.archive.org/web/20151023195450/https://www.theranos.com/news/posts/theranos-recognizes-milestone-in-new-era-of-preventive-health), sentence "Theranos offers a comprehensive menu of lab tests in convenient locations in its Walgreens Wellness Centers in Arizona and California ...": Contradicted twice (with the 2015-07-03 and the 2015-10-23 date), with Walgreens' own 2016 press release, NPR and the New York Times as sources (Walgreens ended the partnership and closed all 40 Arizona centers). Wording: the statement was true when written and later ceased to be; the card says "Contradicted", the narration says "later ended". Caveat: Lens extracted that sentence as a card in only 2 of about 8 runs.
