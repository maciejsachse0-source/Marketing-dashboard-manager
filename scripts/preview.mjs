/**
 * Środowisko podglądowe dla zespołu (F5-04): produkcyjny build aplikacji na
 * OSOBNEJ bazie `marketing_preview`, wypełnionej zestawem L z generatora
 * `scripts/perf/seed-large.ts`. Zero prawdziwych osób, zero bazy roboczej,
 * zero bazy pomiarowej — klikanie zespołu nie może ruszyć ani danych roboczych,
 * ani liczb, na których stoją progi wydajnościowe.
 *
 *   node scripts/preview.mjs migrate  — schemat na bazie podglądowej
 *   node scripts/preview.mjs seed     — zestaw L (kasuje poprzednią zawartość)
 *   node scripts/preview.mjs serve    — `next start` na porcie 3001, na 0.0.0.0
 *
 * `PREVIEW_DATABASE_URL` mieszka w `.env.local`, a nie w środowisku powłoki,
 * więc podstawienie robimy tutaj, tak samo jak w `scripts/perf/start-perf.mjs`.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import { spawn } from 'node:child_process';

const tryb = process.argv[2];
const preview = process.env.PREVIEW_DATABASE_URL;

if (!preview) {
  console.error('[preview] PREVIEW_DATABASE_URL nie jest ustawiony (patrz .env.example)');
  process.exit(1);
}
if (!['migrate', 'seed', 'serve'].includes(tryb)) {
  console.error('[preview] użycie: node scripts/preview.mjs migrate|seed|serve');
  process.exit(1);
}

const PORT = process.env.PREVIEW_PORT ?? '3001';

const komendy = {
  // Migracje i generator zestawu L czytają inne zmienne, więc podstawiamy bazę
  // podglądową pod tę, której każdy z nich szuka.
  migrate: ['npx', ['tsx', 'drizzle/migrate.ts'], { DATABASE_URL: preview }],
  seed: ['npx', ['tsx', 'scripts/perf/seed-large.ts'], { PERF_DATABASE_URL: preview }],
  serve: ['npx', ['next', 'start', '-p', PORT, '-H', '0.0.0.0'], { DATABASE_URL: preview }],
};

const [cmd, args, env] = komendy[tryb];
if (tryb === 'serve') {
  console.log(`[preview] baza podglądowa, port ${PORT}, nasłuch na 0.0.0.0`);
}
const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
child.on('exit', (code) => process.exit(code ?? 0));
