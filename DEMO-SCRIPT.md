# MentionFox Lens: demo video script (version 0.2.0)

Under 3 minutes (the contest only judges the first 3:00). English. Upload to YouTube as Public, then paste the link into Devpost.

The message from start to finish: Lens shows signals a careful reader could have caught in 2014. It is not hindsight.

## First, once: can your Chrome run the on-device model?

The contest is judged on how the entry uses on-device and cloud together, so a take that shows "On-device" matters.

1. Type chrome://on-device-internals in the address bar and press Enter. (If Chrome says the page is disabled, follow the one switch it names, then open it again.)
2. Find where the page shows the model's status (it may be a tab named Model Status) and read it. If it offers a download, start it and wait until it is ready. Chrome asks for at least 22 GB of free disk, and either a graphics card with more than 4 GB of memory or 16 GB of RAM with 4 processor cores.
3. Open any article, open the Lens side panel and click Quick private scan. If the bar says On-device, keep Beat 5. If it says Cloud, send us the Model Status text before recording.

## Before you press record

1. Chrome desktop. Open chrome://extensions and click the reload arrow on MentionFox Lens, so it shows version 0.2.0 (your own build in the dist folder).
2. Block JavaScript for the Web Archive, so the archived page does not blank itself:
   type chrome://settings/content/javascript in the address bar, find "Not allowed to use JavaScript", click Add, type [*.]web.archive.org, click Add.
3. Open the Lens side panel once so it is ready: puzzle-piece icon, MentionFox Lens, then "Open Lens side panel".
4. Before the real take, click Deep scan once to confirm your build reaches the cloud. Use your own dist build or the judges zip, not the public release zip.
5. In a second tab, have the Justice Department page open: https://www.justice.gov/usao-ndca/us-v-elizabeth-holmes-et-al
6. In a third tab, have the code open: https://github.com/OsakaSaul/mentionfox-lens

Say only what is on your screen. Counts, seconds and wording change a little between runs. If a flag below is not there, skip its line.

## Beat 1: the hook (0:00 to 0:20)

Click: paste this address and press Enter.
https://web.archive.org/web/20140805154020/http://fortune.com/2014/06/12/theranos-blood-holmes/

Say: "June 2014. Fortune puts Theranos on its cover. This is the archived page, saved that August. Nothing had gone wrong in public yet. Could a careful reader have seen a problem, using only what was on this page?"

## Beat 2: Deep scan (0:20 to 0:35)

Click: the "Deep scan" button.

Say: "This is MentionFox Lens. I click Deep scan, and the cloud model reads the whole article in one pass."

(Cut the waiting in the edit. It took about 6 seconds in our test run.)

## Beat 3: red flags at the top (0:35 to 1:20)

Click: nothing. Point at the red cards at the top of the list.

Say: "Red flags come first. Here: tests done on one hundredth to one thousandth of the usual amount of blood. That is an extraordinary claim, and the page gives no key evidence for it."

Say: "As many as seventy different tests from 25 to 50 microliters. Same problem."

Say: "How is it done? The article says that is a trade secret. Lens flags secrecy offered as a feature."

Say: "And when pressed, the company only says it uses the same fundamental chemical methods as other labs. Lens flags that as an evasive answer."

## Beat 4: Show on page (1:20 to 1:30)

Click: "Show on page" on the 70-tests card ("Theranos can run as many as 70 tests...").

Say: "One click takes me to the exact sentence. Nothing is paraphrased. These are the article's own words."

## Beat 5: Quick private scan, one line (1:30 to 1:45)

Click: "Quick private scan". Only do this beat if the bar under it will say On-device in your browser; test it before recording. If it says Cloud, skip the click and cut this beat.

Say: "There is also a lighter Quick private scan that runs on my own device, so the page stays in my browser."

## Beat 6: the reveal (1:45 to 2:10)

Click: the Justice Department tab. Scroll to the sentence beginning "On January 3, 2022".

Say: "In January 2022, a federal jury convicted Elizabeth Holmes of defrauding investors. Lens did not need to know that. It read a 2014 page and pointed at what was missing."

## Beat 7: close (2:10 to 2:30)

Click: the GitHub tab.

Say: "MentionFox Lens is free and open source. A flag does not say a sentence is false. It shows you where to ask for proof. The code is on GitHub."

## If something goes wrong

- The archived page is blank: JavaScript is not blocked yet. Redo step 2, then reload.
- Deep scan is refused: you are on a build that cannot reach the cloud. See TESTING.md.
