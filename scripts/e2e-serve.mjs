/**
 * Serwer dla testów e2e: `next dev` na bazie TESTOWEJ, nie roboczej (F7-21).
 *
 * Zastane `playwright.config.ts` uruchamiało `npm run dev`, więc scenariusze
 * pisały do bazy, na której siedzi praca (`marketing`) — pełny przebieg dokładał
 * do niej pięć wierszy, a import 975 osób. Tutaj podstawiamy TEST_DATABASE_URL
 * i CZYŚCIMY bazę PRZED przebiegiem, żeby przerwany przebieg nie psuł następnego.
 *
 * Zasiew: zestaw L (`scripts/perf/seed-large.ts`, deterministyczny, truncate na
 * wejściu) plus prawdziwy katalog szablonów i agentów (`drizzle/seed-catalog.ts`),
 * bo kreator kampanii szuka szablonu po nazwie z katalogu, a nie po generycznej
 * nazwie z generatora.
 *
 * Podstawienie robimy skryptem, a nie w npm scripts, bo TEST_DATABASE_URL mieszka
 * w `.env.local`, nie w środowisku powłoki — tak samo jak `scripts/perf/start-perf.mjs`.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import { spawn, spawnSync } from 'node:child_process';

const test = process.env.TEST_DATABASE_URL;
if (!test) {
  console.error('[e2e-serve] TEST_DATABASE_URL nie jest ustawiony (patrz .env.example)');
  process.exit(1);
}
for (const [nazwa, url] of [
  ['DATABASE_URL', process.env.DATABASE_URL],
  ['PERF_DATABASE_URL', process.env.PERF_DATABASE_URL],
  ['PREVIEW_DATABASE_URL', process.env.PREVIEW_DATABASE_URL],
]) {
  if (url && url === test) {
    console.error(`[e2e-serve] TEST_DATABASE_URL jest równy ${nazwa}, odmawiam czyszczenia`);
    process.exit(1);
  }
}

const kroki = [
  ['schemat', ['tsx', 'drizzle/migrate.ts'], { DATABASE_URL: test }],
  ['zestaw L', ['tsx', 'scripts/perf/seed-large.ts'], { PERF_DATABASE_URL: test }],
  ['katalog', ['tsx', 'drizzle/seed-catalog.ts'], { DATABASE_URL: test }],
];
for (const [opis, args, env] of kroki) {
  console.log(`[e2e-serve] ${opis}`);
  const r = spawnSync('npx', args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const port = process.env.E2E_PORT ?? '3000';
console.log(`[e2e-serve] next dev na bazie testowej, port ${port}`);
const child = spawn('npx', ['next', 'dev', '--turbopack', '-p', port], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: test },
});
child.on('exit', (code) => process.exit(code ?? 0));
