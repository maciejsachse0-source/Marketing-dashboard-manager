/** Dowód do F6-01: żaden komunikat o błędzie nie idzie samym kolorem. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });
const BASE = 'http://localhost:3000';
// F7-42: do screenshots/ tylko pod UPDATE_SHOTS=1, inaczej bramka brudzi drzewo.
const OUT = path.join(process.cwd(), process.env.UPDATE_SHOTS === '1' ? 'screenshots' : 'test-results', 'F6');
mkdirSync(OUT, { recursive: true });
const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'osoby.xlsx');

async function zaloguj(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(process.env.AUTH_EMAIL);
  await page.getByLabel('Hasło').fill(process.env.AUTH_PASSWORD);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

const opisAlertow = () =>
  Array.from(document.querySelectorAll('[role="alert"], [data-testid$="-error"]')).map((el) => ({
    testid: el.getAttribute('data-testid') || '',
    tekst: (el.innerText || '').trim(),
    ikona: el.querySelector('svg') !== null,
  }));

const browser = await chromium.launch();
const raport = {};

// 1. Zły format pliku.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await zaloguj(page);
  await page.goto(`${BASE}/import/osoby`);
  await page.setInputFiles('input[type=file]', {
    name: 'osoby.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('a,b\n1,2\n'),
  });
  await page.getByTestId('import-file-error').waitFor();
  raport.zlyFormat = await page.evaluate(opisAlertow);
  await page.screenshot({ path: path.join(OUT, 'blad-zly-format.png') });
  await ctx.close();
}

// 2. Kolizja mapowania: dwie kolumny na jedno pole.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await zaloguj(page);
  await page.goto(`${BASE}/import/osoby`);
  await page.setInputFiles('input[type=file]', FIXTURE);
  await page.getByTestId('import-do-mapowania').click();
  await page.getByLabel('Pole dla kolumny Uwagi').click();
  await page.getByRole('option', { name: 'Email' }).click();
  await page.getByTestId('import-mapping-conflict').waitFor();
  raport.kolizja = await page.evaluate(opisAlertow);
  raport.kolizjaDalej = await page.getByTestId('import-do-podgladu').isDisabled();
  await page.screenshot({ path: path.join(OUT, 'blad-kolizja-mapowania.png') });
  await ctx.close();
}

// 3. Obwódka ogniskowania na guziku paska narzędzi kalendarza.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await zaloguj(page);
  await page.goto(`${BASE}/calendar`);
  const guzik = page.getByRole('button', { name: 'Dziś' });
  await guzik.focus();
  raport.obwodka = await guzik.evaluate((el) => {
    const s = getComputedStyle(el);
    return { boxShadow: s.boxShadow, borderColor: s.borderColor };
  });
  await page.screenshot({ path: path.join(OUT, 'ognisko-kalendarz-dzis.png'), clip: { x: 220, y: 60, width: 700, height: 120 } });
  await ctx.close();
}

await browser.close();
writeFileSync(path.join(OUT, 'bledy-i-ognisko.json'), JSON.stringify(raport, null, 2));
console.log(JSON.stringify(raport, null, 2));
