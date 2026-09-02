/**
 * Metryczka bazy: wersja Postgresa, host, indeksy z pg_indexes, liczby wierszy.
 * Wszystko przez klienta postgres-js, bo `psql` nie jest na tej maszynie
 * zainstalowany i żadne kryterium akceptacji nie ma prawa go zakładać.
 *
 * Uruchomienie: npm run pg:info  [--work] [--json]
 *   domyślnie czyta PERF_DATABASE_URL, --work przełącza na DATABASE_URL
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import postgres from 'postgres';

const useWork = process.argv.includes('--work');
const asJson = process.argv.includes('--json');
const varName = useWork ? 'DATABASE_URL' : 'PERF_DATABASE_URL';
const url = process.env[varName];

if (!url) {
  console.error(`[pg-info] ${varName} nie jest ustawiony`);
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

const [version] = await sql`select version() as v, current_database() as db`;
const [settings] = await sql`
  select current_setting('server_version') as server_version,
         current_setting('max_connections') as max_connections,
         current_setting('TimeZone') as timezone`;

const indexes = await sql`
  select tablename, indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
  order by tablename, indexname`;

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name`;

const counts = {};
for (const { table_name } of tables) {
  const [row] = await sql`select count(*)::int as n from ${sql(table_name)}`;
  counts[table_name] = row.n;
}

await sql.end();

// Host bez hasła: ten wynik trafia do docs/ARCHITEKTURA.md i do raportów.
const parsed = new URL(url);
const host = `${parsed.hostname}:${parsed.port || 5432}/${parsed.pathname.replace(/^\//, '')}`;

const info = {
  source: varName,
  host,
  database: version.db,
  serverVersion: settings.server_version,
  versionFull: version.v,
  maxConnections: Number(settings.max_connections),
  timezone: settings.timezone,
  indexCount: indexes.length,
  indexes: indexes.map((i) => ({ table: i.tablename, name: i.indexname, def: i.indexdef })),
  rowCounts: counts,
};

if (asJson) {
  console.log(JSON.stringify(info, null, 2));
} else {
  console.log(`zrodlo         ${info.source}`);
  console.log(`host           ${info.host}`);
  console.log(`postgres       ${info.serverVersion}`);
  console.log(`max_connections ${info.maxConnections}`);
  console.log(`strefa czasowa ${info.timezone}`);
  console.log(`\nindeksy (${info.indexCount}):`);
  for (const i of info.indexes) console.log(`  ${i.table.padEnd(22)} ${i.name}`);
  console.log('\nwiersze:');
  for (const [t, n] of Object.entries(info.rowCounts)) {
    console.log(`  ${t.padEnd(22)} ${String(n).padStart(6)}`);
  }
}
