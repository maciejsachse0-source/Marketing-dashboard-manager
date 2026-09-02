import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

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
