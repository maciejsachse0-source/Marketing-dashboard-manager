import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { connectTestDb } from './db';

/**
 * Scenariusze end-to-end fazy F5 (plan/06 sekcja 3): kalendarz z przewijaniem
 * i filtrem oraz dodanie produkcji. Logowanie stoi w `login.spec.ts`, pełny
 * import z fixture w `import-osoby.spec.ts` — oba zostawiają własny zrzut
 * w `screenshots/F5/`.
 *
 * Dane: wyłącznie to, co już siedzi w bazie roboczej, plus jedna produkcja
 * o nazwie z prefiksem `E2E F5` tworzona i kasowana przez ten plik. Żadnych
 * prawdziwych danych osobowych, poświadczenia z `.env.local` (konto lokalne),
 * nigdy z produkcji.
 */
const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;
const SHOTS = path.join(process.cwd(), 'screenshots', 'F5');
const TYTUL = 'E2E F5 produkcja testowa';

async function zaloguj(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Hasło').fill(PASSWORD!);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  expect(EMAIL, 'AUTH_EMAIL musi być w .env.local').toBeTruthy();
  expect(PASSWORD, 'AUTH_PASSWORD musi być w .env.local').toBeTruthy();
  await zaloguj(page);
});

test('kalendarz: przewinięcie osi czasu i filtr kampanii', async ({ page }) => {
  await page.goto('/calendar?view=quarter');
  await expect(page.getByRole('heading', { name: 'Pipeline', level: 1 })).toBeVisible();

  // Przewijanie: pas ganta jest szerszy niż okno, więc ma czym przewijać.
  const pas = page.locator('div.overflow-x-auto').first();
  await expect(pas).toBeVisible({ timeout: 30_000 });
  const zakres = await pas.evaluate((el) => ({
    scroll: el.scrollWidth,
    widok: el.clientWidth,
  }));
  expect(zakres.scroll, 'gant musi być szerszy niż okno, inaczej nie ma czego przewijać').toBeGreaterThan(
    zakres.widok,
  );
  const po = await pas.evaluate((el) => {
    el.scrollLeft = el.scrollWidth - el.clientWidth;
    return el.scrollLeft;
  });
  expect(po).toBeGreaterThan(0);

  // Filtr kampanii: wybór pierwszej kampanii z listy pokazuje jej narrację.
  const select = page.locator('select[title^="Wybierz kampanię"]');
  await expect(select).toBeVisible();
  const opcje = await select.locator('option').evaluateAll((els) =>
    els
      .map((e) => ({ value: (e as HTMLOptionElement).value, label: (e.textContent ?? '').trim() }))
      .filter((o) => o.value !== 'none'),
  );
  expect(opcje.length, 'baza musi mieć co najmniej jedną kampanię').toBeGreaterThan(0);
  const nazwa = opcje[0].label.replace(/ \(poza oknem\)$/, '');
  await select.selectOption(opcje[0].value);
  await expect(page.locator(`[title^="Kampania ${nazwa} "]`).first()).toBeVisible({
    timeout: 15_000,
  });

  await page.screenshot({ path: path.join(SHOTS, 'F5-03-kalendarz-filtr.png'), fullPage: false });
});

test.describe('dodanie produkcji', () => {
  // Baza testowa jest czyszczona przed przebiegiem (F7-21), ale test i tak
  // kasuje po sobie produkcję `E2E F5`, żeby dwa uruchomienia pod rząd na tym
  // samym serwerze nie wchodziły sobie w drogę.
  const sql = connectTestDb();

  test.afterAll(async () => {
    await sql`delete from productions where title = ${TYTUL}`;
    await sql.end();
  });

  test('kreator zakłada produkcję i otwiera jej stronę', async ({ page }) => {
    await sql`delete from productions where title = ${TYTUL}`;

    await page.goto('/productions/list');

    const okno = page.getByRole('dialog');
    // F7-21: serwer e2e startuje na zimno, więc pierwsze kliknięcie potrafi
    // trafić w stronę przed hydracją i przepaść. Ponawiamy, zamiast czekać
    // dłużej na okno, którego nikt już nie otworzy.
    await expect(async () => {
      await page.getByRole('button', { name: /Nowa produkcja/ }).first().click();
      await expect(okno.getByText('krok 1/3')).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await okno.getByRole('button', { name: /Dalej/ }).click();

    await okno.getByLabel('Tytuł produkcji').fill(TYTUL);
    // Artysta: pierwszy z listy poza guzikiem „bez artysty" (ten jest pierwszy
    // i ustawia null).
    const artysci = okno.getByRole('button');
    const wszystkie = await artysci.allTextContents();
    const indeks = wszystkie.findIndex(
      (t, i) => i > 0 && t.trim().length > 0 && !/Wstecz|Anuluj|Dalej|Utwórz/.test(t),
    );
    expect(indeks, 'lista artystów nie może być pusta').toBeGreaterThan(0);
    await artysci.nth(indeks).click();
    await okno.getByRole('button', { name: /Dalej/ }).click();

    await expect(okno.getByText('krok 3/3')).toBeVisible();
    await okno.getByRole('button', { name: /Utwórz produkcję/ }).click();

    // Kreator przerzuca na stronę produkcji. Od F7-24 w nagłówku stoi TYTUŁ,
    // więc sprawdzamy go wprost.
    await page.waitForURL(/\/productions\/\d+$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: TYTUL, level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    const [wiersz] = await sql`select id, title from productions where title = ${TYTUL}`;
    expect(wiersz?.title, 'produkcja nie trafiła do bazy').toBe(TYTUL);
    expect(page.url()).toContain(`/productions/${wiersz.id}`);

    // Na liście każda karta ma swój tytuł (F7-24), więc rozpoznajemy produkcję
    // po tytule w karcie prowadzącej pod jej adres.
    await page.goto('/productions/list');
    await expect(
      page.locator(`a[href="/productions/${wiersz.id}"]`).getByText(TYTUL).first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(SHOTS, 'F5-04-produkcja-dodana.png'),
      fullPage: false,
    });
  });
});
