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

const budget = JSON.parse(readFileSync('perf/budget.json', 'utf8'));

function runsOfKind(prefix) {
  if (!existsSync('perf/runs')) return [];
  return readdirSync('perf/runs')
    .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(`perf/runs/${f}`, 'utf8')));
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

function drift(label, now, before) {
  if (before === undefined || before === null || before === 0) return;
  const pct = Math.round(((now - before) / before) * 100);
  if (Math.abs(pct) >= budget.driftPct) {
    drifts.push({ label, before, now, pct });
  }
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
  drift(`p95 ${key}`, r.p95Ms, pagePrev?.pages?.[key]?.p95Ms);
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
  drift(`p95 ${name}`, r.p95Ms, dbPrev?.queries?.[name]?.p95Ms);
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
    drift(k, dev[k], devPrev?.[k]);
  }
}

// --- bundle -----------------------------------------------------------------
if (existsSync('perf/baseline.json')) {
  const baseline = JSON.parse(readFileSync('perf/baseline.json', 'utf8'));
  const kb = baseline.bundle?.calendarFirstLoadKb;
  if (typeof kb === 'number') {
    lines.push('\nBUNDLE');
    check('JS /calendar (gzip)', kb, budget.bundle.calendarFirstLoadKb, 'kB');
  }
}

console.log(lines.join('\n'));

if (drifts.length > 0) {
  console.log(`\nDRYF względem poprzedniego przebiegu (próg ${budget.driftPct}%):`);
  for (const d of drifts) console.log(`  ${d.label}: ${d.before} -> ${d.now} (${d.pct > 0 ? '+' : ''}${d.pct}%)`);
} else {
  console.log(`\nDRYF: brak zmian powyżej ${budget.driftPct}% względem poprzedniego przebiegu.`);
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
