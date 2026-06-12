import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryHaystack, expandQuery, scoreEntry } from '../../search.js';

const synonyms = { moody: ['dark', 'dramatic'], motion: ['animation', 'animated'] };
const entry = {
  title: 'Lusion', description: 'hero morphs on scroll',
  notes: [{ by: 'A', note: 'love the cursor' }],
  tags: { mood: ['dark', 'dramatic'], component: ['hero'], style: [], colour: [], medium: ['website'], industry: [] }
};

test('haystack folds title, description, notes, all tags', () => {
  const h = entryHaystack(entry);
  for (const word of ['lusion', 'morphs', 'cursor', 'dark', 'hero', 'website']) assert.ok(h.includes(word), word);
});

test('expandQuery adds synonyms both directions', () => {
  assert.ok(expandQuery('moody', synonyms).includes('dark'));      // key → values
  assert.ok(expandQuery('animated', synonyms).includes('motion')); // value → key
});

test('scoreEntry ranks matches and returns 0 for misses', () => {
  assert.ok(scoreEntry(entry, expandQuery('moody hero', synonyms)) > 0);
  assert.equal(scoreEntry(entry, expandQuery('spreadsheet', synonyms)), 0);
});
