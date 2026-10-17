/**
 * The English pages show a story's English headline, from fixture stories
 * shaped as the feed produces them (lib/feed/storyView.ts toStory), and the
 * Bangla pages show exactly what they always did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StoryCard from '@/components/StoryCard';
import { LangProvider } from '@/i18n/client';
import { toStory } from '../storyView';
import { storyIn, feedInEnglish } from '@/lib/app/news';
import { englishHeadline, anyMachine, MACHINE_TITLE } from '@/lib/headline';
import type { LatestEntry } from '../store';

// Run with: npm test

const entry = (over: Partial<LatestEntry>): LatestEntry => ({
  id: 103903,
  type: 'news',
  title: 'তারেক রহমানের ভারত সফর হবে, তবে তারিখ ঠিক হয়নি',
  url: 'https://example.com/story',
  summary: null,
  outletName: 'প্রথম আলো',
  thumbnailUrl: null,
  durationSeconds: null,
  publishedAt: '2026-10-16T05:00:00+00:00',
  alsoIn: [{ outletName: 'সমকাল', url: 'https://example.com/other' }],
  pinned: false,
  lowConfidence: false,
  titleEn: "Tarique Rahman's India visit will happen, but the date is not fixed",
  summaryEn: null,
  mpIds: [],
  ...over,
});

const render = (lang: 'bn' | 'en', s: ReturnType<typeof toStory>) =>
  renderToStaticMarkup(createElement(LangProvider, { lang } as Parameters<typeof LangProvider>[0], createElement(StoryCard, { s })));

test('an English page shows the English headline, with the machine-translation tooltip', () => {
  const html = render('en', toStory(entry({})));
  assert.match(html, /Tarique Rahman&#x27;s India visit will happen, but the date is not fixed/);
  assert.ok(html.includes(`title="${MACHINE_TITLE}"`));
  assert.ok(!html.includes('তারেক রহমানের ভারত সফর'), 'the Bangla headline is not on the English card');
});

test('an English page shows a headline not yet translated in Bangla, marked as Bangla', () => {
  const html = render('en', toStory(entry({ titleEn: null })));
  assert.match(html, /lang="bn"[^>]*>তারেক রহমানের ভারত সফর হবে, তবে তারিখ ঠিক হয়নি</);
  assert.ok(!html.includes(MACHINE_TITLE));
});

test('a Bangla page is the same whether or not the story has English', () => {
  assert.equal(render('bn', toStory(entry({}))), render('bn', toStory(entry({ titleEn: null }))));
  assert.ok(!render('bn', toStory(entry({}))).includes('Tarique'));
});

test("an outlet's own English is shown as it is and not called a machine translation", () => {
  const own = 'Speaker meets party leaders';
  assert.deepEqual(englishHeadline(own, own), { text: own, lang: undefined, machine: false });
  assert.equal(anyMachine([{ title: own, titleEn: own }]), false);
  assert.equal(anyMachine([{ title: 'বাংলা', titleEn: null }, { title: 'বাংলা', titleEn: 'Bangla' }]), true);
});

test('the app API: English in title, the original beside it, Bangla answers unchanged but for titleEn', () => {
  const s = toStory(entry({}));
  const en = storyIn(s, 'en') as unknown as { lead: Record<string, unknown>; also: Record<string, unknown>[] };
  assert.equal(en.lead.title, "Tarique Rahman's India visit will happen, but the date is not fixed");
  assert.equal(en.lead.titleOriginal, 'তারেক রহমানের ভারত সফর হবে, তবে তারিখ ঠিক হয়নি');
  assert.equal(en.lead.titleTranslated, true);
  assert.equal(en.also[0]!.title, en.lead.title);

  const untranslated = storyIn(toStory(entry({ titleEn: null })), 'en') as unknown as { lead: Record<string, unknown> };
  assert.equal(untranslated.lead.title, 'তারেক রহমানের ভারত সফর হবে, তবে তারিখ ঠিক হয়নি');
  assert.equal(untranslated.lead.titleTranslated, false);

  const bn = storyIn(s, 'bn');
  assert.equal(bn.lead.title, 'তারেক রহমানের ভারত সফর হবে, তবে তারিখ ঠিক হয়নি');
  assert.equal(bn.lead.titleEn, "Tarique Rahman's India visit will happen, but the date is not fixed");
});

test("the member feed's English answer puts the English in title and summary", () => {
  const body = feedInEnglish({ items: [{ title: 'শিরোনাম', titleEn: 'Headline', summary: 'সারাংশ', summaryEn: null, outletName: 'প্রথম আলো', alsoIn: [] }] });
  const item = (body.items as Record<string, unknown>[])[0]!;
  assert.equal(item.title, 'Headline');
  assert.equal(item.titleOriginal, 'শিরোনাম');
  assert.equal(item.titleTranslated, true);
  assert.equal(item.summary, 'সারাংশ');
  assert.equal(item.summaryTranslated, false);
});
