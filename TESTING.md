# Testing MentionFox Lens (for judges)

Version 0.2.0. Chrome desktop, version 139 or newer.

## Which zip to use

Judges: download lens-0.2.0-judges.zip from the private link in the testing instructions field of our Devpost submission. This build can reach the cloud, so Deep scan works. Please do not share the link or the zip.

The public zip on the GitHub release (lens-0.2.0.zip) contains no cloud access credential. While Firebase App Check enforcement is on, Deep scan and the cloud version of Quick private scan are refused in that build: you get a short failure message and no cards. Only the on-device Quick private scan can work there, and only if your Chrome has the built-in model ready. The authors have not been able to run that on-device path.

## Install

1. Download lens-0.2.0-judges.zip from the private link.
2. Unzip it into its own folder.
3. Type chrome://extensions in the address bar and press Enter.
4. Turn on Developer mode (top right).
5. Click Load unpacked and choose the unzipped folder (the one that contains manifest.json).
6. Click the puzzle-piece icon in the toolbar and pin MentionFox Lens.

## Block JavaScript for the Web Archive

The archived demo page blanks itself when its old scripts run.

1. Type chrome://settings/content/javascript in the address bar and press Enter.
2. Find "Not allowed to use JavaScript" and click Add.
3. Type [*.]web.archive.org and click Add.

You can remove this entry when you finish testing.

## Run the demo

1. Open the August 2014 snapshot: https://web.archive.org/web/20140805154020/http://fortune.com/2014/06/12/theranos-blood-holmes/
2. Click the Lens icon in the toolbar, then Open Lens side panel.
3. Click Deep scan.

What you should see: a blue Cloud bar with the time taken (about 5 to 6 seconds in our test runs), a one-line summary of counts, and red cards at the top of the list. In our three test runs there were 7 red flags, including the 1/100th to 1/1,000th blood amount, as many as 70 tests from 25 to 50 microliters, the trade secret, and "the same fundamental chemical methods". Counts and wording can differ a little between runs.

4. Click Show on page on a card. The page scrolls to that sentence and highlights it.

## Build it yourself

You need Node 20 or newer and your own App Check debug token for a Firebase project with AI Logic (see README, "Setup"). git clone https://github.com/OsakaSaul/mentionfox-lens.git, then npm install, then npm run build:dev, then load the dist folder.
