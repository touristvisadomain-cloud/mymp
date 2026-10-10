import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS, dataDrop, dataDropError } from './dataFloor.mjs';

// Run with: npm test

test('an empty database under a full snapshot stops the build', () => {
  assert.match(dataDrop('admin corrections', 0, 3147, FLOORS.overrides) ?? '', /gave 0, the committed snapshot has 3147/);
  assert.ok(dataDrop('published vote counts', 0, 297, FLOORS.results));
  assert.ok(dataDrop('published news', 40, 230, FLOORS.news));
});

test('ordinary change passes', () => {
  assert.equal(dataDrop('admin corrections', 3150, 3147, FLOORS.overrides), null);
  assert.equal(dataDrop('admin corrections', 1600, 3147, FLOORS.overrides), null);
  assert.equal(dataDrop('published news', 115, 230, FLOORS.news), null);
});

test('a snapshot too small to judge by never stops anything', () => {
  assert.equal(dataDrop('admin corrections', 0, 99, FLOORS.overrides), null);
  assert.equal(dataDrop('published news', 0, 0, FLOORS.news), null);
});

test('the error is fatal, so --soft cannot swallow it', () => {
  const e = dataDropError('admin corrections: the database gave 0, the committed snapshot has 3147') as Error & { fatal?: boolean };
  assert.equal(e.fatal, true);
  assert.match(e.message, /ALLOW_DATA_DROP=1/);
});
