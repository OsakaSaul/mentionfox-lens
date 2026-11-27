import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { extractMainBlocks } from "../src/shared/extract.js";
import { pickArticleRoot, coherenceGuard, cleanArticle } from "../src/shared/article-root.js";

const dom = (html, url = "https://news.example.com/2014/06/12/story") => new JSDOM(html, { url }).window.document;
const extract = (html, opts) => extractMainBlocks(dom(html), opts);
const text = (r) => r.blocks.join("\n");
const fixture = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

const P1 = "In the fall of 2003 a nineteen-year-old sophomore at Stanford walked into a professor's office and said, \"Let's start a company\", and the professor agreed to help her.";
const P2 = "The company, called Theranos, says its devices can run as many as 70 tests on a drop of blood, which would be a large change for the laboratory industry and for patients alike.";
const P3 = "Investors have put more than $400 million into the business, valuing it at several billion dollars, and its board includes former secretaries of state and senior defense officials.";
const P4 = "Precisely how the company does this is described only in general terms, and the founder declined to give further details of the method when asked during several interviews.";
const P5 = "Former employees later described a very different picture of the laboratory, and regulators asked the company for records that it had not yet handed over to them.";
const P6 = "The company's lawyers said the reporting was inaccurate, and the founder repeated on television that the technology worked as described in every one of its public statements.";
const ARTICLE = `<article class="article-content"><p>${P1}</p><p>${P2}</p><p>${P3}</p><p>${P4}</p><p>${P5}</p><p>${P6}</p></article>`;

const TICKER = `<div class="ticker-bar" role="marquee"><span>Treasury Secretary Scott Bessent says if Nvidia was a bank, 'a lot of the executives would be removed' while Huang reportedly eyes return</span></div>`;
const PROMO = `<div class="event-promo"><p>Join Fortune 500 leaders, startup founders, and policymakers shaping the future of business at the Fortune 500 Innovation Forum.</p><a href="/forum">Register now</a></div>`;
const ADDUS = `<div class="flex p-4"><div>Add Fortune on Google for similar content.</div></div>`;
const RELATED = `<ul class="related-stories"><li><a href="/a">Elon Musk spends about an hour a week on his foundation and gives most of it away</a></li><li><a href="/b">This cattleman's farm brings in thirty million dollars a year</a></li><li><a href="/c">Jeff Bezos donated nearly two hundred million dollars in stock in two days</a></li></ul>`;
const HEADLINES = `<div class="top-stories"><a href="/1">Markets slide as the dollar strengthens against a basket of currencies</a><a href="/2">Oil prices climb after a surprise cut from major producers</a><a href="/3">Tech earnings week begins with a cautious outlook for ad sales</a></div>`;
const ADS = `<ins class="adsbygoogle" style="display:block"><span>Advertisement: buy our cars today at the lowest price ever</span></ins><div id="ad-slot-1" class="sponsor-box"><span>Sponsored: ten things your bank does not want you to know</span></div>`;
const CREDIT = `<figure><img alt=""><figcaption class="photo-credit">Photographer: Jane Roe for the magazine</figcaption></figure>`;
const SHARE = `<div class="share-bar"><span>Share this article on social media and follow us</span></div>`;
const COOKIE = `<div id="cookie-banner"><p>We use cookies to improve your experience on our site and for advertising purposes.</p></div>`;
const NEWSLETTER = `<div class="newsletter-signup"><p>Sign up for our daily newsletter and get the best stories delivered to your inbox every morning.</p></div>`;
const WAYBACK = `<div id="wm-ipp-base"><div id="wm-ipp"><a href="/">The Wayback Machine</a> Donate Capture 12 JUN 2014 Collected by the Internet Archive</div></div>`;

const page = (inner, head = "") => `<!doctype html><html><head><title>This CEO is out for blood | Fortune</title>${head}</head><body>${inner}</body></html>`;

test("article body only: the story is kept, every kind of furniture is dropped (decoy H1s, ticker, promo, ads, related and headline lists, credits, share, cookie, newsletter, Wayback toolbar)", () => {
  const html = page(`${WAYBACK}${COOKIE}<header><h1>Fortune</h1></header>
    <div class="trending-top-bar"><h1>Trending now</h1><h1>1</h1>${TICKER}</div>
    <main>${TICKER}${HEADLINES}${PROMO}
      <div class="article-page-wrapper"><div class="title-wrap"><h1>This CEO is out for blood</h1><p class="dek">Elizabeth Holmes founded a blood diagnostics company when she was 19.</p></div>
      ${CREDIT}${SHARE}${ARTICLE.replace("</article>", ADS + RELATED + ADDUS + NEWSLETTER + "</article>")}</div>
      ${RELATED}</main><footer>Copyright 2014 Example Media. All rights reserved.</footer>`);
  const r = extract(html);
  const t = text(r);
  assert.equal(r.rootKind, "article-after-h1", "the <article> that follows the real H1 (the H1 is not inside it)");
  for (const keep of ["fall of 2003", "as many as 70 tests", "$400 million", "declined to give further details"]) assert.ok(t.includes(keep), "kept: " + keep);
  for (const gone of ["Bessent", "Nvidia", "Fortune 500", "Innovation Forum", "Add Fortune on Google", "Elon Musk", "cattleman", "Markets slide", "Advertisement", "Sponsored", "Photographer", "Share this article", "cookies", "newsletter", "Wayback", "Internet Archive", "Trending", "Copyright"]) assert.ok(!t.includes(gone), "dropped: " + gone);
});

test("root order: itemprop articleBody first", () => {
  const html = page(`<main>${TICKER}<h1>This CEO is out for blood</h1><article><p>${P1}</p></article><div itemprop="articleBody"><p>${P1}</p><p>${P2}</p><p>${P3}</p><p>${P4}</p></div></main>`);
  const r = extract(html);
  assert.equal(r.rootKind, "articleBody");
  assert.ok(text(r).includes("as many as 70 tests") && !text(r).includes("Bessent"));
});

test("root order: the <article> that CONTAINS the H1 comes before any other", () => {
  const html = page(`<main>${TICKER}<article><h1>This CEO is out for blood</h1><p>${P1}</p><p>${P2}</p><p>${P3}</p><p>${P4}</p></article><article><h1>Other story</h1><p>${P1.replace("2003", "1999")}</p></article></main>`);
  const r = extract(html);
  assert.equal(r.rootKind, "article-h1");
  assert.ok(text(r).includes("fall of 2003") && !text(r).includes("1999"));
});

test("root order: JSON-LD only LOCATES the visible body (no <article> tag); its own text is never analysed", () => {
  const ld = `<script type="application/ld+json">${JSON.stringify({ "@type": "NewsArticle", headline: "This CEO is out for blood", description: P1.slice(0, 120), articleBody: "SECRET PAYWALLED BODY THAT IS NOT VISIBLE ON THE PAGE AND MUST NEVER BE ANALYSED" })}</script>`;
  const filler = Array.from({ length: 6 }, (_, i) => `<p>${P2.replace("70", String(70 + i))}</p>`).join("");
  const html = page(`<div class="wrap"><div class="ticker">${TICKER}</div><div class="story"><p>${P1}</p>${filler}<p>${P3}</p></div><div class="other"><p>${P4}</p></div></div>`, ld);
  const r = extract(html);
  assert.ok(["jsonld", "dense", "legacy"].includes(r.rootKind));
  assert.ok(!text(r).includes("SECRET PAYWALLED BODY"), "JSON-LD text is never analysed");
  assert.ok(text(r).includes("fall of 2003") && !text(r).includes("Bessent"));
});

test("text that is not rendered is dropped (display:none, hidden), but a collapsed FAQ answer is kept", () => {
  const html = page(`<style>.paywalled{display:none}.faq-answer{display:none}</style><main><h1>This CEO is out for blood</h1><article><p>${P1}</p><p>${P2}</p><p class="paywalled">HIDDEN PAYWALL TEASER NOBODY CAN SEE ON THE PAGE AT ALL AND THIS LINE IS LONG ENOUGH TO KEEP</p><div hidden><p>ANOTHER HIDDEN PARAGRAPH THAT IS LONG ENOUGH TO BE KEPT AS A BLOCK OF TEXT IF IT WERE VISIBLE</p></div><p>${P3}</p><p>${P4}</p><p>${P5}</p><p>${P6}</p><details><summary>What is it</summary><p class="faq-answer">The collapsed answer to a question that a reader can open with one click, which is page content.</p></details></article></main>`);
  const t = text(extract(html));
  assert.ok(!t.includes("HIDDEN PAYWALL") && !t.includes("ANOTHER HIDDEN"), "not rendered: dropped");
  assert.ok(t.includes("collapsed answer"), "an accordion answer is one click away: kept");
});

test("a duplicated scrolling strip is dropped", () => {
  const strip = `<div class="strip">${Array.from({ length: 2 }, () => `<span>Oil prices climb after a surprise cut from major producers today</span><span>Markets slide as the dollar strengthens against other currencies</span>`).join("")}</div>`;
  const t = text(extract(page(`<main><h1>This CEO is out for blood</h1>${strip}${ARTICLE}</main>`)));
  assert.ok(!t.includes("Oil prices") && !t.includes("Markets slide") && t.includes("as many as 70 tests"));
});

test("the Wayback toolbar is dropped even when the page has no article root (legacy path)", () => {
  const html = page(`${WAYBACK}<div><p>${P1}</p><p>${P2}</p></div>`);
  const t = text(extract(html));
  assert.ok(!t.includes("Wayback") && !t.includes("Donate") && t.includes("fall of 2003"));
});

test("a company page is NOT treated as a news page: a small block among many is not 'the article'", () => {
  const faq = Array.from({ length: 12 }, (_, i) => `<h3>Question ${i + 1} about the festival and what is included?</h3><p>Answer ${i + 1}: details about the festival, the flights, the housing and the payment plan, written out in a full sentence.</p>`).join("");
  const html = page(`<div><h1>FAQ</h1>${faq}<div><p>${P1}</p><p>${P2}</p><p>${P3}</p></div></div>`, '<meta property="og:type" content="website">');
  const r = extract(html);
  assert.equal(r.rootKind, "legacy");
  assert.ok(text(r).includes("Answer 12"), "the whole FAQ stays");
});

test("fixture: a live news page with furniture inside <main> gives the article only", () => {
  const r = extractMainBlocks(dom(fixture("test/fixtures/made-up/harbor-live.html"), "https://harborweekly.example/2014/06/12/veridrop/"));
  const t = text(r);
  assert.equal(r.rootTag, "ARTICLE");
  for (const gone of ["Vexley", "Orbitron", "Harbor 500 Innovation Forum", "Join Harbor 500 leaders", "Add Harbor on Google", "Lorcan Dusk spends"]) assert.ok(!t.includes(gone), "dropped: " + gone);
  assert.ok(t.includes("In the spring of 2008 Dana Marlowe") && t.includes("as many as 70 tests") && t.includes("trade secret"));
  assert.ok(r.chars > 4000 && r.chars < 5000, "article length " + r.chars);
});

test("fixture: an archived copy of a news page, with the archive's toolbar, gives the article only", () => {
  const r = extractMainBlocks(dom(fixture("test/fixtures/made-up/harbor-archived.html"), "https://web.archive.org/web/20140612000000/http://harborweekly.example/2014/06/12/veridrop/"));
  const t = text(r);
  assert.ok(t.startsWith("June 12, 2014") && t.includes("In the spring of 2008") && t.includes("as many as 70 tests"));
  for (const gone of ["Wayback", "Internet Archive", "Donate", "Vexley", "Innovation Forum"]) assert.ok(!t.includes(gone), "dropped: " + gone);
});

test("no regression: a table-and-font page, a mission page, an encyclopedia article, a long FAQ and a press release extract exactly these blocks", () => {
  const n = (p, url) => { const r = extractMainBlocks(dom(fixture(p), url || "https://example.com/x")); return [r.chars, r.blocks.length]; };
  assert.deepEqual(n("test/fixtures/made-up/calderon-vision.html"), [2310, 12]);
  assert.deepEqual(n("test/fixtures/made-up/calderon-inside.html"), [1429, 7]);
  assert.deepEqual(n("test/fixtures/made-up/brightlane-mission.html"), [1257, 12]);
  assert.deepEqual(n("test/fixtures/made-up/encyclopedia-priya.html"), [1825, 11]);
  assert.deepEqual(n("test/fixtures/made-up/emberfest-faq.html"), [23526, 180]);
  assert.deepEqual(n("test/fixtures/made-up/veridrop-release.html"), [2001, 14]);
});

test("coherenceGuard (helper for a guessed root): a ticker line on someone else's story goes, the story and its first lines stay", () => {
  const blocks = [P1, P2, P3, "Treasury Secretary Scott Bessent says Nvidia executives would be removed while Huang eyes a return.", P4];
  const g = coherenceGuard(blocks, { headline: "This CEO is out for blood Elizabeth Holmes Theranos" });
  assert.equal(g.dropped, 1);
  assert.ok(!g.blocks.some((b) => /Bessent/.test(b)) && g.blocks.includes(P4));
  assert.equal(coherenceGuard([P1, P2], { headline: "x" }).dropped, 0);
});

test("pickArticleRoot returns null for a page with no article signals, and cleanArticle without strict mode leaves content alone", () => {
  assert.equal(pickArticleRoot(dom(page("<div><p>short page</p></div>"))), null);
  const d = dom(page(`<div><div class="promo-card"><p>${P1}</p><p>${P2}</p></div></div>`));
  cleanArticle(d.body, false);
  assert.ok(d.body.textContent.includes("fall of 2003"), "non-strict mode removes only tickers and ads");
});
