/**
 * Sprawdzenie reguły dryfu na zastanych przebiegach z `perf/runs`.
 *
 * Dwie rzeczy do udowodnienia, obie na danych, nie na przekonaniu:
 *  1. NEGATYWNIE: żadna para kolejnych przebiegów z historii nie blokuje fazy.
 *     Historia to sam szum maszyny, więc każda blokada tutaj byłaby fałszywym
 *     alarmem, a bramka fałszywie alarmująca zostaje wyłączona w tydzień.
 *  2. POZYTYWNIE: pogorszenie w rozmiarze prawdziwej regresji blokuje. Za taką
 *     uznajemy wartość podchodzącą pod sam limit budżetu (90% limitu, czyli
 *     jeszcze bez przekroczenia progu twardego) albo wzrost o jedną trzecią,
 *     zależnie od tego, co większe.
 *
 * Uruchomienie: node scripts/perf/drift-selftest.mjs. Kod 0 = reguła trzyma.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { driftVerdict } from './drift.mjs';

const budget = JSON.parse(readFileSync('perf/budget.json', 'utf8'));

function runs(prefix) {
  return readdirSync('perf/runs')
    .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(`perf/runs/${f}`, 'utf8')));
}

/** [{ label, limit, series: [wartość, ...] }] ze wszystkich zastanych przebiegów. */
function series() {
  const out = [];
  const pageRuns = runs('page');
  for (const key of Object.keys(pageRuns.at(-1)?.pages ?? {})) {
    const limit = budget.page[key]?.p95Ms;
    if (limit === undefined) continue;
    out.push({
      label: `p95 ${key}`,
      limit,
      values: pageRuns.map((r) => r.pages?.[key]?.p95Ms).filter((v) => typeof v === 'number'),
    });
  }
  out.push({
    label: 'JS /calendar (gzip)',
    limit: budget.bundle.calendarFirstLoadKb,
    values: pageRuns.map((r) => r.bundle?.calendarFirstLoadKb).filter((v) => typeof v === 'number'),
  });
  const dbRuns = runs('db');
  for (const name of Object.keys(dbRuns.at(-1)?.queries ?? {})) {
    out.push({
      label: `p95 ${name}`,
      limit: budget.db._kazdeZapytanie.p95Ms,
      values: dbRuns.map((r) => r.queries?.[name]?.p95Ms).filter((v) => typeof v === 'number'),
    });
  }
  return out;
}

const metrics = series();
const falseAlarms = [];
let pairs = 0;
let maxNoisePct = 0;

for (const m of metrics) {
  for (let i = 1; i < m.values.length; i++) {
    pairs += 1;
    const verdict = driftVerdict(m.values[i], m.values[i - 1], m.limit, budget);
    if (verdict) maxNoisePct = Math.max(maxNoisePct, Math.abs(verdict.pct));
    if (verdict?.blocking) {
      falseAlarms.push(`${m.label}: ${m.values[i - 1]} -> ${m.values[i]} (${verdict.pct}%)`);
    }
  }
}

const missed = [];
for (const m of metrics) {
  const last = m.values.at(-1);
  if (typeof last !== 'number') continue;
  const regression = Math.max(last * 1.31, m.limit * 0.9);
  const verdict = driftVerdict(regression, last, m.limit, budget);
  if (!verdict?.blocking) {
    missed.push(`${m.label}: ${last} -> ${regression.toFixed(1)} nie zablokowało`);
  }
}

console.log(`Metryki: ${metrics.length}, par kolejnych przebiegów: ${pairs}`);
console.log(`Największy szum w historii: ${maxNoisePct}%`);
console.log(`Fałszywe alarmy na szumie: ${falseAlarms.length}`);
for (const f of falseAlarms) console.log(`  ${f}`);
console.log(`Regresje pod limit przepuszczone bez blokady: ${missed.length}`);
for (const f of missed) console.log(`  ${f}`);

if (falseAlarms.length > 0 || missed.length > 0) process.exit(1);
console.log('Reguła dryfu trzyma: szum nie blokuje, regresja pod limit blokuje.');
