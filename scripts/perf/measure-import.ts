/**
 * Pomiar kroku 1 do 4 importu: parsowanie fixture'a plus suchy przebieg
 * (normalizacja i decyzja o wierszu) dla arkusza twórców.
 * Próg z plan/04 sekcja 8: poniżej 3000 ms na 1000 wierszy.
 *
 * Trzy przebiegi, liczy się mediana (szum czasowy na tej maszynie sięga 40%).
 * Uruchomienie: npx tsx scripts/perf/measure-import.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseWorkbook } from '../../src/lib/import/parse';
import { autoMap, toRawRow } from '../../src/lib/import/mapping';
import { normalizeRow } from '../../src/lib/import/normalize';
import { planRow, type ExistingPerson } from '../../src/lib/import/dedup';

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'osoby.xlsx');

/** Baza „już istniejących" osób, żeby suchy przebieg realnie szukał duplikatów. */
const istniejacy: ExistingPerson[] = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  role: 'artist',
  name: `Ala Przykładowa ${String(i).padStart(4, '0')}`,
  handle: `@atrapa_${String(i).padStart(4, '0')}`,
  email: null,
  phone: null,
  location: 'Warszawa',
  status: null,
  notes: null,
}));

async function przebieg(data: Buffer) {
  const start = performance.now();
  const parsed = await parseWorkbook('osoby.xlsx', data);
  if (!parsed.ok) throw new Error(parsed.message);
  const sheet = parsed.sheets[0];
  const mapping = autoMap(sheet.headers, 'artist');

  let insert = 0;
  let skip = 0;
  let update = 0;
  let bledy = 0;
  let puste = 0;
  for (const cells of sheet.rows) {
    const result = normalizeRow(toRawRow(cells, mapping), 'artist');
    if (result.kind === 'empty') { puste += 1; continue; }
    if (result.kind === 'error') { bledy += 1; continue; }
    const plan = planRow(result.person, 'artist', istniejacy, 'update');
    if (plan.action === 'insert') insert += 1;
    else if (plan.action === 'update') update += 1;
    else skip += 1;
  }
  const ms = performance.now() - start;
  return { ms, wierszy: sheet.rows.length, insert, update, skip, bledy, puste };
}

async function main() {
  const data = await readFile(FIXTURE);
  const wyniki = [];
  for (let i = 0; i < 3; i += 1) wyniki.push(await przebieg(data));

  const czasy = wyniki.map((w) => w.ms).sort((a, b) => a - b);
  const w = wyniki[0];
  console.log(`wierszy        ${w.wierszy}`);
  console.log(`nowych         ${w.insert}`);
  console.log(`aktualizacji   ${w.update}`);
  console.log(`pominietych    ${w.skip}`);
  console.log(`bledow         ${w.bledy}`);
  console.log(`pustych        ${w.puste}`);
  console.log(`czasy [ms]     ${czasy.map((c) => c.toFixed(0)).join(', ')}`);
  console.log(`mediana [ms]   ${czasy[1].toFixed(0)}  (prog 3000)`);
  process.exit(czasy[1] < 3000 ? 0 : 1);
}

main();
