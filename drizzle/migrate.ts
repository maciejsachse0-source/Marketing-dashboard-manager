import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dbPath = resolve(process.env.DATABASE_PATH ?? './data/marketing-crew.db');
const dir = dirname(dbPath);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
// Turn FK OFF for migrations — Drizzle's "recreate table" pattern (used for SQLite
// schema changes) drops/renames tables, which would otherwise violate FK pointing
// to that table. Re-enable after.
sqlite.pragma('foreign_keys = OFF');

const db = drizzle(sqlite);

console.log(`[migrate] applying migrations to ${dbPath}`);
migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('[migrate] done');

sqlite.pragma('foreign_keys = ON');
sqlite.close();
