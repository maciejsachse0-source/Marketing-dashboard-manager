/**
 * Harness, część stronowa. Mierzy 7 ścieżek z plan/03 sekcja 3:
 * rozgrzewka 3x, pomiar 11x, zapis p50, p95, rozmiaru odpowiedzi i statusu.
 *
 * Uruchomienie: node scripts/perf/measure-page.mjs
 * Zmienne: BASE_URL (domyślnie http://localhost:3000), AUTH_EMAIL, AUTH_PASSWORD,
 *          PERF_DATABASE_URL (tylko do zapisania hosta bazy w wyniku).
 * Wynik: perf/runs/page-<timestamp>.json oraz tabela na stdout.
 *
 * Logowanie: proxy w src/proxy.ts odbija każdą ścieżkę poza /login. Formularz
 * logowania jest server action, więc nie da się w niego strzelić samym
 * `POST /login` z email i hasłem — Next wymaga dodatkowo pól `$ACTION_*`,
 * które renderuje w HTML formularza dla wersji bez JavaScriptu. Skrypt czyta
 * je z HTML-a i przepisuje do żądania, czyli robi dokładnie to, co zrobiłaby
 * przeglądarka z wyłączonym JS. Dzięki temu nie duplikujemy tu podpisywania
 * ciasteczka i pomiar przechodzi tą samą ścieżką co użytkownik.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;

const WARMUP = 3;
const RUNS = 11;

if (!EMAIL || !PASSWORD) {
  console.error('[measure-page] AUTH_EMAIL i AUTH_PASSWORD muszą być w .env.local');
  process.exit(1);
}

const ids = JSON.parse(readFileSync('perf/fixtures-ids.json', 'utf8'));

// plan/03 sekcja 3. Kolejność ma znaczenie tylko dla czytelności tabeli.
const PATHS = {
  home: '/',
  calendar: '/calendar?week=2026-03-02',
  'calendar-table': '/calendar?week=2026-03-02&mode=table',
  productions: '/productions/list',
  'production-detail': `/productions/${ids.productionId}`,
  'campaign-detail': `/campaigns/${ids.campaignId}`,
  analytics: '/analytics',
};

function fail(msg) {
  console.error(`[measure-page] ${msg}`);
  console.error('[measure-page] pomiar nieważny, nic nie zapisano');
  process.exit(1);
}

/** Ciasteczko sesji zdobyte tak, jak zdobyłaby je przeglądarka bez JS. */
async function login() {
  let res;
  try {
    res = await fetch(`${BASE_URL}/login`, { redirect: 'manual' });
  } catch (e) {
    fail(`nie da się otworzyć ${BASE_URL}/login: ${e.message}`);
  }
  if (res.status !== 200) fail(`GET /login zwrócił ${res.status}, oczekiwano 200`);
  const html = await res.text();

  const form = new FormData();
  // Pola techniczne server action, w kolejności z HTML-a.
  const hidden = html.matchAll(/<input[^>]*name="(\$[^"]*)"[^>]*>/g);
  let seen = 0;
  for (const m of hidden) {
    const tag = m[0];
    const name = m[1].replaceAll('&quot;', '"');
    const value = /value="([^"]*)"/.exec(tag)?.[1] ?? '';
    form.append(
      name,
      value.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#x27;', "'"),
    );
    seen++;
  }
  if (seen === 0) fail('w HTML /login nie ma pól $ACTION_*, formularz zmienił kształt');

  form.append('email', EMAIL);
  form.append('password', PASSWORD);

  const post = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    body: form,
    redirect: 'manual',
  });

  const cookies = post.headers.getSetCookie?.() ?? [];
  const session = cookies.find((c) => c.startsWith('mc_session='));
  if (!session) {
    fail(`POST /login (status ${post.status}) nie zwrócił ciasteczka mc_session — sprawdź parę AUTH_EMAIL/AUTH_PASSWORD`);
  }
  return session.split(';')[0];
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function hit(url, cookie) {
  const t = process.hrtime.bigint();
  const res = await fetch(url, { headers: { cookie }, redirect: 'manual' });
  const body = await res.arrayBuffer();
  return {
    ms: Number(process.hrtime.bigint() - t) / 1e6,
    status: res.status,
    bytes: body.byteLength,
  };
}

const cookie = await login();

// Kontrola przytomności: gdyby ciasteczko nie działało, proxy oddałoby 307
// i wszystkie pomiary byłyby pomiarem przekierowania.
const probe = await hit(`${BASE_URL}/`, cookie);
if (probe.status !== 200) fail(`sesja nie działa, GET / zwróciło ${probe.status}`);

const results = {};

for (const [key, path] of Object.entries(PATHS)) {
  const url = `${BASE_URL}${path}`;
  // Rozgrzewka per URL, nie globalna: w dev pierwsze wejście kompiluje stronę.
  for (let i = 0; i < WARMUP; i++) {
    const w = await hit(url, cookie);
    if (w.status !== 200) fail(`${path} zwróciło ${w.status} w rozgrzewce, oczekiwano 200`);
  }

  const times = [];
  let bytes = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = await hit(url, cookie);
    if (r.status !== 200) fail(`${path} zwróciło ${r.status} w pomiarze, oczekiwano 200`);
    times.push(r.ms);
    bytes = r.bytes;
  }
  times.sort((a, b) => a - b);

  results[key] = {
    url: path,
    p50Ms: Number(percentile(times, 50).toFixed(1)),
    p95Ms: Number(percentile(times, 95).toFixed(1)),
    bytes,
    status: 200,
  };
}

/**
 * Rozmiar JS pierwszego ładowania `/calendar` po gzip.
 *
 * plan/03 sekcja 4 każe wziąć tę liczbę „z wyjścia next build". W Next 16.2.4
 * build na Turbopacku NIE drukuje już kolumn Size ani First Load JS (sprawdzone:
 * `next build --help` nie ma flagi, która by je przywróciła), więc liczymy to
 * samo bezpośrednio na wydanej stronie: bierzemy każdy skrypt, który /calendar
 * ładuje z /_next/static, i sumujemy jego rozmiar po gzip. To ta sama definicja,
 * tylko mierzona na działającym serwerze zamiast czytana z logu.
 */
async function calendarFirstLoadJsGzipKb(cookieHeader) {
  const res = await fetch(`${BASE_URL}${PATHS.calendar}`, {
    headers: { cookie: cookieHeader },
    redirect: 'manual',
  });
  const html = await res.text();
  const srcs = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)) srcs.add(m[1]);
  let total = 0;
  for (const src of srcs) {
    const r = await fetch(`${BASE_URL}${src}`, { headers: { 'accept-encoding': 'gzip' } });
    const buf = Buffer.from(await r.arrayBuffer());
    // fetch rozpakowuje odpowiedź, więc pakujemy z powrotem, żeby dostać
    // rozmiar „po gzip" niezależnie od tego, czy serwer skompresował plik.
    total += gzipSync(buf).byteLength;
  }
  return { files: srcs.size, gzipKb: Number((total / 1024).toFixed(1)) };
}

const bundle = await calendarFirstLoadJsGzipKb(cookie);

const perfUrl = process.env.PERF_DATABASE_URL;
const parsed = perfUrl ? new URL(perfUrl) : null;

const out = {
  kind: 'page',
  at: new Date().toISOString(),
  baseUrl: BASE_URL,
  dbUrlHost: parsed ? `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}` : null,
  warmup: WARMUP,
  runs: RUNS,
  bundle: { calendarFirstLoadKb: bundle.gzipKb, files: bundle.files },
  pages: results,
};

mkdirSync('perf/runs', { recursive: true });
const file = `perf/runs/page-${out.at.replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

console.log(`baza: ${out.dbUrlHost ?? 'nieznana'}, serwer: ${BASE_URL}`);
console.log('strona              p50 ms   p95 ms     bajtów');
for (const [key, r] of Object.entries(results)) {
  console.log(
    `${key.padEnd(19)} ${String(r.p50Ms).padStart(6)} ${String(r.p95Ms).padStart(8)} ${String(r.bytes).padStart(10)}`,
  );
}
console.log(`\nJS pierwszego ładowania /calendar: ${bundle.gzipKb} kB po gzip (${bundle.files} plików)`);
console.log(`\nzapisano ${file}`);
