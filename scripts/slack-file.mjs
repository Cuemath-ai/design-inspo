// usage: node scripts/slack-file.mjs <file_id> <out_path>
// Downloads a Slack file upload. First run opens a browser window — log into
// cuemath.slack.com once; a session token is saved to .slack-auth.json
// (gitignored) and all later runs are headless and instant. If the token
// expires, the window opens again automatically.
import { readFile, writeFile } from 'node:fs/promises';

const [fileId, outPath] = process.argv.slice(2);
if (!fileId || !outPath) { console.error('usage: slack-file.mjs <file_id> <out_path>'); process.exit(1); }

async function harvestAuth() {
  const { chromium } = await import('playwright');
  const ctx = await chromium.launchPersistentContext('.browser-profile', {
    headless: false, viewport: { width: 1200, height: 800 }
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto('https://cuemath.slack.com', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('Log into Slack in the browser window (workspace: cuemath)…');
  // wait for the session cookie that appears once login completes (up to 5 min)
  let d;
  for (let i = 0; i < 150 && !d; i++) {
    d = (await ctx.cookies('https://cuemath.slack.com')).find(c => c.name === 'd');
    if (!d) await new Promise(r => setTimeout(r, 2000));
  }
  if (!d) throw new Error('Slack login timed out');
  // boot the web client (not the desktop-app handoff page) to read the API token
  await page.goto('https://app.slack.com/client', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForFunction(() => !!localStorage.getItem('localConfig_v2'), { timeout: 120000 });
  const token = await page.evaluate(
    () => Object.values(JSON.parse(localStorage.getItem('localConfig_v2')).teams)[0].token
  );
  await ctx.close();
  const auth = { token, cookie: `d=${d.value}` };
  await writeFile(new URL('../.slack-auth.json', import.meta.url), JSON.stringify(auth));
  return auth;
}

let auth;
try { auth = JSON.parse(await readFile(new URL('../.slack-auth.json', import.meta.url), 'utf8')); }
catch { auth = await harvestAuth(); }

const headers = () => ({ Authorization: `Bearer ${auth.token}`, Cookie: auth.cookie });

async function fileInfo() {
  const r = await fetch(`https://cuemath.slack.com/api/files.info?file=${fileId}`, { headers: headers() });
  return r.json();
}

let info = await fileInfo();
if (!info.ok && ['invalid_auth', 'not_authed', 'token_expired'].includes(info.error)) {
  auth = await harvestAuth();
  info = await fileInfo();
}
if (!info.ok) { console.error(`files.info failed: ${info.error}`); process.exit(1); }

const url = info.file.url_private_download || info.file.url_private;
const resp = await fetch(url, { headers: headers() });
if (!resp.ok) { console.error(`download failed: HTTP ${resp.status}`); process.exit(1); }
await writeFile(outPath, Buffer.from(await resp.arrayBuffer()));
console.log(`saved ${outPath} (${info.file.mimetype}, ${info.file.size} bytes)`);
