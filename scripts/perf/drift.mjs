/**
 * Reguła dryfu, wydzielona z `report.mjs`, żeby dało się ją przepuścić przez
 * zastane przebiegi bez uruchamiania całego raportu
 * (`node scripts/perf/drift-selftest.mjs`).
 *
 * Dwa progi względne: `driftPct` ostrzega, `driftFailPct` blokuje. Blokada ma
 * dodatkowy warunek bezwzględny `driftAbsFloorPct` liczony od limitu
 * budżetowego metryki, bo sam procent łapie szum: między kolejnymi przebiegami
 * `p95 home` skacze o 77% (17,6 -> 31,2 ms), co przy limicie 600 ms jest
 * niczym, a bramka padająca na szumie zostaje wyłączona w tydzień.
 */
export function driftVerdict(now, before, limit, budget) {
  if (before === undefined || before === null || before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (Math.abs(pct) < budget.driftPct) return null;
  const floor = typeof limit === 'number' ? (limit * budget.driftAbsFloorPct) / 100 : Infinity;
  const blocking = pct >= budget.driftFailPct && now - before >= floor;
  return { before, now, pct, blocking };
}
