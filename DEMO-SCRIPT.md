# MentionFox Lens: demo video script (version 0.2.0)

Under 3 minutes (the contest only judges the first 3:00). English. Upload to YouTube as Public, then paste the link into Devpost.

The message from start to finish: while you read, Lens shows which sentences to ask proof for. It works on any article. The video uses a made-up page, so no real company or person is on screen.

## First, once: can your Chrome run the on-device model?

The contest is judged on how the entry uses on-device and cloud together, so a take that shows "On-device" matters.

1. Type chrome://on-device-internals in the address bar and press Enter. (If Chrome says the page is disabled, follow the one switch it names, then open it again.)
2. Find where the page shows the model's status (it may be a tab named Model Status) and read it. If it offers a download, start it and wait until it is ready. Chrome asks for at least 22 GB of free disk, and either a graphics card with more than 4 GB of memory or 16 GB of RAM with 4 processor cores.
3. Open any article, open the Lens side panel and click Quick private scan. If the bar says On-device, keep Beat 5. If it says Cloud, send us the Model Status text before recording.

## Before you press record

1. Chrome desktop. Open chrome://extensions and click the reload arrow on MentionFox Lens, so it shows version 0.2.0 (your own build in the dist folder, or the judges zip, not the public release zip).
2. Open https://foxapis.com/demo/lens-sample/ and open the Lens side panel: puzzle-piece icon, MentionFox Lens, then "Open Lens side panel".
3. Practice once: click Deep scan and note which red cards appear. Nobody has run Lens on this page yet, so this practice run is the first look. Say only what is on your screen; if a kind of flag below is not there, skip its line. Counts, seconds and wording change a little between runs.
4. Frame the recording on the page and the side panel only: no bookmarks bar, no other tabs' titles, no other extensions' icons.
5. In a second tab have the code open for the last beat: https://github.com/OsakaSaul/mentionfox-lens . If you would rather keep every logo out of frame, skip the click and just say the address.

## Beat 1: the hook (0:00 to 0:20)

Click: the tab with the sample article. Rest on the yellow line at the top for a moment.

Say: "This article is made up for the demo: the company, the people and the paper. It reads like many pitches and profiles. Which sentences should you ask for proof of?"

## Beat 2: Deep scan (0:20 to 0:35)

Click: the "Deep scan" button.

Say: "This is MentionFox Lens. I click Deep scan, and the cloud model reads the whole article in one pass."

(Cut the waiting in the edit.)

## Beat 3: red flags at the top (0:35 to 1:25)

Click: nothing. Point at each red card as you talk about it. Use only the lines whose flag is on screen.

Extraordinary claim, say: "An extraordinary claim: a very big result, and the page gives no key evidence for it."

Numbers that disagree, say: "The page gives two different numbers for the same thing. Lens puts that near the top."

Secrecy, say: "The method is kept secret, and the secrecy is offered as the reason to trust it."

Evasive answer, say: "Asked a direct question, the answer talks about something else."

## Beat 4: Show on page (1:25 to 1:40)

Click: "Show on page" on one red card.

Say: "One click takes me to the exact sentence, in the article's own words."

## Beat 5: checkable or puffery (1:40 to 1:55)

Click: scroll the list down to one card marked specific and checkable, then one marked vague or puffery.

Say: "Below the flags, Lens separates claims you can check, with a number or a date, from praise you cannot."

## Beat 6: Quick private scan, one line (1:55 to 2:10)

Click: "Quick private scan". Only do this beat if the bar under it will say On-device in your browser; test it before recording. If it says Cloud, skip the click and cut this beat.

Say: "There is also a lighter Quick private scan that runs on my own device, so the page stays in my browser."

## Beat 7: close (2:10 to 2:30)

Click: the code tab, or stay on the article.

Say: "MentionFox Lens is free and open source, and it works on any article. A flag does not say a sentence is false. It shows you where to ask for proof."

## If something goes wrong

- Deep scan is refused: you are on a build that cannot reach the cloud. See TESTING.md.
- A flag you expected is missing: skip its line. Do not add words Lens did not show.
