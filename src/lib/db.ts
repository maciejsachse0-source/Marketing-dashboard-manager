import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../drizzle/schema';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __dbClient__: ReturnType<typeof postgres> | undefined;
}

// Cache only the postgres client (TCP connection pool) on globalThis so HMR
// reuses it instead of opening a new connection every reload. The drizzle
// wrapper is always re-built with the freshly-imported schema — caching it
// across HMR caused `db.query.<newTable>` to be undefined for tables added
// to schema.ts after the dev server first started.
function getClient() {
  if (globalThis.__dbClient__) return globalThis.__dbClient__;
  const client = postgres(env.DATABASE_URL, {
    // Disable prepared statements for compatibility with serverless poolers
    // (Neon pooled, Vercel Postgres pooled, Supabase pgbouncer in transaction mode).
    prepare: false,
    // Keep the pool tiny — serverless functions get short lifetimes; one
    // active connection per warm instance is plenty.
    max: 1,
    idle_timeout: 20,
  });
  if (env.NODE_ENV !== 'production') {
    globalThis.__dbClient__ = client;
  }
  return client;
}

export const db = drizzle(getClient(), { schema });

export { schema };
