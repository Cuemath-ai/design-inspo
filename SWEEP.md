# SWEEP.md — Inspo sweep procedure (silent / pre-approved)

You are running the Inspo sweep. It must run **without triggering any permission
prompt**, so it is built around a fixed set of pre-approved commands.

## ⛔ The only shell commands you may run

Run these by their **absolute path**, exactly as written. **Never** run `git`,
`cd`, `npm`, `grep`, `cat`, `ls`, `sed`, `node -e`, or any other shell command —
those will prompt and break the silent run. To look inside a file, use the
**Read** tool. To write an entry or edit state, use the **Write/Edit** tools.

- `node /Users/manikbansal/Desktop/design-inspo/scripts/git-sync.mjs pull`
- `node /Users/manikbansal/Desktop/design-inspo/scripts/slack-read.mjs C0BA05V4C7M <last_swept_at>`
- `node /Users/manikbansal/Desktop/design-inspo/scripts/shot.mjs <url> <id> [--motion]`
- `node /Users/manikbansal/Desktop/design-inspo/scripts/slack-file.mjs <url_private> assets/<id>.<ext>`
- `node /Users/manikbansal/Desktop/design-inspo/scripts/bot.mjs post C0BA05V4C7M "<text>" [thread_ts]`
- `node /Users/manikbansal/Desktop/design-inspo/scripts/bot.mjs react C0BA05V4C7M <ts> white_check_mark`
- `node /Users/manikbansal/Desktop/design-inspo/scripts/build-index.mjs`
- `node /Users/manikbansal/Desktop/design-inspo/scripts/git-sync.mjs publish "<commit message>"`

All scripts resolve their own paths, so the working directory does not matter.

## 0. Pull + state
1. Run `git-sync.mjs pull`.
2. **Read** `data/.../state.json` (path: `/Users/manikbansal/Desktop/design-inspo/state.json`)
   → `last_swept_at`, `pending`, `channel_id` (C0BA05V4C7M), `last_digest_date`.

## 1. Read the channel
Run `slack-read.mjs C0BA05V4C7M <last_swept_at>` and parse the JSON. Each item:
`ts, user, userName, bot_id, subtype, text, thread_ts, reactions, files[], replies[]`.
`userName` is the author's first name (null if the bot lacks users:read — then
use "team" and flag it in the summary). Pending threads come back as `replies`.

## 2. Process each new top-level message
Skip messages from the Inspo bot (`bot_id` set), the pinned rules message,
join notices, and plain conversation (no link and no file = conversation).

- **No description** (link/file but text adds nothing): the instant Worker has
  usually already nudged in-thread. If `replies` shows no bot nudge yet, run
  `bot.mjs post … "What caught your eye? One line and it's in." <ts>`. Add the
  ts to `pending`. Skip.
- **Duplicate URL** (normalise: lowercase host, drop trailing slash/query/hash;
  compare to the `url` of existing entries — find them by **Read**ing the files
  listed by `build-index`'s inputs, i.e. the JSONs in `data/entries/`): append
  `{by: userName, note: their text, date}` to that entry's `notes[]` (Edit it),
  bump `updated`, then `bot.mjs post … "Already saved by {addedBy} on {date} —
  added your note ✓" <ts>`. Skip.
- **New inspiration**: pick `id` = `YYYY-MM-DD-<slug>`. Capture:
  - link → `shot.mjs <url> <id>` (add `--motion` if the text mentions
    movement/animation/scroll/hover/🎬, or the site is clearly motion-led).
  - file upload → `slack-file.mjs <file.url_private> assets/<id>.<ext>` (ext from
    mimetype). If a message has BOTH a file and a link, the file is the card and
    the link is the entry `url`.
  - Open the captured `assets/<id>.png` with **Read** to confirm it isn't blank.

## 3. Write the entry
**Write** `/Users/manikbansal/Desktop/design-inspo/data/entries/<id>.json` with:
`id, type(site|image|video), url, title, description (their words, lightly
cleaned), notes:[], addedBy: userName, date, updated, loves:0, slack_ts:<ts>,
asset:"assets/<id>.png", motion?:"assets/<id>.webm", tags:{style[],mood[],
colour[],component[],medium[],industry[]}` — 5–12 generous, concrete,
lowercase-kebab tags across the six dimensions. Reuse existing tag words where
they fit (Read a couple of recent entries).
Then `bot.mjs post … "Added ✓ — tagged: {4–6 tags} → https://cuemath-ai.github.io/design-inspo/" <ts>`.

## 4. Edit commands (thread replies on existing entries, matched by `slack_ts`)
- `retag: a, b, c` → merge those tags into the entry (Edit the entry JSON).
- `edit: <text>` → replace the entry's description (Edit the entry JSON).
- `remove` → deletion needs a shell `rm` (not pre-approved), so don't automate
  it. Note "remove requested for <id>" in the final summary for manual action.
Confirm applied retag/edit with `bot.mjs react … white_check_mark`.

## 5. Loves
For entries dated within 30 days, set `loves` = total reaction count from the
`reactions` of their source message (already in the slack-read output). Edit
changed entries only.

## 6. Publish
1. Run `build-index.mjs`.
2. **Edit** state.json: `last_swept_at` = newest processed ts; updated `pending`.
3. Run `git-sync.mjs publish "sweep: <N> added, <M> updated"`.

## 7. Weekly digest (Mondays, Po's voice — primary; Worker backstops at 5 PM)
Post ONLY if: today is **Monday**, local time **10:00–16:59**, and no digest has
gone out today. Check the latter from the slack-read output — any bot message
today containing **🧲** means it's done; then SKIP. Otherwise compose a fresh,
short Po (Kung Fu Panda) digest — warm, goofy, dumpling/kung-fu flourishes,
state how many entries were added in the last 7 days, name the most-loved find,
include the gallery link — **starting with 🧲** (the shared marker that stops the
5 PM Worker double-posting). Post it with `bot.mjs post C0BA05V4C7M "<text>"`
(no thread_ts). After posting, **Edit** state.json `last_digest_date` to today.

## 8. Summary
End with one line: added / merged / nudged / edited / digest counts, plus
anything that failed or any author you had to attribute to "team".
