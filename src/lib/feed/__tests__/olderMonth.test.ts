import { test } from 'node:test';
import assert from 'node:assert/strict';
import { olderMonth } from '../collectors';

test('older video searches walk the window month by month, never this month', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  const seen = new Set<string>();
  for (let t = 0; t < 10; t++) seen.add(olderMonth(t, now)!.after.slice(0, 7));
  assert.deepEqual([...seen].sort(), ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  assert.deepEqual(olderMonth(10, now), olderMonth(0, now));
  assert.equal(olderMonth(9, now)!.before, '2026-10-01T00:00:00.000Z');
});
