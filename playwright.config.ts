import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // F7-18: zanim ruszy pierwszy test, sprawdź czy serwer pod BASE_URL stoi na tej
  // bazie, o której myślisz. `reuseExistingServer` niżej bierze cudzy proces bez słowa.
  globalSetup: './e2e/global-setup.ts',
  // A shared dev server plus parallel logins to the same single-user account is
  // a recipe for flakes. One worker until there is a reason for more.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    // F7-21: własny skrypt, bo `npm run dev` stawiał serwer na bazie ROBOCZEJ
    // i scenariusze dopisywały do niej śmieci. `scripts/e2e-serve.mjs` czyści
    // i zasiewa bazę testową, dopiero potem uruchamia `next dev`.
    command: 'node scripts/e2e-serve.mjs',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
