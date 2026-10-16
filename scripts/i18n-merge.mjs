// Folds a batch of translations into data/translations/en/*.json.
//
//   node scripts/i18n-merge.mjs <kind> <inputs.json> <outputs.json> [more pairs...]
//
// <kind> is the file to write: bios, boundaries, fields or notes. Each
// <inputs.json> is an array of items with an `id` and the Bangla `bn` they
// were made from; each <outputs.json> maps those ids to English. The result
// is keyed by the exact Bangla, which is how src/i18n/content.ts finds it, so
// a later change to the Bangla leaves the old English unused rather than wrong.
import fs from 'node:fs';

const [, , kind, ...files] = process.argv;
if (!['bios', 'boundaries', 'fields', 'notes'].includes(kind) || files.length < 2 || files.length % 2) {
  console.error('usage: node scripts/i18n-merge.mjs <bios|boundaries|fields|notes> <inputs.json> <outputs.json> [...]');
  process.exit(1);
}
const target = `data/translations/en/${kind}.json`;
const table = JSON.parse(fs.readFileSync(target, 'utf8'));
const BANGLA = /[ঀ-৿]/;
let added = 0, changed = 0;
const problems = [];
for (let i = 0; i < files.length; i += 2) {
  const inputs = JSON.parse(fs.readFileSync(files[i], 'utf8'));
  const outputs = JSON.parse(fs.readFileSync(files[i + 1], 'utf8'));
  for (const item of inputs) {
    const en = outputs[item.id];
    if (typeof en !== 'string' || !en.trim()) { problems.push(`missing: ${item.id}`); continue; }
    if (BANGLA.test(en)) { problems.push(`Bangla in English: ${item.id}`); continue; }
    // Paragraph count must match, for running text.
    const paras = (s) => s.split(/\n\s*\n/).filter((p) => p.trim()).length;
    if (kind === 'bios' && paras(item.bn) !== paras(en)) problems.push(`paragraphs ${paras(item.bn)} → ${paras(en)}: ${item.id}`);
    if (table[item.bn] === undefined) added++;
    else if (table[item.bn] !== en.trim()) changed++;
    table[item.bn] = en.trim();
  }
}
const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(target, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`${target}: ${added} added, ${changed} changed, ${Object.keys(sorted).length} in all`);
if (problems.length) console.log(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
