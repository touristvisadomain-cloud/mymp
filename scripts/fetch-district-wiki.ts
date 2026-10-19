/**
 * Each district's description from Wikipedia, in Bangla and English, for the
 * district pages: the opening of the district's article, and from its
 * sections the naming, history, geography, people, economy and culture in a
 * few sentences each, and lists of its places to see, rivers and notable
 * people. Wikipedia's text is CC BY-SA 4.0; the page names and links the
 * article beside it. Written to data/district-wiki.json; run again by hand
 * when the articles should be refreshed:
 *
 *   npx tsx scripts/fetch-district-wiki.ts
 *
 * A district whose article cannot be found is left out and listed; its page
 * then shows the site's own paragraph alone.
 */
import fs from 'node:fs';
import { districtList } from '../src/lib/districts';

const UA = { 'User-Agent': 'mymp-build/1.0 (https://mymp.bd; district descriptions)' };

/** Article titles where the site's spelling differs from Wikipedia's. */
const EN_TITLE: Record<string, string> = {
  chattogram: 'Chittagong District',
  'coxs-bazar': "Cox's Bazar District",
  jaipurhat: 'Joypurhat District',
  gopalgonj: 'Gopalganj District, Bangladesh',
  jashore: 'Jessore District',
  bogura: 'Bogra District',
  barishal: 'Barisal District',
  cumilla: 'Comilla District',
  maulvibazar: 'Moulvibazar District',
  jhalokathi: 'Jhalokati District',
  chapainawabganj: 'Chapai Nawabganj District',
  rangamati: 'Rangamati Hill District',
  khagrachhari: 'Khagrachhari District',
  bandarban: 'Bandarban District',
  laxmipur: 'Lakshmipur District',
  netrokona: 'Netrokona District',
  dinajpur: 'Dinajpur District, Bangladesh',
};
const BN_TITLE: Record<string, string> = {
  rangamati: 'রাঙ্গামাটি পার্বত্য জেলা',
  khagrachhari: 'খাগড়াছড়ি জেলা',
  bandarban: 'বান্দরবান জেলা',
  'coxs-bazar': 'কক্সবাজার জেলা',
  chapainawabganj: 'চাঁপাইনবাবগঞ্জ জেলা',
  madaripur: 'মাদারীপুর জেলা',
};

/**
 * The sections a district page shows, in this order, found by their
 * headings in either language. `list`: the section is a list of names.
 */
const SECTIONS: { key: string; bn: RegExp; en: RegExp; list?: boolean; max?: number }[] = [
  { key: 'name', bn: /নামকরণ|নামের উৎপত্তি|নামের ইতিহাস/, en: /^Etymology|^Name/i, max: 420 },
  { key: 'history', bn: /^ইতিহাস/, en: /^History/i, max: 620 },
  { key: 'geography', bn: /অবস্থান|আয়তন|ভূ-?প্রকৃতি|ভৌগোলিক|ভূগোল/, en: /^Geography|^Location/i, max: 420 },
  { key: 'people', bn: /^জনসংখ্যা|জনসংখ্যার উপাত্ত|জনমিতি/, en: /^Demographics|^Population/i, max: 380 },
  { key: 'economy', bn: /^অর্থনীতি|^কৃষি|শিল্প ও বাণিজ্য/, en: /^Economy/i, max: 460 },
  { key: 'culture', bn: /সংস্কৃতি|ঐতিহ্য|উৎসব|খাদ্যাভ্যাস/, en: /^Culture/i, max: 380 },
  { key: 'places', bn: /চিত্তাকর্ষক|দর্শনীয়|উল্লেখযোগ্য স্থান|ঐতিহাসিক স্থা|পর্যটন|প্রত্নতাত্ত্বিক/, en: /Points of interest|Tourism|Tourist|Places of interest|Attractions/i, list: true },
  { key: 'rivers', bn: /নদ-?নদী|^নদী|প্রধান নদী|নদনদী/, en: /^Rivers/i, list: true },
  { key: 'notable', bn: /ব্যক্তিত্ব|ব্যক্তিবর্গ|কৃতী|বিশিষ্ট ব্যক্তি/, en: /Notable (people|persons|residents|personalities)/i, list: true },
];

export interface WikiSection { key: string; title: string; text?: string; items?: string[] }
interface Lead { text: string; url: string; title: string; sections?: WikiSection[] }

async function article(host: string, title: string): Promise<{ title: string; url: string; text: string } | null> {
  const u = `https://${host}/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&exsectionformat=wiki&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const j = (await (await fetch(u, { headers: UA })).json()) as { query?: { pages?: Record<string, { title: string; fullurl?: string; extract?: string; missing?: string }> } };
      const p = Object.values(j.query?.pages ?? {})[0];
      if (!p || p.missing !== undefined || !p.extract || !p.fullurl) return null;
      return { title: p.title, url: p.fullurl, text: p.extract };
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

interface Part { head: string; level: number; body: string }

/** The article split at every heading, each part with its level ("== ইতিহাস ==" 2, "=== নামকরণ ===" 3); the lead first. */
function split(text: string): Part[] {
  const out: Part[] = [{ head: '', level: 1, body: '' }];
  for (const line of text.split('\n')) {
    const h = /^(={2,})\s*(.+?)\s*\1\s*$/.exec(line.trim());
    if (h) out.push({ head: h[2]!, level: h[1]!.length, body: '' });
    else out[out.length - 1]!.body += `${line}\n`;
  }
  return out;
}

/** A part's body with its sub-parts' (the rivers of each upazila under "নদী"). */
function withChildren(parts: Part[], i: number): string {
  let body = parts[i]!.body;
  for (let k = i + 1; k < parts.length && parts[k]!.level > parts[i]!.level; k++) body += parts[k]!.body;
  return body;
}

/** Prose lines only: a heading or a list line has no full stop. The lead's lines may run on. */
const prose = (body: string, lead = false) =>
  body
    .split('\n')
    .map((l) => l.trim())
    // A paragraph may end in the colon that opens a list ("গড়গুলো হলো:"); cut() drops that sentence.
    .filter((l) => l && !/^=+.*=+$/.test(l) && (lead || /[।.!?]$/.test(l) || (l.length > 80 && /[।!?]|\.\s/.test(l))))
    .join(' ');

/** A section's list: its short lines without a full stop, each a name. */
function listOf(body: string, bangla: boolean): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of body.split('\n')) {
    const l = raw.replace(/[​-‍﻿]/g, '').trim().replace(/^[-•*·–\d০-৯.)\s]+/, '').replace(/\s*\([^()]*\)/g, '').replace(/[,;।.:ঃ]+$/, '').trim();
    if (!l || /^=+/.test(raw.trim()) || l.length < 3 || l.length > 70) continue;
    // A sentence or a sub-heading is not a name.
    if (/[।]/.test(l) || (!bangla && /\.\s/.test(l)) || /[ঃ:]$/.test(raw.trim())) continue;
    if (seen.has(l)) continue;
    seen.add(l);
    items.push(l);
    if (items.length >= 12) break;
  }
  return items;
}

/** Text cut at a sentence end, no longer than `max` characters; never mid-sentence. */
function cut(text: string, bangla: boolean, drop: string[] = [], max = 640): string {
  // Brackets go, innermost first: "(Bengali: …)", "(1,234 km2 (476 sq mi))", pronunciations.
  let clean = text;
  for (let i = 0; i < 3; i++) clean = clean.replace(/\s*\([^()]*\)/g, '');
  clean = clean
    .replace(/\s*\/\s*-?[\d.]+;\s*-?[\d.]+/g, '') // "২৬.২৫° উত্তর ৮৮.৫০° পূর্ব / 26.25; 88.50"
    .replace(/[^।.!?]*(?:\.\.\.|…)\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.।])/g, '$1')
    .trim();
  // Split after a sentence's end, never inside a number ("3,291.42").
  const sentences = clean.split(bangla ? /(?<=[।!?])\s*/ : /(?<=[.!?])\s+(?=[A-Z"'“])/).map((s) => `${s} `);
  let out = '';
  for (const s of sentences.filter(
    (x) =>
      // A sentence that opens a list ("এগুলো হচ্ছেঃ …") has lost its list.
      !/(?:হচ্ছে|হলো|নিম্নরূপ)\s*[ঃ:]/.test(x) &&
      !/[ঃ:]\s*$/.test(x) &&
      !drop.some((d) => x.includes(d)) &&
      x.trim().length > 30 &&
      !/^[\d০-৯]+[.)]/.test(x.trim()),
  )) {
    if (out && (out + s).length > max) break;
    out += s;
  }
  return out.trim();
}

/**
 * Sentences and list lines left out, read 2026-10-19: opinion, vandalism,
 * figures the articles get wrong ("44,959 square kilometres" for Bagerhat),
 * or advertising. Matched by a piece of the text.
 */
const DROP: Record<string, string[]> = {
  chuadanga: ['জীবন যাত্রার মান', 'জীবিকার তাগিদে', 'ঝুঁকিপূর্ণ'],
  meherpur: ['কারণ এটি একটি জেলা', 'প্রশাসনিক অঞ্চল বলতে'],
  bagerhat: ['44,959', 'it is good', 'বঙ্গবসাগরেের'],
  narail: ['smart app', 'Where people', 'DSSR'],
  magura: ['dristic', 'Shakib'],
  shariatpur: ['আজ আর চাঁদ রায়'],
};

/** Every word an opinion or an advertisement slips in with: such sentences go everywhere. */
const NEVER = ['সবচেয়ে সুন্দর', 'অপরূপ', 'মনোমুগ্ধকর', 'best ', 'beautiful', 'click', 'www.', 'http'];

function describe(a: { title: string; url: string; text: string }, bangla: boolean, drop: string[]): Lead {
  const parts = split(a.text);
  const leadText = cut(prose(parts[0]!.body, true), bangla, drop);
  const used = new Set<number>();
  const sections: WikiSection[] = [];
  for (const s of SECTIONS) {
    const i = parts.findIndex((p, k) => k > 0 && !used.has(k) && (bangla ? s.bn : s.en).test(p.head));
    if (i < 0) continue;
    used.add(i);
    const p = parts[i]!;
    if (s.list) {
      const items = listOf(withChildren(parts, i), bangla).filter((x) => !drop.some((d) => x.includes(d)));
      if (items.length >= 2) {
        sections.push({ key: s.key, title: p.head, items });
        continue;
      }
      // A list section written as prose ("চিত্তাকর্ষক স্থান" in a paragraph) is shown as prose.
    }
    const text = cut(prose(p.body), bangla, [...drop, ...NEVER], s.max ?? 420);
    // A section no longer than a sentence or two that repeats the opening adds nothing.
    if (text.length >= 80 && !leadText.includes(text.slice(0, 60))) sections.push({ key: s.key, title: p.head, text });
  }
  return { title: a.title, url: a.url, text: leadText, sections };
}

async function main() {
  const out: Record<string, { bn?: Lead; en?: Lead }> = {};
  const missing: string[] = [];
  for (const d of districtList()) {
    const drop = DROP[d.slug] ?? [];
    const bn = await article('bn.wikipedia.org', BN_TITLE[d.slug] ?? `${d.bn} জেলা`);
    const en = await article('en.wikipedia.org', EN_TITLE[d.slug] ?? `${d.en} District`);
    // An English hit on a namesake elsewhere ("Gopalganj District" in India) is no hit.
    const enOk = en && /Bangladesh/.test(en.text.slice(0, 3000)) ? en : null;
    const bnD = bn ? describe(bn, true, drop) : null;
    const enD = enOk ? describe(enOk, false, drop) : null;
    out[d.slug] = {
      ...(bnD && bnD.text ? { bn: bnD } : {}),
      ...(enD && enD.text ? { en: enD } : {}),
    };
    if (!out[d.slug]!.bn || !out[d.slug]!.en) missing.push(`${d.slug}${out[d.slug]!.bn ? '' : ' (bn)'}${out[d.slug]!.en ? '' : ' (en)'}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  fs.writeFileSync('data/district-wiki.json', JSON.stringify(out, null, 1) + '\n');
  const n = (lang: 'bn' | 'en') => Object.values(out).reduce((k, v) => k + (v[lang]?.sections?.length ?? 0), 0);
  console.log(`data/district-wiki.json: ${Object.keys(out).length} districts, ${n('bn')} Bangla and ${n('en')} English sections${missing.length ? `; not found: ${missing.join(', ')}` : ''}`);
}

main();
