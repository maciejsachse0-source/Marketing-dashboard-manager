/**
 * Audyt dostępności (F6-01) na URUCHOMIONEJ aplikacji.
 *
 * Sprawdza na `/calendar`, `/productions/list` i `/import/osoby`:
 *  1. przejście klawiaturą (Tab) — czy ogniskowanie obejmuje każdy element akcji
 *     i czy przy każdym widać obwódkę (outline albo box-shadow inne niż w spoczynku),
 *  2. guziki bez tekstu — czy mają dostępną nazwę (`aria-label` albo `title`),
 *  3. obszar dotyku — czy prostokąt trafienia ma co najmniej 44 x 44 px
 *     (liczony razem z pseudoelementem `::after`, którym poszerzamy strefę).
 *
 * Uruchomienie: `node scripts/a11y-audit.mjs` przy serwerze na porcie 3000.
 * Wynik: tabela na stdout plus `screenshots/F6/a11y-audit.json`. Kod 1, gdy
 * którykolwiek warunek nie jest spełniony.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const OUT = path.join(process.cwd(), 'screenshots', 'F6');
const STRONY = ['/calendar', '/productions/list', '/import/osoby'];
const MIN_DOTYK = 44;

/** Prostokąt trafienia elementu razem z pseudoelementem ::after. */
const HIT_BOX = `(el) => {
  const r = el.getBoundingClientRect();
  const after = getComputedStyle(el, '::after');
  let w = r.width, h = r.height;
  if (after && after.content !== 'none') {
    const aw = parseFloat(after.width), ah = parseFloat(after.height);
    if (Number.isFinite(aw) && aw > w) w = aw;
    if (Number.isFinite(ah) && ah > h) h = ah;
  }
  return { w: Math.round(w), h: Math.round(h) };
}`;

const OPIS = `(el) => {
  const t = (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') || '',
    text: t,
    label: el.getAttribute('aria-label') || el.getAttribute('title') || '',
    testid: el.getAttribute('data-testid') || '',
    cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60),
  };
}`;

async function zaloguj(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(process.env.AUTH_EMAIL);
  await page.getByLabel('Hasło').fill(process.env.AUTH_PASSWORD);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** Selektor wszystkiego, co jest akcją albo polem. */
const AKCJE =
  'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=combobox], [role=tab], [role=switch], [role=checkbox], [tabindex]:not([tabindex="-1"])';

async function audytStrony(page, sciezka, touchPage) {
  await page.goto(BASE + sciezka);
  await page.waitForLoadState('networkidle');

  // 1. Inwentarz elementów akcji widocznych na stronie.
  const widoczne = await page.$$eval(
    AKCJE,
    (els, opis) => {
      const f = new Function('return ' + opis)();
      return els
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (el.getRootNode() !== document) return false;
          if (el.tagName.toLowerCase() === 'nextjs-portal') return false;
          return (
            r.width > 0 &&
            r.height > 0 &&
            s.visibility !== 'hidden' &&
            s.display !== 'none' &&
            !el.hasAttribute('disabled') &&
            el.getAttribute('aria-hidden') !== 'true'
          );
        })
        .map(f);
    },
    OPIS,
  );

  // 2. Przejście Tabem: zbieramy elementy, które faktycznie dostają ognisko.
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('Tab');
  const trasa = [];
  const bezObwodki = [];
  const widziane = new Set();
  for (let i = 0; i < 4000; i += 1) {
    const info = await page.evaluate(
      ({ opis, hit }) => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        if (el.tagName.toLowerCase() === 'nextjs-portal') return { pomin: true };
        const f = new Function('return ' + opis)();
        const g = new Function('return ' + hit)();
        const s = getComputedStyle(el);
        // Obwódka jest widoczna, gdy element ma outline o niezerowej szerokości
        // albo box-shadow (Tailwind `ring-*` renderuje się jako box-shadow).
        const outline = parseFloat(s.outlineWidth) || 0;
        const cien = s.boxShadow && s.boxShadow !== 'none';
        const opisEl = f(el);
        return {
          ...opisEl,
          box: g(el),
          obwodka: (outline > 0 && s.outlineStyle !== 'none') || cien,
          outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
          boxShadow: (s.boxShadow || '').slice(0, 80),
          klucz: `${el.tagName}|${opisEl.text}|${opisEl.label}|${opisEl.testid}|${opisEl.cls}`,
        };
      },
      { opis: OPIS, hit: HIT_BOX },
    );
    if (!info) break;
    if (info.pomin) {
      await page.keyboard.press('Tab');
      continue;
    }
    if (widziane.has(info.klucz + i)) break;
    widziane.add(info.klucz + i);
    trasa.push(info);
    if (!info.obwodka) bezObwodki.push(info);
    await page.keyboard.press('Tab');
    // Cykl zamknięty: wróciliśmy do pierwszego elementu.
    const wrocilo = await page.evaluate(
      (k) => {
        const el = document.activeElement;
        if (!el || el === document.body) return false;
        const t = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const cls = typeof el.className === 'string' ? el.className.slice(0, 60) : '';
        return (
          `${el.tagName}|${t}|${el.getAttribute('aria-label') || el.getAttribute('title') || ''}|${el.getAttribute('data-testid') || ''}|${cls}` === k
        );
      },
      trasa[0].klucz,
    );
    if (wrocilo && trasa.length > 1) break;
  }

  // 3. Guziki bez tekstu i bez nazwy.
  const bezNazwy = await page.$$eval(
    'button, [role=button]',
    (els, opis) => {
      const f = new Function('return ' + opis)();
      const nazwa = (el) => {
        const by = el.getAttribute('aria-labelledby');
        const zBy = by ? (document.getElementById(by)?.innerText ?? '') : '';
        return (el.getAttribute('aria-label') || el.getAttribute('title') || zBy).trim();
      };
      const widoczny = (el) => {
        const r = el.getBoundingClientRect();
        if (el.getRootNode() !== document) return false;
        return r.width > 0 && r.height > 0 && el.getAttribute('aria-hidden') !== 'true';
      };
      return els
        .filter((el) => widoczny(el) && (el.innerText || '').trim() === '' && nazwa(el) === '')
        .map(f);
    },
    OPIS,
  );

  // 4. Obszar dotyku guzików komponentu `Button` (plan/05 sekcja 3), mierzony
  // w drugiej karcie z emulacją ekranu dotykowego (`pointer: coarse`).
  await touchPage.goto(BASE + sciezka);
  await touchPage.waitForLoadState('networkidle');
  const zaMale = await touchPage.$$eval(
    '[data-slot="button"]',
    (els, args) => {
      const [opis, hit, min] = args;
      const f = new Function('return ' + opis)();
      const g = new Function('return ' + hit)();
      return els
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (el.getRootNode() !== document) return false;
          return r.width > 0 && r.height > 0 && el.getAttribute('aria-hidden') !== 'true';
        })
        .map((el) => ({ ...f(el), box: g(el) }))
        .filter((x) => x.box.w < min || x.box.h < min);
    },
    [OPIS, HIT_BOX, MIN_DOTYK],
  );

  return { sciezka, widoczne, trasa, bezObwodki, bezNazwy, zaMale };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await zaloguj(page);

// Druga karta udaje ekran dotykowy (`hasTouch` plus `isMobile` daje w Chromium
// `pointer: coarse`), bo tylko tam włącza się halo 44 px wokół guzika.
const touchCtx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  hasTouch: true,
  isMobile: true,
});
const touchPage = await touchCtx.newPage();
await zaloguj(touchPage);

const wyniki = [];
for (const s of STRONY) wyniki.push(await audytStrony(page, s, touchPage));
await browser.close();

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'a11y-audit.json'), JSON.stringify(wyniki, null, 2));

let bledy = 0;
for (const w of wyniki) {
  console.log(`\n=== ${w.sciezka}`);
  console.log(`  elementów akcji widocznych: ${w.widoczne.length}`);
  console.log(`  osiągniętych Tabem:         ${w.trasa.length}`);
  console.log(`  bez obwódki ogniskowania:   ${w.bezObwodki.length}`);
  console.log(`  guziki bez nazwy:           ${w.bezNazwy.length}`);
  console.log(`  obszar dotyku < ${MIN_DOTYK} px:      ${w.zaMale.length}`);
  for (const x of w.bezObwodki) console.log(`    OBWÓDKA  ${x.tag} "${x.text || x.label}" ${x.cls}`);
  for (const x of w.bezNazwy) console.log(`    NAZWA    ${x.tag} ${x.cls}`);
  for (const x of w.zaMale)
    console.log(`    DOTYK    ${x.box.w}x${x.box.h} ${x.tag} "${x.text || x.label}" ${x.cls}`);
  bledy += w.bezObwodki.length + w.bezNazwy.length + w.zaMale.length;
}
console.log(`\nRAZEM naruszeń: ${bledy}`);
process.exit(bledy === 0 ? 0 : 1);
