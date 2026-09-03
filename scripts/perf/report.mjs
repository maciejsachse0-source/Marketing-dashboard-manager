/**
 * Sędzia harnessu. Bierze NAJNOWSZY przebieg każdego rodzaju z perf/runs/,
 * konfrontuje go z progami z perf/budget.json i liczy dryf względem
 * POPRZEDNIEGO przebiegu tego samego rodzaju (nie względem baseline — baseline
 * jest punktem historycznym, a dryf ma łapać regresję z ostatniej zmiany).
 *
 * Uruchomienie: node scripts/perf/report.mjs
 * Kod wyjścia: 0 gdy wszystkie progi trzymają, 1 gdy którykolwiek przekroczony.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { driftVerdict } from './drift.mjs';

const budget = JSON.parse(readFileSync('perf/budget.json', 'utf8'));

function runsOfKind(prefix) {
  if (!existsSync('perf/runs')) return [];
  return readdirSync('perf/runs')
    .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`perf/runs/${f}`, 'utf8')))
    // F7-14: sortowanie po NAZWIE pliku mieszało kolejność, bo przebiegi trybu
    // deweloperskiego mają w nazwie bundler przed datą (`dev-turbopack-...`
    // sortuje się przed `dev-webpack-...`) — raport pokazywał wtedy starszy
    // przebieg jako najnowszy. Sortujemy po polu `at`, czyli po czasie pomiaru.
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

const breaches = [];
const drifts = [];
const lines = [];

function check(label, value, limit, unit = 'ms') {
  const ok = value <= limit;
  if (!ok) {
    const overPct = Math.round(((value - limit) / limit) * 100);
    breaches.push({ label, value, limit, overPct });
  }
  lines.push(
    `${ok ? '  ok  ' : ' PRÓG '} ${label.padEnd(34)} ${String(value).padStart(8)} ${unit} / limit ${limit}`,
  );
}

/**
 * Dryf względem POPRZEDNIEGO przebiegu tego samego rodzaju. Sama reguła siedzi
 * w `drift.mjs`, bo przepuszcza ją przez zastane przebiegi
 * `node scripts/perf/drift-selftest.mjs` (dowód, że bramka nie łapie szumu).
 */
function drift(label, now, before, limit) {
  const verdict = driftVerdict(now, before, limit, budget);
  if (verdict) drifts.push({ label, ...verdict });
}

// --- strony -----------------------------------------------------------------
const pageRuns = runsOfKind('page');
if (pageRuns.length === 0) {
  console.error('[report] brak przebiegu page-*.json w perf/runs, uruchom measure-page.mjs');
  process.exit(1);
}
const page = pageRuns.at(-1);
const pagePrev = pageRuns.at(-2);
lines.push(`\nSTRONY  (${page.at}, serwer ${page.baseUrl}, baza ${page.dbUrlHost ?? 'nieznana'})`);
for (const [key, r] of Object.entries(page.pages)) {
  const limit = budget.page[key]?.p95Ms;
  if (limit === undefined) continue;
  check(`p95 ${key}`, r.p95Ms, limit);
  drift(`p95 ${key}`, r.p95Ms, pagePrev?.pages?.[key]?.p95Ms, limit);
}

/**
 * F7-34: pomiar bez warunków pomiaru jest nieważny. Zestaw L stoi w `budget.zestawL`
 * (jedyne miejsce, czyta go też generator), a przebieg wiezie policzone wiersze.
 * Rozjazd blokuje, bo p95 z innej liczby wierszy nie jest porównywalny ani
 * z `perf/baseline.json`, ani z poprzednim przebiegiem.
 */
lines.push('\nZESTAW L');
if (!page.rows) {
  breaches.push({ label: 'przebieg bez licznika wierszy', value: 'brak', limit: 'komplet', overPct: null });
  lines.push(' PRÓG  przebieg sprzed F7-34, przemierz: node scripts/perf/measure-page.mjs');
} else {
  for (const [tabela, oczekiwane] of Object.entries(budget.zestawL)) {
    const teraz = page.rows[tabela];
    const ok = teraz === oczekiwane;
    if (!ok) breaches.push({ label: `wiersze ${tabela}`, value: teraz ?? 'brak', limit: oczekiwane, overPct: null });
    lines.push(`${ok ? '  ok  ' : ' PRÓG '} ${`wiersze ${tabela}`.padEnd(34)} ${String(teraz ?? '-').padStart(8)}    / zestaw L ${oczekiwane}`);
  }
}

// --- baza -------------------------------------------------------------------
const dbRuns = runsOfKind('db');
if (dbRuns.length === 0) {
  console.error('[report] brak przebiegu db-*.json w perf/runs, uruchom measure-db.mjs');
  process.exit(1);
}
const db = dbRuns.at(-1);
const dbPrev = dbRuns.at(-2);
lines.push(`\nBAZA  (${db.at}, ${db.dbUrlHost})`);
for (const [name, r] of Object.entries(db.queries)) {
  check(`p95 ${name}`, r.p95Ms, budget.db._kazdeZapytanie.p95Ms);
  drift(`p95 ${name}`, r.p95Ms, dbPrev?.queries?.[name]?.p95Ms, budget.db._kazdeZapytanie.p95Ms);
  if (r.seqScan) {
    const tables = r.seqScanTables.map((s) => `${s.table}:${s.tableRows}`).join(', ');
    breaches.push({
      label: `seqScan ${name} (${tables})`,
      value: 'jest',
      limit: 'brak',
      overPct: null,
    });
    lines.push(` PRÓG  ${`seqScan ${name}`.padEnd(34)} ${tables}`);
  }
}

// --- tryb deweloperski (opcjonalny, mierzony osobno przez perf:dev) ---------
const devRuns = runsOfKind('dev');
if (devRuns.length > 0) {
  const dev = devRuns.at(-1);
  const devPrev = devRuns.at(-2);
  lines.push(`\nDEV  (${dev.at})`);
  for (const k of ['readyMs', 'firstCompileMs', 'warmP50Ms', 'hmrMs', 'peakRssMb']) {
    check(k, dev[k], budget.dev[k], k === 'peakRssMb' ? 'MB' : 'ms');
    drift(k, dev[k], devPrev?.[k], budget.dev[k]);
  }
}

// --- bundle -----------------------------------------------------------------
// Rozmiar bierzemy z NAJNOWSZEGO przebiegu `page-*`, nie z `perf/baseline.json`.
// Do F2-06 czytany był baseline, czyli liczba z F0-05, i bramka rozmiaru pokazywała
// stan sprzed pomiaru niezależnie od tego, co właśnie zbudowano.
const bundleRun = pageRuns.at(-1)?.bundle ?? null;
const baselineBundle = existsSync('perf/baseline.json')
  ? JSON.parse(readFileSync('perf/baseline.json', 'utf8')).bundle
  : null;
const bundleKb = bundleRun?.calendarFirstLoadKb ?? baselineBundle?.calendarFirstLoadKb;
if (typeof bundleKb === 'number') {
  lines.push('\nBUNDLE');
  check('JS /calendar (gzip)', bundleKb, budget.bundle.calendarFirstLoadKb, 'kB');
  drift(
    'JS /calendar (gzip)',
    bundleKb,
    pageRuns.at(-2)?.bundle?.calendarFirstLoadKb,
    budget.bundle.calendarFirstLoadKb,
  );
}

console.log(lines.join('\n'));

const blockingDrifts = drifts.filter((d) => d.blocking);
if (drifts.length > 0) {
  console.log(
    `\nDRYF względem poprzedniego przebiegu (ostrzeżenie od ${budget.driftPct}% w górę, blokada od ${budget.driftFailPct}% razem z ${budget.driftAbsFloorPct}% limitu; zmiana w dół to poprawa):`,
  );
  // F7-43: `driftVerdict` liczy wartość bezwzględną, więc na liście ląduje też
  // POPRAWA. Słowo „ostrzeżenie" zostaje wyłącznie dla pogorszenia — ostrzeżenie
  // o tym, że jest szybciej, uczy przewijać całą sekcję.
  for (const d of drifts) {
    const slowo = d.blocking ? 'BLOKUJE' : d.pct < 0 ? 'poprawa    ' : 'ostrzeżenie';
    console.log(`  ${slowo} ${d.label}: ${d.before} -> ${d.now} (${d.pct > 0 ? '+' : ''}${d.pct}%)`);
  }
} else {
  console.log(`\nDRYF: brak zmian powyżej ${budget.driftPct}% względem poprzedniego przebiegu.`);
}

for (const d of blockingDrifts) {
  breaches.push({
    label: `dryf ${d.label} (poprzednio ${d.before})`,
    value: d.now,
    limit: `+${budget.driftFailPct}%`,
    overPct: d.pct,
  });
}

if (breaches.length > 0) {
  console.log('\nPRZEKROCZONE PROGI:');
  for (const b of breaches) {
    console.log(
      `  ${b.label}: ${b.value} wobec ${b.limit}` + (b.overPct === null ? '' : ` (+${b.overPct}%)`),
    );
  }
  process.exit(1);
}

console.log('\nWszystkie progi trzymają.');
