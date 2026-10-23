import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charCount, fitDescription, fitTitle, langAlternates, SITE_TITLE, withSiteName } from '../seo';

test('a description that fits is returned whole, Bangla included', () => {
  // 159 characters as a reader counts them, far more in code points.
  const bn =
    'মুক্তিযুদ্ধ বিষয়ক মন্ত্রণালয় সম্পর্কিত স্থায়ী কমিটি: মুক্তিযুদ্ধ বিষয়ক মন্ত্রণালয়ের কাজ সংসদের পক্ষে তদারক করে; মন্ত্রণালয়ের বিল ও কাজকর্ম পর্যালোচনা করে, অনিয়ম ও গুরুতর অভিযোগ তদন্ত করে এবং সুপারিশ দেয়। সভাপতি মোঃ মনিরুল হক চৌধুরী, সদস্য ১০ জন।';
  assert.ok(charCount(bn) <= 160);
  assert.equal(fitDescription(bn), bn);
  assert.equal(fitDescription('A short one.'), 'A short one.');
});

test('a long description ends at the last sentence that fits', () => {
  const text =
    'Mymensingh district has 11 parliamentary seats; in the 13th Parliament the BNP holds 8, an independent 1, Bangladesh Khelafat Majlis 1 and Jamaat-e-Islami 1. The current Member of Parliament, party and area of each seat.';
  const out = fitDescription(text);
  assert.ok(charCount(out) <= 158);
  assert.ok(out.endsWith('Jamaat-e-Islami 1.'));
});

test('a full stop after an abbreviation is not a sentence end', () => {
  const text = `${'word '.repeat(18)}Dr. ${'more '.repeat(30)}end.`;
  const out = fitDescription(text);
  assert.ok(!out.endsWith('Dr.'));
  assert.ok(out.endsWith('…'));
});

test('without a sentence end, the cut is at a whole word, with no dangling "and"', () => {
  const text =
    'Mahdi Amin, Adviser to the Prime Minister (with the rank of a state minister); Ministry of Education, Ministry of Primary and Mass Education, Ministry of Expatriates Welfare and Overseas Employment, Ministry of Labour and Employment. Biography.';
  const out = fitDescription(text);
  assert.ok(charCount(out) <= 158);
  assert.ok(out.endsWith('…'));
  assert.ok(!/\s(and|of)…$/.test(out));
  assert.ok(text.startsWith(out.slice(0, -1)));
});

test('a title keeps the site name only while it fits in 60', () => {
  assert.equal(fitTitle('en', 'MP for Dhaka-17: Tarique Rahman'), 'MP for Dhaka-17: Tarique Rahman');
  assert.deepEqual(fitTitle('en', 'MP for Cox\'s Bazar-2: Alamgir Mohammed Mahfuz Ullah Farid'), {
    absolute: "MP for Cox's Bazar-2: Alamgir Mohammed Mahfuz Ullah Farid",
  });
  // The committee's tail goes before its name is left without the site's.
  assert.deepEqual(
    fitTitle('en', 'Standing Committee on Ministry of Law, Justice and Parliamentary Affairs: duties and members', 'Standing Committee on Ministry of Law'),
    'Standing Committee on Ministry of Law',
  );
  assert.equal(withSiteName('Tarique Rahman | MP for Dhaka-17', 'en'), 'Tarique Rahman | MP for Dhaka-17 | My MP');
  assert.equal(
    withSiteName('Mohammad Amin Ur Rashid | Minister for Fisheries and Livestock', 'en'),
    'Mohammad Amin Ur Rashid | Minister for Fisheries and Livestock',
  );
});

test('English pages are offered abroad, not to readers in Bangladesh', () => {
  const { canonical, languages } = langAlternates('bn', '/mp/tarique-rahman');
  assert.equal(canonical, '/mp/tarique-rahman');
  const l = languages as Record<string, string>;
  assert.equal(l['bn-BD'], '/mp/tarique-rahman');
  assert.equal(l['x-default'], '/mp/tarique-rahman');
  // A plain "en" would send everyone in Bangladesh with Google in English to the English page.
  assert.equal(l.en, undefined);
  assert.equal(l['en-BD'], undefined);
  assert.equal(l['en-GB'], '/en/mp/tarique-rahman');
  assert.equal(l['en-US'], '/en/mp/tarique-rahman');
  assert.equal(langAlternates('en', '/').canonical, '/en');
});

test('the Bangla home title carries "My MP" in Latin letters', () => {
  assert.ok(SITE_TITLE.startsWith('আমার এমপি (My MP)'));
  assert.ok(charCount(SITE_TITLE) <= 60);
});
