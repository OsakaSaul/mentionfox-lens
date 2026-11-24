# lens-check (T2988) - NOT USED SINCE T2989

The Check button now calls the FoxAPIs backend route `POST https://api.foxapis.com/v1/lens/check` (T2989). This Worker is not deployed and needs no deploy; the code and tests stay for reference. The KV namespace stays (free).


The backend of the Lens **Check** button. One Cloudflare Worker on the existing account and Workers plan. No new paid service: the only storage is one Workers KV key per day (free tier).

What it does
- `POST {claim, domain, snapshot_date}` from the Lens extension only (`Origin` must be one of `ALLOWED_ORIGINS`, otherwise 403).
- Wraps the one sentence in a neutral 50-word frame (claims_check needs a document of at least 50 words), calls the hidden FoxAPIs `POST /v1/claims_check` (mode snapshot) with the Worker secret `FOXAPIS_TOKEN`, polls the job, and returns `{verdict: contradicted|supported|no_record, reason, sources[]}` (at most 3 sources, one per site).
- Global cap: 100 checks per UTC day across all users (`DAILY_CAP`, KV namespace `lens-check-cap`). Over the cap: HTTP 429 `{error: "busy", message: "Web checks are busy today"}`. A check that fails upstream gives its slot back.
- Never passes upstream error text through; never logs the sentence.

## One-time steps for the owner (nothing here is done for you, and no secret is stored anywhere in this repo)

1. Deploy (Node 22 is needed for current wrangler; the account is already the one the other Workers use):

       cd lens-check
       npx wrangler login
       npx wrangler deploy

   `wrangler.toml` already points at the KV namespace `lens-check-cap` (id `cf4c5c7330a74f588ed113f16d40eb0f`).
2. Set the secret (the FoxAPIs token must be on the claims_check allow-list, `CLAIMS_CHECK_ALLOWED` on the backend):

       npx wrangler secret put FOXAPIS_TOKEN

3. Allow the extension: open `chrome://extensions`, copy the Lens id, then in `wrangler.toml` set

       ALLOWED_ORIGINS = "chrome-extension://<the id>"

   and run `npx wrangler deploy` again. (Add the Web Store id too, comma separated, once published.)
4. Point the extension at the Worker: `wrangler deploy` prints the Worker URL (`https://lens-check.<your-subdomain>.workers.dev`). Put it in `CHECK_URL` in `src/shared/check.js` (it is a non-resolving `.invalid` address until then, so Check shows "not available right now"), run `npm run build`, reload the extension.

## Tests
`npm test` (from the repo root) runs `test/worker.test.js`: origin lock, missing secret, padded document, polling, verdict mapping, daily cap and its UTC reset, slot given back on failure, no secret or upstream text in any answer.
