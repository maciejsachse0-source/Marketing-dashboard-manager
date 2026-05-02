import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../drizzle/schema';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __dbClient__: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __db__: ReturnType<typeof createDb> | undefined;
  // eslint-disable-next-line no-var
  var __dbSchemaVersion__: string | undefined;
}

function createDb() {
  const client =
    globalThis.__dbClient__ ??
    postgres(env.DATABASE_URL, {
      // Disable prepared statements for compatibility with serverless poolers
      // (Neon pooled, Vercel Postgres pooled, Supabase pgbouncer in transaction mode).
      prepare: false,
      // Keep the pool tiny — serverless functions get short lifetimes; one
      // active connection per warm instance is plenty.
      max: 1,
      idle_timeout: 20,
    });
  globalThis.__dbClient__ = client;
  return drizzle(client, { schema });
}

const SCHEMA_VERSION = 'pg-v1';

function getDb() {
  if (
    globalThis.__db__ &&
    globalThis.__dbSchemaVersion__ === SCHEMA_VERSION
  ) {
    return globalThis.__db__;
  }
  const fresh = createDb();
  if (env.NODE_ENV !== 'production') {
    globalThis.__db__ = fresh;
    globalThis.__dbSchemaVersion__ = SCHEMA_VERSION;
  }
  return fresh;
}

export const db = getDb();

export { schema };
