# SWEEP.md — daily Inspo sweep procedure

You are running the Inspo sweep in the design-inspo repo. Work through ALL
steps. Judgment calls (tags, descriptions, motion-worthiness) are yours;
everything mechanical uses the scripts. Never invent entries; every entry
traces to a Slack message.

## 0. Setup
- `git pull` first.
- Read `state.json` → `last_swept_at` (null = first run: process entire
  channel history), `pending` (nudged messages awaiting a description),
  `channel_id` (already cached: `C0BA05V4C7M`).

**This sweep is fully headless — it uses the bot token for everything and needs
no interactive Slack login, so it runs identically on a Mac or in Claude cloud.**

- **Read** the channel (messages + threads + reactions + file info):
  `node scripts/slack-read.mjs <channel_id> <last_swept_at>` → prints JSON.
  (Pass `0` as the timestamp for a full first-run history pull.)
- **Post / react** (every reply, nudge, confirmation, digest — all appear as
  the Inspo bot, never a person):
  `node scripts/bot.mjs post <channel_id> "<text>" [thread_ts]`
  `node scripts/bot.mjs react <channel_id> <message_ts> <emoji>` (e.g. `white_check_mark`)
- **Download an uploaded file:**
  `node scripts/slack-file.mjs <url_private> assets/<id>.<ext>`

Do NOT use the Slack connector / MCP tools anywhere in the sweep — the cloud
runner won't have them.

## 1. Collect
- Run `node scripts/slack-read.mjs <channel_id> <last_swept_at>` and parse the
  JSON. Each item has ts, user, bot_id, subtype, text, thread_ts, reactions,
  files (with url_private), and (if any) replies. This is your whole input.
- Pending threads are already included (the reader returns each message's
  replies), so you can resolve nudges from the same JSON.

## 2. Pending nudges
For each pending item whose thread now has a reply from the author:
treat the reply as the description and process the original message via
step 3. Remove from `pending`. If still no reply: leave it (ONE nudge ever —
never re-nudge).

## 3. Process each new top-level message
Skip anything from the **Inspo bot itself** (its own confirmations, nudges,
digest — they carry a `bot_id` or come from the Inspo bot user; never
re-process them), the pinned rules message, channel-join notices, and plain
conversation (a message with no link and no file attachment is conversation
— ignore it).

a. **Extract**: first URL in the text, file attachments, remaining text =
   the description candidate. Author display name via the connector.
b. **No description?** (bare link/file, or text adds nothing): the instant
   Worker usually nudges within a second, so FIRST check the thread — if the
   Inspo bot has already nudged there, just add to `pending` (do NOT nudge
   again). Only if no bot nudge exists yet, nudge in thread via the bot —
   `node scripts/bot.mjs post <channel_id> "What caught your eye? One line and it's in." <message_ts>`
   then add to `pending` with the message ts. Either way, STOP processing
   this message.
c. **Duplicate?** Normalize the URL (lowercase host, strip trailing slash,
   query params, and fragment) and compare against the `url` of every file
   in data/entries/. If it exists: append {by, note: their description,
   date} to that entry's `notes[]`, bump `updated`, reply in thread via the
   bot — "Already saved by {addedBy} on {date} — added your note to it ✓",
   and skip to the next message.
d. **Capture**:
   - **Upload + URL in the same message** → the upload is the card image
     (the author cropped what matters — never replace it with an auto
     screenshot) and the URL is stored as the entry's `url` (the Visit
     link). type = site. Capture motion of the URL only if the description
     flags movement.
   - URL → decide motion-worthiness: capture motion when the description
     mentions movement (animation/transition/scroll/hover/motion/🎬) OR
     the site is plainly animation-led. Then:
     `node scripts/shot.mjs <url> <id> [--motion]`
   - File upload → `node scripts/slack-file.mjs <file.url_private> assets/<id>.<ext>`
     (uses the bot token; no login needed). type = image or video by mimetype.
     If a `.mov` came in, convert to web-friendly mp4 with ffmpeg if available:
     `ffmpeg -y -i <in.mov> -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an assets/<id>.mp4`.
   - id = `YYYY-MM-DD-<slug-from-domain-or-filename>`; if taken, append `-2`.
   - Open the captured still with the Read tool. Blank/cookie-walled/broken?
     Retry once; if still bad, keep the entry but note it and tell Manik in
     the final report.
e. **Tag**: 5–12 lowercase-kebab-case tags across style, mood, colour,
   component, medium, industry. Be generous and concrete — tags power
   search. Reuse existing vocabulary where it fits (check a few recent
   entries); new tags are fine when warranted. If you coin a tag that has
   an obvious synonym cluster, add it to synonyms.json.
f. **Write** `data/entries/<id>.json` per the README schema. `title` =
   site/product name. `description` = the author's words (light cleanup
   only — it stays THEIR voice). `addedBy` = author first name. Include
   `slack_ts` = the source message ts (used for edit-command lookups).
g. **Confirm in thread** via the bot:
   `node scripts/bot.mjs post <channel_id> "Added ✓ — tagged: {4–6 best tags} → https://cuemath-ai.github.io/design-inspo/" <message_ts>`

## 4. Edit commands
Read the threads of existing entries that received new replies; match
entry by `slack_ts`:
- `retag: a, b, c` → merge those tags in (replace a dimension only if they
  prefix it like `mood: x, y`).
- `edit: <text>` → replace description with <text>.
- `remove` → delete the entry JSON and its assets.
Confirm each applied command via the bot — react ✅
(`node scripts/bot.mjs react <channel_id> <reply_ts> white_check_mark`) or a
short `bot.mjs post` reply.

## 5. Loves
For every entry whose `date` is within the last 30 days, re-read its
original message's reactions; `loves` = total reaction count across all
emoji. Update changed entries (bump nothing else).

## 6. Publish
- `npm run build`
- Update state.json: `last_swept_at` = newest processed message ts,
  current `pending` list.
- `git add -A && git commit -m "sweep: <N> added, <M> updated" && git push`

## 7. Weekly digest (Mondays, 1 PM, in Po's voice)
The sweep runs hourly, so guard against repeats: post ONLY if today is Monday
AND local time is 13:00 or later AND `state.json.last_digest_date` is not
today's date. After posting, set `last_digest_date` to today's date.

Count N = entries added in the last 7 days. Post via the bot to the channel
(not a thread): `node scripts/bot.mjs post <channel_id> "<message>"`.

**Voice — the bot's personality is Po from Kung Fu Panda:** warm, goofy,
humble, big-hearted; food metaphors (dumplings, noodles); the occasional
kung-fu flourish ("Skadoosh!", "There is no charge for awesomeness"). Keep it
SHORT — 2 to 4 lines. Genuinely encouraging, never cringe or bloated. Each
week: state N, optionally name the most-loved find of the week, include the
gallery link (https://cuemath-ai.github.io/design-inspo/), and rally the team
to add more. If N is 0, post a gentle "quiet week, let's change that" version
rather than skipping. Vary the wording every week — never copy these verbatim:

- "Whoaa — 7 new inspirations this week! That's a full plate of dumplings for the eyes 🥟 The crew loved *{title}* most. Now... what beauty will YOU drop this week? There is no charge for awesomeness. Skadoosh 🐼 → {link}"
- "Only 1 new find this week — but even one dumpling can start a feast, yeah? 🐼 Let's fill the board, team. Drop what's inspiring you → {link}"

## 8. Report
End with a one-paragraph summary for Manik: added/merged/nudged/edited
counts, anything that failed (bad screenshots, undownloadable files,
dead links), and any synonyms.json additions.
