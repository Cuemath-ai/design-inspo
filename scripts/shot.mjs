// usage: node scripts/shot.mjs <url> <id> [--motion]
// writes assets/<id>.png always; assets/<id>.webm if --motion
// Paths resolve relative to this script, so it works from ANY working directory
// (the scheduled sweep never needs to `cd` into the repo).
import { chromium } from 'playwright';
import { rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assets = fileURLToPath(new URL('../assets/', import.meta.url));
const tmpDir = `${assets}.tmp-video`;

const [url, id] = process.argv.slice(2);
const motion = process.argv.includes('--motion');
if (!url || !id) { console.error('usage: shot.mjs <url> <id> [--motion]'); process.exit(1); }

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500); // let entrance animations settle
  await page.screenshot({ path: `${assets}${id}.png`, fullPage: true });
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
    await ctx.close();                       // finalizes the recording
    const tmp = await video.path();
    await rename(tmp, `${assets}${id}.webm`);
    await rm(tmpDir, { recursive: true, force: true });
  }
} finally { await browser.close(); }
console.log(`captured ${id}${motion ? ' (+motion)' : ''}`);
