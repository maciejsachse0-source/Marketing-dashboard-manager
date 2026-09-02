import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;
const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'osoby.xlsx');

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

/** Krok 2 na 3: arkusz twórców, rola twórcy, propozycja mapowania. */
async function doMapowania(page: Page) {
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
    await page.getByRole('option', { name: /^Pusty/ }).click();
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

    await expect(podsumowanie).not.toHaveText(przed!);
    await expect(podsumowanie).toContainText('0 nowych');
    expect(uploady).toBe(0);
  });

  // Tabela zdarzeń: dwie kolumny zmapowane na jedno pole.
  test('kolizja mapowania blokuje przejście dalej i wskazuje kolumny', async ({ page }) => {
    await page.goto('/import/osoby');
    await wgrajFixture(page);
    await doMapowania(page);

    await page.getByLabel('Pole dla kolumny Uwagi').click();
    await page.getByRole('option', { name: 'Email' }).click();

    const komunikat = page.getByTestId('import-mapping-conflict');
    await expect(komunikat).toContainText('E-mail');
    await expect(komunikat).toContainText('Uwagi');
    await expect(page.getByTestId('import-do-podgladu')).toBeDisabled();
    await expect(page.getByLabel('Pole dla kolumny E-mail')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Pole dla kolumny Uwagi')).toHaveAttribute('aria-invalid', 'true');
  });

  // Tabela zdarzeń: Tab przez mapowanie idzie w kolejności kolumn.
  test('Tab przechodzi selecty w kolejności kolumn arkusza', async ({ page }) => {
    await page.goto('/import/osoby');
    await wgrajFixture(page);
    await doMapowania(page);

    await page.getByLabel('Pole dla kolumny Imię').focus();
    const kolejnosc = ['Instagram', 'E-mail', 'Telefon', 'Miasto', 'Uwagi'];
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
  // Ten blok naprawdę pisze do bazy, z której korzysta serwer deweloperski.
  // ponytail: sprzątanie po znaczniku najwyższego id sprzed testu, czyli
  // kasujemy wyłącznie wiersze wstawione przez ten test. Osobna baza dla e2e
  // to szersza zmiana środowiska, opisana jako znalezisko w F7.
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 2 });
  let znacznik = 0;

  test.beforeAll(async () => {
    const [row] = await sql`select coalesce(max(id), 0)::int as id from artists`;
    znacznik = row.id as number;
  });

  test.afterAll(async () => {
    await sql`delete from artists where id > ${znacznik}`;
    await sql.end();
  });

  test.beforeEach(async ({ page }) => {
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

    await page.getByTestId('import-zapisz').click();
    await expect(page.getByTestId('import-zapisz')).toBeDisabled();
    await expect(page.getByTestId('import-postep')).toContainText('paczka');

    const podsumowanie = page.getByTestId('import-podsumowanie');
    await expect(podsumowanie).toBeVisible({ timeout: 30_000 });
    await expect(podsumowanie).toContainText('Dodano 975');
    const link = page.getByTestId('import-link-lista');
    await expect(link).toHaveText('Przejdź do artystów');
    await expect(link).toHaveAttribute('href', '/artists');

    const pobranie = page.waitForEvent('download');
    await page.getByTestId('import-pobierz-bledy').click();
    const plik = await pobranie;
    expect(plik.suggestedFilename()).toBe('import-bledy.csv');
  });
});
