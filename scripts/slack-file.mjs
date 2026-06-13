// Download a Slack-uploaded file via the BOT token (needs the files:read scope).
// Replaces the old browser-session approach so file downloads work headless,
// including in Claude cloud. Pass the file's url_private (from slack-read.mjs).
//
// usage: node scripts/slack-file.mjs <url_private> <dest_path>
// dest_path may be relative (e.g. assets/x.png) — it resolves against the repo
// root, so this works from ANY working directory (no cd needed).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.SLACK_BOT_TOKEN?.trim()
  || (await readFile(new URL('../.slack-bot-token', import.meta.url), 'utf8')).trim();
const [url, destArg] = process.argv.slice(2);
if (!url || !destArg) { console.error('usage: slack-file.mjs <url_private> <dest_path>'); process.exit(1); }
const dest = path.isAbsolute(destArg) ? destArg : path.join(repo, destArg);

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
