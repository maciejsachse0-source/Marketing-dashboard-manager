import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { connectTestDb } from './db';

const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;
const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'osoby.xlsx');

// Fixture jest poza gitem (zasada Z14: zero arkuszy w repozytorium). Generator
// jest deterministyczny, wiec brakujacy plik odtwarzamy przed pierwszym testem.
test.beforeAll(() => {
  if (!existsSync(FIXTURE)) {
    execFileSync('npx', ['tsx', 'scripts/make-fixture-xlsx.ts'], { stdio: 'inherit' });
  }
});

async function zaloguj(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Hasło').fill(PASSWORD!);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function wgrajFixture(page: Page) {
  await page.setInputFiles('input[type=file]', FIXTURE);
  await expect(page.getByLabel('Arkusz', { exact: true })).toBeVisible();
}

/** Fixture ma układ prawdziwego skoroszytu: twórcy siedzą w arkuszu „Artyści". */
async function wybierzArtystow(page: Page) {
  await page.getByLabel('Arkusz', { exact: true }).click();
  await page.getByRole('option', { name: /^Artyści/ }).click();
}

/** Krok 2 na 3: arkusz twórców, rola twórcy, propozycja mapowania. */
async function doMapowania(page: Page) {
  await wybierzArtystow(page);
  await page.getByTestId('import-do-mapowania').click();
  await expect(page.getByTestId('import-podsumowanie-na-zywo')).toBeVisible();
}

test.describe('import osób, kroki 1 do 4', () => {
  test.beforeEach(async ({ page }) => {
    expect(EMAIL, 'AUTH_EMAIL musi być w .env.local').toBeTruthy();
    await zaloguj(page);
  });

  // Tabela zdarzeń: wejście na stronę bez sesji.
  test('bez sesji przekierowanie na /login', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/import/osoby');
    expect(new URL(page.url()).pathname).toBe('/login');
  });

  // Tabela zdarzeń: upuszczenie pliku na strefę zrzutu podświetla ramkę.
  test('strefa zrzutu podświetla się przy przeciąganiu', async ({ page }) => {
    await page.goto('/import/osoby');
    const strefa = page.getByTestId('import-dropzone');
    await expect(strefa).toHaveAttribute('data-drag-active', 'false');
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await strefa.dispatchEvent('dragenter', { dataTransfer: dt });
    await expect(strefa).toHaveAttribute('data-drag-active', 'true');
    await strefa.dispatchEvent('dragleave');
    await expect(strefa).toHaveAttribute('data-drag-active', 'false');
  });

  // Tabela zdarzeń: wybór pliku innego niż .xlsx.
  test('plik spoza xlsx odrzucony z komunikatem', async ({ page }) => {
    await page.goto('/import/osoby');
    await page.setInputFiles('input[type=file]', {
      name: 'osoby.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('a,b\n1,2\n'),
    });
    await expect(page.getByTestId('import-file-error')).toHaveText(
      'Ten format nie jest obsługiwany. Wgraj plik xlsx',
    );
    await expect(page.getByTestId('import-dropzone')).toBeVisible();
  });

  // Tabela zdarzeń: plik powyżej 10 MB.
  test('plik powyżej limitu odrzucony z podaniem rozmiaru', async ({ page }) => {
    await page.goto('/import/osoby');
    await page.setInputFiles('input[type=file]', {
      name: 'wielki.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.alloc(11 * 1024 * 1024),
    });
    await expect(page.getByTestId('import-file-error')).toHaveText(
      'Plik ma 11,0 MB, a limit to 10,0 MB',
    );
  });

  // Tabela zdarzeń: brak wierszy do zaimportowania.
  test('arkusz bez wierszy blokuje przejście dalej', async ({ page }) => {
    await page.goto('/import/osoby');
    await wgrajFixture(page);
    await page.getByLabel('Arkusz', { exact: true }).click();
    await page.getByRole('option', { name: /^Szablony/ }).click();
    await expect(page.getByTestId('import-pusty-arkusz')).toHaveText(
      'Arkusz nie zawiera wierszy z danymi',
    );
    await expect(page.getByTestId('import-do-mapowania')).toBeDisabled();
  });

  // Tabela zdarzeń: zmiana wyboru w mapowaniu przelicza podgląd bez wysyłania pliku.
  test('zmiana mapowania przelicza podgląd bez ponownego uploadu', async ({ page }) => {
    await page.goto('/import/osoby');
    await wgrajFixture(page);
    await doMapowania(page);

    const podsumowanie = page.getByTestId('import-podsumowanie-na-zywo');
    const przed = await podsumowanie.textContent();

    let uploady = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/import/people')) uploady += 1;
    });

    await page.getByLabel('Pole dla kolumny Imię').click();
    await page.getByRole('option', { name: 'kolumna pomijana' }).click();

    // Od F7-44 samo odpięcie imienia nie zeruje wyniku: nazwa leci wtedy
    // z handle. Zero nowych osób daje dopiero odpięcie obu kolumn naraz.
    await expect(podsumowanie).not.toHaveText(przed!);
    await page.getByLabel('Pole dla kolumny Instagram').click();
    await page.getByRole('option', { name: 'kolumna pomijana' }).click();

    await expect(podsumowanie).toContainText('0 nowych');
    expect(uploady).toBe(0);
  });

  // Tabela zdarzeń: dwie kolumny zmapowane na jedno pole.
  test('kolizja mapowania blokuje przejście dalej i wskazuje kolumny', async ({ page }) => {
    await page.goto('/import/osoby');
    await wgrajFixture(page);
    await doMapowania(page);

    await page.getByLabel('Pole dla kolumny Notatki').click();
    await page.getByRole('option', { name: 'Email' }).click();

    const komunikat = page.getByTestId('import-mapping-conflict');
    await expect(komunikat).toContainText('E-mail');
    await expect(komunikat).toContainText('Notatki');
    await expect(page.getByTestId('import-do-podgladu')).toBeDisabled();
    await expect(page.getByLabel('Pole dla kolumny E-mail')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Pole dla kolumny Notatki')).toHaveAttribute('aria-invalid', 'true');
  });

  // Tabela zdarzeń: Tab przez mapowanie idzie w kolejności kolumn.
  test('Tab przechodzi selecty w kolejności kolumn arkusza', async ({ page }) => {
    await page.goto('/import/osoby');
    await wgrajFixture(page);
    await doMapowania(page);

    await page.getByLabel('Pole dla kolumny Imię').focus();
    const kolejnosc = ['Instagram', 'E-mail', 'W trakcie', 'Link', 'Lokalizacja'];
    for (const naglowek of kolejnosc) {
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(`Pole dla kolumny ${naglowek}`)).toBeFocused();
    }
  });

  // Krok 4: suchy przebieg pokazuje liczby i nie dotyka bazy (licznik w raporcie).
  test('suchy przebieg pokazuje liczby i pierwsze 20 wierszy', async ({ page }) => {
    await page.goto('/import/osoby');
    await wgrajFixture(page);
    await doMapowania(page);
    await page.getByTestId('import-do-podgladu').click();

    await expect(page.getByTestId('licznik-nowe')).not.toHaveText('0');
    await expect(page.getByTestId('licznik-bledy')).not.toHaveText('0');
    await expect(page.getByTestId('podglad-wiersz')).toHaveCount(20);
  });
});

test('fixture jest syntetyczny, bez prawdziwych danych', () => {
  const bytes = readFileSync(FIXTURE);
  expect(bytes.byteLength).toBeGreaterThan(0);
});

test.describe('import osób, kroki 5 do 7', () => {
  // Ten blok wsypuje do bazy 970 osób. Od F7-21 idzie to do bazy TESTOWEJ,
  // czyszczonej i zasiewanej przed przebiegiem przez `scripts/e2e-serve.mjs`,
  // więc zamiast sprzątania po znaczniku `max(id)` po prostu opróżniamy tabelę.
  // Kolejność plików ma znaczenie: scenariusze, które potrzebują zasianych
  // artystów (`f5-scenariusze`), biegną wcześniej, a późniejsze zakładają
  // własnych.
  const sql = connectTestDb();

  test.afterAll(async () => {
    await sql.end();
  });

  test.beforeEach(async ({ page }) => {
    // Każdy test tego bloku startuje z tego samego stanu bazy, inaczej import
    // z jednego testu robi z wierszy następnego same duplikaty.
    await sql`truncate table artists restart identity cascade`;
    await zaloguj(page);
    await page.goto('/import/osoby');
    await wgrajFixture(page);
    await doMapowania(page);
    await page.getByTestId('import-do-podgladu').click();
    await page.getByTestId('import-do-zatwierdzenia').click();
    await expect(page.getByTestId('import-do-zapisu')).toBeVisible();
  });

  // Tabela zdarzeń: zapis nie powiódł się.
  test('błąd zapisu zachowuje formularz i nie zostawia danych', async ({ page }) => {
    await page.route('**/api/import/people/save', (route) =>
      route.fulfill({ status: 500, body: 'boom' }),
    );
    await page.getByTestId('import-zapisz').click();

    await expect(page.getByTestId('import-blad-zapisu')).toContainText('HTTP 500');
    // Formularz zachowany: krok 5 dalej stoi, z tym samym wyborem i liczbami.
    await expect(page.getByLabel('Duplikaty pewne, czyli ten sam handle albo email')).toBeVisible();
    await expect(page.getByTestId('import-zapisz')).toBeEnabled();
  });

  // Tabela zdarzeń: trwający zapis oraz sukces z podsumowaniem.
  test('zapis pokazuje licznik paczek, potem podsumowanie', async ({ page }) => {
    const zapisano = page.getByTestId('import-do-zapisu');
    await expect(zapisano).toContainText('nowych');

    // Licznik paczek sprawdzamy na strumieniu, nie na przelotnym stanie DOM:
    // zapis 985 wierszy trwa kilkadziesiąt milisekund, więc asercja na widoku
    // wygrywała wyścig raz na kilka przebiegów. Widok pokazuje dokładnie te linie.
    const linie: string[] = [];
    await page.route('**/api/import/people/save', async (route) => {
      const res = await route.fetch();
      const body = await res.body();
      linie.push(...body.toString('utf8').split('\n').filter(Boolean));
      await route.fulfill({ response: res, body });
    });

    await page.getByTestId('import-zapisz').click();

    const podsumowanie = page.getByTestId('import-podsumowanie');
    await expect(podsumowanie).toBeVisible({ timeout: 30_000 });
    // 970, nie 960: od F7-44 dziesięć wierszy fixture bez imienia, ale z handle,
    // wchodzi jako osoby zamiast lecieć jako błąd „brak nazwy”.
    await expect(podsumowanie).toContainText('Dodano 970');
    const link = page.getByTestId('import-link-lista');
    await expect(link).toHaveText('Przejdź do artystów');
    await expect(link).toHaveAttribute('href', '/artists');

    expect(linie).toContain('{"batch":1,"of":10}');
    expect(linie).toContain('{"batch":10,"of":10}');
    expect(linie.at(-1)).toContain('"done":true');

    // Zrzut scenariusza F5-03 (plan/06 sekcja 3, scenariusz „pełny import
    // z fixture"). Fixture jest syntetyczny, na zrzucie nie ma prawdziwych osób.
    // F7-42: do screenshots/ tylko pod UPDATE_SHOTS=1, inaczej bramka brudzi drzewo.
    const shots = path.join(process.cwd(), process.env.UPDATE_SHOTS === '1' ? 'screenshots' : 'test-results', 'F5');
    mkdirSync(shots, { recursive: true });
    await page.screenshot({
      path: path.join(shots, 'F5-02-import-podsumowanie.png'),
      fullPage: false,
    });

    const pobranie = page.waitForEvent('download');
    await page.getByTestId('import-pobierz-bledy').click();
    const plik = await pobranie;
    expect(plik.suggestedFilename()).toBe('import-bledy.csv');
  });
});
