import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { config } from 'dotenv';
import ExcelJS from 'exceljs';

config({ path: '.env.local' });
const BASE = 'http://localhost:3000';
const OUT = path.join(process.cwd(), 'screenshots', 'F6');
mkdirSync(OUT, { recursive: true });
const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'osoby.xlsx');

// Arkusz bez wierszy danych — do zrzutu stanu pustego.
const PUSTY = '/tmp/f6-pusty.xlsx';
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pusty arkusz');
  ws.addRow(['Imię', 'E-mail']);
  await wb.xlsx.writeFile(PUSTY);
}

async function zaloguj(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(process.env.AUTH_EMAIL);
  await page.getByLabel('Hasło').fill(process.env.AUTH_PASSWORD);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

const browser = await chromium.launch();
const raport = {};

// 1. Stan pusty arkusza (1280 x 720).
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await zaloguj(page);
  await page.goto(`${BASE}/import/osoby`);
  await page.setInputFiles('input[type=file]', PUSTY);
  await page.getByTestId('import-pusty-arkusz').waitFor();
  raport.pustyKomunikat = await page.getByTestId('import-pusty-arkusz').innerText();
  raport.dalejZablokowany = await page.getByTestId('import-do-mapowania').isDisabled();
  await page.screenshot({ path: path.join(OUT, 'import-pusty-arkusz.png') });
  await ctx.close();
}

// 2. Mapowanie jako lista kart poniżej 768 px (375 x 800).
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await zaloguj(page);
  await page.goto(`${BASE}/import/osoby`);
  await page.setInputFiles('input[type=file]', FIXTURE);
  await page.getByTestId('import-do-mapowania').click();
  await page.getByTestId('import-podsumowanie-na-zywo').waitFor();
  raport.kartyUklad = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="import-mapping-karty"]');
    const tr = box.querySelector('tbody tr');
    const td = tr.querySelector('td');
    return {
      thead: getComputedStyle(box.querySelector('thead')).display,
      tr: getComputedStyle(tr).display,
      td: getComputedStyle(td).display,
      trBorder: getComputedStyle(tr).borderTopWidth,
      szerokoscOkna: window.innerWidth,
    };
  });
  await page.screenshot({ path: path.join(OUT, 'import-mapowanie-karty-375.png'), fullPage: true });
  await ctx.close();
}

// 2b. Ta sama tabela na 1280 px — dowód, że powyżej 768 px zostaje tabelą.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await zaloguj(page);
  await page.goto(`${BASE}/import/osoby`);
  await page.setInputFiles('input[type=file]', FIXTURE);
  await page.getByTestId('import-do-mapowania').click();
  await page.getByTestId('import-podsumowanie-na-zywo').waitFor();
  raport.tabelaUklad = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="import-mapping-karty"]');
    return {
      thead: getComputedStyle(box.querySelector('thead')).display,
      tr: getComputedStyle(box.querySelector('tbody tr')).display,
    };
  });
  await page.screenshot({ path: path.join(OUT, 'import-mapowanie-tabela-1280.png') });
  await ctx.close();
}

// 3. Pasek postępu przy prefers-reduced-motion. Strumień zapisu jest podstawiony
// w przeglądarce, więc nic nie trafia do bazy.
for (const [nazwa, reduced] of [
  ['import-pasek-postepu-normalny', 'no-preference'],
  ['import-pasek-postepu-reduced-motion', 'reduce'],
]) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: reduced,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/import/people/save')) {
        const body = new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('{"batch":3,"of":10}\n'));
            // strumień celowo zostaje otwarty, żeby pasek postępu został na ekranie
          },
        });
        return Promise.resolve(
          new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
        );
      }
      return orig(input, init);
    };
  });
  await zaloguj(page);
  await page.goto(`${BASE}/import/osoby`);
  await page.setInputFiles('input[type=file]', FIXTURE);
  await page.getByTestId('import-do-mapowania').click();
  await page.getByTestId('import-do-podgladu').click();
  await page.getByTestId('import-do-zatwierdzenia').click();
  await page.getByTestId('import-zapisz').click();
  await page.getByTestId('import-postep').waitFor();
  raport[nazwa] = await page.evaluate(() => {
    const bar = document.querySelector('[role="progressbar"] > div');
    const s = getComputedStyle(bar);
    const spinner = document.querySelector('[data-slot="button-spinner"]');
    return {
      tekst: document.querySelector('[data-testid="import-postep"]').innerText,
      szerokosc: s.width,
      transitionDuration: s.transitionDuration,
      animationName: s.animationName,
      spinnerAnimacja: spinner ? getComputedStyle(spinner).animationName : 'brak spinnera',
      reduceMatch: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });
  await page.screenshot({ path: path.join(OUT, `${nazwa}.png`) });
  await ctx.close();
}

await browser.close();
writeFileSync(path.join(OUT, 'import-widoki.json'), JSON.stringify(raport, null, 2));
console.log(JSON.stringify(raport, null, 2));
