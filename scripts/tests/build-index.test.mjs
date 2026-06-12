import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from '../build-index.mjs';

test('compiles entries newest-first and validates required fields', () => {
  const entries = [
    { id: 'a', date: '2026-06-10', description: 'x', title: 'A', type: 'site', tags: {}, asset: 'assets/a.png' },
    { id: 'b', date: '2026-06-12', description: 'y', title: 'B', type: 'site', tags: {}, asset: 'assets/b.png' }
  ];
  const out = buildIndex(entries);
  assert.equal(out[0].id, 'b');
  assert.throws(() => buildIndex([{ id: 'c' }]), /missing required/);
});
