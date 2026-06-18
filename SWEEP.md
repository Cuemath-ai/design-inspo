# SWEEP.md — Inspo sweep procedure (silent / pre-approved)

You are running the Inspo sweep. It must run **without triggering any permission
prompt**, so it is built around a fixed set of pre-approved commands.

**When a request or reply is ambiguous, ask — don't guess.** Reply in-thread in
Po's voice (the bot's personality), leave things unchanged, and pick it up once
they answer. And whenever you DO apply a change someone asked for, confirm it
in-thread in Po's voice.

## ⛔ The only shell commands you may run

Run these by their **absolute path**, exactly as written. **Never** run `git`,
`cd`, `npm`, `grep`, `cat`, `ls`, `sed`, `node -e`, or any other shell command —
those will prompt and break the silent run. To look inside a file, use the
**Read** tool. To write an entry or edit state, use the **Write/Edit** tools.

- `node /Users/manikbansal/design-inspo/scripts/git-sync.mjs pull`
- `node /Users/manikbansal/design-inspo/scripts/slack-read.mjs C0BA05V4C7M <last_swept_at>`
- `node /Users/manikbansal/design-inspo/scripts/shot.mjs <url> <id> [--motion]`
- `node /Users/manikbansal/design-inspo/scripts/slack-file.mjs <url_private> assets/<id>.<ext>`
- `node /Users/manikbansal/design-inspo/scripts/bot.mjs post C0BA05V4C7M "<text>" [thread_ts]`
- `node /Users/manikbansal/design-inspo/scripts/bot.mjs react C0BA05V4C7M <ts> white_check_mark`
- `node /Users/manikbansal/design-inspo/scripts/build-index.mjs`
- `node /Users/manikbansal/design-inspo/scripts/git-sync.mjs publish "<commit message>"`

All scripts resolve their own paths, so the working directory does not matter.

## 0. Pull + state
1. Run `git-sync.mjs pull`.
2. **Read** `data/.../state.json` (path: `/Users/manikbansal/design-inspo/state.json`)
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
  - image upload → `slack-file.mjs <file.url_private> assets/<id>.<ext>`; that
    image IS the card (`asset`). If the message also has a link, that link is the
    entry `url`.
  - **video upload** (a person shared a clip/screen recording — e.g. "navigation
    interaction") → download it, convert to mp4 if needed (`ffmpeg … assets/<id>.mp4`),
    set `motion` to it, AND extract a frame as the still thumbnail so the card
    shows THEIR video, not an auto-screenshot:
    `ffmpeg -y -ss 1 -i assets/<id>.mp4 -vframes 1 assets/<id>.png -loglevel error`.
    Do NOT auto-screenshot the link in this case. If the message also has a link,
    it's the entry `url`.
  - link only → take the BEST screenshot that matches the description:
    - default: `shot.mjs <url> <id>` captures the hero (top viewport) — clean and
      representative for most.
    - if the description points at a specific part ("footer", "pricing", "the
      bottom", a named section) → `shot.mjs <url> <id> --find "<that word>"`
      (scrolls that element into view) or `--scroll <0..1>`.
    - if it's about the whole layout / a one-screen page → add `--full`.
    - add `--motion` if movement is the point.
    Aim to show what the user actually pointed at.
  - **Rule: if an image or video is shared, that file IS the thumbnail** (for a
    video, a frame of it) — NEVER replace a shared image/video with a screenshot.
  - Open the captured `assets/<id>.png` with **Read** to confirm it isn't blank
    and that it reflects the description; re-shoot with a different target if not.

## 3. Write the entry
**Write** `/Users/manikbansal/design-inspo/data/entries/<id>.json` with:
`id, type(site|image|video), url, title, description (their words, lightly
cleaned), notes:[], addedBy: userName, date, updated, loves:0, slack_ts:<ts>,
asset:"assets/<id>.png", motion?:"assets/<id>.webm", tags:{style[],mood[],
colour[],component[],medium[],industry[]}` — 5–12 generous, concrete,
lowercase-kebab tags across the six dimensions. Reuse existing tag words where
they fit (Read a couple of recent entries).
Then confirm in-thread in **Po's voice** (warm, brief, one line, vary it) via
`bot.mjs post … <ts>`, e.g. *"Gotcha — added to the board! 🐼 Tagged dark, editorial, motion-heavy. → https://cuemath-ai.github.io/design-inspo/"*. Keep the 🧲 magnet for the weekly digest only.

## 4. Thread replies on existing entries — read the INTENT (plain language)
Match the entry by `slack_ts`. People write naturally — there's no required
syntax. Read each new reply and decide what they mean, then act:

- **Change the tags** ("add dark/moody", "tag it as a dashboard") → merge/adjust
  the entry's tags (Edit the JSON).
- **Change the description** ("actually it's the footer I loved") → replace the
  entry's `description` (Edit the JSON).
- **Change the link** ("update the link to X", "point this at Y") → set the
  entry's `url` (Edit the JSON).
- **Make it a separate entry** ("add this as its own entry") → create a new
  entry per §2–§3 using the reply's link/intent.
- **Remove it** ("delete this", "remove this one") → run
  `node /Users/manikbansal/design-inspo/scripts/remove-entry.mjs <id>`.
- **Just more commentary / praise / a second perspective** → append it to the
  entry's `notes[]` (Edit the JSON).
- **Genuinely ambiguous** (can't tell if it's an instruction or a comment, or a
  structural/destructive change isn't clearly intended) → do NOT guess. Reply
  in-thread in Po's voice asking which they meant, e.g. *"Hmm, want me to change
  the entry, or just keep this as a note? 🐼"* — and leave the entry unchanged
  until they answer. Lean non-destructive when waiting.

The old `retag:` / `edit:` / `remove` prefixes still work but are not required.

**Always confirm an applied change in-thread in Po's voice** (warm, brief, a
dumpling/kung-fu wink — one short line, vary it), e.g. *"Done! Swapped the link,
skadoosh 🐼"*, *"Gotcha — retagged it dark + moody 🥟"*, *"Poof, removed it from
the board 🐼"*. The 🧲 magnet is reserved for the weekly digest — don't use it
on these.

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
