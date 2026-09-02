/**
 * Liczby wierszy per tabela. Domyślnie z bazy pomiarowej (PERF_DATABASE_URL),
 * `--work` przełącza na roboczą (DATABASE_URL).
 *
 * Uruchomienie: node scripts/perf/table-counts.mjs [--work] [--json]
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import postgres from 'postgres';

const useWork = process.argv.includes('--work');
const asJson = process.argv.includes('--json');
const url = useWork ? process.env.DATABASE_URL : process.env.PERF_DATABASE_URL;

if (!url) {
  console.error(`[table-counts] ${useWork ? 'DATABASE_URL' : 'PERF_DATABASE_URL'} nie jest ustawiony`);
  process.exit(1);
}

const TABLES = [
  'artists',
  'videographers',
  'campaigns',
  'productions',
  'calendar_entries',
  'posts',
  'csv_uploads',
  'csv_rows',
];

const sql = postgres(url, { max: 1, prepare: false });

const counts = {};
for (const t of TABLES) {
  const [row] = await sql`select count(*)::int as n from ${sql(t)}`;
  counts[t] = row.n;
}
await sql.end();

if (asJson) {
  console.log(JSON.stringify(counts, null, 2));
} else {
  console.log(`baza: ${useWork ? 'DATABASE_URL' : 'PERF_DATABASE_URL'}`);
  for (const [t, n] of Object.entries(counts)) {
    console.log(`${t.padEnd(18)} ${String(n).padStart(6)}`);
  }
}
