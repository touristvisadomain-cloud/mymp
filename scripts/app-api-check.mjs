// Checks the mobile app's API (docs/app-api.md) against a running site:
//
//   node scripts/app-api-check.mjs [http://localhost:3000]
//
// Every endpoint, in both languages: it answers 200 with JSON, gzipped when
// asked, readable from any origin, with the language it was asked for; and
// an English answer carries no Bangla, except in the news headlines (the
// outlets' own words): a headline not yet translated stays in Bangla, and the
// original is kept beside a translated one (titleOriginal, summaryOriginal).

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const BANGLA = /[ঀ-৿]/;

/**
 * Bangla allowed on an English answer: a story's headline (its lead or the
 * same story elsewhere), and the bootstrap's upazila table, whose second
 * column is the Bangla an English name is matched to; and the fields kept in
 * Bangla for search: a brief's `areaBn` and the `…Alt` names. Addresses are not text.
 */
const ALLOWED = [/\.stories\[\d+\]\.(lead|also\[\d+\])\.(title|titleOriginal)$/, /^\.(items|pinned)\[\d+\]\.(title|summary|titleOriginal|summaryOriginal)$/, /^\.upazilaEn\[\d+\]\[1\]$/, /\.areaBn$/, /\.(name|seat|district)Alt$/];
const isUrl = (s) => /^https?:\/\//.test(s);

const get = async (path) => {
  const r = await fetch(`${base}${path}`, { headers: { 'accept-encoding': 'gzip' } });
  return r;
};

/** Every string in a JSON value, with its path. */
function* strings(v, path = '') {
  if (typeof v === 'string') yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${path}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* strings(x, `${path}.${k}`);
}

const boot = await (await get('/api/app/v1/bootstrap')).json();
const someMember = boot.members.find((m) => m.officeBn)?.slug ?? boot.members[0].slug;
const former = boot.former[0]?.slug;
const cabinet = await (await get('/api/app/v1/cabinet')).json();
const adviser = cabinet.posts.find((p) => p.adviserSlug)?.adviserSlug;
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

const endpoints = [
  '/api/app/v1/bootstrap',
  `/api/app/v1/mp/${someMember}`,
  '/api/app/v1/mp/tarique-rahman',
  ...(former ? [`/api/app/v1/mp/${former}`] : []),
  '/api/app/v1/cabinet',
  ...(adviser ? [`/api/app/v1/adviser/${adviser}`] : []),
  '/api/app/v1/election',
  '/api/app/v1/news?limit=50',
  '/api/app/v1/news?type=video&limit=10',
  `/api/app/v1/news?from=${today}&to=${today}`,
  '/api/app/v1/news?counts=1',
  '/api/app/v1/news/counts',
  '/api/app/v1/sessions',
  '/api/app/v1/seats',
  '/api/app/v1/seat/dhaka-17',
  '/api/app/v1/seat/women-seat-1',
  '/api/app/v1/district/dhaka',
  '/api/app/v1/reserved',
  '/api/app/v1/party/bnp',
  '/api/app/v1/party/ind',
  '/api/app/v1/committees',
  '/api/app/v1/committee/public-accounts-committee-pac',
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

for (const ep of endpoints) {
  for (const lang of ['bn', 'en']) {
    const path = `${ep}${ep.includes('?') ? '&' : '?'}lang=${lang}`;
    const r = await get(path);
    console.log(`${r.status} ${path}`);
    if (r.status !== 200) fail(`status ${r.status}`);
    if (r.headers.get('access-control-allow-origin') !== '*') fail('no access-control-allow-origin: *');
    const size = Number(r.headers.get('content-length') ?? 0);
    if (r.headers.get('content-encoding') !== 'gzip' && size > 1024) fail('not gzipped');
    let body;
    try {
      body = await r.json();
    } catch {
      fail('not JSON');
      continue;
    }
    if (body.lang !== lang) fail(`lang is ${JSON.stringify(body.lang)}`);
    if (lang === 'en') {
      const bangla = [...strings(body)].filter(([p, s]) => BANGLA.test(s) && !isUrl(s) && !ALLOWED.some((re) => re.test(p)));
      for (const [p, s] of bangla.slice(0, 15)) fail(`Bangla at ${p}: ${s.slice(0, 80)}`);
      if (bangla.length > 15) fail(`… and ${bangla.length - 15} more`);
    }
  }
}

// Routes the website shares with the app, which its web build reads directly.
for (const path of ['/api/news/range?from=2026-10-01&to=2026-10-02', `/api/feed/${someMember}?recent=5`, `/api/feed/${someMember}?lang=en`, '/api/feed/no-such-member']) {
  const r = await get(path);
  console.log(`${r.status} ${path}`);
  if (r.headers.get('access-control-allow-origin') !== '*') fail('no access-control-allow-origin: *');
  if (path.endsWith('lang=en')) {
    const bangla = [...strings(await r.json())].filter(([p, s]) => BANGLA.test(s) && !isUrl(s) && !ALLOWED.some((re) => re.test(p)));
    for (const [p, s] of bangla.slice(0, 15)) fail(`Bangla at ${p}: ${s.slice(0, 80)}`);
  }
}

console.log(failures ? `\n${failures} problem(s).` : '\nEvery endpoint answers as documented.');
process.exitCode = failures ? 1 : 0;
