// Every Bangla string in the files as they are on the base branch must still be
// in the same files now: adding English must never change a Bangla page.
//
//   node scripts/i18n-bn-intact.mjs [base]      (base defaults to origin/main)
//
// Compares each changed or moved source file with its version on the base,
// run by run of Bangla text, and lists any run that is gone. Comments count
// too, which is noise only when a comment was deliberately rewritten.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const base = process.argv[2] || 'origin/main';
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const RUN = /[ঀ-৿][ঀ-৿‌‍ ,।:;!?“”‘’()\-–—.%/০-৯]*/g;
const runs = (s) => new Set((s.match(RUN) ?? []).map((r) => r.trim().replace(/[ ,:;(\-–—.]+$/, '')).filter((r) => r.length > 1));

// Every source file as it is now: a string moved into a shared helper (src/i18n/names.ts) is not lost.
const everywhere = sh('git ls-files -co --exclude-standard src')
  .split('\n')
  .filter((f) => /\.(tsx?|mjs)$/.test(f) && fs.existsSync(f))
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

const changes = sh(`git diff --name-status -M ${base} -- src`).trim().split('\n').filter(Boolean);
let missing = 0;
for (const line of changes) {
  const parts = line.split('\t');
  const status = parts[0];
  if (status.startsWith('A') || status.startsWith('D')) continue;
  const oldPath = parts[1];
  const newPath = status.startsWith('R') ? parts[2] : parts[1];
  if (!/\.(tsx?|mjs)$/.test(newPath) || !fs.existsSync(newPath)) continue;
  const before = sh(`git show ${base}:"${oldPath}"`);
  const now = fs.readFileSync(newPath, 'utf8');
  const gone = [...runs(before)].filter((r) => !now.includes(r) && !everywhere.includes(r));
  if (gone.length) {
    missing += gone.length;
    console.log(`\n${newPath}`);
    for (const g of gone) console.log(`   ${g}`);
  }
}
console.log(missing ? `\n${missing} Bangla string(s) changed or removed.` : 'Every Bangla string is intact.');
process.exitCode = missing ? 1 : 0;
