// Which Bangla-only data still has no English (data/translations/en, or an
// editor's English override saved through the admin).
//
//   node scripts/i18n-coverage.mjs [--list]
//
// Prints a count per field; --list also prints each missing value. Run it
// after a sync that brought new or changed Bangla text (a new member, an
// edited biography), then translate what it lists.
import fs from 'node:fs';

const list = process.argv.includes('--list');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const keyOf = (s) => s.normalize('NFC').replace(/[‌‍]/g, '').replace(/\s+/g, ' ').trim();
const table = new Set();
for (const f of ['bios', 'boundaries', 'fields', 'notes']) for (const k of Object.keys(rd(`data/translations/en/${f}.json`))) table.add(keyOf(k));

const members = rd('data/members.json').filter((m) => !m.resignedOn);
const seats = rd('data/seats.json');
const advisers = rd('data/advisers.json').advisers;
const posts = rd('data/posts.json').rows.filter((r) => !r.toDate);
const results = rd('data/results.json');
const parties = rd('data/parties.json');

const checks = [
  ['member biographies', members, 'bioBn'],
  ['member summaries', members, 'summaryBn'],
  ['member education', members, 'educationBn'],
  ['member birthplaces', members, 'birthPlaceBn'],
  ['member professions', members, 'professionBn'],
  ['member party posts', members, 'partyRoleBn'],
  ['member ministries', members, 'ministryBn'],
  ['seat boundaries', seats, 'boundaryBn'],
  ['adviser biographies', advisers, 'bioBn'],
  ['adviser names', advisers, 'nameBn'],
  ['adviser posts', advisers, 'roleBn'],
  ['adviser ranks', advisers, 'rankBn'],
  ['adviser education', advisers, 'educationBn'],
  ['adviser birthplaces', advisers, 'birthPlaceBn'],
  ['adviser professions', advisers, 'professionBn'],
  ['cabinet ministries', posts, 'ministryBn'],
  ['cabinet posts', posts, 'title'],
  ['cabinet rank notes', posts, 'rankNote'],
  ['election result notes', results, 'sourceNote'],
  ...['summaryBn', 'originBn', 'founderBn', 'symbolBn', 'leaderTitleBn', 'leaderNameBn', 'secretaryTitleBn', 'secretaryNameBn', 'headquartersBn'].map((k) => [`party ${k} (editor's)`, parties, k]),
];

let missing = 0;
for (const [label, rows, field] of checks) {
  const enField = field.replace(/Bn$/, 'En');
  const gaps = rows.filter((r) => r[field] && !(enField !== field && r[enField]) && !table.has(keyOf(r[field])));
  const total = rows.filter((r) => r[field]).length;
  if (!total) continue;
  missing += gaps.length;
  console.log(`${gaps.length ? '✗' : '✓'} ${label}: ${total - gaps.length}/${total}`);
  if (list) for (const g of gaps) console.log(`    ${g.id ?? g.slug ?? g.abbr ?? g.seatNo ?? ''}  ${String(g[field]).slice(0, 120)}`);
}
console.log(missing ? `\n${missing} value(s) without English.` : '\nEverything has English.');
process.exitCode = missing ? 1 : 0;
