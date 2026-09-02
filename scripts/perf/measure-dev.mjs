/**
 * Harness, część deweloperska. Algorytm z plan/03 sekcja 1.3: zimny `.next`,
 * start `npm run dev`, czas do "Ready", czas pierwszej kompilacji `/calendar`,
 * mediana kolejnych wejść, czas HMR po dotknięciu ganta, szczytowy RSS drzewa
 * procesów dev.
 *
 * Uruchomienie: npm run perf:dev [nazwa-skryptu-npm]   (domyślnie `dev`)
 * Wynik: perf/runs/dev-<timestamp>.json oraz tabela na stdout. W pliku ląduje
 * pole `bundler` (webpack albo turbopack) i `maxOldSpace`, żeby dało się
 * porównywać przebiegi wariantów — tego wymaga issue F2-05.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';

const BASE_URL = 'http://localhost:3000';
const SCRIPT = process.argv[2] ?? 'dev';
const SCRIPT_CMD = JSON.parse(readFileSync('package.json', 'utf8')).scripts[SCRIPT];
if (!SCRIPT_CMD) {
  console.error(`[measure-dev] w package.json nie ma skryptu "${SCRIPT}"`);
  process.exit(1);
}
const BUNDLER = SCRIPT_CMD.includes('--turbopack') ? 'turbopack' : 'webpack';
const MAX_OLD_SPACE = /max-old-space-size=(\d+)/.exec(SCRIPT_CMD)?.[1] ?? null;
const GANTT = 'src/components/calendar/gantt-view.tsx';
const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('[measure-dev] AUTH_EMAIL i AUTH_PASSWORD muszą być w .env.local');
  process.exit(1);
}

/** Suma RSS procesu i całego jego potomstwa. Next dev trzyma kompilator
 *  w osobnym procesie, więc mierzenie samego rodzica pokazywałoby ułamek
 *  prawdy o zużyciu pamięci. */
function treeRssMb(rootPid) {
  let out;
  try {
    out = execSync('ps -eo pid,ppid,rss', { encoding: 'utf8' });
  } catch {
    return 0;
  }
  const byParent = new Map();
  const rss = new Map();
  for (const line of out.trim().split('\n').slice(1)) {
    const [pid, ppid, kb] = line.trim().split(/\s+/).map(Number);
    if (!Number.isFinite(pid)) continue;
    rss.set(pid, kb);
    if (!byParent.has(ppid)) byParent.set(ppid, []);
    byParent.get(ppid).push(pid);
  }
  let total = 0;
  const stack = [rootPid];
  const seen = new Set();
  while (stack.length) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    total += rss.get(pid) ?? 0;
    for (const child of byParent.get(pid) ?? []) stack.push(child);
  }
  return total / 1024;
}

async function login() {
  const res = await fetch(`${BASE_URL}/login`, { redirect: 'manual' });
  const html = await res.text();
  const form = new FormData();
  for (const m of html.matchAll(/<input[^>]*name="(\$[^"]*)"[^>]*>/g)) {
    const value = /value="([^"]*)"/.exec(m[0])?.[1] ?? '';
    form.append(m[1], value.replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
  }
  form.append('email', EMAIL);
  form.append('password', PASSWORD);
  const post = await fetch(`${BASE_URL}/login`, { method: 'POST', body: form, redirect: 'manual' });
  const cookie = (post.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('mc_session='));
  if (!cookie) throw new Error('POST /login nie zwrócił ciasteczka mc_session');
  return cookie.split(';')[0];
}

async function timedGet(path, cookie) {
  const t = process.hrtime.bigint();
  const res = await fetch(`${BASE_URL}${path}`, { headers: { cookie }, redirect: 'manual' });
  await res.arrayBuffer();
  return { ms: Number(process.hrtime.bigint() - t) / 1e6, status: res.status };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

rmSync('.next', { recursive: true, force: true });

const started = process.hrtime.bigint();
// detached: własna grupa procesów, żeby na końcu dało się ubić CAŁE drzewo
// (npm → next dev → workery kompilatora) jednym `kill(-pid)`. Bez tego next
// zostaje w tle i następny pomiar mierzy rozgrzany serwer.
const dev = spawn('npm', ['run', SCRIPT], { env: process.env, detached: true });

let peakRssMb = 0;
const sampler = setInterval(() => {
  peakRssMb = Math.max(peakRssMb, treeRssMb(dev.pid));
}, 1000);

const readyMs = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('dev server nie wystartował w 120 s')), 120_000);
  const onData = (buf) => {
    process.stdout.write(`[dev] ${buf}`);
    if (/Ready in/.test(String(buf))) {
      clearTimeout(timer);
      resolve(Number(process.hrtime.bigint() - started) / 1e6);
    }
  };
  dev.stdout.on('data', onData);
  dev.stderr.on('data', (b) => process.stderr.write(`[dev] ${b}`));
  dev.on('exit', (c) => reject(new Error(`dev server zakończył się kodem ${c}`)));
});

let out;
try {
  const cookie = await login();

  const first = await timedGet('/calendar', cookie);
  if (first.status !== 200) throw new Error(`/calendar zwróciło ${first.status}`);
  const firstCompileMs = first.ms;

  const warm = [];
  for (let i = 0; i < 5; i++) warm.push((await timedGet('/calendar', cookie)).ms);
  const warmP50Ms = median(warm);

  // HMR: podmieniamy w gancie NAPIS, który trafia do HTML-a, i mierzymy, po
  // jakim czasie serwer oddaje stronę z nowym napisem. Oryginał wraca na
  // miejsce w finally.
  //
  // Poprzednia wersja (dopisz komentarz na końcu pliku i czekaj na odpowiedź
  // trzy razy wolniejszą od rozgrzanej) działała dla webpacka i NIE działała
  // dla turbopacka: ten przebudowuje moduł tak szybko, że żadna odpowiedź nie
  // przekracza progu i pomiar wywalał się z komunikatem „nie zaobserwowano
  // przebudowy". Porównanie całych odpowiedzi też odpada — dwa identyczne
  // żądania różnią się między sobą (identyfikatory Reacta). Marker w treści
  // znaczy dokładnie „serwer oddaje już przekompilowany moduł" i znaczy to
  // samo dla obu bundlerów.
  const TOUCH_ANCHOR = 'Outreach + ustalenia';
  const TOUCH_MARK = `PERFTOUCH${Date.now()}`;
  const original = readFileSync(GANTT, 'utf8');
  if (!original.includes(TOUCH_ANCHOR)) {
    throw new Error(`w ${GANTT} nie ma napisu "${TOUCH_ANCHOR}" — pomiar HMR nie ma czego podmienić`);
  }
  let hmrMs = null;
  const tHmr = process.hrtime.bigint();
  try {
    writeFileSync(GANTT, original.replace(TOUCH_ANCHOR, `${TOUCH_ANCHOR} ${TOUCH_MARK}`));
    while (Number(process.hrtime.bigint() - tHmr) / 1e6 < 30_000) {
      const res = await fetch(`${BASE_URL}/calendar`, { headers: { cookie }, redirect: 'manual' });
      const body = await res.text();
      if (res.status !== 200) throw new Error(`po dotknięciu ganta strona zwróciła ${res.status}`);
      if (body.includes(TOUCH_MARK)) {
        hmrMs = Number(process.hrtime.bigint() - tHmr) / 1e6;
        break;
      }
    }
  } finally {
    writeFileSync(GANTT, original);
  }
  if (hmrMs === null) {
    throw new Error('w 30 s od zapisu ganta serwer nie oddał strony z nowym napisem');
  }

  peakRssMb = Math.max(peakRssMb, treeRssMb(dev.pid));

  out = {
    kind: 'dev',
    at: new Date().toISOString(),
    script: SCRIPT,
    bundler: BUNDLER,
    maxOldSpace: MAX_OLD_SPACE ? Number(MAX_OLD_SPACE) : null,
    readyMs: Math.round(readyMs),
    firstCompileMs: Math.round(firstCompileMs),
    warmP50Ms: Math.round(warmP50Ms),
    hmrMs: Math.round(hmrMs),
    peakRssMb: Math.round(peakRssMb),
  };
} finally {
  clearInterval(sampler);
  dev.removeAllListeners('exit');
  try {
    process.kill(-dev.pid, 'SIGTERM');
  } catch {
    try {
      dev.kill('SIGTERM');
    } catch {
      /* proces już nie żyje */
    }
  }
}

mkdirSync('perf/runs', { recursive: true });
const file = `perf/runs/dev-${BUNDLER}-${out.at.replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

console.log(`\nskrypt: ${SCRIPT} (${BUNDLER}${MAX_OLD_SPACE ? `, --max-old-space-size=${MAX_OLD_SPACE}` : ', bez flagi pamięci'})`);
console.log('\nmetryka             wartość');
for (const k of ['readyMs', 'firstCompileMs', 'warmP50Ms', 'hmrMs', 'peakRssMb']) {
  console.log(`${k.padEnd(19)} ${String(out[k]).padStart(7)}`);
}
console.log(`\nzapisano ${file}`);
process.exit(0);
