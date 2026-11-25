# Testing MentionFox Lens (for judges)

Version 0.1.9. Chrome desktop, version 139 or newer.

## Read this first: cloud access

Deep scan and the cloud version of Quick private scan go through Firebase App Check. The public release zip contains no access credential. While App Check enforcement is on, those two are refused in the zip build: you get a short failure message and no cards, so there is no Check button either.

In the zip as it is, only the on-device Quick private scan can work, and only if your Chrome has the built-in model ready. The authors have not been able to run that on-device path.

To see the full demo, use an access token from the private testing instructions in our Devpost submission, if one is given there, and follow "Full demo with an access token" below. No token is published in this repository.

## Install from the release zip

1. Download lens-0.1.9.zip from https://github.com/OsakaSaul/mentionfox-lens/releases/tag/v0.1.9
2. Unzip it into its own folder.
3. Type chrome://extensions in the address bar and press Enter.
4. Turn on Developer mode (top right).
5. Click Load unpacked and choose the unzipped folder (the one that contains manifest.json).
6. Click the puzzle-piece icon in the toolbar and pin MentionFox Lens.

## Full demo with an access token

You need Node 20 or newer.

1. git clone https://github.com/OsakaSaul/mentionfox-lens.git
2. cd mentionfox-lens
3. npm install
4. Create a file named .env.local containing one line: APPCHECK_DEBUG_TOKEN= followed by the token from the private testing instructions.
5. npm run build:dev
6. Load unpacked as above, choosing the dist folder.

## Block JavaScript for the Web Archive

The archived demo page blanks itself when its old scripts run.

1. Type chrome://settings/content/javascript in the address bar and press Enter.
2. Find "Not allowed to use JavaScript" and click Add.
3. Type [*.]web.archive.org and click Add.

You can remove this entry when you finish testing.

## Run the demo

1. Open https://web.archive.org/web/20140805154020/http://fortune.com/2014/06/12/theranos-blood-holmes/
2. Click the Lens icon in the toolbar, then Open Lens side panel.
3. Click Deep scan.

What you should see: a blue Cloud bar with the time taken (about 5 to 6 seconds in our test runs), a one-line summary of counts, and red flags at the top of the list. In our three test runs there were 7 red flags, including the 1/100th to 1/1,000th blood amount, as many as 70 tests from 25 to 50 microliters, the trade secret, and "the same fundamental chemical methods". Counts and wording can differ a little between runs.

4. Click Show on page on a card. The page scrolls to that sentence and highlights it.
5. Optional: click Check on a specific claim card. It searches for a public record. It is experimental: the same sentence can get a different answer on another run, including a wrong one, so read the sources. It does not show a verdict as of the page's date.

## Limits

You get 5 free checks a day per install. There is also a shared limit of 100 checks a day across all users; past it, the card says "Web checks are busy today".

Check sends only that one sentence, the site's domain and the archive date. It does not send the page.
