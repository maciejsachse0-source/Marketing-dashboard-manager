import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Issue F2-04. Memoizacja ganta ma sens tylko wtedy, gdy interakcja, która
 * przerysowuje wszystkie wiersze naraz, mieści się w progu. Scenariusz zmienia
 * filtr kampanii w pasku narzędzi i mierzy czas od zdarzenia `change`
 * na `<select>` do klatki, w której gant pokazuje już narrację nowej kampanii.
 *
 * Pomiar liczy przeglądarka (`performance.now()` w kontekście strony), więc
 * nie doliczają się round-tripy protokołu Playwrighta. Trzy przebiegi
 * i mediana, bo rozrzut pojedynczego pomiaru sięga kilkudziesięciu procent.
 *
 * Zestaw L: uruchom `npm run perf:serve` (produkcyjny serwer na bazie
 * pomiarowej) i puść `npx playwright test e2e/gantt-filter.spec.ts`.
 *
 * F7-28: pomiar biegnie WYŁĄCZNIE na budowaniu produkcyjnym. Na `next dev`
 * mediana wychodziła 306-313 ms przy progu 300 ms (na `next start`: 116-139 ms),
 * więc bramka zapalała się na czerwono zależnie od tego, co akurat stoi na
 * porcie 3000. Serwer deweloperski rozpoznajemy po polu `dev` z `/api/health`.
 */

const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;
const PROG_MS = 300;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Hasło').fill(PASSWORD!);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Zmienia wybraną kampanię i zwraca czas do klatki z nową narracją (ms). */
async function switchCampaign(page: Page, value: string, name: string): Promise<number> {
  return page.evaluate(
    async ([v, expected]) => {
      const sel = document.querySelector<HTMLSelectElement>(
        'select[title^="Wybierz kampanię"]',
      );
      if (!sel) throw new Error('nie ma selektora kampanii');
      const hasNarrative = () =>
        [...document.querySelectorAll<HTMLElement>('[title^="Kampania "]')].some((el) =>
          (el.getAttribute('title') ?? '').startsWith(`Kampania ${expected} `),
        );
      const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

      const t0 = performance.now();
      // Ustawienie przez natywny setter — React nasłuchuje `change` na select,
      // ale ignoruje zdarzenie, gdy wartość ustawić wprost na właściwości.
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )!.set!;
      setter.call(sel, v);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      const deadline = t0 + 15_000;
      while (performance.now() < deadline) {
        if (hasNarrative()) {
          // Dwie klatki: pierwsza to commit Reacta, druga gwarantuje, że
          // przeglądarka faktycznie przemalowała.
          await nextFrame();
          await nextFrame();
          return performance.now() - t0;
        }
        await nextFrame();
      }
      return -1;
    },
    [value, name] as const,
  );
}

test('zmiana filtra kampanii przemalowuje gant poniżej progu', async ({ page }) => {
  expect(EMAIL, 'AUTH_EMAIL musi być w .env.local').toBeTruthy();
  expect(PASSWORD, 'AUTH_PASSWORD musi być w .env.local').toBeTruthy();

  await login(page);

  const health = await page.request.get('/api/health');
  const { dev } = (await health.json()) as { dev?: boolean };
  test.skip(
    dev !== false,
    'Pomiar przemalowania ganta ma sens tylko na budowaniu produkcyjnym. ' +
      'Na porcie 3000 stoi `next dev` (kod bez optymalizacji, mediana ~310 ms ' +
      'przy progu 300 ms). Uruchom `npm run perf:serve` i powtórz.',
  );

  await page.goto('/calendar?view=week');
  const select = page.locator('select[title^="Wybierz kampanię"]');
  await expect(select).toBeVisible({ timeout: 30_000 });

  // Dwie pierwsze kampanie z listy (pomijając „brak") — przełączamy tam
  // i z powrotem, więc każdy przebieg to realna zmiana danych w gancie.
  const options = await select.locator('option').evaluateAll((els) =>
    els
      .map((e) => ({ value: (e as HTMLOptionElement).value, label: (e.textContent ?? '').trim() }))
      .filter((o) => o.value !== 'none'),
  );
  expect(options.length, 'baza musi mieć co najmniej 2 kampanie').toBeGreaterThanOrEqual(2);
  const pair = options.slice(0, 2).map((o) => ({
    value: o.value,
    name: o.label.replace(/ \(poza oknem\)$/, ''),
  }));

  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const target = pair[i % 2];
    const ms = await switchCampaign(page, target.value, target.name);
    expect(ms, 'gant nie pokazał narracji wybranej kampanii').toBeGreaterThan(0);
    samples.push(Math.round(ms));
  }

  const median = [...samples].sort((a, b) => a - b)[1];
  mkdirSync('perf/runs', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    `perf/runs/gantt-filter-${stamp}.json`,
    JSON.stringify(
      {
        _opis: 'F2-04: czas od zmiany filtra kampanii do przemalowania ganta',
        baseUrl: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
        prog: PROG_MS,
        samples,
        medianMs: median,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`[F2-04] próbki: ${samples.join(', ')} ms; mediana: ${median} ms`);
  expect(median).toBeLessThan(PROG_MS);
});
