import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../drizzle/schema';
import { env } from './env';

declare global {
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
    // Na Vercelu kazda instancja funkcji trzyma wlasna pule i zyje krotko,
    // wiec jedno polaczenie na instancje wystarcza i nie wyczerpuje limitu
    // providera. Poza Vercelem (serwer dlugo zyjacy, jeden proces) pula ma
    // sens: DB_POOL_MAX, domyslnie 10. Uzasadnienie limitu: docs/ARCHITEKTURA.md sekcja 3.
    max: process.env.VERCEL ? 1 : env.DB_POOL_MAX,
    idle_timeout: 20,
  });
  if (env.NODE_ENV !== 'production') {
    globalThis.__dbClient__ = client;
  }
  return client;
}

export const db = drizzle(getClient(), { schema });

export { schema };
