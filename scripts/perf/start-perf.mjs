/**
 * `next start` z DATABASE_URL podmienionym na PERF_DATABASE_URL, czyli serwer
 * produkcyjny gadający do bazy pomiarowej z zestawem L.
 *
 * Dlaczego skrypt, a nie `DATABASE_URL=$PERF_DATABASE_URL next start` wprost
 * w package.json: PERF_DATABASE_URL mieszka w `.env.local`, a nie w środowisku
 * powłoki, więc `$PERF_DATABASE_URL` w npm scripts rozwinęłoby się do pustego
 * łańcucha. Tutaj wczytujemy `.env.local` przez dotenv i dopiero wtedy
 * nadpisujemy zmienną. Next nie nadpisze jej ponownie z pliku, bo dotenv nie
 * rusza kluczy już obecnych w process.env.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { spawn } from 'node:child_process';

const perf = process.env.PERF_DATABASE_URL;
if (!perf) {
  console.error('[perf:serve] PERF_DATABASE_URL nie jest ustawiony');
  process.exit(1);
}

const child = spawn('npx', ['next', 'start'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: perf },
});
child.on('exit', (code) => process.exit(code ?? 0));
