// Download a Slack-uploaded file via the BOT token (needs the files:read scope).
// Replaces the old browser-session approach so file downloads work headless,
// including in Claude cloud. Pass the file's url_private (from slack-read.mjs).
//
// usage: node scripts/slack-file.mjs <url_private> <dest_path>
import { readFile, writeFile } from 'node:fs/promises';

const token = (await readFile(new URL('../.slack-bot-token', import.meta.url), 'utf8')).trim();
const [url, dest] = process.argv.slice(2);
if (!url || !dest) { console.error('usage: slack-file.mjs <url_private> <dest_path>'); process.exit(1); }

const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
if (!res.ok) { console.error('download failed:', res.status); process.exit(1); }

const ct = res.headers.get('content-type') || '';
const buf = Buffer.from(await res.arrayBuffer());
// Slack serves an HTML sign-in page (HTTP 200) when the token can't read the
// file — catch that so we never save a login page as if it were an image.
if (ct.includes('text/html')) {
  console.error('got an HTML page, not a file — the bot is likely missing the files:read scope');
  process.exit(1);
}
await writeFile(dest, buf);
console.log(`saved ${dest} (${ct}, ${buf.length} bytes)`);
