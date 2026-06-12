import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REQUIRED = ['id', 'type', 'title', 'description', 'date', 'asset', 'tags'];

export function buildIndex(entries) {
  for (const e of entries) {
    const missing = REQUIRED.filter(k => e[k] === undefined || e[k] === null || e[k] === '');
    if (missing.length) throw new Error(`entry ${e.id ?? '?'} missing required: ${missing.join(', ')}`);
  }
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = new URL('../data/entries/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
  const entries = await Promise.all(files.map(async f => JSON.parse(await readFile(new URL(f, dir), 'utf8'))));
  const index = buildIndex(entries);
  await writeFile(new URL('../index.json', import.meta.url), JSON.stringify(index));
  console.log(`index.json: ${index.length} entries`);
}
