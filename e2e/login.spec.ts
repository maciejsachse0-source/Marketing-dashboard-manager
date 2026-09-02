import { expect, test } from '@playwright/test';

const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;

test('logowanie parą z env otwiera /calendar', async ({ page }) => {
  expect(EMAIL, 'AUTH_EMAIL musi być w .env.local').toBeTruthy();
  expect(PASSWORD, 'AUTH_PASSWORD musi być w .env.local').toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Hasło').fill(PASSWORD!);
  await page.getByRole('button', { name: /zaloguj/i }).click();

  // The form is a server action, so the redirect lands a moment after the click.
  // Navigating straight away raced it and the proxy bounced us back to /login,
  // where /calendar still answered 200 because the redirect had been followed.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));

  const response = await page.goto('/calendar');
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/calendar');
  await expect(page.getByRole('heading', { name: 'Pipeline', level: 1 })).toBeVisible();
});
