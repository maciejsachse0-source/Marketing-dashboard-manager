/**
 * Harness, część deweloperska. Algorytm z plan/03 sekcja 1.3: zimny `.next`,
 * start `npm run dev`, czas do "Ready", czas pierwszej kompilacji `/calendar`,
 * mediana kolejnych wejść, czas HMR po dotknięciu ganta, szczytowy RSS drzewa
 * procesów dev.
 *
 * Uruchomienie: npm run perf:dev
 * Wynik: perf/runs/dev-<timestamp>.json oraz tabela na stdout.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';

const BASE_URL = 'http://localhost:3000';
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
const dev = spawn('npm', ['run', 'dev'], { env: process.env, detached: true });

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

  // HMR: dopisujemy komentarz na końcu pliku ganta i mierzymy, po jakim czasie
  // serwer oddaje PRZEKOMPILOWANĄ stronę. Oryginał wraca na miejsce w finally.
  //
  // Pułapka, w którą wdepnąłem: pierwsze GET po zapisie potrafi wrócić w 50 ms,
  // bo obserwator plików jeszcze nie zauważył zmiany i serwer oddaje starą,
  // skompilowaną wersję. Zapisany wtedy „hmrMs = 54" jest pomiarem niczego.
  // Dlatego czekamy na odpowiedź wyraźnie wolniejszą od rozgrzanej — to jest ta,
  // w której webpack faktycznie przebudował moduł. Gdy taka nie przyjdzie
  // w 30 s, wolimy wywalić pomiar niż zapisać ładną liczbę bez pokrycia.
  const recompileThresholdMs = Math.max(warmP50Ms * 3, 150);
  const original = readFileSync(GANTT, 'utf8');
  let hmrMs = null;
  const tHmr = process.hrtime.bigint();
  try {
    writeFileSync(GANTT, `${original}\n// perf-touch ${Date.now()}\n`);
    while (Number(process.hrtime.bigint() - tHmr) / 1e6 < 30_000) {
      const r = await timedGet('/calendar', cookie);
      if (r.status !== 200) throw new Error(`po dotknięciu ganta strona zwróciła ${r.status}`);
      if (r.ms > recompileThresholdMs) {
        hmrMs = Number(process.hrtime.bigint() - tHmr) / 1e6;
        break;
      }
    }
  } finally {
    writeFileSync(GANTT, original);
  }
  if (hmrMs === null) {
    throw new Error(
      `w 30 s od zapisu ganta nie zaobserwowano przebudowy (żadna odpowiedź nie przekroczyła ${Math.round(recompileThresholdMs)} ms)`,
    );
  }

  peakRssMb = Math.max(peakRssMb, treeRssMb(dev.pid));

  out = {
    kind: 'dev',
    at: new Date().toISOString(),
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
const file = `perf/runs/dev-${out.at.replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

console.log('\nmetryka             wartość');
for (const k of ['readyMs', 'firstCompileMs', 'warmP50Ms', 'hmrMs', 'peakRssMb']) {
  console.log(`${k.padEnd(19)} ${String(out[k]).padStart(7)}`);
}
console.log(`\nzapisano ${file}`);
process.exit(0);
