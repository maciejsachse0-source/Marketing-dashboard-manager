/**
 * Harness, część bazodanowa. Mierzy 4 zapytania krytyczne z plan/03 sekcja 1.2:
 * rozgrzewka 2x, pomiar 7x, zapis p50 i p95, plus EXPLAIN (ANALYZE, BUFFERS)
 * pierwszego przebiegu. Wszystko przez postgres-js, bo `psql` tu nie istnieje.
 *
 * Uruchomienie: node scripts/perf/measure-db.mjs
 * Wynik: perf/runs/db-<timestamp>.json oraz tabela na stdout.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import postgres from 'postgres';
import { mkdirSync, writeFileSync } from 'node:fs';

// plan/03 sekcja 1.2 mówi: rozgrzewka 2x, pomiar 7x. Zmierzone: przy zapytaniach
// rzędu 1 do 2 ms na lokalnym Postgresie 7 próbek dawało mediany rozjeżdżające się
// między przebiegami o 11,8%, czyli powyżej progu 10% z kryterium akceptacji F0-04.
// Sam pomiar trwa ułamek sekundy, więc więcej próbek nic nie kosztuje, a mediana
// przestaje skakać. Powód i liczby: DECISIONS.md, wpis F0-04.
/** Górny limit rund rozgrzewkowych. Rozgrzewka kończy się wcześniej, gdy czasy
 *  przestaną spadać; ten limit jest tylko bezpiecznikiem przed pętlą bez końca. */
const WARMUP_MAX_ROUNDS = 40;
const RUNS = 25;
/** Poniżej tylu wierszy W TABELI Seq Scan jest tańszy niż indeks i planer ma
 *  rację, więc nie liczy się jako trafienie. Próg z plan/03 sekcja 1.2.
 *  Uwaga: liczy się rozmiar tabeli, nie liczba wierszy zwróconych przez skan.
 *  Seq Scan po 3 000 wpisów kalendarza, który po filtrze oddaje 118 wierszy,
 *  nadal przeczesał całe 3 000 i nadal jest tym, co ma usunąć indeks. */
const SEQ_SCAN_MIN_TABLE_ROWS = 1000;

const url = process.env.PERF_DATABASE_URL;
if (!url) {
  console.error('[measure-db] PERF_DATABASE_URL nie jest ustawiony');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

// Okno 21 dni i 90 dni liczone od stałej daty, tej samej co oś generatora
// zestawu L. Gdyby liczyć od `now()`, wyniki dryfowałyby z dnia na dzień
// i porównanie z baseline przestałoby cokolwiek znaczyć.
const NOW = '2026-01-05T09:00:00.000Z';

const QUERIES = {
  'calendar-window': {
    text: `
      select ce.id, ce.type, ce.title, ce.starts_at, ce.ends_at, ce.status,
             p.id as production_id, p.title as production_title, p.t0_at
      from calendar_entries ce
      left join productions p on p.id = ce.production_id
      where ce.starts_at >= $1::timestamptz - interval '7 days'
        and ce.starts_at <  $1::timestamptz + interval '14 days'
      order by ce.starts_at`,
    params: [NOW],
  },
  'productions-list': {
    text: `
      select p.id, p.title, p.slug, p.t0_at, p.cancelled_at,
             a.name as artist_name, v.name as videographer_name, c.name as campaign_name
      from productions p
      left join artists a on a.id = p.artist_id
      left join videographers v on v.id = p.videographer_id
      left join campaigns c on c.id = p.campaign_id
      order by p.t0_at desc
      limit 100`,
    params: [],
  },
  'campaign-detail': {
    text: `
      select c.id, c.name, c.phase, c.release_at, c.milestones,
             p.id as production_id, p.title as production_title, p.t0_at
      from campaigns c
      left join productions p on p.campaign_id = c.id
      where c.id = $1
      order by p.t0_at`,
    params: [1],
  },
  'posts-analytics': {
    text: `
      select platform,
             count(*)::int as n,
             avg(engagement_rate)::float as avg_engagement,
             sum(reach)::bigint as total_reach
      from posts
      where published_at >= $1::timestamptz - interval '90 days'
        and reach is not null
      group by platform
      order by total_reach desc`,
    params: [NOW],
  },
};

/** Odmowa mierzenia pustki. Bez tego harness raportuje świetne czasy na zerze
 *  wierszy i baseline staje się kłamstwem, którego nikt później nie podważa. */
const [{ n: productionCount }] = await sql`select count(*)::int as n from productions`;
if (productionCount === 0) {
  console.error('[measure-db] tabela productions jest pusta, odmawiam pomiaru na pustce');
  console.error('[measure-db] uruchom najpierw: npx tsx scripts/perf/seed-large.ts');
  await sql.end();
  process.exit(1);
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

/** Zbiera nazwy tabel, na których planer wybrał Seq Scan. Plan jest drzewem,
 *  więc schodzimy rekurencyjnie. */
function collectSeqScans(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node['Node Type'] === 'Seq Scan') {
    out.push({ table: node['Relation Name'], scanRows: node['Actual Rows'] ?? 0 });
  }
  for (const child of node.Plans ?? []) collectSeqScans(child, out);
  return out;
}

// Rozmiary tabel, potrzebne żeby ocenić, czy Seq Scan jest trafieniem.
const tableRows = {};
for (const { table_name } of await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'`) {
  const [r] = await sql`select count(*)::int as n from ${sql(table_name)}`;
  tableRows[table_name] = r.n;
}

// ROZGRZEWKA GLOBALNA, ADAPTACYJNA, przed jakimkolwiek pomiarem.
// Zmierzone: pierwszy przebieg po dłuższej bezczynności wychodził systematycznie
// wolniej od kolejnych (p50 1,86 / 0,96 / 0,63 ms wobec 1,48 / 0,72 / 0,55 ms
// w przebiegach 2 do 4), bo zimny jest proces node i cache serwera, a nie
// zapytanie. Stała liczba rozgrzewek tego nie domykała: przebiegi 1 vs 2
// rozjeżdżały się na p50 o 33%, podczas gdy 2 vs 3 o 1,9%.
// Dlatego rozgrzewamy DOPÓKI mediana rundy nie przestanie spadać, zamiast
// ustalać magiczną liczbę przejść. Bez tego kryterium „dwa przebiegi pod rząd
// różnią się o mniej niż 10%" przechodziło tylko wtedy, gdy ktoś pamiętał, żeby
// wyrzucić pierwszy przebieg, a taka wiedza plemienna zawsze w końcu ginie.
async function warmRound() {
  const t = process.hrtime.bigint();
  for (const q of Object.values(QUERIES)) await sql.unsafe(q.text, q.params);
  return Number(process.hrtime.bigint() - t) / 1e6;
}

let prev = Infinity;
for (let i = 0; i < WARMUP_MAX_ROUNDS; i++) {
  const ms = await warmRound();
  // Runda nie szybsza od poprzedniej o więcej niż 2% = rozgrzane.
  if (ms > prev * 0.98) break;
  prev = ms;
}

const results = {};

for (const [name, q] of Object.entries(QUERIES)) {
  const explainRaw = await sql.unsafe(
    `explain (analyze, buffers, format json) ${q.text}`,
    q.params,
  );
  const plan = explainRaw[0]['QUERY PLAN'][0].Plan;
  const seqScans = collectSeqScans(plan)
    .map((s) => ({ ...s, tableRows: tableRows[s.table] ?? 0 }))
    .filter((s) => s.tableRows > SEQ_SCAN_MIN_TABLE_ROWS);

  await sql.unsafe(q.text, q.params);

  const times = [];
  let rows = 0;
  for (let i = 0; i < RUNS; i++) {
    const t = process.hrtime.bigint();
    const out = await sql.unsafe(q.text, q.params);
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
    rows = out.length;
  }
  times.sort((a, b) => a - b);

  results[name] = {
    p50Ms: Number(percentile(times, 50).toFixed(2)),
    p95Ms: Number(percentile(times, 95).toFixed(2)),
    rows,
    seqScan: seqScans.length > 0,
    seqScanTables: seqScans,
    plan: plan['Node Type'],
  };
}

await sql.end();

const parsed = new URL(url);
const out = {
  kind: 'db',
  at: new Date().toISOString(),
  dbUrlHost: `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`,
  productionCount,
  runs: RUNS,
  queries: results,
};

mkdirSync('perf/runs', { recursive: true });
const file = `perf/runs/db-${out.at.replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

console.log(`baza: ${out.dbUrlHost}, productions: ${productionCount}`);
console.log('zapytanie          p50 ms   p95 ms   wierszy  seqScan');
for (const [name, r] of Object.entries(results)) {
  console.log(
    `${name.padEnd(18)} ${String(r.p50Ms).padStart(6)} ${String(r.p95Ms).padStart(8)} ` +
      `${String(r.rows).padStart(9)}  ${r.seqScan ? 'TAK' : 'nie'}` +
      (r.seqScan ? ` (${r.seqScanTables.map((s) => `${s.table}:${s.tableRows}`).join(', ')})` : ''),
  );
}
console.log(`\nzapisano ${file}`);
