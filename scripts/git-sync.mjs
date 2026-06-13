// scripts/git-sync.mjs — git pull / publish for the repo, from ANY cwd.
// Uses `git -C <repo>` so the sweep never needs to `cd` (the one shell pattern
// that can't be auto-approved). Resolves the repo from this script's location.
//
// usage: node scripts/git-sync.mjs pull
//        node scripts/git-sync.mjs publish "commit message"
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });

const [cmd, msg] = process.argv.slice(2);

if (cmd === 'pull') {
  process.stdout.write(git(['pull', '--no-edit']));
} else if (cmd === 'publish') {
  git(['add', '-A']);
  if (!git(['status', '--porcelain']).trim()) { console.log('nothing to publish'); process.exit(0); }
  git(['commit', '-m', msg || 'sweep update']);
  process.stdout.write(git(['push']));
  console.log('published');
} else {
  console.error('usage: git-sync.mjs pull | publish "<msg>"');
  process.exit(1);
}
