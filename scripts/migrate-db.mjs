import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, '.env.local');
const SQL_FILES = [
  'supabase/schema.sql',
  'supabase/migrations/002_election_results.sql',
  'supabase/migrations/003_posts.sql',
  'supabase/migrations/004_feed.sql',
];

function loadEnvFile(text) {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

async function main() {
  try {
    loadEnvFile(await readFile(ENV_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set in the environment or .env.local');

  const sql = postgres(url, {
    max: 1,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
    prepare: false,
    connect_timeout: 15,
  });

  try {
    await sql.begin(async (transaction) => {
      for (const relativePath of SQL_FILES) {
        const path = join(ROOT, relativePath);
        process.stdout.write(`Applying ${relativePath}\n`);
        await transaction.unsafe(await readFile(path, 'utf8'));
      }
    });
    console.log('Database migrations applied successfully.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(`Database migration failed: ${error.message ?? error}`);
  process.exit(1);
});
