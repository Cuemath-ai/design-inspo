# Inspo — Cuemath design inspiration library

Drop a link or image in #design-inspo on Slack with one line about what caught
your eye. A daily sweep tags it and publishes it here.

**Gallery:** https://cuemath-ai.github.io/design-inspo/

## How it works
- `SWEEP.md` — the daily procedure, executed by Claude Code on a custodian's machine
- `data/entries/` — one JSON per inspiration; `index.json` is the compiled feed
- `assets/` — screenshots, motion clips, uploads
- `state.json` — sweep cursor + pending nudges (machine-independent; any
  custodian with the Slack connector can take over by cloning and scheduling)

## Local dev
npm install && npx playwright install chromium
npm run build && python3 -m http.server 8080
