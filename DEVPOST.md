# Devpost submission: MentionFox Lens

Paste each section into the matching Devpost field. Platform to select: Web (Chrome extension). Deadline: Nov 30, 2026, 2:00pm PST (Dec 1, 07:00 JST).

## Name

MentionFox Lens

## Tagline

See what a careful reader would question on any page

## Inspiration

Many pages that ask for your trust carry their own warning signs: a very large result with no evidence beside it, two numbers that do not agree, a method kept secret, a direct question answered with something else. Those lines are on the page for anyone to read, and they are easy to read past.

We wanted a tool that points at them while you are reading. Not hindsight, and not a lie detector: signals a careful reader could catch on the day.

Lens works on any article. The demo uses a made-up page, with an invented company, people and publication, to keep the video free of other people's trademarks and likenesses: https://foxapis.com/demo/lens-sample/

## Value proposition

Anyone reading a company's page, a profile or a pitch can see, while reading, which sentences to ask proof for. It is free, needs no account, and shows whether each run stayed on the device or went to the cloud.

## What it does

MentionFox Lens is a free, open-source Chrome extension. It reads the page you are on, only when you click.

Deep scan reads the whole article in the cloud, in one pass. Red flags come first: extraordinary claims with the key evidence missing, evasive answers, secrecy offered as a feature, and numbers that disagree. Below them, claims are marked "specific and checkable" or "vague or puffery", each with a one-line reason. "Show on page" jumps to the exact sentence and highlights it.

Quick private scan reads the first part of the page, on your device when your browser has the built-in model. It is lighter than Deep scan.

AI view shows how an AI assistant would summarise the page: what it would pick up, what is missing or unclear, three fixes and a score.

Lens never calls a sentence false by its own judgment. A red flag means "ask for proof".

## What we built during the submission period

The project is new: the repository's first commit is dated 23 November 2026, inside the submission period, and it holds the whole history. During the period we built the extension, the hybrid path with Firebase AI Logic (on device first, cloud as the fallback, plus the cloud-only Deep scan), the red-flag rules, reading only the article body, the quote matcher and highlighting, and the tests. We used AI coding assistants (Claude Code) and standard libraries (Firebase JavaScript SDK, esbuild, Playwright). One feature that is switched off in this release, Check, calls a server of ours at foxapis.com that is not part of this repository.

## How we built it

It is a hybrid. The Quick private scan and AI view use Firebase AI Logic hybrid inference: Chrome's built-in AI (Gemini Nano) is preferred, and the Firebase AI Logic cloud model takes over when the on-device model is not available. If an on-device answer cannot be read, Lens retries once in the cloud. A large bar says On-device or Cloud for each run, with the time taken, so you can always see where your text went.

Deep scan always uses the Firebase AI Logic cloud model, because it needs the whole article at once. It runs only when you click it.

The extension is Manifest V3 with four permissions (activeTab, scripting, sidePanel, storage), bundled with esbuild so there is no remote code, with Firebase App Check on the cloud path. A quote matcher with five fallback tiers finds each quoted sentence on the page and highlights it in place.

## Challenges we ran into

Archived pages. Some saved copies of old articles blank themselves when their old scripts run, so Lens can fall back to the page's no-script copy.

Noise. Early runs treated tickers, promos, related links and the Web Archive toolbar as claims. Lens now reads the article body only.

Hindsight. It is easy to make a tool look clever after the facts are out. The red-flag rules look only at what the page itself says and leaves out.

Quoting. Models reword what they quote. The five-tier matcher ties each card back to real text on the page, and a card says so when it cannot.

On-device limits. The built-in model is not available on every machine, including the one we built on, so our recorded test runs used the cloud path.

## Accomplishments that we're proud of

In testing on one saved long magazine article from 2014, three separate Deep scan runs each returned 7 red flags, and the same four signals appeared in all three: two very large technical claims, a method held as a trade secret, and an answer that did not address the question. Deep scan took between 4.7 and 5.7 seconds in those runs.

It is free, MIT licensed, needs no account, and asks for four permissions.

## What we learned

The most useful output is not a true or false stamp. It is a short list of sentences worth a follow-up question.

Hybrid inference changes the design, not only the code: people should be able to see which path ran, and the choice to send a whole article to the cloud should be their own click.

A small on-device model and a larger cloud model are good at different jobs, so we gave them different buttons.

## What's next for MentionFox Lens

Source-checking: take one flagged claim, search for public records and show the sources next to it. We left it out of this version because its answers were not yet consistent enough. Test and tune the on-device path on more machines. Add more languages and better handling of very long pages. Keep more of the work on the device as built-in models improve.

## Built with

chrome-extension, manifest-v3, javascript, firebase, firebase-ai-logic, firebase-app-check, gemini-nano, chrome-built-in-ai, gemini, esbuild, playwright, claude-code

## Links

Code: https://github.com/OsakaSaul/mentionfox-lens

Release download: https://github.com/OsakaSaul/mentionfox-lens/releases/tag/v0.2.0

Testing instructions: TESTING.md in the repository

Privacy policy: https://foxapis.com/lens/privacy/

Demo page (made up): https://foxapis.com/demo/lens-sample/

Demo video: add the YouTube link after uploading
