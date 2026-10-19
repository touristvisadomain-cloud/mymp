/**
 * Each district's description from Wikipedia, in Bangla and English, for the
 * district pages: the lead of the district's article, cut at a sentence end.
 * Wikipedia's text is CC BY-SA 4.0; the page names and links the article
 * beside it. Written to data/district-wiki.json; run again by hand when the
 * articles should be refreshed:
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

interface Lead { text: string; url: string; title: string }

/** The article's lead; with `more`, its first sections too, headings dropped (a one-line lead says little). */
async function lead(host: string, title: string, more = false): Promise<Lead | null> {
  const u = `https://${host}/w/api.php?action=query&prop=extracts|info&inprop=url&${more ? 'exchars=1600' : 'exintro=1'}&explaintext=1&exsectionformat=plain&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
  const j = (await (await fetch(u, { headers: UA })).json()) as { query?: { pages?: Record<string, { title: string; fullurl?: string; extract?: string; missing?: string }> } };
  const p = Object.values(j.query?.pages ?? {})[0];
  if (!p || p.missing !== undefined || !p.extract || !p.fullurl) return null;
  // Past the lead, section headings ("অবস্থান ও আয়তন") and list lines ("ঠাকুরগাঁও সদর উপজেলা")
  // go: they have no full stop. The lead itself is prose, though a sentence may run across a line.
  const text = p.extract
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l, i, all) => l && (!more || i < all.indexOf('') || /[।.!?]$/.test(l)))
    .join(' ');
  return { title: p.title, url: p.fullurl, text };
}

/** The lead cut at a sentence end, no longer than `max` characters; never mid-sentence. */
function cut(text: string, bangla: boolean, drop: string[] = [], max = 640): string {
  // Brackets go, innermost first: "(Bengali: …)", "(1,234 km2 (476 sq mi))", pronunciations.
  let clean = text;
  for (let i = 0; i < 3; i++) clean = clean.replace(/\s*\([^()]*\)/g, '');
  clean = clean
    .replace(/\s*\/\s*-?[\d.]+;\s*-?[\d.]+/g, '') // "২৬.২৫° উত্তর ৮৮.৫০° পূর্ব / 26.25; 88.50"
    .replace(/[^।.!?]*(?:\.\.\.|…)\s*$/, '') // the sentence the character limit cut off
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.।])/g, '$1')
    .trim();
  // Split after a sentence's end, never inside a number ("3,291.42").
  const sentences = clean.split(bangla ? /(?<=[।!?])\s*/ : /(?<=[.!?])\s+(?=[A-Z"'“])/).map((s) => `${s} `);
  let out = '';
  // A sentence that opens a list ("এগুলো হচ্ছেঃ …") has lost its list.
  for (const s of sentences.filter((x) => !/(?:হচ্ছে|হলো|নিম্নরূপ)\s*[ঃ:]/.test(x) && !/[ঃ:]\s*$/.test(x) && !drop.some((d) => x.includes(d)) && x.trim().length > 30 && !/^[\d০-৯]+\./.test(x.trim()))) {
    if (out && (out + s).length > max) break;
    out += s;
  }
  return out.trim();
}

/**
 * Sentences left out, read 2026-10-19: opinion, vandalism and figures the
 * articles get wrong ("44,959 square kilometres" for Bagerhat), or
 * advertising. Matched by a piece of the sentence.
 */
const DROP: Record<string, string[]> = {
  chuadanga: ['জীবন যাত্রার মান', 'জীবিকার তাগিদে', 'ঝুঁকিপূর্ণ'],
  meherpur: ['কারণ এটি একটি জেলা', 'প্রশাসনিক অঞ্চল বলতে'],
  bagerhat: ['44,959', 'it is good', 'বঙ্গবসাগরেের'],
  narail: ['smart app', 'Where people', 'DSSR'],
  magura: ['dristic', 'Shakib'],
  shariatpur: ['আজ আর চাঁদ রায়'],
};

/** The fuller text when it says more than the lead, else the lead. */
const longer = (a: Lead, b: Lead | null) => (b && b.text.length > a.text.length ? b : a);

async function main() {
const out: Record<string, { bn?: Lead; en?: Lead }> = {};
const missing: string[] = [];
for (const d of districtList()) {
  const bnTitle = BN_TITLE[d.slug] ?? `${d.bn} জেলা`;
  let bn = await lead('bn.wikipedia.org', bnTitle);
  if (bn && bn.text.length < 250) bn = longer(bn, await lead('bn.wikipedia.org', bnTitle, true));
  const enTitle = EN_TITLE[d.slug] ?? `${d.en} District`;
  let en = await lead('en.wikipedia.org', enTitle);
  if (en && en.text.length < 250) en = longer(en, await lead('en.wikipedia.org', enTitle, true));
  // An English hit on a namesake elsewhere ("Gopalganj District" in India) is no hit.
  const enOk = en && /Bangladesh|Division/.test(en.text) ? en : null;
  out[d.slug] = {
    ...(bn ? { bn: { ...bn, text: cut(bn.text, true, DROP[d.slug]) } } : {}),
    ...(enOk ? { en: { ...enOk, text: cut(enOk.text, false, DROP[d.slug]) } } : {}),
  };
  if (!bn || !enOk) missing.push(`${d.slug}${bn ? '' : ' (bn)'}${enOk ? '' : ' (en)'}`);
  await new Promise((r) => setTimeout(r, 250));
}
fs.writeFileSync('data/district-wiki.json', JSON.stringify(out, null, 1) + '\n');
console.log(`data/district-wiki.json: ${Object.keys(out).length} districts${missing.length ? `; not found: ${missing.join(', ')}` : ''}`);
}

main();
