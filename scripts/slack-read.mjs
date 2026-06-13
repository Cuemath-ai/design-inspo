// Headless Slack reader — pulls channel messages (with threads, reactions, and
// file metadata) via the BOT token, so the sweep needs no interactive login and
// can run anywhere, including Claude cloud. Prints JSON to stdout.
//
// usage: node scripts/slack-read.mjs <channel_id> [oldest_ts]
//   oldest_ts: only messages strictly newer than this (default 0 = all history)
import { readFile } from 'node:fs/promises';

const token = process.env.SLACK_BOT_TOKEN?.trim()
  || (await readFile(new URL('../.slack-bot-token', import.meta.url), 'utf8')).trim();
const channel = process.argv[2];
const oldest = process.argv[3] || '0';
if (!channel) { console.error('usage: slack-read.mjs <channel_id> [oldest_ts]'); process.exit(1); }

async function api(method, params) {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Bearer ${token}`
    },
    body: new URLSearchParams(params)
  });
  return r.json();
}

const out = [];
let cursor;
do {
  const res = await api('conversations.history', { channel, oldest, limit: '200', ...(cursor ? { cursor } : {}) });
  if (!res.ok) { console.error(JSON.stringify({ error: res.error })); process.exit(1); }
  for (const m of res.messages || []) {
    const msg = {
      ts: m.ts,
      user: m.user,
      bot_id: m.bot_id,
      subtype: m.subtype,
      text: m.text || '',
      thread_ts: m.thread_ts,
      reply_count: m.reply_count || 0,
      reactions: (m.reactions || []).map(r => ({ name: r.name, count: r.count })),
      files: (m.files || []).map(f => ({ id: f.id, name: f.name, mimetype: f.mimetype, url_private: f.url_private }))
    };
    if (m.reply_count) {
      const rep = await api('conversations.replies', { channel, ts: m.ts, limit: '200' });
      msg.replies = (rep.messages || [])
        .filter(r => r.ts !== m.ts)
        .map(r => ({ ts: r.ts, user: r.user, bot_id: r.bot_id, text: r.text || '' }));
    }
    out.push(msg);
  }
  cursor = res.response_metadata?.next_cursor;
} while (cursor);

out.sort((a, b) => Number(a.ts) - Number(b.ts));
console.log(JSON.stringify(out, null, 2));
