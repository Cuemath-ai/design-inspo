// Screenshot a URL into assets/<id>.png (+ optional motion clip). Works from any
// cwd (paths resolve from this file), so the silent sweep never needs to `cd`.
//
// usage: node scripts/shot.mjs <url> <id> [options]
//   --motion          also record a ~6s scrolling clip → assets/<id>.webm
//   --full            full-page still (whole layout) instead of one viewport
//   --scroll <0..1>   scroll to this fraction of the page before the still
//   --find "<text>"   scroll the first element containing <text> into view first
//
// Default still = the top viewport (the hero) at 1440×960 — a clean card shape.
// Use --find/--scroll to capture the part of the page the description points at
// (e.g. "footer", "pricing"), so the thumbnail shows what the user meant.
import { chromium } from 'playwright';
import { rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assets = fileURLToPath(new URL('../assets/', import.meta.url));
const tmpDir = `${assets}.tmp-video`;

const args = process.argv.slice(2);
const [url, id] = args;
const motion = args.includes('--motion');
const full = args.includes('--full');
const scrollFrac = args.includes('--scroll') ? parseFloat(args[args.indexOf('--scroll') + 1]) : null;
const findText = args.includes('--find') ? args[args.indexOf('--find') + 1] : null;
if (!url || !id) {
  console.error('usage: shot.mjs <url> <id> [--motion] [--full] [--scroll 0..1] [--find "text"]');
  process.exit(1);
}

// Best-effort: click a cookie/consent button so it doesn't wall the screenshot.
async function dismissOverlays(page) {
  for (const re of [/accept all/i, /accept/i, /agree/i, /got it/i, /allow all/i, /i agree/i]) {
    const btn = page.getByRole('button', { name: re }).first();
    if (await btn.count().catch(() => 0)) { await btn.click({ timeout: 1500 }).catch(() => {}); break; }
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await dismissOverlays(page).catch(() => {});
  await page.waitForTimeout(800);

  if (findText) {
    await page.evaluate(t => {
      const el = [...document.querySelectorAll('body *')]
        .find(n => n.offsetParent !== null && (n.textContent || '').trim().toLowerCase().includes(t.toLowerCase()));
      if (el) el.scrollIntoView({ block: 'center' });
    }, findText).catch(() => {});
    await page.waitForTimeout(700);
  } else if (scrollFrac != null && !Number.isNaN(scrollFrac)) {
    await page.evaluate(f => window.scrollTo(0, Math.max(0, (document.body.scrollHeight - window.innerHeight) * f)), scrollFrac).catch(() => {});
    await page.waitForTimeout(700);
  }

  await page.screenshot({ path: `${assets}${id}.png`, fullPage: full });
  await page.close();

  if (motion) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: tmpDir, size: { width: 1280, height: 800 } }
    });
    const mp = await ctx.newPage();
    await mp.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await mp.waitForTimeout(2000);
    await mp.evaluate(() => new Promise(done => {
      let y = 0; const step = () => {
        y += 14; window.scrollTo(0, y);
        if (y < window.innerHeight * 3) requestAnimationFrame(step); else done();
      }; step();
    })).catch(() => {});
    await mp.waitForTimeout(1000);
    const video = mp.video();
    await ctx.close();
    const tmp = await video.path();
    await rename(tmp, `${assets}${id}.webm`);
    await rm(tmpDir, { recursive: true, force: true });
  }
} finally { await browser.close(); }

console.log(`captured ${id}${full ? ' (full)' : ''}${findText ? ` @"${findText}"` : scrollFrac != null ? ` @${scrollFrac}` : ''}${motion ? ' (+motion)' : ''}`);
