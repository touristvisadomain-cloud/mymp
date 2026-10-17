/**
 * Bangla headlines into English, for the English pages.
 *
 * The provider is Google Cloud Translation, Basic edition (v2 REST), chosen by
 * the environment: with `GOOGLE_TRANSLATE_KEY` set, headlines are sent to
 * https://translation.googleapis.com/language/translate/v2 (source bn, target
 * en); without it nothing is translated and nothing breaks, the English pages
 * show the Bangla as they always did.
 *
 * Only the headline (and, with FEED_TRANSLATE_SUMMARIES=1, the outlet's
 * summary) is sent: public text the outlets published. Nothing about readers.
 *
 * Names stay as the site spells them. Before sending, every member's name and
 * every seat the headline names is replaced by the site's English inside
 * `<span translate="no">…</span>`, and the text goes as HTML, which Google
 * leaves alone inside such a span. The spans are stripped from the answer and
 * the HTML entities decoded, so what is stored is plain text.
 *
 * What comes back is checked: one answer per headline, none empty, no Bangla
 * script left in any. A batch that fails is tried once more; a headline whose
 * answer is still unusable is left untranslated (the caller records that, so
 * it is not asked for on every run).
 *
 * This module reads no site data and no database, so it can be tested alone;
 * src/lib/feed/translateGlossary.ts builds the names, translateRun.ts the runs.
 */
import { feedToken } from './matchMp';

const BANGLA = /[ঀ-৿]/;

/** Does the text have any Bangla in it? A headline without is copied as it is. */
export const hasBangla = (s: string | null | undefined): boolean => !!s && BANGLA.test(s);

export const GOOGLE_V2 = 'https://translation.googleapis.com/language/translate/v2';

/** Headlines per request, and characters per request (Google recommends at most 5,000; it takes 128 segments). */
export const BATCH_SIZE = 40;
export const BATCH_CHARS = 5000;
/** A pause between requests, so a backfill of thousands is a steady trickle. */
export const PAUSE_MS = 250;

export interface Provider {
  name: 'google';
  key: string;
}

/** The provider the environment configures, or null: then translation is skipped. */
export function translationProvider(env: Record<string, string | undefined> = process.env): Provider | null {
  const key = env.GOOGLE_TRANSLATE_KEY?.trim();
  return key ? { name: 'google', key } : null;
}

/** Summaries too? They are not shown on the site's pages, and they are long, so only when asked for. */
export const translateSummaries = (env: Record<string, string | undefined> = process.env) => env.FEED_TRANSLATE_SUMMARIES === '1';

/* ---------------------------------------------------------------- names kept as the site spells them */

/** A name the site already has in English: its words, folded as the matcher folds them. */
export interface GlossaryEntry {
  tokens: string[];
  en: string;
  kind: 'member' | 'seat';
}

export interface Glossary {
  entries: GlossaryEntry[];
  /**
   * Every word of every member's name. A match with one of these right before
   * it is part of somebody else's longer name ("মনোয়ার হোসেন চৌধুরী" is not
   * "হোসেন চৌধুরী"), and is left for the translator.
   */
  nameWords: Set<string>;
}

export const emptyGlossary = (): Glossary => ({ entries: [], nameWords: new Set() });

/**
 * Case endings after a name, folded as feedToken folds them, and what the
 * English takes instead: the possessive becomes "'s", the object marker
 * nothing. Any other ending ("ও", "ই": also, only) carries meaning a bare name
 * would lose, so that name is left for Google to translate whole.
 */
const ENDINGS: Record<string, string> = {
  '': '',
  'র': "'s",
  'ের': "'s",
  'এর': "'s",
  'যের': "'s",
  'দের': "'s",
  'কে': '',
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Word { start: number; end: number; token: string }

/** The words of a headline with where each sits, folded as the matcher folds them. */
function words(text: string): Word[] {
  const out: Word[] = [];
  for (const m of text.matchAll(/[\p{L}\p{M}\p{N}​-‍﻿]+/gu)) {
    const token = feedToken(m[0]);
    if (token) out.push({ start: m.index!, end: m.index! + m[0].length, token });
  }
  return out;
}

/**
 * The headline as HTML for Google, with every name the glossary knows
 * wrapped as `<span translate="no">English</span>`. Longer names are tried
 * first, and a word is wrapped at most once.
 */
export function protectNames(text: string, glossary: Glossary): string {
  const ws = words(text);
  const taken: { from: number; to: number; html: string }[] = [];
  const claimed = new Set<number>();
  const entries = [...glossary.entries].sort((a, b) => b.tokens.length - a.tokens.length);

  for (const e of entries) {
    const n = e.tokens.length;
    if (n < 1) continue;
    for (let i = 0; i + n <= ws.length; i++) {
      let ending: string | undefined = '';
      for (let j = 0; j < n; j++) {
        const w = ws[i + j]!;
        const t = e.tokens[j]!;
        if (claimed.has(i + j)) { ending = undefined; break; }
        if (w.token === t) continue;
        // Only the last word of a member's name takes a case ending.
        if (j === n - 1 && e.kind === 'member' && w.token.startsWith(t) && w.token.slice(t.length) in ENDINGS) {
          ending = ENDINGS[w.token.slice(t.length)];
          continue;
        }
        ending = undefined;
        break;
      }
      if (ending === undefined) continue;
      const first = ws[i]!;
      const last = ws[i + n - 1]!;
      if (e.kind === 'member') {
        // Part of a longer name: somebody else.
        const before = ws[i - 1];
        if (before && glossary.nameWords.has(before.token) && /^\s+$/.test(text.slice(before.end, first.start))) continue;
        const after = ws[i + n];
        if (after && glossary.nameWords.has(after.token) && /^\s+$/.test(text.slice(last.end, after.start))) continue;
      } else {
        // A seat is written "ঢাকা-১৭": the words joined by a hyphen, not "ঢাকা, ১৭ অক্টোবর".
        let joined = true;
        for (let j = 1; j < n; j++) if (!/^\s*[-‐–]\s*$/.test(text.slice(ws[i + j - 1]!.end, ws[i + j]!.start))) joined = false;
        if (!joined) continue;
      }
      for (let j = 0; j < n; j++) claimed.add(i + j);
      taken.push({ from: first.start, to: last.end, html: `<span translate="no">${escapeHtml(e.en + ending)}</span>` });
    }
  }

  taken.sort((a, b) => a.from - b.from);
  let out = '';
  let at = 0;
  for (const t of taken) {
    out += escapeHtml(text.slice(at, t.from)) + t.html;
    at = t.to;
  }
  return out + escapeHtml(text.slice(at));
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' };

/** HTML entities to characters: &amp;, &quot;, &#39;, &#8217;, &#x2019; and the common named ones. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Google's HTML answer as plain text: the spans and any other tags gone, the entities decoded. */
export function plainText(html: string): string {
  return decodeEntities(html.replace(/<\/?[a-z][^>]*>/gi, ''))
    .replace(/\s+/g, ' ')
    // A span that ended in "'s" may come back with a space before it.
    .replace(/\s+'s\b/g, "'s")
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();
}

/** An answer worth storing: some text, and not a letter of Bangla left in it. */
export const validTranslation = (s: string | null | undefined): s is string => !!s && s.trim().length > 0 && !hasBangla(s);

/* ---------------------------------------------------------------- Google */

export class TranslateError extends Error {
  /** True when retrying cannot help (a refused or missing key): the run stops. */
  constructor(message: string, public fatal: boolean) {
    super(message);
  }
}

type Fetch = typeof fetch;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One request: HTML segments in, Google's HTML answers out, one per segment in
 * the same order. Throws on an HTTP error or an answer of the wrong length.
 */
async function googleOnce(segments: string[], key: string, fetchImpl: Fetch): Promise<string[]> {
  const res = await fetchImpl(GOOGLE_V2, {
    method: 'POST',
    // The key goes in a header rather than the address, so it is in no log of URLs.
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-goog-api-key': key },
    body: JSON.stringify({ q: segments, source: 'bn', target: 'en', format: 'html' }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 400 with a bad key, 401/403 when the key is refused or the API is not enabled.
    const fatal = res.status === 401 || res.status === 403 || (res.status === 400 && /api key|API_KEY/i.test(body));
    throw new TranslateError(`Google Translate answered ${res.status}: ${body.slice(0, 200)}`, fatal);
  }
  const json = (await res.json()) as { data?: { translations?: { translatedText?: unknown }[] } };
  const list = json.data?.translations;
  if (!Array.isArray(list) || list.length !== segments.length) {
    throw new TranslateError(`Google Translate sent ${Array.isArray(list) ? list.length : 'no'} answers for ${segments.length} headlines`, false);
  }
  return list.map((t) => (typeof t.translatedText === 'string' ? t.translatedText : ''));
}

/** One request, and once more after a pause if it fails for a reason that may pass. */
async function googleWithRetry(segments: string[], key: string, fetchImpl: Fetch, retryMs: number): Promise<string[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await googleOnce(segments, key, fetchImpl);
    } catch (e) {
      if (e instanceof TranslateError && e.fatal) throw e;
      if (attempt === 1) return null;
      await sleep(retryMs);
    }
  }
  return null;
}

export interface TranslateOptions {
  provider: Provider;
  glossary?: Glossary;
  fetchImpl?: Fetch;
  pauseMs?: number;
  /** The wait before a failed request is tried again (default a second). */
  retryMs?: number;
  /** Stop starting new requests after this time (Date.now() value); the rest come back null. */
  deadline?: number;
}

/** What became of one text: English and who wrote it, or null when it could not be translated. */
export type Translated = { text: string; source: 'google' | 'original' } | null;

/** Batches of at most BATCH_SIZE segments and BATCH_CHARS characters. */
export function batches<T extends { html: string }>(items: T[], size = BATCH_SIZE, chars = BATCH_CHARS): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let n = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= size || n + it.html.length > chars)) {
      out.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(it);
    n += it.html.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Translates texts, in order. A text with no Bangla in it (an outlet that
 * publishes in English) is copied as it is; an empty one stays null.
 */
export async function translateTexts(texts: (string | null | undefined)[], opts: TranslateOptions): Promise<Translated[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const pauseMs = opts.pauseMs ?? PAUSE_MS;
  const retryMs = opts.retryMs ?? 1000;
  const glossary = opts.glossary ?? emptyGlossary();
  const out: Translated[] = texts.map((t) => (t && t.trim() && !hasBangla(t) ? { text: t.trim(), source: 'original' } : null));
  const todo = texts
    .map((t, i) => ({ i, text: t ?? '' }))
    .filter((x) => hasBangla(x.text))
    .map((x) => ({ ...x, html: protectNames(x.text.trim(), glossary) }));

  let first = true;
  for (const batch of batches(todo)) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    if (!first) await sleep(pauseMs);
    first = false;
    const answers = await googleWithRetry(batch.map((b) => b.html), opts.provider.key, fetchImpl, retryMs);
    if (!answers) continue;
    const bad: typeof batch = [];
    batch.forEach((b, k) => {
      const text = plainText(answers[k] ?? '');
      if (validTranslation(text)) out[b.i] = { text, source: 'google' };
      else bad.push(b);
    });
    // An unusable answer is asked for once more on its own; then it is left.
    if (bad.length && !(opts.deadline && Date.now() > opts.deadline)) {
      await sleep(pauseMs);
      const again = await googleWithRetry(bad.map((b) => b.html), opts.provider.key, fetchImpl, retryMs).catch((e) => {
        if (e instanceof TranslateError && e.fatal) throw e;
        return null;
      });
      bad.forEach((b, k) => {
        const text = plainText(again?.[k] ?? '');
        if (validTranslation(text)) out[b.i] = { text, source: 'google' };
      });
    }
  }
  return out;
}

/** How many characters a set of texts costs to translate: what Google bills, the HTML of the kept names included. */
export function billableChars(texts: (string | null | undefined)[], glossary: Glossary = emptyGlossary()): number {
  return texts.reduce((n, t) => n + (hasBangla(t) ? protectNames(t!.trim(), glossary).length : 0), 0);
}
