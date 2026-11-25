# MentionFox Lens: demo video script (version 0.1.9)

Under 3 minutes (the contest only judges the first 3:00). English. Upload to YouTube as Public, then paste the link into Devpost.

The message from start to finish: Lens shows signals a careful reader could have caught in 2014. It is not hindsight.

## Before you press record

1. Chrome desktop, with Lens loaded from the build you tested (TESTING.md).
2. Block JavaScript for the Web Archive, so the archived page does not blank itself:
   type chrome://settings/content/javascript in the address bar, find "Not allowed to use JavaScript", click Add, type [*.]web.archive.org, click Add.
3. Open the Lens side panel once so it is ready: puzzle-piece icon, MentionFox Lens, then "Open Lens side panel".
4. Before the real take, click Deep scan once to confirm your build can reach the cloud: the plain release zip may be refused (see TESTING.md).
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

## Beat 5: ask for proof (1:30 to 2:00)

Do NOT click Check in this video. In our test runs its verdict on this sentence kept changing, and one run showed a green Supported tick. Stay on the red card.

Click: nothing. Point at the 70-tests card and the one-line reason under the quote.

Say: "Under each flag is one line saying why. A flag does not say the sentence is false. It says: before you believe this, ask for proof. In 2014, that was the question to ask."

## Beat 6: Quick private scan, one line (2:00 to 2:10)

Click: "Quick private scan". Only do this beat if the bar under it will say On-device in your browser; test it before recording. If it says Cloud, skip the click and cut this beat.

Say: "There is also a lighter Quick private scan that runs on my own device, so the page stays in my browser."

## Beat 7: the reveal (2:10 to 2:30)

Click: the Justice Department tab. Scroll to the sentence beginning "On January 3, 2022".

Say: "In January 2022, a federal jury convicted Elizabeth Holmes of defrauding investors. Lens did not need to know that. It read a 2014 page and pointed at what was missing."

## Beat 8: close (2:30 to 2:45)

Click: the GitHub tab.

Say: "MentionFox Lens is free and open source. It will not tell you what to believe. It shows you where to ask for proof. The code is on GitHub."

## If something goes wrong

- The archived page is blank: JavaScript is not blocked yet. Redo step 2, then reload.
- Deep scan is refused: you are on a build that cannot reach the cloud. See TESTING.md.
