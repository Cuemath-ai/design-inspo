// Inspo bot — posts/reacts via the Slack bot token (gitignored .slack-bot-token).
// Reading the channel still happens through the Claude Slack connector during
// the sweep; only OUTBOUND actions (confirmations, nudges, digest, ✅) go here,
// so they appear as "Inspo" instead of a person.
//
// usage:
//   node scripts/bot.mjs post   <channel> "<text>" [thread_ts]
//   node scripts/bot.mjs react  <channel> <message_ts> <emoji>
import { readFile } from 'node:fs/promises';

const token = process.env.SLACK_BOT_TOKEN?.trim()
  || (await readFile(new URL('../.slack-bot-token', import.meta.url), 'utf8')).trim();

async function slack(method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json.ok) { console.error(`${method} error:`, json.error); process.exit(1); }
  return json;
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'post') {
  const [channel, text, thread_ts] = rest;
  const body = { channel, text };
  if (thread_ts) body.thread_ts = thread_ts;
  const r = await slack('chat.postMessage', body);
  console.log('posted', r.ts);
} else if (cmd === 'react') {
  const [channel, timestamp, name] = rest;
  await slack('reactions.add', { channel, timestamp, name: name.replace(/:/g, '') });
  console.log('reacted', name);
} else {
  console.error('usage: bot.mjs post <channel> "<text>" [thread_ts]  |  bot.mjs react <channel> <ts> <emoji>');
  process.exit(1);
}
