import { expect, test } from '@playwright/test';

/**
 * Sieć bezpieczeństwa dla nieświeżych danych po mutacji. Powstała przy issue
 * F1-03, gdzie próbowaliśmy wpiąć katalogi w cache Next 16 (Cache Components).
 * Zmiana została cofnięta, bo pomiar nie potwierdził hipotezy (szczegóły
 * w `DECISIONS.md`), ale test zostaje: pilnuje, że mutacja z interfejsu
 * odświeża widok bez twardego przeładowania, więc złapie regres także wtedy,
 * gdy ktoś ruszy `revalidatePath` albo wróci do tematu cache.
 *
 * Dlaczego osoba, a nie wpis kalendarza, jak mówiło pierwotne kryterium:
 * wpisu kalendarza nie da się dziś dodać z interfejsu (znalezisko F7-09).
 */

const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;

test('po dodaniu osoby lista pokazuje ją bez twardego odświeżenia', async ({ page }) => {
  expect(EMAIL, 'AUTH_EMAIL musi być w .env.local').toBeTruthy();
  expect(PASSWORD, 'AUTH_PASSWORD musi być w .env.local').toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Hasło').fill(PASSWORD!);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));

  await page.goto('/artists');

  const name = `Test cache ${Date.now()}`;
  await page.getByRole('button', { name: /dodaj artyst/i }).click();
  await page.getByLabel('Imię / Nazwa *').fill(name);
  await page.getByRole('button', { name: 'Zapisz' }).click();

  // Bez reload(): jeżeli widok nie zostałby unieważniony, lista przyszłaby
  // w starej postaci i nowej osoby by tu nie było.
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

  // Druga wizyta, też bez twardego odświeżenia — sprawdza, że unieważnienie
  // przeżyło nawigację, a nie tylko odświeżyło bieżące drzewo Reacta.
  await page.goto('/');
  await page.goto('/artists');
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });
});
