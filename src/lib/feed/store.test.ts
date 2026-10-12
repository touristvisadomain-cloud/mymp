import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notLaterThanNow } from './store';

// Run with: npm test

const NOW = Date.parse('2026-10-12T05:07:00Z');

test('a story stamped hours ahead takes the time it was seen', () => {
  // The Daily Observer, 2026-10-12: Dhaka time written as UTC.
  assert.equal(notLaterThanNow('2026-10-12T08:41:43+00:00', NOW), '2026-10-12T05:07:00.000Z');
});

test('ordinary times pass unchanged, a few minutes of clock drift included', () => {
  assert.equal(notLaterThanNow('2026-10-12T04:30:00+00:00', NOW), '2026-10-12T04:30:00+00:00');
  assert.equal(notLaterThanNow('2026-10-12T05:12:00+00:00', NOW), '2026-10-12T05:12:00+00:00');
  assert.equal(notLaterThanNow('2026-10-12T10:41:22+06:00', NOW), '2026-10-12T10:41:22+06:00');
});

test('a time that does not parse is left for the caller to handle', () => {
  assert.equal(notLaterThanNow('not a date', NOW), 'not a date');
});
