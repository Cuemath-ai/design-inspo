// One-off tidy: delete the Inspo bot's own messages (the "live" hello and any
// test nudges) from the channel. chat.delete with the bot token can only remove
// messages the bot itself posted, so human posts are untouched.
import { readFile } from 'node:fs/promises';

const token = process.env.SLACK_BOT_TOKEN?.trim()
  || (await readFile(new URL('../.slack-bot-token', import.meta.url), 'utf8')).trim();
const channel = process.argv[2] || 'C0BA05V4C7M';

async function api(method, body) {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  return r.json();
}

const me = await api('auth.test', {});
const botUser = me.user_id;
const hist = await api('conversations.history', { channel, limit: 200 });
let deleted = 0;

for (const m of hist.messages || []) {
  if (m.reply_count) {
    const rep = await api('conversations.replies', { channel, ts: m.ts, limit: 200 });
    for (const r of rep.messages || []) {
      if (r.ts !== m.ts && (r.bot_id || r.user === botUser)) {
        const d = await api('chat.delete', { channel, ts: r.ts });
        if (d.ok) deleted++;
      }
    }
  }
  if (m.bot_id || m.user === botUser || m.subtype === 'bot_message') {
    const d = await api('chat.delete', { channel, ts: m.ts });
    if (d.ok) deleted++; else console.log('skip', m.ts, d.error);
  }
}
console.log('deleted bot messages:', deleted);
