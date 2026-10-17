import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  batches, decodeEntities, plainText, protectNames, translateTexts, translationProvider, validTranslation,
  TranslateError, type Glossary,
} from './translate';
import { feedToken } from './matchMp';

// Run with: npm test

const glossary: Glossary = {
  entries: [
    { tokens: ['তারেক', 'রহমান'].map(feedToken), en: 'Tarique Rahman', kind: 'member' },
    { tokens: ['সালাহউদ্দিন', 'আহমদ'].map(feedToken), en: 'Salahuddin Ahmed', kind: 'member' },
    { tokens: ['ঢাকা', '১৭'].map(feedToken), en: 'Dhaka-17', kind: 'seat' },
  ],
  nameWords: new Set(['তারেক', 'রহমান', 'সালাহউদ্দিন', 'আহমদ', 'মিজানুর'].map(feedToken)),
};

const provider = { name: 'google' as const, key: 'test-key' };

/** A stand-in for Google: answers each segment with `answer(segment)`, and records what it was asked. */
function fakeGoogle(answer: (segment: string, call: number) => string, opts: { status?: (call: number) => number; drop?: (call: number) => boolean } = {}) {
  const calls: { q: string[]; headers: Record<string, string>; url: string }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { q: string[]; source: string; target: string; format: string };
    assert.equal(body.source, 'bn');
    assert.equal(body.target, 'en');
    assert.equal(body.format, 'html');
    calls.push({ q: body.q, headers: init.headers as Record<string, string>, url });
    const call = calls.length;
    const status = opts.status?.(call) ?? 200;
    if (status !== 200) return new Response('{"error":{"message":"nope"}}', { status });
    const list = body.q.map((s) => ({ translatedText: answer(s, call) }));
    return Response.json({ data: { translations: opts.drop?.(call) ? list.slice(1) : list } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test('no key, no provider: translation is skipped', () => {
  assert.equal(translationProvider({}), null);
  assert.equal(translationProvider({ GOOGLE_TRANSLATE_KEY: '  ' }), null);
  assert.deepEqual(translationProvider({ GOOGLE_TRANSLATE_KEY: 'abc' }), { name: 'google', key: 'abc' });
});

test("members' names and seats go to Google as the site spells them, in spans it leaves alone", () => {
  assert.equal(
    protectNames('তারেক রহমানের সঙ্গে ঢাকা-১৭ আসনের ভোটারদের সাক্ষাৎ', glossary),
    `<span translate="no">Tarique Rahman's</span> সঙ্গে <span translate="no">Dhaka-17</span> আসনের ভোটারদের সাক্ষাৎ`,
  );
  // The object marker is dropped; an ending that carries meaning ("also") leaves the name to Google.
  assert.equal(protectNames('তারেক রহমানকে চিঠি', glossary), '<span translate="no">Tarique Rahman</span> চিঠি');
  assert.equal(protectNames('তারেক রহমানও যাবেন', glossary), 'তারেক রহমানও যাবেন');
});

test('a name inside a longer name, and a place and a date, are not taken for a member or a seat', () => {
  assert.equal(protectNames('মিজানুর তারেক রহমান', glossary), 'মিজানুর তারেক রহমান');
  assert.equal(protectNames('ঢাকা, ১৭ অক্টোবর', glossary), 'ঢাকা, ১৭ অক্টোবর');
});

test('the rest of the headline is escaped for HTML, and the answer comes back as plain text', () => {
  assert.equal(protectNames('বিএনপি & জামায়াত <সংলাপ>', glossary), 'বিএনপি &amp; জামায়াত &lt;সংলাপ&gt;');
  assert.equal(decodeEntities('A &amp; B &quot;C&quot; &#39;D&#39; &#8217; &#x2019; &unknown;'), 'A & B "C" \'D\' ’ ’ &unknown;');
  assert.equal(
    plainText('<span translate="no">Tarique Rahman</span> &#39;s meeting with <span translate="no">Dhaka-17</span> voters &amp; others .'),
    "Tarique Rahman's meeting with Dhaka-17 voters & others.",
  );
});

test('an answer is usable only when it has text and no Bangla left', () => {
  assert.equal(validTranslation('Prime Minister visits Sylhet'), true);
  assert.equal(validTranslation(''), false);
  assert.equal(validTranslation('   '), false);
  assert.equal(validTranslation('Prime Minister visits সিলেট'), false);
  assert.equal(validTranslation(null), false);
});

test('batches hold at most 40 headlines and 5,000 characters', () => {
  const items = Array.from({ length: 95 }, (_, i) => ({ html: 'x'.repeat(80), i }));
  assert.deepEqual(batches(items).map((b) => b.length), [40, 40, 15]);
  const long = Array.from({ length: 10 }, () => ({ html: 'x'.repeat(2000) }));
  assert.deepEqual(batches(long).map((b) => b.length), [2, 2, 2, 2, 2]);
});

test('translates in order, in batches, copies English headlines and sends the key in a header', async () => {
  const texts = [
    ...Array.from({ length: 45 }, (_, i) => `শিরোনাম ${i}`),
    'Speaker meets party leaders',
    null,
    'তারেক রহমানের সফর',
  ];
  const g = fakeGoogle((s) => s.replace('শিরোনাম', 'Headline').replace('সফর', 'visit'));
  const out = await translateTexts(texts, { provider, glossary, fetchImpl: g.impl, pauseMs: 0, retryMs: 0 });
  assert.equal(g.calls.length, 2);
  assert.deepEqual(g.calls.map((c) => c.q.length), [40, 6]);
  assert.equal(g.calls[0]!.headers['x-goog-api-key'], 'test-key');
  assert.ok(!g.calls[0]!.url.includes('test-key'));
  assert.deepEqual(out[0], { text: 'Headline 0', source: 'google' });
  assert.deepEqual(out[44], { text: 'Headline 44', source: 'google' });
  assert.deepEqual(out[45], { text: 'Speaker meets party leaders', source: 'original' });
  assert.equal(out[46], null);
  assert.deepEqual(out[47], { text: "Tarique Rahman's visit", source: 'google' });
});

test('a failed request is tried once more, then its headlines are left untranslated', async () => {
  const flaky = fakeGoogle((s) => s.replace('শিরোনাম', 'Headline'), { status: (call) => (call === 1 ? 503 : 200) });
  const ok = await translateTexts(['শিরোনাম'], { provider, fetchImpl: flaky.impl, pauseMs: 0, retryMs: 0 });
  assert.equal(flaky.calls.length, 2);
  assert.deepEqual(ok, [{ text: 'Headline', source: 'google' }]);

  const down = fakeGoogle(() => 'x', { status: () => 500 });
  assert.deepEqual(await translateTexts(['শিরোনাম'], { provider, fetchImpl: down.impl, pauseMs: 0, retryMs: 0 }), [null]);
  assert.equal(down.calls.length, 2);
});

test('an answer of the wrong length is a failure, not a misaligned list', async () => {
  const g = fakeGoogle((s) => `EN ${s.length}`, { drop: () => true });
  assert.deepEqual(await translateTexts(['এক', 'দুই'], { provider, fetchImpl: g.impl, pauseMs: 0, retryMs: 0 }), [null, null]);
  assert.equal(g.calls.length, 2);
});

test('an answer still in Bangla is asked for again on its own, then left', async () => {
  const g = fakeGoogle((s, call) => (s === 'দুই' && call === 1 ? 'দুই' : s === 'দুই' ? 'Two' : 'One'));
  const out = await translateTexts(['এক', 'দুই'], { provider, fetchImpl: g.impl, pauseMs: 0, retryMs: 0 });
  assert.deepEqual(out, [{ text: 'One', source: 'google' }, { text: 'Two', source: 'google' }]);
  assert.deepEqual(g.calls.map((c) => c.q), [['এক', 'দুই'], ['দুই']]);

  const stubborn = fakeGoogle((s) => (s === 'দুই' ? 'দুই' : 'One'));
  assert.deepEqual(await translateTexts(['এক', 'দুই'], { provider, fetchImpl: stubborn.impl, pauseMs: 0, retryMs: 0 }), [{ text: 'One', source: 'google' }, null]);
});

test('a refused key stops the run instead of failing every batch quietly', async () => {
  const g = fakeGoogle(() => 'x', { status: () => 403 });
  await assert.rejects(translateTexts(['এক'], { provider, fetchImpl: g.impl, pauseMs: 0, retryMs: 0 }), (e) => e instanceof TranslateError && e.fatal);
  assert.equal(g.calls.length, 1);
});
