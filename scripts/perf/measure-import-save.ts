/**
 * Pomiar kroku 6 importu: zapis 1000 nowych osób oraz zużycie pamięci przy
 * pliku 10 MB. Progi z plan/04 sekcja 8: zapis poniżej 5000 ms, wzrost RSS
 * poniżej 300 MB.
 *
 * Zapis idzie do bazy testowej (TEST_DATABASE_URL) i kończy się wycofaniem
 * transakcji, więc pomiar nie zostawia po sobie ani jednego wiersza.
 * Trzy przebiegi, liczy się mediana (szum czasowy na tej maszynie sięga 40%).
 *
 * Uruchomienie: npx tsx scripts/perf/measure-import-save.ts
 */
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import ExcelJS from 'exceljs';
import * as schema from '../../drizzle/schema';
import { parseWorkbook } from '../../src/lib/import/parse';
import { autoMap } from '../../src/lib/import/mapping';
import { dryRun } from '../../src/lib/import/dry-run';
import { savePlans } from '../../src/lib/import/save';

config({ path: '.env.local', quiet: true });

const PROG_MS = 5000;
const PROG_RSS_MB = 300;

const client = postgres(process.env.TEST_DATABASE_URL!, { prepare: false, max: 2 });
const db = drizzle(client, { schema });

class Wycofaj extends Error {}

function osoba(i: number) {
  const numer = String(i).padStart(5, '0');
  return {
    line: i + 2,
    person: {
      name: `Atrapa Pomiarowa ${numer}`,
      handle: `@atrapa_pomiar_${numer}`,
      email: `pomiar${numer}@przyklad.test`,
      phone: null,
      location: 'Warszawa',
      status: null,
      notes: null,
    },
    plan: { action: 'insert' as const },
  };
}

async function zapis(): Promise<number> {
  const plans = Array.from({ length: 1000 }, (_, i) => osoba(i));
  const start = performance.now();
  try {
    await db.transaction(async (tx) => {
      await savePlans(tx, 'artist', plans);
      throw new Wycofaj('pomiar, wycofujemy');
    });
  } catch (err) {
    if (!(err instanceof Wycofaj)) throw err;
  }
  return performance.now() - start;
}

/** Skoroszyt ważący ponad 10 MB, budowany w katalogu tymczasowym poza repem. */
async function wielkiPlik(dir: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Twórcy');
  sheet.addRow(['Imię', 'Instagram', 'E-mail', 'Telefon', 'Miasto', 'Uwagi']);
  for (let i = 1; i <= 5000; i += 1) {
    const numer = String(i).padStart(5, '0');
    sheet.addRow([
      `Atrapa Pomiarowa ${numer}`,
      `@atrapa_pomiar_${numer}`,
      `pomiar${numer}@przyklad.test`,
      `+48 500 ${numer.slice(0, 3)} ${numer.slice(3)}0`,
      'Warszawa',
      // Losowa treść, bo powtarzalny tekst skompresowałby się do zera i plik
      // nigdy nie dobiłby do 10 MB, o które chodzi w progu pamięci.
      randomBytes(2020).toString('base64'),
    ]);
  }
  const plik = path.join(dir, 'wielki.xlsx');
  await workbook.xlsx.writeFile(plik);
  return plik;
}

async function pamiec(plik: string): Promise<{ mb: number; bytes: number; wierszy: number }> {
  const data = await readFile(plik);
  global.gc?.();
  const przed = process.memoryUsage().rss;
  const parsed = await parseWorkbook('wielki.xlsx', data);
  if (!parsed.ok) throw new Error(parsed.message);
  const sheet = parsed.sheets[0];
  const wynik = dryRun(sheet.rows, autoMap(sheet.headers, 'artist'), 'artist', [], 'skip');
  const po = process.memoryUsage().rss;
  return { mb: (po - przed) / (1024 * 1024), bytes: data.byteLength, wierszy: wynik.inserts };
}

async function main() {
  const czasy: number[] = [];
  for (let i = 0; i < 3; i += 1) czasy.push(await zapis());
  czasy.sort((a, b) => a - b);
  const mediana = czasy[1];

  const dir = await mkdtemp(path.join(os.tmpdir(), 'import-perf-'));
  let rss = { mb: 0, bytes: 0, wierszy: 0 };
  try {
    rss = await pamiec(await wielkiPlik(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const [row] = await client`select count(*)::int as n from artists`;
  await client.end();

  const linie = [
    `zapis 1000 osob [ms] ${czasy.map((c) => c.toFixed(0)).join(', ')}`,
    `mediana [ms]         ${mediana.toFixed(0)}  (prog ${PROG_MS})`,
    `plik [MB]            ${(rss.bytes / (1024 * 1024)).toFixed(1)}, wierszy ${rss.wierszy}`,
    `wzrost RSS [MB]      ${rss.mb.toFixed(1)}  (prog ${PROG_RSS_MB})`,
    `wierszy w artists po pomiarze ${row.n}`,
  ];
  console.log(linie.join('\n'));

  const ok = mediana < PROG_MS && rss.mb < PROG_RSS_MB;
  if (!ok) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
