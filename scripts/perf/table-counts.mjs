/**
 * Liczby wierszy per tabela. Domyślnie z bazy pomiarowej (PERF_DATABASE_URL),
 * `--work` przełącza na roboczą (DATABASE_URL), `--preview` na podglądową
 * dla zespołu (PREVIEW_DATABASE_URL, F5-04).
 *
 * Uruchomienie: node scripts/perf/table-counts.mjs [--work|--preview] [--json]
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import postgres from 'postgres';

const asJson = process.argv.includes('--json');
const zmienna = process.argv.includes('--work')
  ? 'DATABASE_URL'
  : process.argv.includes('--preview')
    ? 'PREVIEW_DATABASE_URL'
    : 'PERF_DATABASE_URL';
const url = process.env[zmienna];

if (!url) {
  console.error(`[table-counts] ${zmienna} nie jest ustawiony`);
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
  console.log(`baza: ${zmienna}`);
  for (const [t, n] of Object.entries(counts)) {
    console.log(`${t.padEnd(18)} ${String(n).padStart(6)}`);
  }
}
