/**
 * Bundle every migration plus the RLS file into one SQL script that can be
 * pasted into Supabase's SQL Editor, for a first setup without a local
 * connection string. It also records the migrations in drizzle's journal
 * table, so a later `pnpm db:migrate` picks up from the right place instead
 * of re-running what the editor already applied.
 *
 * Regenerate after any migration change: `pnpm --filter @sangsad/db sql:bundle`.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const journal = JSON.parse(readFileSync(resolve(root, 'migrations/meta/_journal.json'), 'utf8'));

let out = `-- সংসদ engine for mymp.bd: one-shot setup for Supabase's SQL Editor.
-- Generated from packages/db/migrations + sql/rls.sql on ${new Date().toISOString().slice(0, 10)}.
-- Safe to run once on a fresh project. Afterwards use \`pnpm db:migrate\` for new migrations.

create schema if not exists drizzle;
create schema if not exists sangsad;
create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);

`;

const applied = [];
for (const entry of journal.entries) {
  const file = resolve(root, 'migrations', `${entry.tag}.sql`);
  const sql = readFileSync(file, 'utf8');
  const hash = createHash('sha256').update(sql).digest('hex');
  applied.push({ tag: entry.tag, when: entry.when, hash });
  out += `-- ---------------- migration ${entry.tag} ----------------\n`;
  out += sql.replace(/--> statement-breakpoint/g, '').trim() + '\n\n';
}

out += `-- ---------------- row level security ----------------\n`;
out += readFileSync(resolve(root, 'sql/rls.sql'), 'utf8').trim() + '\n\n';

out += `-- ---------------- record the migrations as applied ----------------\n`;
for (const a of applied) {
  out += `insert into drizzle.__drizzle_migrations (hash, created_at)\n  select '${a.hash}', ${a.when}\n  where not exists (select 1 from drizzle.__drizzle_migrations where hash = '${a.hash}');\n`;
}

const target = resolve(root, 'setup.sql');
writeFileSync(target, out, 'utf8');
console.log(`wrote ${target}: ${applied.map((a) => a.tag).join(', ')} + rls (${(out.length / 1024).toFixed(0)} KB)`);
