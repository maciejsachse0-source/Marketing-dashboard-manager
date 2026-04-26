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

export const db = globalThis.__db__ ?? createDb();
if (env.NODE_ENV !== 'production') globalThis.__db__ = db;

export { schema };
