# Inspo — architecture & setup reference

A shared inspiration library for the Cuemath design team. People drop links or
images in a Slack channel with one line about what caught their eye; the system
tags them, screenshots them, and publishes a searchable visual gallery.

**Gallery:** https://cuemath-ai.github.io/design-inspo/
**Repo:** `Cuemath-ai/design-inspo` (public)
**Slack channel:** `#design-inspo` — id `C0BA05V4C7M` (workspace: cuemath)

> No secrets live in this repo. Tokens are in gitignored local files and in
> Cloudflare. This doc only says *where* they are.

---

## 1. The loop (how it all fits)

```
Someone posts in #design-inspo  ──┐
                                   │  (link/image + one line)
                                   ▼
        ┌─────────────────────────────────────────┐
        │ INSTANT (cloud, 24/7): Cloudflare Worker  │
        │  • no description? Po nudges in seconds   │
        └─────────────────────────────────────────┘
                                   │
                                   ▼
        ┌─────────────────────────────────────────┐
        │ TWICE DAILY (Mac): the sweep              │
        │  reads channel → screenshots → tags →     │
        │  writes entry → builds → pushes → Po ✓     │
        └─────────────────────────────────────────┘
                                   │
                                   ▼
        ┌─────────────────────────────────────────┐
        │ GitHub Pages rebuilds the static gallery  │
        └─────────────────────────────────────────┘
```

Three independent pieces: an always-on **Worker** (instant feedback + Monday
digest backstop), a **scheduled sweep** on Manik's Mac (the heavy AI work), and
a **static gallery** on GitHub Pages. Nothing needs paid API keys.

---

## 2. Slack app ("Inspo" bot)

Configured at api.slack.com/apps → **Inspo**. Bot user id `U0BAFCRH79S`.

**Bot token scopes** (all required):
- `chat:write` — post nudges / confirmations / digest
- `reactions:write` — ✅ confirm edit commands
- `channels:history` — read the channel + receive message events
- `files:read` — download uploaded images/videos
- `users:read` — resolve who posted (author names)

**Event Subscriptions:** enabled, Request URL = the Worker URL (below),
subscribed to the bot event **`message.channels`**. This is what makes the
instant nudge fire.

**Secrets:** the Bot User OAuth token (`xoxb-…`) and the Signing Secret live
in two places only — gitignored local files (§6) and Cloudflare Worker secrets
(§3). If a token is ever rotated, update **both** places.

---

## 3. Cloudflare Worker (`inspo-nudge`)

Code: `worker/src/index.js`. Config: `worker/wrangler.toml`.
**URL:** https://inspo-nudge.manik-bansal.workers.dev

Two jobs:
1. **`fetch()` — instant nudge.** Slack pings it on every post. If a message has
   a link or file but no real description, the bot replies in-thread within a
   second ("Ooh, nice find! 🐼 …"). It verifies Slack's signature (HMAC, replay
   window 5 min), ignores bot messages / thread replies / plain chatter.
2. **`scheduled()` — Monday digest backstop.** Cron `30 11 * * 1` (UTC) = **5 PM
   IST Monday**. Posts a template Po digest **only if** the Mac sweep hasn't
   already (it checks the channel for a 🧲 in the last ~10h). Reads the live
   `index.json` to count the week's adds.

**Worker secrets** (set via `wrangler secret put`, never in git):
`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`.
**Worker var:** `INSPO_CHANNEL = C0BA05V4C7M` (in wrangler.toml).

**Deploy / operate** (from `worker/`):
```
npx wrangler deploy          # publish changes
npx wrangler tail            # live logs
npx wrangler secret put SLACK_BOT_TOKEN      # (re)set a secret
npx wrangler dev --test-scheduled --port 8799   # test the digest locally,
  # then: curl "http://localhost:8799/__scheduled?cron=30+11+*+*+1"
```
Local testing reads secrets from `worker/.dev.vars` (gitignored).

---

## 4. The sweep (scheduled task on Manik's Mac)

**Task:** `inspo-sweep` (Claude Code scheduled task). Cron `7 12,20 * * *` local
= **~12:13 PM and ~8:13 PM IST**. Procedure: `SWEEP.md`.

**Runs on the Mac, only while the Claude app is open.** If the app is closed at
the scheduled time, the run fires on the next launch (catch-up, not skipped).
The sweep is idempotent — driven by `state.json.last_swept_at`, so a catch-up
run processes everything new at once. The Worker handles time-sensitive nudges,
so the only effect of the Mac being off is the gallery refreshing later.

**What a run does** (see `SWEEP.md` for the exact steps): pull, read new channel
messages, for each new post → screenshot (or download an upload), choose tags,
write the entry JSON, confirm in-thread as Po; refresh love counts; rebuild
`index.json`; push. On Mondays 10:00–16:59 it also posts the fresh Po digest
(marked 🧲 so the 5 PM Worker backstop stands down).

### Why the sweep is built the way it is (IMPORTANT for edits)

The sweep runs **unattended**, so it must trigger **zero permission prompts**.
Claude refuses to auto-approve some shell patterns — notably any **`cd … && …`
compound command** (it warns about untrusted hooks / path bypass) and these can
only be "Allow once", never persisted. So the sweep is designed to avoid them:

- **Every action is a pre-approved, absolute-path `node` script.** No raw `git`,
  no `cd`, no `grep`/`cat`/`ls`/`sed`. To read a file the run uses the Read
  tool, not `cat`.
- That's why `scripts/git-sync.mjs` exists — it runs git via `git -C <repo>` so
  the sweep never has to `cd`.
- All scripts resolve their own paths (via `import.meta.url`), so they work from
  any working directory.
- The allow-list + allowed-directory live in `.claude/settings.local.json`
  (gitignored, §6). If you add a NEW command to the sweep, add its absolute-path
  pattern there or it will prompt.

If a future run starts prompting again, the cause is almost always: a command
that isn't in the allow-list, a relative path instead of absolute, or a `cd`
slipping in. Fix the script/SWEEP.md to use the approved absolute-path form.

---

## 5. The gallery (GitHub Pages)

Static, no framework. Served from the repo root of `main`.

- `index.html` / `styles.css` / `app.js` — the gallery (dark masonry, floating
  search, tag chips, Recent↔Loved sort, full-screen detail view with motion
  playback, filled "Visit site" button, Back, keep-browsing grid below detail).
- `search.js` — vibe-search matching (`entryHaystack`, `expandQuery`,
  `scoreEntry`); unit-tested.
- `synonyms.json` — the synonym map that makes "moody"/"playful" etc. match
  related tags. Extend this to improve search.
- `bundle.css` — CueDesign design system (tokens + embedded Athletics / Untitled
  Sans fonts via `@font-face local()`). Copied from Cuemath-Hive. On machines
  without those fonts it falls back per the design system's own stack.

GitHub Pages has a CDN cache, so a push can take a couple of minutes (and a
hard refresh) to appear live.

---

## 6. Files & where secrets live

```
index.html, styles.css, app.js, search.js   gallery
synonyms.json                                vibe-search synonyms
bundle.css                                   CueDesign tokens + fonts
index.json                                   BUILD ARTIFACT (compiled entries, newest first)
data/entries/<id>.json                       one entry per inspiration (source of truth)
assets/<id>.png|.webm|.mp4|…                 screenshots, motion clips, uploads
state.json                                   sweep cursor: last_swept_at, pending[], channel_id, last_digest_date
SWEEP.md                                     the sweep procedure (executed by the scheduled task)
scripts/
  git-sync.mjs        git pull / publish via `git -C` (no cd)
  slack-read.mjs      read channel+threads+reactions+files, resolve author names
  slack-file.mjs      download a Slack upload via the bot token
  shot.mjs            headless screenshot (+ optional ~6s motion clip)
  bot.mjs             post / react as the Inspo bot
  build-index.mjs     data/entries/* → index.json
  clean-bot-messages.mjs   one-off: delete the bot's own channel messages
worker/
  src/index.js        the Cloudflare Worker (instant nudge + digest backstop)
  wrangler.toml       Worker config (cron trigger, INSPO_CHANNEL)

GITIGNORED (local only — never committed):
  .slack-bot-token        the xoxb- bot token (used by all scripts)
  .slack-signing-secret   Slack signing secret (for local Worker tests)
  .dev.vars               worker/.dev.vars — secrets for `wrangler dev`
  .claude/settings.local.json   permission allow-list + allowed directory
  .browser-profile/, .slack-auth.json   obsolete (old browser-download approach)
```

Scripts read the bot token from `$SLACK_BOT_TOKEN` if set, else `.slack-bot-token`.

### Entry JSON schema
```json
{
  "id": "2026-06-13-lusion",
  "type": "site | image | video",
  "url": "https://…",            // source link (null for pure uploads)
  "title": "Lusion",
  "description": "the bit that caught their eye — their words",
  "notes": [{ "by": "Avneet", "note": "also the cursor", "date": "2026-06-13" }],
  "addedBy": "Manik",
  "date": "2026-06-13",
  "updated": "2026-06-13",
  "loves": 0,                     // synced from Slack reactions, last 30 days
  "slack_ts": "1781…",            // source message, for edit-command lookups
  "asset": "assets/2026-06-13-lusion.png",
  "motion": "assets/2026-06-13-lusion.webm",  // optional
  "tags": { "style": [], "mood": [], "colour": [], "component": [], "medium": [], "industry": [] }
}
```

---

## 7. Common tasks

- **Change sweep frequency:** update the `inspo-sweep` scheduled task's cron
  (currently `7 12,20 * * *`). Keep one slot inside Mon 10:00–16:59 so the Mac
  posts the fresh digest before the 5 PM Worker backstop.
- **Change the digest day/time:** Mac side = the window in `SWEEP.md` §7; cloud
  backstop = the cron in `worker/wrangler.toml` (UTC) — redeploy after editing.
- **Improve search:** add clusters to `synonyms.json` (lowercase, list each
  cluster once; expansion is bidirectional).
- **Rotate the bot token:** regenerate in the Slack app, then update BOTH
  `.slack-bot-token` (local) and the Worker secret (`wrangler secret put
  SLACK_BOT_TOKEN`).
- **Tidy the bot's own channel messages:** `node scripts/clean-bot-messages.mjs`.
- **Edit an entry from Slack:** reply on its thread with `retag: a, b`,
  `edit: new text`. (`remove` is flagged for manual deletion — not automated.)
- **Run the sweep manually:** "Run now" on the `inspo-sweep` task, or follow
  `SWEEP.md` using the absolute-path scripts.

---

## 8. Known gotchas

- **Rebuild AND commit `index.json`.** It's a build artifact; `data/entries/`
  is the source of truth. If you delete/add entries by hand, run
  `node scripts/build-index.mjs` and commit the result — otherwise the gallery
  shows stale/broken cards. (This bit us once: deleted entries lingered because
  the rebuilt index wasn't staged.)
- **Pages cache lag:** a push takes ~1–3 min and a hard refresh to go live.
- **GitHub 100 MB/file cap:** motion clips are short (~6s) and compressed; long
  screen recordings won't fit. `.mov` uploads are converted to web `.mp4` with
  ffmpeg.
- **Public repo = public content.** The pinned channel rule says "nothing
  internal/confidential."
- **Sweep depends on the Mac being on** (see §4). Cloud-hosting the heavy sweep
  would need a paid AI key (deliberately not done).
- **Permission prompts returning** → see §4's "why it's built this way": a new
  command needs an absolute-path allow-list entry; never introduce `cd`/raw git.

---

## 9. History

Built 2026-06. Designed around three constraints: no paid API keys for the core
loop, frictionless capture (just post in Slack), and a genuinely nice browsing
experience for designers. The bot's personality is Po from Kung Fu Panda.
