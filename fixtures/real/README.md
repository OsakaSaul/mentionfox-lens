# Real page fixtures

Raw HTML of four real, public marketing/news pages, fetched on 2026-11-23 with `curl` and a normal browser User-Agent. No logins, no LinkedIn/X. Saved unmodified (nothing stripped: each file is under 400 KB). Used only to test the extension; copyright stays with the original publishers.

| File | Kind | URL |
|---|---|---|
| `founder-bio.html` | Founder bio (personal site) | https://paulgraham.com/bio.html |
| `press-release.html` | Company press release (newsroom) | https://newsroom.spotify.com/2025-02-04/spotify-reports-fourth-quarter-2024-earnings/ |
| `homepage.html` | Company homepage | https://basecamp.com/ |
| `news-article.html` | News article | https://www.bbc.com/news/articles/c3qj57rkd2k1o |

`sources.json` has the same URLs for the probe (`scripts/live-probe.mjs --fixture <file>`), which serves a copy with `<script>` tags removed and a `<base href>` to the original URL so CSS still loads. Results: `docs/real-runs/`.
