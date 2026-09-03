import { expect, test, type Page } from '@playwright/test';
import { connectTestDb } from './db';

/**
 * F7-27: pole „Start produkcji" musi się zamykać w kółko. Przed naprawą uchwyt
 * startu liczył się z poniedziałku tygodnia T-0, więc przesunięcie o 1..6 dni
 * przestawiało `t0At` w bazie, a pole po przeładowaniu pokazywało starą datę —
 * i każde powtórzenie dokładało kolejną deltę.
 *
 * Nazwa pliku zaczyna się od `f7`, żeby scenariusz poszedł PRZED
 * `import-osoby.spec.ts`, który czyści tabelę artystów (kaskadą razem
 * z produkcjami).
 */
const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;

async function zaloguj(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Hasło').fill(PASSWORD!);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

function doInputu(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

test('start produkcji: przesunięcie o n dni widać w polu, powtórka nic nie zmienia', async ({
  page,
}) => {
  expect(EMAIL, 'AUTH_EMAIL musi być w .env.local').toBeTruthy();
  await zaloguj(page);

  const sql = connectTestDb();
  const rows = await sql<{ id: number }[]>`
    select id from productions where cancelled_at is null order by id limit 1`;
  await sql.end();
  expect(rows.length, 'baza testowa musi mieć produkcję').toBe(1);
  const url = `/productions/${rows[0].id}`;

  const pole = () => page.locator('input[type="date"]').first();

  for (const n of [1, 2, 3]) {
    await page.goto(url);
    const przed = await pole().inputValue();
    const [y, m, d] = przed.split('-').map(Number);
    const chciane = doInputu(new Date(y, m - 1, d + n));
    await pole().fill(chciane);
    await pole().blur();
    await expect(page.getByText('Timeline przesunięty')).toBeVisible({ timeout: 15_000 });
    await page.goto(url);
    expect(await pole().inputValue(), `przesunięcie o ${n} dni`).toBe(chciane);
  }

  // Powtórka tej samej daty nie rusza już osi: T-0 przed i po jest identyczne.
  const t0 = async () => ((await page.locator('body').innerText()).match(/T-0:[^\n]*/) ?? ['?'])[0];
  await page.goto(url);
  const przedPowtorka = await t0();
  const obecna = await pole().inputValue();
  await pole().fill(obecna);
  await pole().blur();
  await page.waitForTimeout(1500);
  await page.goto(url);
  expect(await t0()).toBe(przedPowtorka);
});
