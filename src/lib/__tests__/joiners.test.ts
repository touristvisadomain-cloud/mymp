import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixJoiners } from '../joiners.mjs';

test('a stray joiner before a hasanta goes, so the conjunct is drawn', () => {
  // From the parliament's member list (2026-10-15): পেশা "ব‌্যবসা".
  assert.equal(fixJoiners('ব‌্যবসা'), 'ব্যবসা');
  assert.equal(fixJoiners('বেসরকারী সদস‌্যদের বিল'), 'বেসরকারী সদস্যদের বিল');
  assert.equal(fixJoiners('হোমিওপ‌্যাথি'), 'হোমিওপ্যাথি');
});

test('joiners at a word\'s edge go', () => {
  assert.equal(fixJoiners('আসেন‌‌'), 'আসেন');
  assert.equal(fixJoiners('কমিটির ‌১ম বৈঠক'), 'কমিটির ১ম বৈঠক');
});

test('a deliberate joiner stays', () => {
  // An explicit hasanta, and র with য-ফলা rather than a reph.
  assert.equal(fixJoiners('মাহ্‌দী'), 'মাহ্‌দী');
  assert.equal(fixJoiners('র‌্যাব'), 'র‌্যাব');
  assert.equal(fixJoiners('ব্যবসা'), 'ব্যবসা');
});
