import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// The repo-root .env is the single place for keys; packages read it from there.
// drizzle-kit bundles this file itself, so import.meta.dirname is unavailable; it runs from packages/db.
config({ path: resolve(process.cwd(), '../../.env.local') });
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '../../../.env.local') });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  schemaFilter: ['sangsad'],
  migrations: { schema: 'drizzle', table: '__drizzle_migrations' },
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://unset' },
  strict: true,
  verbose: true,
});
