// scripts/remove-entry.mjs <id> — delete an entry's JSON + its assets, from any
// cwd (resolves the repo from this file's location, so the silent sweep can call
// it without a `cd`). Used when a thread reply asks to remove an inspiration.
//
// usage: node scripts/remove-entry.mjs <id>
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
if (!id) { console.error('usage: remove-entry.mjs <id>'); process.exit(1); }

const targets = [
  `data/entries/${id}.json`,
  `assets/${id}.png`, `assets/${id}.webm`, `assets/${id}.mp4`,
  `assets/${id}.jpg`, `assets/${id}.jpeg`, `assets/${id}.gif`
];
const removed = [];
for (const t of targets) {
  try { await rm(path.join(repo, t)); removed.push(t); } catch { /* not present */ }
}
console.log(`removed: ${removed.join(', ') || '(nothing matched)'}`);
