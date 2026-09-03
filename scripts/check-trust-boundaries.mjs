/**
 * Granice zaufania (zasada Z13, issue F6-02).
 *
 * Wypisuje KAŻDY publiczny punkt wejścia — handler w `src/app/api/` i eksportowaną
 * akcję serwerową z `src/server/actions/` — razem ze schematem Zod, który sprawdza
 * jego wejście. Punkt wejścia bez schematu i bez argumentów jest opisany jako
 * „brak wejścia"; punkt wejścia z argumentami i bez schematu to błąd i kod 1.
 *
 * Uruchomienie: `node scripts/check-trust-boundaries.mjs`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function plikiPod(dir, nazwa) {
  const out = [];
  for (const wpis of readdirSync(dir)) {
    const pelna = path.join(dir, wpis);
    if (statSync(pelna).isDirectory()) out.push(...plikiPod(pelna, nazwa));
    else if (nazwa(wpis)) out.push(pelna);
  }
  return out;
}

/** Wyciąga schematy Zod użyte w kawałku kodu. */
function schematy(kod) {
  const znalezione = new Set();
  for (const m of kod.matchAll(/([A-Za-z_][\w.]*(?:\([^)]*\))?)\s*\.\s*(?:safeParse|parse)\s*\(/g)) {
    const nazwa = m[1];
    if (/^(Date|JSON|Number|url|new URL)/.test(nazwa)) continue;
    znalezione.add(nazwa);
  }
  return [...znalezione];
}

/** Dzieli plik na bloki: jeden eksportowany symbol, jedno ciało. */
function bloki(kod, wzorzec) {
  const trafienia = [...kod.matchAll(wzorzec)];
  return trafienia.map((m, i) => {
    const start = m.index;
    const koniec = i + 1 < trafienia.length ? trafienia[i + 1].index : kod.length;
    return { nazwa: m[1], cialo: kod.slice(start, koniec) };
  });
}

/** Czy funkcja w ogóle bierze argumenty? Bez argumentów nie ma czego walidować. */
function maArgumenty(cialo) {
  const otw = cialo.indexOf('(');
  const zam = cialo.indexOf(')', otw);
  return cialo.slice(otw + 1, zam).trim().length > 0;
}

const wiersze = [];
let bledy = 0;

for (const plik of plikiPod(path.join(ROOT, 'src/app/api'), (n) => n === 'route.ts')) {
  const kod = readFileSync(plik, 'utf8');
  const wzgl = path.relative(ROOT, plik);
  for (const b of bloki(kod, /export async function (GET|POST|PUT|PATCH|DELETE)\s*\(/g)) {
    const s = schematy(b.cialo);
    // Handler bez parametru nie dostaje `Request`, więc nie czyta ani ciała, ani
    // adresu, ani nagłówków zapytania — nie ma tam wejścia do sprawdzenia. Ta sama
    // reguła co dla akcji serwerowych niżej (F7-18, `src/app/api/health/route.ts`).
    const argumenty = maArgumenty(b.cialo);
    wiersze.push({ plik: wzgl, punkt: b.nazwa, schematy: s, argumenty });
    if (s.length === 0 && argumenty) bledy += 1;
  }
}

for (const plik of plikiPod(path.join(ROOT, 'src/server/actions'), (n) => n.endsWith('.ts'))) {
  const kod = readFileSync(plik, 'utf8');
  if (!kod.startsWith("'use server'")) continue;
  const wzgl = path.relative(ROOT, plik);
  for (const b of bloki(kod, /export async function (\w+)\s*\(/g)) {
    const s = schematy(b.cialo);
    const argumenty = maArgumenty(b.cialo);
    wiersze.push({ plik: wzgl, punkt: b.nazwa, schematy: s, argumenty });
    if (s.length === 0 && argumenty) bledy += 1;
  }
}

const szer = Math.max(...wiersze.map((w) => w.punkt.length));
let plikTeraz = '';
for (const w of wiersze) {
  if (w.plik !== plikTeraz) {
    plikTeraz = w.plik;
    console.log(`\n${plikTeraz}`);
  }
  const opis =
    w.schematy.length > 0
      ? w.schematy.join(', ')
      : w.argumenty === false
        ? 'brak wejścia (funkcja bezargumentowa)'
        : 'BRAK SCHEMATU';
  console.log(`  ${w.punkt.padEnd(szer)}  ${opis}`);
}

console.log(`\nPunktów wejścia: ${wiersze.length}. Bez schematu mimo argumentów: ${bledy}.`);
process.exit(bledy === 0 ? 0 : 1);
