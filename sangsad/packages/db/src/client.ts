import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | null = null;
let client: ReturnType<typeof postgres> | null = null;

/**
 * Lazy so importing this module never throws: the web app may run in fixture
 * mode with no database at all. Supabase's pooler needs `prepare: false`.
 */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');
  const connectionUrl = new URL(url);
  if (process.env.DATABASE_SSL === 'disable') {
    connectionUrl.searchParams.delete('sslmode');
    connectionUrl.searchParams.delete('ssl');
  }
  client = postgres(connectionUrl.toString(), {
    prepare: false,
    max: 5,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
    connect_timeout: 15,
  });
  cached = drizzle(client, { schema });
  return cached;
}

export async function closeDb() {
  if (!client) return;
  await client.end({ timeout: 5 });
  client = null;
  cached = null;
}

export { schema };
