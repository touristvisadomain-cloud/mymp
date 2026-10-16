// Checks the English pages for Bangla that should not be there.
//
//   node scripts/i18n-check.mjs [base] [path ...]
//
// base defaults to http://localhost:3000. With no paths, every page in the
// sitemap is checked (as /en/...). Text inside an element marked lang="bn"
// (news headlines, which stay in their own language; a name given in Bangla
// beside the English one) is allowed; so is the language switch's "বাংলা".
// Also read: title, alt, aria-label, placeholder, and the <meta> description
// and share tags. Prints each page with the Bangla it found; exits 1 if any.
const [, , baseArg, ...pathsArg] = process.argv;
const base = (baseArg || 'http://localhost:3000').replace(/\/$/, '');
const BANGLA = /[ঀ-৿]/;
const ALLOWED = new Set(['বাংলা', 'বাং']);

async function pages() {
  if (pathsArg.length) return pathsArg;
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  const out = new Set();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const u = new URL(m[1]);
    out.add(u.pathname.replace(/^\/en(?=\/|$)/, '') || '/');
  }
  return [...out];
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ATTRS = ['title', 'alt', 'aria-label', 'placeholder'];

/** Visible text and readable attributes of a page, outside lang="bn" elements. */
function readable(html) {
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, '');
  const found = [];
  const stack = []; // true where the element (or an ancestor) is lang="bn"
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      const text = m[4].replace(/&nbsp;/g, ' ').trim();
      if (text && !stack.at(-1)?.bn) found.push(text);
      continue;
    }
    const [, close, tag, attrs] = m;
    const t = tag.toLowerCase();
    if (close) {
      // Pop to the matching open tag.
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === t) { stack.length = i; break; }
      }
      continue;
    }
    const parentBn = stack.length ? stack.at(-1).bn : false;
    const lang = /\blang="([^"]*)"/.exec(attrs)?.[1];
    const bn = lang ? lang.startsWith('bn') : parentBn;
    if (!bn) {
      for (const a of ATTRS) {
        const v = new RegExp(`\\b${a}="([^"]*)"`).exec(attrs)?.[1];
        if (v) found.push(`[${a}] ${v}`);
      }
      if (t === 'meta') {
        const name = /\b(?:name|property)="([^"]*)"/.exec(attrs)?.[1] ?? '';
        const content = /\bcontent="([^"]*)"/.exec(attrs)?.[1];
        if (content && /description|title|og:|twitter:/.test(name) && !/image|url|locale/.test(name)) found.push(`[meta ${name}] ${content}`);
      }
    }
    if (!VOID.has(t) && !/\/\s*$/.test(attrs)) stack.push({ tag: t, bn });
  }
  return found;
}

let bad = 0;
for (const p of await pages()) {
  const url = `${base}${p === '/' ? '/en' : `/en${p}`}`;
  let html;
  try {
    const r = await fetch(url);
    html = await r.text();
    if (!r.ok) { console.log(`${r.status} ${url}`); bad++; continue; }
  } catch (e) {
    console.log(`ERR ${url} ${e.message}`); bad++; continue;
  }
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
  const hits = [title, ...readable(html)].filter((s) => BANGLA.test(s) && !ALLOWED.has(s.trim()));
  if (hits.length) {
    bad++;
    console.log(`\n${url}  (${hits.length})`);
    for (const h of [...new Set(hits)].slice(0, 40)) console.log(`   ${h.slice(0, 160)}`);
  }
}
console.log(bad ? `\n${bad} page(s) with Bangla on the English side.` : '\nNo Bangla on the English pages.');
process.exitCode = bad ? 1 : 0;
