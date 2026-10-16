// The Bangla pages must read the same before and after a change: this fetches
// every Bangla page from two running builds (say main and a branch) and lists
// the text that differs.
//
//   node scripts/i18n-compare-bn.mjs <before-base> <after-base> [path ...]
//
// With no paths, every Bangla page in the after-build's sitemap. Compares the
// visible text and the title and description, as runs of text in page order;
// prints what each side has that the other lacks.
const [, , before, after, ...pathsArg] = process.argv;
if (!before || !after) {
  console.error('usage: node scripts/i18n-compare-bn.mjs <before-base> <after-base> [path ...]');
  process.exit(1);
}

async function pages() {
  if (pathsArg.length) return pathsArg;
  const xml = await (await fetch(`${after}/sitemap.xml`)).text();
  const out = new Set();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const p = new URL(m[1]).pathname;
    if (!/^\/en(\/|$)/.test(p)) out.add(p);
  }
  return [...out];
}

function texts(html) {
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
  const body = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template|noscript|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
  const runs = body.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return [`[title] ${title}`, `[description] ${desc}`, ...runs];
}

/** What a has more of than b, as a multiset of runs. */
function extra(a, b) {
  const count = new Map();
  for (const x of b) count.set(x, (count.get(x) ?? 0) + 1);
  const out = [];
  for (const x of a) {
    const n = count.get(x) ?? 0;
    if (n) count.set(x, n - 1);
    else out.push(x);
  }
  return out;
}

let differing = 0;
const list = await pages();
for (const p of list) {
  const [h1, h2] = await Promise.all([fetch(before + p).then((r) => r.text()), fetch(after + p).then((r) => r.text())]);
  const a = texts(h1);
  const b = texts(h2);
  const gone = extra(a, b);
  const added = extra(b, a);
  if (gone.length || added.length) {
    differing++;
    console.log(`\n${p}`);
    for (const g of gone.slice(0, 15)) console.log(`   - ${g.slice(0, 150)}`);
    for (const g of added.slice(0, 15)) console.log(`   + ${g.slice(0, 150)}`);
  }
}
console.log(`\n${list.length} Bangla pages compared; ${differing} differ.`);
