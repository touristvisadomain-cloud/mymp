import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, hasMarkup } from '../text';

// Run with: npm test. The cases are what the feeds actually sent (2026-10-17).

test('tags and entities go, once or twice encoded', () => {
  assert.equal(cleanText('<p style="text-align: justify; ">দল-মত, ধর্ম-বর্ণ নির্বিশেষে</p>'), 'দল-মত, ধর্ম-বর্ণ নির্বিশেষে');
  assert.equal(cleanText('<p><span style="font-size: 1rem;">রাজউক উত্তরা মডেল কলেজ</span></p>'), 'রাজউক উত্তরা মডেল কলেজ');
  assert.equal(cleanText('&lt;p&gt;Twice &amp;amp; encoded&lt;/p&gt;'), 'Twice & encoded');
  assert.equal(cleanText('Canada keen to support BD’s oil, LNG supplies&nbsp;&nbsp;'), 'Canada keen to support BD’s oil, LNG supplies');
  assert.equal(cleanText('EUB&nbsp; hons cricket champs&nbsp;'), 'EUB hons cricket champs');
});

test('Bangla joiners come back as the characters, plain text is left alone', () => {
  assert.equal(cleanText('র&zwj;্যাব-১'), 'র‍্যাব-১');
  assert.equal(cleanText('তারেক রহমান: ঢাকা-১৭ <আসন>'), 'তারেক রহমান: ঢাকা-১৭ <আসন>');
  assert.equal(hasMarkup('plain text'), false);
  assert.equal(hasMarkup('a&nbsp;b'), true);
  assert.equal(hasMarkup('<p>x</p>'), true);
});
