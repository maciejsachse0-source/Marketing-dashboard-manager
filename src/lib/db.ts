import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from '../../drizzle/schema';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __db__: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  const dbPath = resolve(env.DATABASE_PATH);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}

// Schema-version stamp — bump when schema.ts gains/loses columns so dev-server
// HMR doesn't keep a stale Drizzle instance with the old column set cached.
const SCHEMA_VERSION = 'flexible-steps-v2-dropped-legacy';
declare global {
  // eslint-disable-next-line no-var
  var __dbSchemaVersion__: string | undefined;
}

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
